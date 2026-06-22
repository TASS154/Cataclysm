import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./config/firebase";
import { useTheme } from "./hooks/useTheme";
import ThemeToggle from "./components/ThemeToggle";
import DiceRoller from "./components/DiceRoller";
import CharacterSheet from "./components/CharacterSheet";
import MapView from "./components/MapView";
import JoinPage from "./pages/JoinPage";
import RulesPage from "./pages/RulesPage";
import NotesPage from "./pages/NotesPage";
import GmLibraryPage from "./pages/GmLibraryPage";
import ImportExportModal from "./components/ImportExportModal";
import CreateSessionWizard from "./components/CreateSessionWizard";
import ChangelogModal from "./components/ChangelogModal";
import { hasUnreadChangelog } from "./data/changelogData";
import { UserProvider } from "./context/UserContext";
import { createSession } from "./services/sessionService";
import "./RPGPlayerEditor.css";

const emptySheet = {
  name: "New Character",
  isMain: true,
  level: 1,
  image: "",
  bars: { inata: 10, ether: 10, vigor: 10, hp: 20, maxHp: 20, sanity: 100, maxSanity: 100 },
  stats: {
    for: 10,
    des: 10,
    sab: 10,
    int: 10,
    car: 10,
    con: 10,
    arteDivina: 0,
    inata: 0,
    magica: 0,
  },
  characterInfo: {
    class: "",
    race: "",
    background: "",
    alignment: "",
    age: "",
    height: "",
    weight: "",
    dominantField: ""
  },
  abilities: [],
  inventory: [],
  equipment: {
    armorMode: "set",
    armorSet: { name: "", notes: "" },
    armorPieces: {
      head: "",
      chest: "",
      hands: "",
      legs: "",
      feet: "",
      accessory: "",
    },
    weapons: [],
    carried: [],
  },
  coins: { gold: 0, silver: 0 },
  traits: [],
  effects: [],
  notes: "",
  documents: [],
  galleryImages: [],
  lore: "",
  caArmorMod: 0,
  modes: [],
  diceShortcuts: [],
  focusType: "inspiration", // "inspiration" | "certainty"
  focusPoints: 0,
  pendingRollPower: null, // null | "inspiration" | "certainty"
  createdAt: Date.now(),
  owner: "",
};

function getEffectiveStats(sheet) {
  const base = sheet.stats || {};
  const modes = (sheet.modes || []).filter((m) => m.active);
  const mods = {};
  modes.forEach((m) => {
    Object.entries(m.modifiers || {}).forEach(([k, v]) => {
      mods[k] = (mods[k] || 0) + Number(v);
    });
  });
  const allKeys = Object.keys({ ...emptySheet.stats, ...base });
  return Object.fromEntries(
    allKeys.map((k) => [k, (Number(base[k]) || 0) + (Number(mods[k]) || 0)])
  );
}

function buildUpdatedSheet(found, emptySheet) {
  return {
    ...emptySheet,
    ...found,
    bars: {
      ...emptySheet.bars,
      ...found.bars,
      sanity: found.bars?.sanity !== undefined ? found.bars.sanity : emptySheet.bars.sanity,
      maxSanity: 100
    },
    stats: { ...emptySheet.stats, ...found.stats },
    characterInfo: found.characterInfo || emptySheet.characterInfo,
    coins: found.coins || { gold: 0, silver: 0 },
    inventory: found.inventory || [],
    equipment: {
      ...emptySheet.equipment,
      ...(found.equipment || {}),
      armorSet: {
        ...emptySheet.equipment.armorSet,
        ...(found.equipment?.armorSet || {}),
      },
      armorPieces: {
        ...emptySheet.equipment.armorPieces,
        ...(found.equipment?.armorPieces || {}),
      },
      weapons: Array.isArray(found.equipment?.weapons) ? found.equipment.weapons : [],
      carried: Array.isArray(found.equipment?.carried) ? found.equipment.carried : [],
    },
    abilities: (found.abilities || []).map(ability => ({
      ...ability,
      cost: typeof ability.cost === "number" ? ability.cost : (typeof ability.cost === "string" ? (ability.cost === "" ? 0 : Number(ability.cost) || 0) : 0)
    })),
    traits: found.traits || [],
    documents: found.documents || [],
    galleryImages: Array.isArray(found.galleryImages) ? found.galleryImages : [],
    lore: found.lore != null ? found.lore : "",
    modes: found.modes || [],
    diceShortcuts: found.diceShortcuts || [],
    focusType: found.focusType === "certainty" ? "certainty" : "inspiration",
    focusPoints: Number(found.focusPoints) || 0,
    pendingRollPower: found.pendingRollPower || null,
    effects: (found.effects || []).map(effect => ({
      ...effect,
      rounds: effect.rounds !== undefined ? effect.rounds : 0,
      damage: effect.damage !== undefined ? effect.damage : 0,
      effect: effect.effect || "",
      drainType: effect.drainType || "",
      drainAmount: effect.drainAmount !== undefined ? effect.drainAmount : 0
    })),
  };
}

