import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
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
import LevelUpRitual from "./components/LevelUpRitual";
import { normalizeAbilities, normalizeTraits } from "./utils/sheetIO";
import CreateSessionWizard from "./components/CreateSessionWizard";
import ErrorBoundary from "./components/ErrorBoundary";
import ChangelogModal from "./components/ChangelogModal";
import { hasUnreadChangelog } from "./data/changelogData";
import { UserProvider } from "./context/UserContext";
import { createSession, purgeExpiredSessions } from "./services/sessionService";
import { isMestreAccount } from "./utils/mestreAccount";
import {
  EMPTY_STATS,
  CORE_STATS,
  migrateStats,
  applyShortRestBars,
  getBarMaxes as rampageGetBarMaxes,
  clearOverheat,
  clearOverheatIfRecovered,
  syncOverheatFlags,
  normalizeOverheat,
  applyLevelUpHp,
  undoLastLevelUp,
  needsInitialStatBeforeLevelUp,
  normalizeEffect,
} from "./utils/rampageRules";
import { buildExportPayload } from "./utils/sheetIO";
import "./RPGPlayerEditor.css";
import "./components/LevelUpRitual.css";

const emptySheet = {
  name: "New Character",
  isMain: true,
  level: 3,
  image: "",
  bars: { inata: 600, ether: 300, vigor: 150, hp: 20, maxHp: 20, sanity: 100, maxSanity: 100 },
  stats: { ...EMPTY_STATS },
  overheat: { pe: false, ether: false, vigor: false },
  characterInfo: {
    class: "",
    race: "",
    background: "",
    alignment: "",
    age: "",
    height: "",
    weight: "",
    dominantField: "",
    initialStat: "", // fis | des | men | car — +1 automático no level-up
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
  levelUpHistory: [],
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
  const migratedStats = migrateStats(found?.stats || {});
  return {
    ...emptySheet,
    ...found,
    bars: {
      ...emptySheet.bars,
      ...found.bars,
      sanity: found.bars?.sanity !== undefined ? found.bars.sanity : emptySheet.bars.sanity,
      maxSanity: 100
    },
    stats: migratedStats,
    overheat: normalizeOverheat(found),
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
    abilities: normalizeAbilities(found.abilities || []),
    traits: normalizeTraits(found.traits || []),
    documents: found.documents || [],
    galleryImages: Array.isArray(found.galleryImages) ? found.galleryImages : [],
    lore: found.lore != null ? found.lore : "",
    modes: found.modes || [],
    diceShortcuts: found.diceShortcuts || [],
    focusType: found.focusType === "certainty" ? "certainty" : "inspiration",
    focusPoints: Number(found.focusPoints) || 0,
    pendingRollPower: found.pendingRollPower || null,
    levelUpHistory: Array.isArray(found.levelUpHistory) ? found.levelUpHistory : [],
    effects: (found.effects || []).map((effect) => normalizeEffect(effect)),
  };
}

function getBarMaxes(sheet) {
  return rampageGetBarMaxes(sheet);
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
  return clearOverheatIfRecovered(applyShortRestBars(sheet));
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
    return clearOverheat(s);
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
  onCloseSessionWizard,
  levelUpPulse,
  onRequestLevelUp,
  onUndoLevelUp,
  onCopySheet,
}) {
  const effectiveStats = useMemo(() => getEffectiveStats(sheet), [sheet]);
  const isMobile = useIsMobile(980);
  const [mobileContentTab, setMobileContentTab] = useState("sheet");
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [copyFlash, setCopyFlash] = useState("");
  const [levelUpAmount, setLevelUpAmount] = useState(1);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const canUseMestreTools = isMestreAccount(username);

  const handleCopyClick = async () => {
    if (!onCopySheet) return;
    try {
      await onCopySheet();
      setCopyFlash("Copiado!");
      setTimeout(() => setCopyFlash(""), 1800);
    } catch (err) {
      alert("Erro ao copiar: " + (err.message || err));
    }
  };

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
                <button
                  className="btn-primary fullwidth"
                  onClick={() => navigate("/join")}
                >
                  Entrar na sessão
                </button>
                <button
                  type="button"
                  className={`btn-outline fullwidth sidebar-menu-toggle ${
                    sidebarMenuOpen ? "is-open" : ""
                  }`}
                  aria-expanded={sidebarMenuOpen}
                  onClick={() => setSidebarMenuOpen((o) => !o)}
                >
                  Menu {sidebarMenuOpen ? "▴" : "▾"}
                </button>
                <div
                  className={`sidebar-menu-panel ${sidebarMenuOpen ? "is-open" : ""}`}
                  aria-hidden={!sidebarMenuOpen}
                >
                  <div className="sidebar-menu-inner">
                    {canUseMestreTools && (
                      <>
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
                              onCloseSessionWizard && onCloseSessionWizard();
                              const id = await createSession(username, 20, 15);
                              flushSync(() => setContentTab("map"));
                              navigate("/session/" + id);
                            } catch (err) {
                              console.error(err);
                              alert("Erro ao criar sessão: " + err.message);
                            }
                          }}
                        >
                          Criar sessão rápida
                        </button>
                      </>
                    )}
                    <button
                      className="btn-outline fullwidth"
                      onClick={() => navigate("/biblioteca")}
                      title="Sua biblioteca individual de imagens e sons"
                    >
                      📚 Minha biblioteca
                    </button>
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
                    <button
                      type="button"
                      className="btn-outline fullwidth"
                      onClick={handleCopyClick}
                      disabled={!sheet || (!sheet.id && !sheet.name)}
                      title="Copiar JSON completo da ficha para a área de transferência"
                    >
                      {copyFlash || "📋 Copiar ficha"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline fullwidth"
                      onClick={() => navigate("/regras")}
                    >
                      Regras
                    </button>
                  </div>
                </div>
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

          <main
            className={`editor ${sessionId && contentTab === "map" ? "editor--session-map" : ""}${
              levelUpPulse ? " editor--levelup-pulse" : ""
            }`}
          >
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
                        <button
                          type="button"
                          className={`level-display ${levelUpOpen ? "is-open" : ""}`}
                          title="Clique para mostrar/ocultar subir de nível"
                          onClick={() => setLevelUpOpen((o) => !o)}
                        >
                          {sheet.level || 1}
                        </button>
                        <div className={`level-up-controls ${levelUpOpen ? "is-open" : ""}`}>
                          <div className="level-up-controls-inner">
                            <input
                              type="number"
                              className="input-number level-up-amount"
                              min={1}
                              max={20}
                              value={levelUpAmount}
                              onChange={(e) => {
                                const n = Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1)));
                                setLevelUpAmount(n);
                              }}
                              title="Quantos níveis subir de uma vez"
                              aria-label="Quantidade de níveis"
                            />
                            <button
                              type="button"
                              className="btn-primary small"
                              onClick={() =>
                                onRequestLevelUp && onRequestLevelUp(Math.max(1, levelUpAmount || 1))
                              }
                              title="Ritual de pontos (3 livres + 1 inicial por nível) e d12 de PV"
                            >
                              Subir {levelUpAmount > 1 ? `${levelUpAmount} níveis` : "de nível"}
                            </button>
                          </div>
                        </div>
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
                    onUndoLevelUp={onUndoLevelUp}
                  />
                )}
                {isMobile && mobileContentTab === "dice" && (
                  <div className="mobile-dice-wrap">
                    <DiceRoller
                      sheet={sheet}
                      effectiveStats={effectiveStats}
                      onUpdateSheet={setSheet}
                      username={username}
                      sessionId={sessionId}
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
              <ErrorBoundary
                onReset={() => {
                  setContentTab("sheet");
                  navigate("/", { replace: true });
                }}
              >
                <MapView
                  sessionId={sessionId}
                  embedded
                  onBack={() => {
                    setContentTab("sheet");
                    navigate("/", { replace: true });
                  }}
                />
              </ErrorBoundary>
            )}
          </main>

          {!isMobile && (
            <aside className="right-aside">
              <DiceRoller
                sheet={sheet}
                effectiveStats={effectiveStats}
                onUpdateSheet={setSheet}
                username={username}
                sessionId={sessionId}
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
  return <EditorLayout {...editorLayoutProps} sessionId={sessionId} />;
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
  const [contentTab, setContentTab] = useState(() => {
    if (typeof window === "undefined") return "sheet";
    return /^\/session\/[^/]+/.test(window.location.pathname) ? "map" : "sheet";
  });
  const [saveStatus, setSaveStatus] = useState("idle");
  const [importExportState, setImportExportState] = useState({ open: false, mode: "export" });
  const [sessionWizardOpen, setSessionWizardOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [showChangelogBadge, setShowChangelogBadge] = useState(() => hasUnreadChangelog());
  const [levelUpPulse, setLevelUpPulse] = useState(false);
  const [levelUpRitual, setLevelUpRitual] = useState(null); // { from, to } | null
  const savePendingRef = useRef(0);
  const saveStatusTimerRef = useRef(null);
  const levelUpPulseTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const inSession = /^\/session\/[^/]+/.test(location.pathname);
    setSessionWizardOpen(false);
    setImportExportState((s) => (s.open ? { ...s, open: false } : s));
    if (inSession) {
      setContentTab("map");
    } else if (!location.pathname.startsWith("/join")) {
      setContentTab("sheet");
    }
  }, [location.pathname]);

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

    purgeExpiredSessions().catch((err) =>
      console.warn("Falha ao limpar sessões expiradas:", err)
    );

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

  const handleRequestLevelUp = useCallback((amount = 1) => {
    const from = Number(sheet.level) || 1;
    if (needsInitialStatBeforeLevelUp(sheet)) {
      alert(
        "Defina o atributo inicial na aba INFO antes do primeiro level-up.\n" +
          "(Fichas já em campanha, nível 10+, podem escolher no ritual.)"
      );
      return;
    }
    const steps = Math.max(1, Math.min(20, Math.floor(Number(amount) || 1)));
    const to = from + steps;
    clearTimeout(levelUpPulseTimerRef.current);
    setContentTab("sheet");
      setLevelUpPulse(true);
    levelUpPulseTimerRef.current = setTimeout(() => {
      setLevelUpPulse(false);
      setLevelUpRitual({ from, to });
    }, 1650);
  }, [sheet]);

  const handleLevelUpCancel = useCallback(() => {
    setLevelUpRitual(null);
  }, []);

  const handleLevelUpConfirm = useCallback(
    ({ deltas, fisDelta, chosenInitial, rolls, gain: rolledGain }) => {
      if (!levelUpRitual) return;
      const s = JSON.parse(JSON.stringify(sheet));
      if (!s.stats) s.stats = { ...EMPTY_STATS };
      if (!s.characterInfo) s.characterInfo = {};
      if (chosenInitial && CORE_STATS.includes(chosenInitial)) {
        s.characterInfo.initialStat = chosenInitial;
      }
      Object.entries(deltas || {}).forEach(([k, v]) => {
        const n = Number(v) || 0;
        if (!n) return;
        s.stats[k] = (Number(s.stats[k]) || 0) + n;
      });
      s.level = levelUpRitual.from;
      const { sheet: leveled, gain, snapshot } = applyLevelUpHp(
        s,
        levelUpRitual.from,
        levelUpRitual.to,
        { fisDelta, rolls, gain: rolledGain }
      );
      snapshot.deltas = { ...(deltas || {}) };
      leveled.levelUpHistory = [...(leveled.levelUpHistory || []), snapshot];
      setLevelUpRitual(null);
      setSheet(leveled);
      setTimeout(() => saveSheet(leveled), 0);
    },
    [levelUpRitual, sheet, saveSheet]
  );

  const handleUndoLevelUp = useCallback(() => {
    const history = sheet.levelUpHistory || [];
    if (!history.length) {
      alert("Não há level-up para desfazer.");
      return;
    }
    if (!window.confirm("Desfazer o último level-up? Pontos, PV e nível voltam ao estado anterior.")) {
      return;
    }
    const result = undoLastLevelUp(sheet);
    if (!result.ok) {
      alert(result.error || "Não foi possível desfazer.");
      return;
    }
    setSheet(result.sheet);
    setTimeout(() => saveSheet(result.sheet), 0);
  }, [sheet, saveSheet]);

  const handleCopySheet = useCallback(async () => {
    const payload = buildExportPayload(sheet, ["mecanica", "narrativa", "personalizacao"]);
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }, [sheet]);

  const handleImportConfirmed = useCallback(
    async (preparedCharacter, options = {}) => {
      const action = options.action || "new";
      const data = {
        ...emptySheet,
        ...preparedCharacter,
        abilities: normalizeAbilities(preparedCharacter.abilities || []),
        traits: normalizeTraits(preparedCharacter.traits || []),
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
    onOpenSessionWizard: () => {
      if (isMestreAccount(username)) setSessionWizardOpen(true);
    },
    onCloseSessionWizard: () => setSessionWizardOpen(false),
    levelUpPulse,
    onRequestLevelUp: handleRequestLevelUp,
    onUndoLevelUp: handleUndoLevelUp,
    onCopySheet: handleCopySheet,
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
      {levelUpRitual && (
        <LevelUpRitual
          key={`${levelUpRitual.from}-${levelUpRitual.to}`}
          open
          fromLevel={levelUpRitual.from}
          toLevel={levelUpRitual.to}
          baseStats={sheet.stats}
          initialStat={(sheet.characterInfo || {}).initialStat || ""}
          requireInitialInInfo={false}
          onInitialStatChange={(stat) => {
            setSheet((prev) => {
              const next = JSON.parse(JSON.stringify(prev));
              if (!next.characterInfo) next.characterInfo = {};
              next.characterInfo.initialStat = stat;
              return next;
            });
          }}
          onConfirm={handleLevelUpConfirm}
          onCancel={handleLevelUpCancel}
        />
      )}
      {sessionWizardOpen && isMestreAccount(username) && (
        <CreateSessionWizard
          open
          onClose={() => setSessionWizardOpen(false)}
          username={username}
          onCreated={(id) => {
            flushSync(() => {
              setSessionWizardOpen(false);
              setContentTab("map");
            });
            navigate("/session/" + id);
          }}
        />
      )}
    </UserProvider>
  );
}
