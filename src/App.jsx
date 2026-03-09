import React, { useEffect, useState, useRef, useMemo } from "react";
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
  coins: { gold: 0, silver: 0 },
  traits: [],
  effects: [],
  notes: "",
  caArmorMod: 0,
  modes: [],
  diceShortcuts: [],
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
    abilities: (found.abilities || []).map(ability => ({
      ...ability,
      cost: typeof ability.cost === "number" ? ability.cost : (typeof ability.cost === "string" ? (ability.cost === "" ? 0 : Number(ability.cost) || 0) : 0)
    })),
    traits: found.traits || [],
    modes: found.modes || [],
    diceShortcuts: found.diceShortcuts || [],
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
  deleteCharacter,
  handleLogout,
  loading,
  navigate,
  contentTab,
  setContentTab,
}) {
  const effectiveStats = useMemo(() => getEffectiveStats(sheet), [sheet]);
  const isMobile = useIsMobile(980);
  const [mobileContentTab, setMobileContentTab] = useState("sheet");
  return (
    <>
      <div className="container">
        <div className="app-grid">
          <aside className="sidebar">
            <h2>Fichas de {username}</h2>
            <div className="controls">
              <button
                className="btn-primary fullwidth"
                onClick={() => {
                  const n = { ...emptySheet, name: "Nova Ficha " + (characters.length + 1), owner: username };
                  setSheet(n);
                  saveSheet(n);
                }}
              >
                + Criar ficha
              </button>
              <button
                className="btn-primary fullwidth"
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
                Criar sessão (mapa)
              </button>
              <button
                className="btn-primary fullwidth"
                onClick={() => navigate("/join")}
              >
                Entrar na sessão
              </button>
              <button className="btn-danger fullwidth" onClick={handleLogout}>
                Sair
              </button>
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
            </div>
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
  const navigate = useNavigate();

  // Login Handling
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError("Por favor, preencha nome de usuário e senha.");
      return;
    }

    try {
      const userRef = doc(db, "users", username);
      const userQuery = query(collection(db, "users"), where("username", "==", username));
      const userSnapshot = await onSnapshot(userQuery, async (snap) => {
        if (snap.empty) {
          await setDoc(userRef, { username, password });
          setIsLoggedIn(true);
          setLoginError("");
        } else {
          const userData = snap.docs[0].data();
          if (userData.password === password) {
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

  const saveSheet = async (s) => {
    try {
      const copy = { ...s, owner: username };
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
    }
  };

  const deleteCharacter = async (id) => {
    if (!window.confirm("Deletar ficha?")) return;
    await deleteDoc(doc(db, `users/${username}/characters`, id));
    setSelectedId(null);
    setSheet({ ...emptySheet, owner: username });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    setSelectedId(null);
    setSheet({ ...emptySheet, owner: "" });
    setCharacters([]);
  };

  // Render Login
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
          </form>
        </div>
      </div>
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
    deleteCharacter,
    handleLogout,
    loading,
    navigate,
    contentTab,
    setContentTab,
  };

  return (
    <UserProvider username={username}>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <Routes>
        <Route path="/" element={<EditorLayout sessionId={null} {...editorLayoutProps} />} />
        <Route path="/session/:sessionId" element={<SessionLayoutWrapper />} />
        <Route path="/join" element={<JoinPage />} />
      </Routes>
    </UserProvider>
  );
}