function getBarMaxes(sheet) {
  const level = Number(sheet.level) || 1;
  return {
    hp: Number(sheet?.bars?.maxHp) || Number(sheet?.bars?.hp) || 0,
    inata: Number(sheet?.bars?.maxInata) || level * 200,
    ether: Number(sheet?.bars?.maxEther) || level * 100,
    vigor: Number(sheet?.bars?.maxVigor) || level * 50,
  };
}

function isCharacterHealthyForLongRest(sheet) {
  const maxes = getBarMaxes(sheet);
  const bars = sheet?.bars || {};
  const hasIncompleteBar =
    (Number(bars.hp) || 0) < maxes.hp ||
    (Number(bars.inata) || 0) < maxes.inata ||
    (Number(bars.ether) || 0) < maxes.ether ||
    (Number(bars.vigor) || 0) < maxes.vigor;
  const hasNegativeStates = Array.isArray(sheet?.effects) && sheet.effects.length > 0;
  return !hasIncompleteBar && !hasNegativeStates;
}

function applyShortRest(sheet) {
  const s = JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const maxes = getBarMaxes(s);
  const current = {
    hp: Number(s.bars.hp) || 0,
    inata: Number(s.bars.inata) || 0,
    ether: Number(s.bars.ether) || 0,
    vigor: Number(s.bars.vigor) || 0,
  };
  s.bars.hp = Math.min(maxes.hp, current.hp + Math.ceil(maxes.hp / 2));
  s.bars.inata = Math.min(maxes.inata, current.inata + Math.ceil(maxes.inata / 2));
  s.bars.ether = Math.min(maxes.ether, current.ether + Math.ceil(maxes.ether / 2));
  s.bars.vigor = Math.min(maxes.vigor, current.vigor + Math.ceil(maxes.vigor / 2));
  return s;
}

function applyLongRest(sheet) {
  const s = JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const maxes = getBarMaxes(s);
  const healthyBeforeRest = isCharacterHealthyForLongRest(s);

  if (!healthyBeforeRest) {
    s.bars.hp = maxes.hp;
    s.bars.inata = maxes.inata;
    s.bars.ether = maxes.ether;
    s.bars.vigor = maxes.vigor;
    s.effects = [];
    return s;
  }

  if (s.focusType === "certainty" && Number(s.focusPoints) > 0) {
    return s;
  }

  s.focusType = "inspiration";
  const current = Number(s.focusPoints) || 0;
  const next = Math.min(3, current + 1);
  s.focusPoints = next;

  if (next >= 3) {
    const convert = window.confirm(
      "Você chegou a 3 Inspirações.\nDeseja converter agora para 1 Certeza?\n\nOK = Converter | Cancelar = Manter 3 Inspirações"
    );
    if (convert) {
      s.focusType = "certainty";
      s.focusPoints = 1;
    }
  }
  return s;
}

function useIsMobile(breakpoint = 980) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

