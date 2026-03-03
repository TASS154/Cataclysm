import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../context/UserContext";
import {
  getSession,
  subscribeTokens,
  updateTokenPosition,
  addToken,
  updateSession,
  deleteToken,
  subscribeAreas,
  addArea,
  deleteArea,
} from "../services/sessionService";
import "./MapView.css";

const MAX_CELL_PX = 36;
const MIN_CELL_PX = 12;
const REF_MAP_PX = 720;

function getCellSize(mapWidth, mapHeight) {
  const dim = Math.max(mapWidth || 20, mapHeight || 15);
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(REF_MAP_PX / dim)));
}

export default function MapView({ embedded = false, onBack, sessionId: sessionIdProp }) {
  const { sessionId: paramSessionId } = useParams();
  const sessionId = sessionIdProp ?? paramSessionId;
  const navigate = useNavigate();
  const { username } = useUser();
  const [session, setSession] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState({ tokenId: null, startX: 0, startY: 0, gridX: 0, gridY: 0 });
  const dragEndPosRef = useRef({ x: 0, y: 0 });
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  const [myCharacters, setMyCharacters] = useState([]);
  const [showGmAddToken, setShowGmAddToken] = useState(false);
  const [showGmSettings, setShowGmSettings] = useState(false);
  const [gmTokenName, setGmTokenName] = useState("");
  const [gmAddAtX, setGmAddAtX] = useState(0);
  const [gmAddAtY, setGmAddAtY] = useState(0);
  const [editMapW, setEditMapW] = useState("");
  const [editMapH, setEditMapH] = useState("");
  const [editBgUrl, setEditBgUrl] = useState("");
  const [gmTokenColor, setGmTokenColor] = useState("#6b7280");
  const [joinColor, setJoinColor] = useState("#6b7280");
  const [tokenMenu, setTokenMenu] = useState({ tokenId: null, x: 0, y: 0 });
  const [tokenEditColor, setTokenEditColor] = useState("#6b7280");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef(null);
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerPoints, setRulerPoints] = useState([]);
  const [areas, setAreas] = useState([]);
  const [areaTool, setAreaTool] = useState(null);
  const [areaDraft, setAreaDraft] = useState([]);
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState("#6366f180");
  const [areaDraftCenter, setAreaDraftCenter] = useState(null);
  const [showAreaNameModal, setShowAreaNameModal] = useState(false);
  const [coneAngleDeg, setConeAngleDeg] = useState(90);
  const coneDraftRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getSession(sessionId).then((data) => {
      if (!cancelled) {
        if (!data) setError("Sessão não encontrada.");
        else setSession(data);
      }
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;
    const unsub = subscribeTokens(sessionId, setTokens);
    return () => unsub();
  }, [sessionId, session]);

  useEffect(() => {
    if (!sessionId || !session) return;
    const unsub = subscribeAreas(sessionId, setAreas);
    return () => unsub();
  }, [sessionId, session]);

  const isGM = session && username === session.gmUsername;
  const myToken = tokens.find((t) => t.ownerUsername === username);

  useEffect(() => {
    if (!username || !session) return;
    if (isGM || myToken) {
      setShowJoinOverlay(false);
      return;
    }
    getDocs(collection(db, "users", username, "characters")).then((snap) => {
      setMyCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowJoinOverlay(true);
    });
  }, [username, session, isGM, myToken]);

  const handlePickCharacterInMap = async (character) => {
    if (!session) return;
    const centerX = Math.floor(session.mapWidth / 2);
    const centerY = Math.floor(session.mapHeight / 2);
    await addToken(sessionId, {
      ownerUsername: username,
      characterId: character.id,
      characterName: character.name || "Personagem",
      x: centerX,
      y: centerY,
      color: joinColor,
    });
    setShowJoinOverlay(false);
  };

  const handleGmAddToken = async (e) => {
    e.preventDefault();
    if (!session || !isGM) return;
    const name = (gmTokenName || "Token").trim();
    const x = Math.max(0, Math.min(session.mapWidth - 1, Number(gmAddAtX) || 0));
    const y = Math.max(0, Math.min(session.mapHeight - 1, Number(gmAddAtY) || 0));
    await addToken(sessionId, {
      ownerUsername: username,
      characterId: "npc-" + Date.now(),
      characterName: name,
      x,
      y,
      color: gmTokenColor,
    });
    setGmTokenName("");
    setGmAddAtX(Math.floor(session.mapWidth / 2));
    setGmAddAtY(Math.floor(session.mapHeight / 2));
    setShowGmAddToken(false);
  };

  const handleRemoveToken = async (tokenId) => {
    setTokenMenu({ tokenId: null, x: 0, y: 0 });
    await deleteToken(sessionId, tokenId).catch(console.error);
  };

  const handleTokenColorChange = async (tokenId, color) => {
    await updateTokenPosition(sessionId, tokenId, { color }).catch(console.error);
    setTokenMenu({ tokenId: null, x: 0, y: 0 });
  };

  const getCellFromEvent = (e) => {
    if (!mapRef.current || !session) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const mapW = session.mapWidth || 20;
    const mapH = session.mapHeight || 15;
    const cellX = Math.floor(((e.clientX - rect.left) / rect.width) * mapW);
    const cellY = Math.floor(((e.clientY - rect.top) / rect.height) * mapH);
    if (cellX < 0 || cellX >= mapW || cellY < 0 || cellY >= mapH) return null;
    return { x: cellX, y: cellY };
  };

  const handleMapClick = (e) => {
    if (!rulerMode && !areaTool && (e.target.closest(".map-token") || e.target.closest(".map-token-menu"))) return;
    if (rulerMode) {
      const cell = getCellFromEvent(e);
      if (!cell) return;
      setRulerPoints((p) => (p.length >= 2 ? [cell] : [...p, cell]));
      return;
    }
    if (!areaTool || !session) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    const gridW = session.mapWidth || 20;
    const gridH = session.mapHeight || 15;
    if (areaTool === "freeform") {
      setAreaDraft((prev) => {
        const key = `${cell.x},${cell.y}`;
        const has = prev.some((c) => c.x === cell.x && c.y === cell.y);
        if (has) return prev.filter((c) => !(c.x === cell.x && c.y === cell.y));
        return [...prev, { x: cell.x, y: cell.y }];
      });
      return;
    }
    if (areaTool === "circle") {
      if (!areaDraftCenter) {
        setAreaDraftCenter(cell);
        return;
      }
      const cx = (areaDraftCenter.x + cell.x) / 2;
      const cy = (areaDraftCenter.y + cell.y) / 2;
      const radius = Math.sqrt(Math.pow(cell.x - areaDraftCenter.x, 2) + Math.pow(cell.y - areaDraftCenter.y, 2)) / 2;
      const cells = [];
      for (let x = 0; x < gridW; x++) {
        for (let y = 0; y < gridH; y++) {
          const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
          if (dist <= radius + 0.5) cells.push({ x, y });
        }
      }
      setAreaDraft(cells);
      setAreaDraftCenter(null);
      setShowAreaNameModal(true);
      return;
    }
    if (areaTool === "cone") {
      if (!areaDraftCenter) {
        setAreaDraftCenter(cell);
        return;
      }
      const dx = cell.x - areaDraftCenter.x;
      const dy = cell.y - areaDraftCenter.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      coneDraftRef.current = { ox: areaDraftCenter.x, oy: areaDraftCenter.y, dx, dy, len };
      const angleRad = (coneAngleDeg * Math.PI) / 180 / 2;
      const ux = dx / len;
      const uy = dy / len;
      const cells = [];
      for (let x = 0; x < gridW; x++) {
        for (let y = 0; y < gridH; y++) {
          const px = x - areaDraftCenter.x;
          const py = y - areaDraftCenter.y;
          const dist = Math.sqrt(px * px + py * py);
          if (dist <= 0.5) { cells.push({ x, y }); continue; }
          const dot = (px * ux + py * uy) / dist;
          if (dot >= Math.cos(angleRad) && dist <= len + 0.5) cells.push({ x, y });
        }
      }
      setAreaDraft(cells);
      setAreaDraftCenter(null);
      setShowAreaNameModal(true);
    }
  };

  const recomputeConeDraft = (angleDeg) => {
    const d = coneDraftRef.current;
    if (!d || !session) return;
    const gridW = session.mapWidth || 20;
    const gridH = session.mapHeight || 15;
    const len = d.len;
    const ux = d.dx / len;
    const uy = d.dy / len;
    const angleRad = (angleDeg * Math.PI) / 180 / 2;
    const cells = [];
    for (let x = 0; x < gridW; x++) {
      for (let y = 0; y < gridH; y++) {
        const px = x - d.ox;
        const py = y - d.oy;
        const dist = Math.sqrt(px * px + py * py);
        if (dist <= 0.5) { cells.push({ x, y }); continue; }
        const dot = (px * ux + py * uy) / dist;
        if (dot >= Math.cos(angleRad) && dist <= len + 0.5) cells.push({ x, y });
      }
    }
    setAreaDraft(cells);
  };

  const finishFreeformArea = () => {
    if (areaDraft.length === 0) return;
    setShowAreaNameModal(true);
  };

  const saveArea = async (e) => {
    e.preventDefault();
    if (areaDraft.length === 0) return;
    await addArea(sessionId, { name: areaName || "Área", type: areaTool, cells: areaDraft, color: areaColor });
    setAreaDraft([]);
    setAreaName("");
    setAreaTool(null);
    setShowAreaNameModal(false);
    coneDraftRef.current = null;
  };

  const handleRemoveArea = async (areaId) => {
    await deleteArea(sessionId, areaId).catch(console.error);
  };

  const openGmSettings = () => {
    setEditMapW(String(session?.mapWidth ?? 20));
    setEditMapH(String(session?.mapHeight ?? 15));
    setEditBgUrl(session?.backgroundImageUrl ?? "");
    setShowGmSettings(true);
  };

  const handleSaveGmSettings = async (e) => {
    e.preventDefault();
    if (!sessionId || !session || !isGM) return;
    const w = Math.max(5, Math.min(50, Number(editMapW) || 20));
    const h = Math.max(5, Math.min(50, Number(editMapH) || 15));
    await updateSession(sessionId, {
      mapWidth: w,
      mapHeight: h,
      name: session.name,
      backgroundImageUrl: editBgUrl.trim() || null,
    });
    setSession((s) => (s ? { ...s, mapWidth: w, mapHeight: h, backgroundImageUrl: editBgUrl.trim() || null } : s));
    setShowGmSettings(false);
  };

  const canMoveToken = (token) => {
    if (!username) return false;
    return isGM || token.ownerUsername === username;
  };

  const handleTokenMouseDown = (e, token) => {
    if (rulerMode || areaTool) return;
    if (!canMoveToken(token)) return;
    e.preventDefault();
    const x = Math.max(0, Math.min((session?.mapWidth ?? 20) - 1, Number(token.x) || 0));
    const y = Math.max(0, Math.min((session?.mapHeight ?? 15) - 1, Number(token.y) || 0));
    dragEndPosRef.current = { x, y };
    setDragging({
      tokenId: token.id,
      startX: e.clientX,
      startY: e.clientY,
      gridX: x,
      gridY: y,
    });
  };

  useEffect(() => {
    if (!dragging.tokenId || !session || !mapRef.current) return;
    const tokenIdToUpdate = dragging.tokenId;
    const mapW = session.mapWidth || 20;
    const mapH = session.mapHeight || 15;

    const onMove = (e) => {
      const el = mapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cellX = Math.floor(((e.clientX - rect.left) / rect.width) * mapW);
      const cellY = Math.floor(((e.clientY - rect.top) / rect.height) * mapH);
      const x = Math.max(0, Math.min(mapW - 1, cellX));
      const y = Math.max(0, Math.min(mapH - 1, cellY));
      dragEndPosRef.current = { x, y };
      setDragging((d) => ({ ...d, gridX: x, gridY: y }));
    };

    const onUp = () => {
      const { x, y } = dragEndPosRef.current;
      updateTokenPosition(sessionId, tokenIdToUpdate, { x, y }).catch(console.error);
      setDragging({ tokenId: null, startX: 0, startY: 0, gridX: 0, gridY: 0 });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging.tokenId, sessionId, session, tokens]);

  const handleBack = () => (embedded && onBack ? onBack() : navigate("/"));

  if (error) {
    return (
      <div className={`map-view map-view--error ${embedded ? "map-view--embedded" : ""}`}>
        <p>{error}</p>
        <button type="button" className="btn-primary" onClick={handleBack}>
          Voltar
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="map-view map-view--loading">
        <p>Carregando sessão...</p>
      </div>
    );
  }

  const renderTokens = () => {
    return tokens.map((token) => {
      const isDraggingThis = dragging.tokenId === token.id;
      const x = isDraggingThis ? dragging.gridX : token.x;
      const y = isDraggingThis ? dragging.gridY : token.y;
      const draggable = canMoveToken(token);
      const pad = Math.max(2, Math.floor(cellSize * 0.06));
      return (
        <div
          key={token.id}
          className={`map-token ${draggable ? "map-token--draggable" : ""} ${isDraggingThis ? "map-token--dragging" : ""}`}
          style={{
            left: x * cellSize + pad,
            top: y * cellSize + pad,
            width: cellSize - pad * 2,
            height: cellSize - pad * 2,
            backgroundColor: token.color || "#6b7280",
          }}
          onMouseDown={(e) => handleTokenMouseDown(e, token)}
          onContextMenu={(e) => {
            if (!isGM) return;
            e.preventDefault();
            setTokenMenu({ tokenId: token.id, x: e.clientX, y: e.clientY });
            setTokenEditColor(token.color || "#6b7280");
          }}
          title={token.characterName}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (draggable && (e.key === "Enter" || e.key === " ")) e.preventDefault();
          }}
        >
          <span className="map-token-label">{token.characterName.slice(0, 2)}</span>
        </div>
      );
    });
  };

  const gridW = session.mapWidth || 20;
  const gridH = session.mapHeight || 15;
  const cellSize = getCellSize(gridW, gridH);
  const bgUrl = session.backgroundImageUrl || "";

  return (
    <div className={`map-view ${embedded ? "map-view--embedded" : ""}`}>
      {showJoinOverlay && myCharacters.length > 0 && (
        <div className="map-join-overlay">
          <div className="map-join-modal">
            <h3>Adicionar seu personagem</h3>
            <div className="form-group">
              <label>Cor do token</label>
              <input type="color" value={joinColor} onChange={(e) => setJoinColor(e.target.value)} className="input-color" />
            </div>
            <p className="muted">Escolha a ficha para esta sessão:</p>
            <ul className="join-char-list">
              {myCharacters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="btn-primary fullwidth"
                    onClick={() => handlePickCharacterInMap(c)}
                  >
                    {c.name || "Sem nome"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {isGM && showGmAddToken && (
        <div className="map-join-overlay">
          <div className="map-join-modal">
            <h3>Adicionar token</h3>
            <form onSubmit={handleGmAddToken}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  className="input-login"
                  value={gmTokenName}
                  onChange={(e) => setGmTokenName(e.target.value)}
                  placeholder="Ex: NPC, Inimigo"
                />
              </div>
              <div className="form-group">
                <label>Cor</label>
                <input type="color" value={gmTokenColor} onChange={(e) => setGmTokenColor(e.target.value)} className="input-color" />
              </div>
              <div className="form-group">
                <label>Posição X (0–{gridW - 1})</label>
                <input
                  type="number"
                  className="input-login"
                  min={0}
                  max={gridW - 1}
                  value={gmAddAtX}
                  onChange={(e) => setGmAddAtX(Number(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>Posição Y (0–{gridH - 1})</label>
                <input
                  type="number"
                  className="input-login"
                  min={0}
                  max={gridH - 1}
                  value={gmAddAtY}
                  onChange={(e) => setGmAddAtY(Number(e.target.value) || 0)}
                />
              </div>
              <button type="submit" className="btn-primary fullwidth">Colocar</button>
              <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 8 }} onClick={() => setShowGmAddToken(false)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {showAreaNameModal && (
        <div className="map-join-overlay">
          <div className="map-join-modal">
            <h3>Nome da área de efeito</h3>
            <form onSubmit={saveArea}>
              <div className="form-group">
                <label>Nome</label>
                <input type="text" className="input-login" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Ex: Explosão, Névoa" />
              </div>
              {areaTool === "cone" && (
                <div className="form-group">
                  <label>Ângulo do cone (graus)</label>
                  <input type="number" className="input-login" min={30} max={150} value={coneAngleDeg} onChange={(e) => { const v = Number(e.target.value) || 90; setConeAngleDeg(v); recomputeConeDraft(v); }} />
                </div>
              )}
              <div className="form-group">
                <label>Cor</label>
                <input type="color" value={areaColor} onChange={(e) => setAreaColor(e.target.value)} className="input-color" />
              </div>
              <button type="submit" className="btn-primary fullwidth">Salvar área</button>
              <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 8 }} onClick={() => { setShowAreaNameModal(false); setAreaDraft([]); setAreaName(""); coneDraftRef.current = null; }}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {isGM && showGmSettings && (
        <div className="map-join-overlay">
          <div className="map-join-modal">
            <h3>Configurar mapa</h3>
            <p className="muted">Cada quadrado = 1 metro. Largura e altura em quadrados.</p>
            <form onSubmit={handleSaveGmSettings}>
              <div className="form-group">
                <label>Largura (quadrados)</label>
                <input type="number" className="input-login" min={5} max={50} value={editMapW} onChange={(e) => setEditMapW(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Altura (quadrados)</label>
                <input type="number" className="input-login" min={5} max={50} value={editMapH} onChange={(e) => setEditMapH(e.target.value)} />
              </div>
              <div className="form-group">
                <label>URL da imagem de fundo</label>
                <input type="text" className="input-login" value={editBgUrl} onChange={(e) => setEditBgUrl(e.target.value)} placeholder="https://... ou use o upload abaixo" />
              </div>
              <div className="form-group">
                <label>Ou envie uma imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input-login"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 800000) {
                      alert("Imagem muito grande (máx. ~800 KB). Use uma URL ou redimensione.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setEditBgUrl(reader.result || "");
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <button type="submit" className="btn-primary fullwidth">Salvar</button>
              <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 8 }} onClick={() => setShowGmSettings(false)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {tokenMenu.tokenId && (
        <div
          className="map-token-menu"
          style={{ left: tokenMenu.x, top: tokenMenu.y }}
        >
          <div className="form-group">
            <label>Cor</label>
            <input type="color" value={tokenEditColor} onChange={(e) => setTokenEditColor(e.target.value)} className="input-color" />
          </div>
          <button type="button" className="btn-primary fullwidth" onClick={() => handleTokenColorChange(tokenMenu.tokenId, tokenEditColor)}>Aplicar cor</button>
          <button type="button" className="btn-danger fullwidth" style={{ marginTop: 6 }} onClick={() => handleRemoveToken(tokenMenu.tokenId)}>Remover token</button>
          <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 6 }} onClick={() => setTokenMenu({ tokenId: null, x: 0, y: 0 })}>Fechar</button>
        </div>
      )}
      <div className="map-view-header">
        <h2>{session.name || "Mapa"}</h2>
        <span className="map-view-role">{isGM ? "Mestre" : "Jogador"}</span>
        <button type="button" className={`map-ruler-btn ${rulerMode ? "map-ruler-btn--active" : ""}`} onClick={() => { setRulerMode((m) => !m); setRulerPoints([]); }} title="Régua: clique duas células para medir">
          Régua
        </button>
        {isGM && (
          <>
            <button type="button" className="btn-primary" onClick={() => { setGmAddAtX(Math.floor(gridW / 2)); setGmAddAtY(Math.floor(gridH / 2)); setShowGmAddToken(true); }}>
              Adicionar token
            </button>
            <button type="button" className="btn-primary" onClick={openGmSettings}>
              Configurar mapa
            </button>
            {areas.length > 0 && (
              <div className="map-areas-list">
                {areas.map((a) => (
                  <span key={a.id} className="map-area-chip">
                    {a.name}
                    <button type="button" className="btn-danger small" onClick={() => handleRemoveArea(a.id)} title="Remover área">×</button>
                  </span>
                ))}
              </div>
            )}
            {!areaTool ? (
              <select className="input-login" style={{ width: "auto" }} value="" onChange={(e) => { const v = e.target.value; if (v) { setAreaTool(v); setAreaDraft([]); setAreaDraftCenter(null); } }}>
                <option value="">Área de efeito...</option>
                <option value="circle">Círculo</option>
                <option value="cone">Cone</option>
                <option value="freeform">Desenho livre</option>
              </select>
            ) : (
              <>
                <span className="muted">Desenhando: {areaTool === "circle" ? "Círculo (clique 2 pontos do diâmetro)" : areaTool === "cone" ? "Cone (clique origem, depois direção)" : "Livre (clique nas células)"}</span>
                {areaTool === "freeform" && <button type="button" className="btn-primary" onClick={finishFreeformArea}>Concluir desenho</button>}
                <button type="button" className="btn-secondary" onClick={() => { setAreaTool(null); setAreaDraft([]); setAreaDraftCenter(null); setShowAreaNameModal(false); }}>Cancelar</button>
              </>
            )}
          </>
        )}
        <button type="button" className="btn-primary" onClick={handleBack}>
          Sair da sessão
        </button>
      </div>
      <div
        ref={mapContainerRef}
        className="map-zoom-pan-container"
        data-pan-enabled={mapZoom >= 1.5}
        onWheel={(e) => {
          e.preventDefault();
          setMapZoom((z) => Math.max(0.25, Math.min(3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
        }}
        onMouseDown={(e) => {
          if (e.target.closest(".map-token") || e.target.closest(".map-token-menu")) return;
          if (areaTool || rulerMode) return;
          if (mapZoom < 1.5) return;
          panStartRef.current = { x: e.clientX - mapPan.x, y: e.clientY - mapPan.y };
        }}
        onMouseMove={(e) => {
          if (!panStartRef.current) return;
          setMapPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
        }}
        onMouseUp={() => { panStartRef.current = null; }}
        onMouseLeave={() => { panStartRef.current = null; }}
      >
        <div
          className="map-zoom-pan-inner"
          style={{
            transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
            transformOrigin: "0 0",
          }}
        >
      <div
        ref={mapRef}
        className="map-grid-wrapper"
        onClick={handleMapClick}
        style={{
          width: gridW * cellSize,
          height: gridH * cellSize,
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="map-grid"
          style={{
            gridTemplateColumns: `repeat(${gridW}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridH}, ${cellSize}px)`,
          }}
        >
          {Array.from({ length: gridW * gridH }, (_, i) => (
            <div key={i} className="map-cell" />
          ))}
        </div>
        <div className="map-areas-layer">
          {areas.map((area) => (
            <React.Fragment key={area.id}>
              {area.cells.map((c, i) => (
                <div
                  key={i}
                  className="map-area-cell"
                  style={{
                    left: c.x * cellSize + 1,
                    top: c.y * cellSize + 1,
                    width: cellSize - 2,
                    height: cellSize - 2,
                    backgroundColor: area.color,
                  }}
                  title={area.name}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        {((areaDraftCenter ? [areaDraftCenter] : []).concat(areaDraft)).length > 0 && (
          <div className="map-areas-layer map-areas-layer--draft">
            {(areaDraftCenter ? [areaDraftCenter] : []).concat(areaDraft).map((c, i) => (
              <div
                key={i}
                className="map-area-cell"
                style={{
                  left: c.x * cellSize + 1,
                  top: c.y * cellSize + 1,
                  width: cellSize - 2,
                  height: cellSize - 2,
                  backgroundColor: areaColor,
                }}
              />
            ))}
          </div>
        )}
        {rulerPoints.length === 2 && (
          <div
            className="map-ruler-line"
            style={{
              left: rulerPoints[0].x * cellSize + cellSize / 2,
              top: rulerPoints[0].y * cellSize + cellSize / 2,
              width: Math.sqrt(
                Math.pow((rulerPoints[1].x - rulerPoints[0].x) * cellSize, 2) +
                Math.pow((rulerPoints[1].y - rulerPoints[0].y) * cellSize, 2)
              ),
              transformOrigin: "0 50%",
              transform: `rotate(${Math.atan2(
                (rulerPoints[1].y - rulerPoints[0].y) * cellSize,
                (rulerPoints[1].x - rulerPoints[0].x) * cellSize
              )}rad)`,
            }}
          />
        )}
        <div className="map-tokens-layer">
          {renderTokens()}
        </div>
      </div>
        </div>
      </div>
      {rulerPoints.length === 2 && (
        <div className="map-ruler-label">
          {Math.abs(rulerPoints[1].x - rulerPoints[0].x) + Math.abs(rulerPoints[1].y - rulerPoints[0].y)} m
        </div>
      )}
    </div>
  );
}
