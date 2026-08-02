import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../context/UserContext";
import {
  subscribeSession,
  subscribeTokens,
  updateTokenPosition,
  addToken,
  updateSession,
  deleteToken,
  subscribeAreas,
  addArea,
  updateArea,
  deleteArea,
  updateFogCells,
  endSession,
} from "../services/sessionService";
import NotesPanel from "./NotesPanel";
import SessionGmPanel, { SessionHandoutOverlay, SessionPublicReminder } from "./SessionGmPanel";
import SessionBroadcastAudio from "./SessionBroadcastAudio";
import { formatTurnBadge, getCurrentParticipant, normalizeRoundTracker } from "../utils/roundTracker";
import {
  cellsForCircle,
  cellsForDiameter,
  translateCells,
  tokenFootprint,
  computeVisibleCells,
} from "../utils/mapAreas";
import { reevaluateZoneEffectsForToken } from "../utils/zoneEffects";
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
  const { username } = useUser() || {};
  const [session, setSession] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState({ tokenId: null, startX: 0, startY: 0, gridX: 0, gridY: 0 });
  const dragEndPosRef = useRef({ x: 0, y: 0 });
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  const [showAddOwnToken, setShowAddOwnToken] = useState(false);
  const [myCharacters, setMyCharacters] = useState([]);
  const [showGmAddToken, setShowGmAddToken] = useState(false);
  const [showGmSettings, setShowGmSettings] = useState(false);
  const [gmTokenName, setGmTokenName] = useState("");
  // Mantém como string para permitir digitação no mobile sem "pular" para 0.
  const [gmAddAtX, setGmAddAtX] = useState("0");
  const [gmAddAtY, setGmAddAtY] = useState("0");
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
  const [showNotesOverlay, setShowNotesOverlay] = useState(false);
  const [gmTokenW, setGmTokenW] = useState("1");
  const [gmTokenH, setGmTokenH] = useState("1");
  const [areaRadius, setAreaRadius] = useState("3");
  const [areaAnchorTokenId, setAreaAnchorTokenId] = useState("");
  const [areaZoneMode, setAreaZoneMode] = useState("none");
  const [areaZoneTick, setAreaZoneTick] = useState("turnEnd");
  const [areaZoneDamage, setAreaZoneDamage] = useState("0");
  const [areaZoneName, setAreaZoneName] = useState("");
  const [areaKind, setAreaKind] = useState("area");
  const [fogMode, setFogMode] = useState(false);
  const [draggingAreaId, setDraggingAreaId] = useState(null);
  const areaDragStartRef = useRef(null);
  const areaGeomRef = useRef(null);
  const coneDraftRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const activePointerIdRef = useRef(null);
  const dragMetaRef = useRef({ startX: 0, startY: 0, moved: false });

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeSession(
      sessionId,
      (data) => {
        if (!data) setError("Sessão não encontrada ou encerrada.");
        else {
          setError("");
          setSession(data);
        }
      },
      (err) => {
        setError("Erro ao carregar sessão: " + (err?.message || "desconhecido"));
        setSession(null);
      }
    );
    return () => unsub && unsub();
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
  const currentMapIndex = Number(session?.currentMapIndex) || 0;
  const visibleTokens = tokens.filter(
    (t) => (Number(t.mapIndex) || 0) === currentMapIndex
  );
  const myTokens = visibleTokens.filter((t) => t.ownerUsername === username);
  const hasMyToken = myTokens.length > 0;

  useEffect(() => {
    if (!username || !session) return;
    if (isGM || hasMyToken) {
      setShowJoinOverlay(false);
      return;
    }
    getDocs(collection(db, "users", username, "characters")).then((snap) => {
      setMyCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowJoinOverlay(true);
    });
  }, [username, session, isGM, hasMyToken]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setShowJoinOverlay(false);
      setShowAddOwnToken(false);
      setShowGmAddToken(false);
      setShowGmSettings(false);
      setShowAreaNameModal(false);
      setShowNotesOverlay(false);
      setTokenMenu({ tokenId: null, x: 0, y: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setShowJoinOverlay(false);
    setShowAddOwnToken(false);
    setShowGmAddToken(false);
    setShowGmSettings(false);
    setShowAreaNameModal(false);
    setShowNotesOverlay(false);
    setTokenMenu({ tokenId: null, x: 0, y: 0 });
  }, [sessionId]);

  const ensureMyCharactersLoaded = async () => {
    if (!username) return;
    if (myCharacters.length > 0) return;
    const snap = await getDocs(collection(db, "users", username, "characters"));
    setMyCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

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
      mapIndex: currentMapIndex,
    });
    if (showJoinOverlay) setShowJoinOverlay(false);
    if (showAddOwnToken) setShowAddOwnToken(false);
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
      width: Math.max(1, Number(gmTokenW) || 1),
      height: Math.max(1, Number(gmTokenH) || 1),
      color: gmTokenColor,
      mapIndex: currentMapIndex,
    });
    setGmTokenName("");
    setGmAddAtX(String(Math.floor(session.mapWidth / 2)));
    setGmAddAtY(String(Math.floor(session.mapHeight / 2)));
    setGmTokenW("1");
    setGmTokenH("1");
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

  const handleMapClick = async (e) => {
    if (!rulerMode && !areaTool && !fogMode && (e.target.closest(".map-token") || e.target.closest(".map-token-menu"))) return;
    if (rulerMode) {
      const cell = getCellFromEvent(e);
      if (!cell) return;
      setRulerPoints((p) => (p.length >= 2 ? [cell] : [...p, cell]));
      return;
    }
    if (!session) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    const gridW = session.mapWidth || 20;
    const gridH = session.mapHeight || 15;
    if (fogMode && isGM) {
      const fog = Array.isArray(session.fogCells) ? [...session.fogCells] : [];
      const idx = fog.findIndex((c) => c.x === cell.x && c.y === cell.y);
      if (idx >= 0) fog.splice(idx, 1);
      else fog.push({ x: cell.x, y: cell.y });
      await updateFogCells(sessionId, fog);
      return;
    }
    if (!areaTool) return;
    if (areaTool === "freeform") {
      setAreaDraft((prev) => {
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
      const built = cellsForDiameter(areaDraftCenter, cell, gridW, gridH);
      areaGeomRef.current = { center: built.center, radius: built.radius };
      setAreaDraft(built.cells);
      setAreaDraftCenter(null);
      setShowAreaNameModal(true);
      return;
    }
    if (areaTool === "circleRadius") {
      const anchor = visibleTokens.find((t) => t.id === areaAnchorTokenId);
      const center = anchor
        ? { x: tokenFootprint(anchor).cx, y: tokenFootprint(anchor).cy }
        : cell;
      const r = Math.max(0.5, Number(areaRadius) || 3);
      const built = cellsForCircle(center, r, gridW, gridH);
      areaGeomRef.current = {
        center: built.center,
        radius: built.radius,
        anchoredTo: anchor ? { type: "token", id: anchor.id } : null,
      };
      setAreaDraft(built.cells);
      setShowAreaNameModal(true);
      return;
    }
    if (areaTool === "wall" || areaTool === "table" || areaTool === "prop") {
      setAreaDraft((prev) => {
        const has = prev.some((c) => c.x === cell.x && c.y === cell.y);
        if (has) return prev.filter((c) => !(c.x === cell.x && c.y === cell.y));
        return [...prev, { x: cell.x, y: cell.y }];
      });
      setAreaKind(areaTool);
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
    const geom = areaGeomRef.current || {};
    let zoneEffect = null;
    if (areaZoneMode === "continuous") {
      zoneEffect = {
        mode: "continuous",
        continuous: { kind: "damage", amount: Number(areaZoneDamage) || 0 },
        statusTemplate: null,
      };
    } else if (areaZoneMode === "status") {
      zoneEffect = {
        mode: "status",
        continuous: null,
        statusTemplate: {
          name: areaZoneName || areaName || "Efeito de área",
          damage: Number(areaZoneDamage) || 0,
          rounds: 0,
          tickMode: areaZoneTick,
        },
      };
    }
    const kind = ["wall", "table", "prop"].includes(areaTool) ? areaTool : areaKind || "area";
    await addArea(sessionId, {
      name: areaName || (kind === "wall" ? "Parede" : "Área"),
      type: areaTool,
      cells: areaDraft,
      color: areaColor,
      center: geom.center || null,
      radius: geom.radius ?? null,
      anchoredTo: geom.anchoredTo || null,
      zoneEffect,
      kind,
    });
    setAreaDraft([]);
    setAreaName("");
    setAreaTool(null);
    setAreaZoneMode("none");
    setAreaZoneDamage("0");
    setAreaZoneName("");
    setShowAreaNameModal(false);
    coneDraftRef.current = null;
    areaGeomRef.current = null;
  };

  const nudgeArea = async (area, dx, dy) => {
    const nextCells = translateCells(area.cells, dx, dy, gridW, gridH);
    const center = area.center
      ? { x: area.center.x + dx, y: area.center.y + dy }
      : null;
    await updateArea(sessionId, area.id, {
      cells: nextCells,
      center,
      anchoredTo: null,
    });
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

  const canEditTokenColor = (token) => {
    if (!username) return false;
    return isGM || token.ownerUsername === username;
  };

  const handleTokenPointerDown = (e, token) => {
    if (rulerMode || areaTool) return;
    if (!canMoveToken(token)) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    dragMetaRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    const x = Math.max(0, Math.min((session?.mapWidth ?? 20) - 1, Number(token.x) || 0));
    const y = Math.max(0, Math.min((session?.mapHeight ?? 15) - 1, Number(token.y) || 0));
    dragEndPosRef.current = { x, y };
    setDragging({
      tokenId: token.id,
      startX: e.clientX,
      startY: e.clientY,
      gridX: x,
      gridY: y,
      moved: false,
    });
  };

  useEffect(() => {
    if (!dragging.tokenId || !session || !mapRef.current) return;
    const tokenIdToUpdate = dragging.tokenId;
    const mapW = session.mapWidth || 20;
    const mapH = session.mapHeight || 15;

    const onMove = (e) => {
      if (activePointerIdRef.current != null && e.pointerId != null && e.pointerId !== activePointerIdRef.current) return;
      const el = mapRef.current;
      if (!el) return;
      const dx = Math.abs(e.clientX - dragging.startX);
      const dy = Math.abs(e.clientY - dragging.startY);
      const moved = dx > 3 || dy > 3;
      if (moved) dragMetaRef.current.moved = true;
      const rect = el.getBoundingClientRect();
      const cellX = Math.floor(((e.clientX - rect.left) / rect.width) * mapW);
      const cellY = Math.floor(((e.clientY - rect.top) / rect.height) * mapH);
      const x = Math.max(0, Math.min(mapW - 1, cellX));
      const y = Math.max(0, Math.min(mapH - 1, cellY));
      dragEndPosRef.current = { x, y };
      setDragging((d) => ({ ...d, gridX: x, gridY: y, moved: d.moved || moved }));
    };

    const onUp = (e) => {
      if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return;
      const currentToken = tokens.find((t) => t.id === tokenIdToUpdate);
      const { x, y } = dragEndPosRef.current;
      const wasMoved = !!dragMetaRef.current.moved && (!currentToken || currentToken.x !== x || currentToken.y !== y);
      if (wasMoved) {
        updateTokenPosition(sessionId, tokenIdToUpdate, { x, y })
          .then(() => {
            const moved = { ...currentToken, x, y };
            return reevaluateZoneEffectsForToken({
              token: moved,
              areas,
              gmUsername: session.gmUsername,
            });
          })
          .catch(console.error);
      } else if (currentToken && canEditTokenColor(currentToken)) {
        setTokenMenu({ tokenId: currentToken.id, x: e.clientX, y: e.clientY });
        setTokenEditColor(currentToken.color || "#6b7280");
      }
      setDragging({ tokenId: null, startX: 0, startY: 0, gridX: 0, gridY: 0 });
      activePointerIdRef.current = null;
      dragMetaRef.current = { startX: 0, startY: 0, moved: false };
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging.tokenId, sessionId, session, tokens]);

  const handleBack = () => {
    if (embedded && onBack) onBack();
    else navigate("/", { replace: true });
  };

  const handleEndSession = async () => {
    if (!isGM || !sessionId) return;
    if (!window.confirm("Terminar esta sessão? Jogadores não poderão mais acessá-la.")) return;
    try {
      await endSession(sessionId);
      handleBack();
    } catch (err) {
      console.error(err);
      alert("Erro ao terminar sessão: " + err.message);
    }
  };

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
      <div className={`map-view map-view--loading ${embedded ? "map-view--embedded" : ""}`}>
        <p>Carregando sessão...</p>
      </div>
    );
  }

  const gridW = session.mapWidth || 20;
  const gridH = session.mapHeight || 15;
  const cellSize = getCellSize(gridW, gridH);
  const bgUrl = session.backgroundImageUrl || "";
  const wallCells = areas.filter((a) => a.kind === "wall").flatMap((a) => a.cells || []);
  const myViewerToken = myTokens[0] || visibleTokens.find((t) => t.ownerUsername === username);
  const visibleCellSet = computeVisibleCells({
    viewerToken: myViewerToken,
    gridW,
    gridH,
    wallCells,
    fogCells: session.fogCells || [],
    isGM,
  });

  const renderTokens = () => {
    return visibleTokens.map((token) => {
      const isDraggingThis = dragging.tokenId === token.id;
      const x = isDraggingThis ? dragging.gridX : token.x;
      const y = isDraggingThis ? dragging.gridY : token.y;
      const tw = Math.max(1, Number(token.width) || 1);
      const th = Math.max(1, Number(token.height) || 1);
      const draggable = canMoveToken(token);
      const pad = Math.max(2, Math.floor(cellSize * 0.06));
      const colorEditable = canEditTokenColor(token);
      const hidden = !isGM && myViewerToken && !visibleCellSet.has(`${Math.round(x)},${Math.round(y)}`);
      if (hidden && token.ownerUsername !== username) return null;
      return (
        <div
          key={token.id}
          className={`map-token ${draggable ? "map-token--draggable" : ""} ${isDraggingThis ? "map-token--dragging" : ""}`}
          style={{
            left: x * cellSize + pad,
            top: y * cellSize + pad,
            width: cellSize * tw - pad * 2,
            height: cellSize * th - pad * 2,
            backgroundColor: token.color || "#6b7280",
          }}
          onPointerDown={(e) => handleTokenPointerDown(e, token)}
          onContextMenu={(e) => {
            if (!colorEditable) return;
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
          <span className="map-token-label">{(token.characterName || "?").slice(0, 2)}</span>
        </div>
      );
    });
  };

  const roundTracker = normalizeRoundTracker(session.roundTracker);
  const currentTurnPlayer = getCurrentParticipant(roundTracker);
  const isMyTurn =
    !isGM &&
    currentTurnPlayer?.ownerUsername &&
    currentTurnPlayer.ownerUsername === username;

  return (
    <div className={`map-view ${embedded ? "map-view--embedded" : ""}`}>
      <SessionBroadcastAudio session={session} />
      <SessionHandoutOverlay session={session} />
      <SessionPublicReminder session={session} />
      {(showJoinOverlay || showAddOwnToken) && !isGM && (
        <div
          className="map-join-overlay"
          onClick={() => {
            setShowJoinOverlay(false);
            setShowAddOwnToken(false);
          }}
        >
          <div className="map-join-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{showAddOwnToken ? "Adicionar token (invocação)" : "Adicionar seu personagem"}</h3>
            {myCharacters.length === 0 ? (
              <>
                <p className="muted">Você não tem fichas. Crie uma ficha antes de entrar na sessão.</p>
                <button type="button" className="btn-primary fullwidth" onClick={handleBack}>
                  Voltar às fichas
                </button>
              </>
            ) : (
              <>
            <div className="form-group">
              <label>Cor do token</label>
              <input type="color" value={joinColor} onChange={(e) => setJoinColor(e.target.value)} className="input-color" />
            </div>
            <p className="muted">Escolha a ficha para criar um token nesta sessão:</p>
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
            {showAddOwnToken && (
              <button
                type="button"
                className="btn-secondary fullwidth"
                style={{ marginTop: 8 }}
                onClick={() => setShowAddOwnToken(false)}
              >
                Fechar
              </button>
            )}
              </>
            )}
          </div>
        </div>
      )}
      {isGM && showGmAddToken && (
        <div className="map-join-overlay" onClick={() => setShowGmAddToken(false)}>
          <div className="map-join-modal" onClick={(e) => e.stopPropagation()}>
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
                  inputMode="numeric"
                  onChange={(e) => setGmAddAtX(e.target.value)}
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
                  inputMode="numeric"
                  onChange={(e) => setGmAddAtY(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Tamanho (células L×A)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" className="input-login" min={1} max={10} value={gmTokenW} onChange={(e) => setGmTokenW(e.target.value)} />
                  <input type="number" className="input-login" min={1} max={10} value={gmTokenH} onChange={(e) => setGmTokenH(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn-primary fullwidth">Colocar</button>
              <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 8 }} onClick={() => setShowGmAddToken(false)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {showAreaNameModal && (
        <div
          className="map-join-overlay"
          onClick={() => {
            setShowAreaNameModal(false);
            setAreaDraft([]);
            setAreaName("");
            coneDraftRef.current = null;
          }}
        >
          <div className="map-join-modal" onClick={(e) => e.stopPropagation()}>
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
              <div className="form-group">
                <label>Efeito da zona</label>
                <select className="input-login" value={areaZoneMode} onChange={(e) => setAreaZoneMode(e.target.value)}>
                  <option value="none">Nenhum</option>
                  <option value="continuous">Contínuo (some ao sair)</option>
                  <option value="status">Status (tick turno/rodada)</option>
                </select>
              </div>
              {areaZoneMode !== "none" && (
                <>
                  <div className="form-group">
                    <label>Dano / valor</label>
                    <input type="number" className="input-login" value={areaZoneDamage} onChange={(e) => setAreaZoneDamage(e.target.value)} />
                  </div>
                  {areaZoneMode === "status" && (
                    <>
                      <div className="form-group">
                        <label>Nome do status</label>
                        <input className="input-login" value={areaZoneName} onChange={(e) => setAreaZoneName(e.target.value)} placeholder="Envenenado..." />
                      </div>
                      <div className="form-group">
                        <label>Tick</label>
                        <select className="input-login" value={areaZoneTick} onChange={(e) => setAreaZoneTick(e.target.value)}>
                          <option value="turnEnd">Fim do turno</option>
                          <option value="turnStart">Início do turno</option>
                          <option value="round">Fim da rodada</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
              <button type="submit" className="btn-primary fullwidth">Salvar área</button>
              <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 8 }} onClick={() => { setShowAreaNameModal(false); setAreaDraft([]); setAreaName(""); coneDraftRef.current = null; }}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {isGM && showGmSettings && (
        <div className="map-join-overlay" onClick={() => setShowGmSettings(false)}>
          <div className="map-join-modal" onClick={(e) => e.stopPropagation()}>
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
          {(() => {
            const token = tokens.find((t) => t.id === tokenMenu.tokenId);
            if (!token || !isGM) return null;
            return (
              <button type="button" className="btn-danger fullwidth" style={{ marginTop: 6 }} onClick={() => handleRemoveToken(tokenMenu.tokenId)}>
                Remover token
              </button>
            );
          })()}
          <button type="button" className="btn-secondary fullwidth" style={{ marginTop: 6 }} onClick={() => setTokenMenu({ tokenId: null, x: 0, y: 0 })}>Fechar</button>
        </div>
      )}
      {showNotesOverlay && (
        <div className="map-join-overlay" onClick={() => setShowNotesOverlay(false)}>
          <div
            className="map-notes-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <NotesPanel embedded onClose={() => setShowNotesOverlay(false)} />
          </div>
        </div>
      )}
      <div className="map-view-header">
        <h2>{session.name || "Mapa"}</h2>
        <span className="map-view-role">{isGM ? "Mestre" : "Jogador"}</span>
        {session.roundTracker && (
          <span
            className={`map-round-badge small ${isMyTurn ? "map-round-badge--your-turn" : "muted"}`}
            title={isMyTurn ? "Sua vez!" : undefined}
          >
            {formatTurnBadge(roundTracker)}
            {isMyTurn && " ★"}
          </span>
        )}
        <SessionGmPanel
          session={session}
          sessionId={sessionId}
          username={username}
          isGM={isGM}
          tokens={visibleTokens}
          onSessionUpdate={setSession}
        />
        <button type="button" className={`map-ruler-btn ${rulerMode ? "map-ruler-btn--active" : ""}`} onClick={() => { setRulerMode((m) => !m); setRulerPoints([]); }} title="Régua: clique duas células para medir">
          Régua
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => setShowNotesOverlay(true)}
          title="Suas Notas de Perfil — visíveis só para você, mestre ou jogador"
        >
          📝 Notas
        </button>
        {!isGM && (
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              await ensureMyCharactersLoaded();
              setShowAddOwnToken(true);
            }}
            title="Adicionar outro token seu (invocação, aliado, etc.)"
          >
            + Meu token
          </button>
        )}
        {isGM && (
          <>
            <button type="button" className="btn-primary" onClick={() => { setGmAddAtX(String(Math.floor(gridW / 2))); setGmAddAtY(String(Math.floor(gridH / 2))); setShowGmAddToken(true); }}>
              Adicionar token
            </button>
            <button type="button" className="btn-primary" onClick={openGmSettings}>
              Configurar mapa
            </button>
            {!areaTool ? (
              <select className="input-login" style={{ width: "auto" }} value="" onChange={(e) => { const v = e.target.value; if (v) { setAreaTool(v); setAreaDraft([]); setAreaDraftCenter(null); setAreaKind(v === "wall" || v === "table" || v === "prop" ? v : "area"); } }}>
                <option value="">Área / objeto...</option>
                <option value="circle">Círculo (diâmetro)</option>
                <option value="circleRadius">Círculo (centro em token + raio)</option>
                <option value="cone">Cone</option>
                <option value="freeform">Desenho livre</option>
                <option value="wall">Parede (obscura visão)</option>
                <option value="table">Mesa / obstáculo</option>
                <option value="prop">Prop / grupo</option>
              </select>
            ) : (
              <>
                <span className="muted">
                  {areaTool === "circle" && "Círculo: 2 pontos (polo fora da grid é ajustado)"}
                  {areaTool === "circleRadius" && "Clique no mapa (ou use token) + raio"}
                  {areaTool === "cone" && "Cone: origem + direção"}
                  {areaTool === "freeform" && "Livre: clique nas células"}
                  {(areaTool === "wall" || areaTool === "table" || areaTool === "prop") && "Clique células; depois Concluir"}
                </span>
                {areaTool === "circleRadius" && (
                  <>
                    <select className="input-login" style={{ width: "auto" }} value={areaAnchorTokenId} onChange={(e) => setAreaAnchorTokenId(e.target.value)}>
                      <option value="">Centro: célula clicada</option>
                      {visibleTokens.map((t) => (
                        <option key={t.id} value={t.id}>{t.characterName}</option>
                      ))}
                    </select>
                    <input type="number" className="input-login" style={{ width: 64 }} min={1} value={areaRadius} onChange={(e) => setAreaRadius(e.target.value)} title="Raio" />
                  </>
                )}
                {(areaTool === "freeform" || areaTool === "wall" || areaTool === "table" || areaTool === "prop") && (
                  <button type="button" className="btn-primary" onClick={finishFreeformArea}>Concluir desenho</button>
                )}
                <button type="button" className="btn-secondary" onClick={() => { setAreaTool(null); setAreaDraft([]); setAreaDraftCenter(null); setShowAreaNameModal(false); }}>Cancelar</button>
              </>
            )}
            <button type="button" className={`btn-outline ${fogMode ? "btn-primary" : ""}`} onClick={() => setFogMode((v) => !v)}>
              {fogMode ? "FoW: pintando…" : "Fog of war"}
            </button>
          </>
        )}
        {isGM && areas.length > 0 && (
          <div className="map-areas-list">
            {areas.map((a) => (
              <span key={a.id} className="map-area-chip">
                {a.name}{a.kind && a.kind !== "area" ? ` [${a.kind}]` : ""}
                <button type="button" className="btn-outline small" onClick={() => nudgeArea(a, -1, 0)} title="←">←</button>
                <button type="button" className="btn-outline small" onClick={() => nudgeArea(a, 1, 0)} title="→">→</button>
                <button type="button" className="btn-outline small" onClick={() => nudgeArea(a, 0, -1)} title="↑">↑</button>
                <button type="button" className="btn-outline small" onClick={() => nudgeArea(a, 0, 1)} title="↓">↓</button>
                <button type="button" className="btn-danger small" onClick={() => handleRemoveArea(a.id)} title="Remover">×</button>
              </span>
            ))}
          </div>
        )}
        <button type="button" className="btn-primary" onClick={handleBack}>
          Sair da sessão
        </button>
        {isGM && (
          <button type="button" className="btn-danger" onClick={handleEndSession}>
            Terminar sessão
          </button>
        )}
      </div>
      <div
        ref={mapContainerRef}
        className="map-zoom-pan-container"
        data-pan-enabled={mapZoom >= 1.5}
        onWheel={(e) => {
          e.preventDefault();
          setMapZoom((z) => {
            const next = Math.max(0.5, Math.min(2.5, z + (e.deltaY > 0 ? -0.1 : 0.1)));
            if (next <= 1) setMapPan({ x: 0, y: 0 });
            return next;
          });
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
              {(area.cells || []).map((c, i) => {
                if (!isGM && !visibleCellSet.has(`${c.x},${c.y}`)) return null;
                return (
                <div
                  key={i}
                  className="map-area-cell"
                  style={{
                    left: c.x * cellSize + 1,
                    top: c.y * cellSize + 1,
                    width: cellSize - 2,
                    height: cellSize - 2,
                    backgroundColor: area.kind === "wall" ? "rgba(30,30,30,0.85)" : area.color,
                  }}
                  title={`${area.name}${area.zoneEffect ? " · efeito" : ""}`}
                />
                );
              })}
            </React.Fragment>
          ))}
          {!isGM &&
            (session.fogCells || []).map((c, i) => (
              <div
                key={`fog-${i}`}
                className="map-area-cell"
                style={{
                  left: c.x * cellSize,
                  top: c.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: "rgba(0,0,0,0.85)",
                  pointerEvents: "none",
                }}
              />
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