function EditorLayout({
  sessionId,
  username,
  characters,
  selectedId,
  setSelectedId,
  sheet,
  setSheet,
  emptySheet,
  saveSheet,
  saveStatus,
  deleteCharacter,
  handleLogout,
  loading,
  navigate,
  contentTab,
  setContentTab,
  onRequestRest,
  onActivateFocus,
  onOpenImportExport,
  onOpenSessionWizard,
}) {
  const effectiveStats = useMemo(() => getEffectiveStats(sheet), [sheet]);
  const isMobile = useIsMobile(980);
  const [mobileContentTab, setMobileContentTab] = useState("sheet");
  return (
    <>
      <div className="container">
        <div className="app-grid">
          <aside className="sidebar">
            <div className="sidebar-user">
              <span className="sidebar-username">{username}</span>
            </div>
            <nav className="sidebar-nav">
              <div className="nav-group">
                <span className="nav-group-label">Fichas</span>
                <button
                  className="btn-primary fullwidth"
                  onClick={() => {
                    const n = {
                      ...emptySheet,
                      name: "Nova Ficha " + (characters.length + 1),
                      owner: username,
                      isMain: characters.length === 0,
                    };
                    setSheet(n);
                    saveSheet(n);
                  }}
                >
                  + Nova ficha
                </button>
              </div>
              <div className="nav-group">
                <span className="nav-group-label">Sessão</span>
                <button
                  className="btn-primary fullwidth"
                  onClick={() => onOpenSessionWizard && onOpenSessionWizard()}
                >
                  Criar sessão (assistente)
                </button>
                <button
                  className="btn-outline fullwidth"
                  onClick={async () => {
                    try {
                      const id = await createSession(username, 20, 15);
                      navigate("/session/" + id);
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao criar sessão: " + err.message);
                    }
                  }}
                >
                  Criar sessão rápida
                </button>
                <button
                  className="btn-outline fullwidth"
                  onClick={() => navigate("/biblioteca")}
                  title="Imagens e sons para usar nas sessões"
                >
                  📚 Biblioteca do Mestre
                </button>
                <button
                  className="btn-primary fullwidth"
                  onClick={() => navigate("/join")}
                >
                  Entrar na sessão
                </button>
              </div>
              <div className="nav-group">
                <span className="nav-group-label">Conta</span>
                <button
                  type="button"
                  className="btn-primary fullwidth"
                  onClick={() => navigate("/notas")}
                  title="Suas notas pessoais (não atreladas a uma ficha específica)"
                >
                  📝 Notas de Perfil
                </button>
                <button
                  type="button"
                  className="btn-outline fullwidth"
                  onClick={() => onOpenImportExport && onOpenImportExport("export")}
                  disabled={!sheet || (!sheet.id && !sheet.name)}
                  title="Exportar a ficha selecionada em JSON"
                >
                  ⬆️ Exportar ficha
                </button>
                <button
                  type="button"
                  className="btn-outline fullwidth"
                  onClick={() => onOpenImportExport && onOpenImportExport("import")}
                  title="Importar ficha de um arquivo JSON"
                >
                  ⬇️ Importar ficha
                </button>
              </div>
              <div className="nav-group">
                <button
                  type="button"
                  className="btn-outline fullwidth"
                  onClick={() => navigate("/regras")}
                >
                  Regras
                </button>
              </div>
              <div className="nav-group nav-group-end">
                <button className="btn-danger fullwidth" onClick={handleLogout}>
                  Sair
                </button>
              </div>
            </nav>
            <div className="sidebar-list-wrap">
              <span className="nav-group-label">Suas fichas</span>
              <div className="list-scroll">
                {loading ? (
                  <div className="muted">Carregando...</div>
                ) : (
                  characters.map((c) => (
                    <div
                      key={c.id}
                      className={`char-item ${selectedId === c.id ? "selected" : ""}`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="char-info">
                        <div className="char-name">{c.name}</div>
                        <div className="char-sub muted">{c.isMain ? "Principal" : "Familiar"}</div>
                      </div>
                      <div className="char-actions">
                        <button
                          className="btn-danger small"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCharacter(c.id);
                          }}
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

              {selectedId && sheet.effects && sheet.effects.length > 0 && (
                <div className="status-sidebar-section">
                  <h3 className="status-sidebar-title">Status Sofridos</h3>
                  <div className="status-sidebar-list">
                    {sheet.effects.map((ef) => {
                      const rounds = ef.rounds !== undefined ? ef.rounds : 0;
                      const damage = ef.damage !== undefined ? ef.damage : 0;
                      return (
                        <div key={ef.id} className="status-sidebar-item">
                          <div className="status-sidebar-item-info">
                            <div className="status-sidebar-item-name">{ef.name}</div>
                            {rounds > 0 && (
                              <div className="status-sidebar-item-rounds">{rounds} rodada{rounds !== 1 ? "s" : ""}</div>
                            )}
                            {damage > 0 && (
                              <div className="status-sidebar-item-damage">-{damage} HP/rodada</div>
                            )}
                          </div>
                          {rounds > 0 && (
                            <button
                              className="btn-primary small"
                              onClick={() => {
                                const s = JSON.parse(JSON.stringify(sheet));
                                const condition = s.effects.find(e => e.id === ef.id);
                                if (!condition) return;

                                const newRounds = (condition.rounds || 0) - 1;

                                if (condition.damage > 0) {
                                  const currentHp = s.bars?.hp || 0;
                                  s.bars.hp = Math.max(0, currentHp - condition.damage);
                                }

                                if (newRounds <= 0) {
                                  s.effects = s.effects.filter(e => e.id !== ef.id);
                                } else {
                                  condition.rounds = newRounds;
                                }

                                setSheet(s);
                                saveSheet(s);
                              }}
                              title="Aplicar condição (reduz 1 rodada e aplica dano)"
                            >
                              Aplicar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </aside>

          <main className="editor">
            {sessionId && (
              <div className="editor-tabs">
                <button type="button" className={contentTab === "sheet" ? "editor-tab active" : "editor-tab"} onClick={() => setContentTab("sheet")}>Ficha</button>
                <button type="button" className={contentTab === "map" ? "editor-tab active" : "editor-tab"} onClick={() => setContentTab("map")}>Mapa</button>
              </div>
            )}
            {(!sessionId || contentTab === "sheet") ? (
              <>
                <div className="editor-header">
                  <div className="character-header">
                    {sheet.image && (
                      <img src={sheet.image} alt="Character" className="character-image" />
                    )}
                    <div className="character-info">
                      <input
                        className="title-input"
                        value={sheet.name}
                        onChange={(e) => setSheet({ ...sheet, name: e.target.value })}
                        onBlur={() => saveSheet(sheet)}
                      />
                      <div className="level-input">
                        <label>Nível</label>
                        <input
                          type="number"
                          value={sheet.level || ""}
                          onChange={(e) => setSheet({ ...sheet, level: e.target.value === "" ? 0 : Number(e.target.value) })}
                          onBlur={() => saveSheet(sheet)}
                          className="input-number"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="header-controls">
                    <input
                      type="text"
                      placeholder="URL da imagem"
                      value={sheet.image || ""}
                      onChange={(e) => setSheet({ ...sheet, image: e.target.value })}
                      onBlur={() => saveSheet(sheet)}
                      className="input-login"
                    />
                    <label className="muted">Principal</label>
                    <input
                      type="checkbox"
                      checked={sheet.isMain || false}
                      onChange={(e) => {
                        const s = { ...sheet, isMain: e.target.checked };
                        setSheet(s);
                        saveSheet(s);
                      }}
                    />
                    <button className="btn-success" onClick={() => saveSheet(sheet)}>
                      Salvar
                    </button>
                    {saveStatus !== "idle" && (
                      <span
                        className={`save-status save-status--${saveStatus}`}
                        role="status"
                        aria-live="polite"
                      >
                        {saveStatus === "saving" && "Salvando…"}
                        {saveStatus === "saved" && "Salvo"}
                        {saveStatus === "error" && "Erro ao salvar"}
                      </span>
                    )}
                  </div>
                </div>

                {isMobile && (
                  <div className="mobile-sheet-tabs">
                    <button
                      type="button"
                      className={mobileContentTab === "sheet" ? "editor-tab active" : "editor-tab"}
                      onClick={() => setMobileContentTab("sheet")}
                    >
                      Ficha
                    </button>
                    <button
                      type="button"
                      className={mobileContentTab === "dice" ? "editor-tab active" : "editor-tab"}
                      onClick={() => setMobileContentTab("dice")}
                    >
                      Dados
                    </button>
                  </div>
                )}

                {(!isMobile || mobileContentTab === "sheet") && (
                  <CharacterSheet
                    sheet={sheet}
                    effectiveStats={effectiveStats}
                    onUpdateSheet={setSheet}
                    onSave={() => saveSheet(sheet)}
                    username={username}
                    characterId={selectedId}
                    onRequestRest={onRequestRest}
                    onActivateFocus={onActivateFocus}
                  />
                )}
                {isMobile && mobileContentTab === "dice" && (
                  <div className="mobile-dice-wrap">
                    <DiceRoller
                      sheet={sheet}
                      effectiveStats={effectiveStats}
                      onUpdateSheet={setSheet}
                      username={username}
                      onRollComplete={(rollData) => {
                        console.log("Roll completed:", rollData);
                      }}
                      onConsumePendingRollPower={(power) => {
                        if (!power) return;
                        const next = { ...sheet, pendingRollPower: null };
                        setSheet(next);
                        setTimeout(() => saveSheet(next), 0);
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <MapView sessionId={sessionId} embedded onBack={() => navigate("/")} />
            )}
          </main>

          {!isMobile && (
            <aside className="right-aside">
              <DiceRoller
                sheet={sheet}
                effectiveStats={effectiveStats}
                onUpdateSheet={setSheet}
                username={username}
                onRollComplete={(rollData) => {
                  console.log("Roll completed:", rollData);
                }}
                onConsumePendingRollPower={(power) => {
                  if (!power) return;
                  const next = { ...sheet, pendingRollPower: null };
                  setSheet(next);
                  setTimeout(() => saveSheet(next), 0);
                }}
              />
            </aside>
          )}
        </div>

        <footer className="footer">
          Conectado ao Firestore. Sistema de fichas de RPG melhorado.
        </footer>
      </div>
    </>
  );
}

function SessionLayoutWrapper(editorLayoutProps) {
  const { sessionId } = useParams();
  return <EditorLayout sessionId={sessionId} {...editorLayoutProps} />;
}

export default function RPGPlayerEditor() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, toggleTheme] = useTheme(username);

  const [sheet, setSheet] = useState(emptySheet);
  const [contentTab, setContentTab] = useState("sheet");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [importExportState, setImportExportState] = useState({ open: false, mode: "export" });
  const [sessionWizardOpen, setSessionWizardOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [showChangelogBadge, setShowChangelogBadge] = useState(() => hasUnreadChangelog());
  const savePendingRef = useRef(0);
  const saveStatusTimerRef = useRef(null);
  const navigate = useNavigate();

  const defaultTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Cataclysm"
  );

  useEffect(() => {
    if (!isLoggedIn) {
      document.title = defaultTitleRef.current || "Cataclysm";
      return;
    }
    const name = (sheet?.name && String(sheet.name).trim()) || "Ficha";
    document.title = `${name} · Cataclysm`;
  }, [isLoggedIn, sheet?.name]);

  // Login Handling
  const handleLogin = async (e) => {
    e.preventDefault();
    const u = (username || "").trim();
    const p = password || "";
    if (!u || !p) {
      setLoginError("Por favor, preencha nome de usuário e senha.");
      return;
    }

    try {
      // Normaliza username para evitar espaços no início/fim.
      if (u !== username) setUsername(u);
      const userRef = doc(db, "users", u);
      const userQuery = query(collection(db, "users"), where("username", "==", u));
      const userSnapshot = await onSnapshot(userQuery, async (snap) => {
        if (snap.empty) {
          await setDoc(userRef, { username: u, password: p });
          setIsLoggedIn(true);
          setLoginError("");
        } else {
          const userData = snap.docs[0].data();
          if (userData.password === p) {
            setIsLoggedIn(true);
            setLoginError("");
          } else {
            setLoginError("Senha incorreta.");
          }
        }
      });
      return () => userSnapshot();
    } catch (err) {
      console.error("Login error", err);
      setLoginError("Erro ao fazer login: " + err.message);
    }
  };

  // Firestore CRUD: only update list from snapshot; do NOT overwrite sheet on every snapshot (that would steal focus while typing)
  useEffect(() => {
    if (!isLoggedIn) return;

    const col = collection(db, `users/${username}/characters`);
    const unsub = onSnapshot(col, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.isMain === b.isMain ? 0 : a.isMain ? -1 : 1));
      setCharacters(arr);
      setLoading(false);

      const mainCharacters = arr.filter((c) => c.isMain);
      if (mainCharacters.length > 0) {
        const latestMain = mainCharacters.reduce((latest, current) =>
          current.createdAt > latest.createdAt ? current : latest
        );
        setSelectedId((prev) => (prev === null ? latestMain.id : prev));
        // Only set sheet on initial load (no selection yet); do not overwrite while user is editing
        setSheet((prev) => (!prev.id && !prev.owner) ? buildUpdatedSheet(latestMain, emptySheet) : prev);
      } else {
        setSelectedId(null);
        setSheet((prev) => (prev.owner === username ? prev : { ...emptySheet, owner: username }));
      }
    });

    return () => unsub();
  }, [isLoggedIn, username]);

  // Sync sheet from Firestore only when user switches character (selectedId changes), not on every characters update
  const prevSelectedIdRef = useRef(null);
  useEffect(() => {
    if (!selectedId) return;
    const found = characters.find((c) => c.id === selectedId);
    if (!found) return;
    if (prevSelectedIdRef.current !== selectedId) {
      prevSelectedIdRef.current = selectedId;
      setSheet(buildUpdatedSheet(found, emptySheet));
    }
  }, [selectedId, characters]);

  const saveSheet = useCallback(
    async (s) => {
      savePendingRef.current += 1;
      setSaveStatus("saving");
      try {
        const copy = {
          ...s,
          owner: username,
          name: typeof s?.name === "string" ? s.name.trim() : s?.name,
        };
        if (!copy.id) {
          const ref = await addDoc(collection(db, `users/${username}/characters`), copy);
          setSelectedId(ref.id);
          setSheet((prev) => ({ ...prev, id: ref.id }));
        } else {
          await setDoc(doc(db, `users/${username}/characters`, copy.id), copy);
        }
      } catch (err) {
        console.error("save error", err);
        alert("Erro ao salvar: " + err.message);
        savePendingRef.current -= 1;
        if (savePendingRef.current <= 0) {
          savePendingRef.current = 0;
          setSaveStatus("error");
          clearTimeout(saveStatusTimerRef.current);
          saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3200);
        }
        return;
      }
      savePendingRef.current -= 1;
      if (savePendingRef.current <= 0) {
        savePendingRef.current = 0;
        setSaveStatus("saved");
        clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      }
    },
    [username]
  );

  const deleteCharacter = async (id) => {
    if (!window.confirm("Deletar ficha?")) return;
    await deleteDoc(doc(db, `users/${username}/characters`, id));
    setSelectedId(null);
    setSheet({ ...emptySheet, owner: username });
  };

  const requestRest = () => {
    const isLong = window.confirm(
      "Escolha o tipo de descanso:\n\nOK = Descanso Longo\nCancelar = Descanso Curto"
    );
    const next = isLong ? applyLongRest(sheet) : applyShortRest(sheet);
    setSheet(next);
    setTimeout(() => saveSheet(next), 0);
  };

  const activateFocusForNextAction = () => {
    const focusType = sheet?.focusType === "certainty" ? "certainty" : "inspiration";
    const points = Number(sheet?.focusPoints) || 0;
    if (points <= 0) {
      alert("Você não tem Inspiração/Certeza disponível.");
      return;
    }

    const next = JSON.parse(JSON.stringify(sheet));
    next.pendingRollPower = focusType;
    if (focusType === "certainty") {
      next.focusType = "inspiration";
      next.focusPoints = 0;
    } else {
      next.focusPoints = Math.max(0, points - 1);
    }
    setSheet(next);
    setTimeout(() => saveSheet(next), 0);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    setSelectedId(null);
    setSheet({ ...emptySheet, owner: "" });
    setCharacters([]);
  };

  const openImportExport = (mode = "export") => {
    setImportExportState({ open: true, mode });
  };

  const closeImportExport = () => {
    setImportExportState({ open: false, mode: "export" });
  };

  const handleImportConfirmed = useCallback(
    async (preparedCharacter, options = {}) => {
      const action = options.action || "new";
      const data = {
        ...emptySheet,
        ...preparedCharacter,
        owner: username,
      };

      if (action === "overwrite" && data.id) {
        await setDoc(doc(db, `users/${username}/characters`, data.id), data);
        setSelectedId(data.id);
        setSheet(buildUpdatedSheet(data, emptySheet));
      } else {
        const { id: _ignore, ...rest } = data;
        const ref = await addDoc(
          collection(db, `users/${username}/characters`),
          rest
        );
        setSelectedId(ref.id);
        setSheet(buildUpdatedSheet({ ...rest, id: ref.id }, emptySheet));
      }
    },
    [username]
  );

  // Quando não logado: /regras é pública; demais rotas mostram login
  if (!isLoggedIn) {
    const loginForm = (
      <div className="login-container">
        <div className="login-panel">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Nome de Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu nome de usuário"
                className="input-login"
              />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="input-login"
              />
            </div>
            {loginError && <div className="error-message">{loginError}</div>}
            <button type="submit" className="btn-primary fullwidth">
              Entrar
            </button>
            <button
              type="button"
              className="btn-outline fullwidth login-regras"
              onClick={() => navigate("/regras")}
            >
              Ler regras do sistema
            </button>
          </form>
        </div>
      </div>
    );
    return (
      <UserProvider username={username}>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button
          type="button"
          className="login-changelog-btn"
          onClick={() => setChangelogOpen(true)}
          title="Novidades do Cataclysm"
          aria-label="Ver novidades"
        >
          📋
          {showChangelogBadge && <span className="login-changelog-badge">!</span>}
        </button>
        <ChangelogModal
          open={changelogOpen}
          onClose={() => {
            setChangelogOpen(false);
            setShowChangelogBadge(false);
          }}
        />
        <Routes>
          <Route path="/regras" element={<RulesPage />} />
          <Route path="*" element={loginForm} />
        </Routes>
      </UserProvider>
    );
  }

  const editorLayoutProps = {
    username,
    characters,
    selectedId,
    setSelectedId,
    sheet,
    setSheet,
    emptySheet,
    saveSheet,
    saveStatus,
    deleteCharacter,
    handleLogout,
    loading,
    navigate,
    contentTab,
    setContentTab,
    onRequestRest: requestRest,
    onActivateFocus: activateFocusForNextAction,
    onOpenImportExport: openImportExport,
    onOpenSessionWizard: () => setSessionWizardOpen(true),
  };

  return (
    <UserProvider username={username}>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <Routes>
        <Route path="/regras" element={<RulesPage />} />
        <Route path="/notas" element={<NotesPage />} />
        <Route path="/biblioteca" element={<GmLibraryPage />} />
        <Route path="/" element={<EditorLayout sessionId={null} {...editorLayoutProps} />} />
        <Route path="/session/:sessionId" element={<SessionLayoutWrapper {...editorLayoutProps} />} />
        <Route path="/join" element={<JoinPage />} />
      </Routes>
      <ImportExportModal
        open={importExportState.open}
        mode={importExportState.mode}
        onClose={closeImportExport}
        sheet={sheet}
        characters={characters}
        onImportConfirmed={handleImportConfirmed}
      />
      <CreateSessionWizard
        open={sessionWizardOpen}
        onClose={() => setSessionWizardOpen(false)}
        username={username}
        onCreated={(id) => navigate("/session/" + id)}
      />
    </UserProvider>
  );
}
