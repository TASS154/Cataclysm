import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

const SESSIONS_COLLECTION = "sessions";
const TOKENS_SUBCOLLECTION = "tokens";
const AREAS_SUBCOLLECTION = "areas";
const ROLLS_SUBCOLLECTION = "rolls";

/** Sessões expiram 24h após criação. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function sanitizeSessionId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);
}

function createdAtToMs(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
  if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
  if (typeof createdAt === "number") return createdAt;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSessionExpired(session) {
  if (!session) return true;
  if (session.expiresAt != null) {
    const exp = createdAtToMs(session.expiresAt);
    if (exp != null) return Date.now() >= exp;
  }
  const created = createdAtToMs(session.createdAt);
  if (created == null) return false;
  return Date.now() >= created + SESSION_TTL_MS;
}

async function deleteSubcollection(sessionId, subName) {
  const col = collection(db, SESSIONS_COLLECTION, sessionId, subName);
  const snap = await getDocs(col);
  if (snap.empty) return;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Remove sessão e subcoleções (tokens, areas, rolls).
 */
export async function deleteSessionFully(sessionId) {
  if (!sessionId) return;
  await Promise.all([
    deleteSubcollection(sessionId, TOKENS_SUBCOLLECTION),
    deleteSubcollection(sessionId, AREAS_SUBCOLLECTION),
    deleteSubcollection(sessionId, ROLLS_SUBCOLLECTION),
  ]);
  await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
}

/**
 * Apaga todas as sessões (ou só as expiradas).
 * @returns {{ deleted: number, ids: string[] }}
 */
export async function purgeSessions({ onlyExpired = false } = {}) {
  const snap = await getDocs(collection(db, SESSIONS_COLLECTION));
  const ids = [];
  for (const d of snap.docs) {
    const data = { id: d.id, ...d.data() };
    if (onlyExpired && !isSessionExpired(data)) continue;
    await deleteSessionFully(d.id);
    ids.push(d.id);
  }
  return { deleted: ids.length, ids };
}

export async function purgeExpiredSessions() {
  return purgeSessions({ onlyExpired: true });
}

/**
 * Cria uma nova sessão de mapa. Quem cria é o mestre.
 * @param {string} gmUsername
 * @param {object} [options]
 * @returns {Promise<string>} sessionId
 */
export async function createSession(gmUsername, options = {}) {
  const {
    mapWidth = 20,
    mapHeight = 15,
    name = "Sessão",
    backgroundImageUrl = "",
    mapSequence = null,
    selectedImageIds = [],
    selectedSoundIds = [],
    customId = "",
  } = typeof options === "object" && options !== null
    ? options
    : { mapWidth: arguments[1], mapHeight: arguments[2], name: arguments[3] };

  const firstMap = Array.isArray(mapSequence) && mapSequence.length > 0
    ? mapSequence[0]
    : {
        name: name || "Mapa 1",
        mapWidth: Number(mapWidth) || 20,
        mapHeight: Number(mapHeight) || 15,
        backgroundImageUrl: backgroundImageUrl || "",
      };

  const sequence = Array.isArray(mapSequence) && mapSequence.length > 0
    ? mapSequence.map((m, i) => ({
        name: m.name || `Mapa ${i + 1}`,
        mapWidth: Number(m.mapWidth) || 20,
        mapHeight: Number(m.mapHeight) || 15,
        backgroundImageUrl: m.backgroundImageUrl || "",
      }))
    : [{
        name: firstMap.name || name || "Mapa 1",
        mapWidth: Number(firstMap.mapWidth) || 20,
        mapHeight: Number(firstMap.mapHeight) || 15,
        backgroundImageUrl: firstMap.backgroundImageUrl || "",
      }];

  const now = Date.now();
  const payload = {
    gmUsername,
    name: name || "Sessão",
    mapWidth: sequence[0].mapWidth,
    mapHeight: sequence[0].mapHeight,
    backgroundImageUrl: sequence[0].backgroundImageUrl || "",
    mapSequence: sequence,
    currentMapIndex: 0,
    selectedImageIds: Array.isArray(selectedImageIds) ? selectedImageIds : [],
    selectedSoundIds: Array.isArray(selectedSoundIds) ? selectedSoundIds : [],
    roundTracker: {
      currentRound: 1,
      currentTurnIndex: 0,
      turnOrder: [],
      activeHandoutUrl: "",
      activeSoundUrl: "",
    },
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + SESSION_TTL_MS),
  };

  const wantedId = sanitizeSessionId(customId);
  if (wantedId) {
    if (wantedId.length < 3) {
      throw new Error("O código da sessão precisa ter pelo menos 3 caracteres.");
    }
    const existing = await getDoc(doc(db, SESSIONS_COLLECTION, wantedId));
    if (existing.exists()) {
      throw new Error("Já existe uma sessão com esse código/URL. Escolha outro.");
    }
    await setDoc(doc(db, SESSIONS_COLLECTION, wantedId), payload);
    return wantedId;
  }

  const ref = await addDoc(collection(db, SESSIONS_COLLECTION), payload);
  return ref.id;
}

/**
 * Busca os dados da sessão (uma vez). Remove se expirada.
 */
export async function getSession(sessionId) {
  const snap = await getDoc(doc(db, SESSIONS_COLLECTION, sessionId));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  if (isSessionExpired(data)) {
    await deleteSessionFully(snap.id).catch(console.error);
    return null;
  }
  return data;
}

/**
 * Inscreve em tempo real nos dados da sessão.
 */
export function subscribeSession(sessionId, callback, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(
    doc(db, SESSIONS_COLLECTION, sessionId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      if (isSessionExpired(data)) {
        deleteSessionFully(snap.id)
          .then(() => callback(null))
          .catch((err) => {
            console.error(err);
            callback(null);
          });
        return;
      }
      callback(data);
    },
    (err) => {
      console.error("subscribeSession error:", err);
      if (onError) onError(err);
      else callback(null);
    }
  );
}

/**
 * Encerra a sessão (remove o documento e subcoleções).
 */
export async function endSession(sessionId) {
  if (!sessionId) return;
  await deleteSessionFully(sessionId);
}

/**
 * Atualiza campos da sessão (mestre).
 */
export async function updateSession(sessionId, data) {
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  const update = {};
  if (data.mapWidth !== undefined) update.mapWidth = Number(data.mapWidth);
  if (data.mapHeight !== undefined) update.mapHeight = Number(data.mapHeight);
  if (data.name !== undefined) update.name = data.name;
  if (data.backgroundImageUrl !== undefined) update.backgroundImageUrl = data.backgroundImageUrl;
  if (data.currentMapIndex !== undefined) update.currentMapIndex = Number(data.currentMapIndex);
  if (data.mapSequence !== undefined) update.mapSequence = data.mapSequence;
  if (data.selectedImageIds !== undefined) update.selectedImageIds = data.selectedImageIds;
  if (data.selectedSoundIds !== undefined) update.selectedSoundIds = data.selectedSoundIds;
  if (data.roundTracker !== undefined) update.roundTracker = data.roundTracker;
  if (data.lastAirBreak !== undefined) update.lastAirBreak = data.lastAirBreak;
  if (Object.keys(update).length === 0) return;
  await updateDoc(sessionRef, update);
}

/**
 * Troca para um mapa da sequência pelo índice.
 */
export async function switchSessionMap(sessionId, mapIndex, mapSequence) {
  const seq = Array.isArray(mapSequence) ? mapSequence : [];
  const idx = Math.max(0, Math.min(seq.length - 1, Number(mapIndex) || 0));
  const m = seq[idx];
  if (!m) return;
  await updateSession(sessionId, {
    currentMapIndex: idx,
    mapWidth: m.mapWidth,
    mapHeight: m.mapHeight,
    backgroundImageUrl: m.backgroundImageUrl || "",
  });
}

export async function updateRoundTracker(sessionId, roundTracker) {
  await updateSession(sessionId, { roundTracker });
}

export function subscribeTokens(sessionId, callback) {
  const tokensCol = collection(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION);
  return onSnapshot(tokensCol, (snap) => {
    const tokens = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      x: Number(d.data().x) || 0,
      y: Number(d.data().y) || 0,
    }));
    callback(tokens);
  });
}

export async function addToken(sessionId, data) {
  const tokensCol = collection(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION);
  const ref = await addDoc(tokensCol, {
    ownerUsername: data.ownerUsername,
    characterId: data.characterId,
    characterName: data.characterName || "Personagem",
    x: Number(data.x) ?? 0,
    y: Number(data.y) ?? 0,
    width: Math.max(1, Number(data.width) || 1),
    height: Math.max(1, Number(data.height) || 1),
    color: data.color || "#6b7280",
    mapIndex: Number(data.mapIndex) ?? 0,
  });
  return ref.id;
}

export async function updateTokenPosition(sessionId, tokenId, data) {
  const tokenRef = doc(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION, tokenId);
  const update = {};
  if (data.x !== undefined) update.x = Number(data.x);
  if (data.y !== undefined) update.y = Number(data.y);
  if (data.color !== undefined) update.color = String(data.color);
  if (data.width !== undefined) update.width = Math.max(1, Number(data.width) || 1);
  if (data.height !== undefined) update.height = Math.max(1, Number(data.height) || 1);
  if (Object.keys(update).length === 0) return;
  await updateDoc(tokenRef, update);
}

export async function deleteToken(sessionId, tokenId) {
  const tokenRef = doc(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION, tokenId);
  await deleteDoc(tokenRef);
}

export async function hasTokenInSession(sessionId, ownerUsername, characterId) {
  const tokensCol = collection(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION);
  const snap = await getDocs(tokensCol);
  return snap.docs.some((d) => {
    const data = d.data();
    if (data.ownerUsername !== ownerUsername) return false;
    if (characterId != null && data.characterId !== characterId) return false;
    return true;
  });
}

export function subscribeAreas(sessionId, callback) {
  const areasCol = collection(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION);
  return onSnapshot(areasCol, (snap) => {
    const areas = snap.docs.map((d) => {
      const data = d.data();
      const cells = Array.isArray(data.cells) ? data.cells.map((c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 })) : [];
      return {
        id: d.id,
        name: data.name || "",
        type: data.type || "freeform",
        cells,
        color: data.color || "#6366f180",
        center: data.center || null,
        radius: data.radius ?? null,
        anchoredTo: data.anchoredTo || null,
        zoneEffect: data.zoneEffect || null,
        kind: data.kind || "area",
      };
    });
    callback(areas);
  });
}

export async function addArea(sessionId, data) {
  const areasCol = collection(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION);
  const ref = await addDoc(areasCol, {
    name: data.name || "Área",
    type: data.type || "freeform",
    cells: data.cells || [],
    color: data.color || "#6366f180",
    center: data.center || null,
    radius: data.radius ?? null,
    anchoredTo: data.anchoredTo || null,
    zoneEffect: data.zoneEffect || null,
    kind: data.kind || "area",
  });
  return ref.id;
}

export async function updateArea(sessionId, areaId, data) {
  const areaRef = doc(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION, areaId);
  const update = {};
  for (const key of ["name", "type", "cells", "color", "center", "radius", "anchoredTo", "zoneEffect", "kind"]) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (Object.keys(update).length === 0) return;
  await updateDoc(areaRef, update);
}

export async function deleteArea(sessionId, areaId) {
  const areaRef = doc(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION, areaId);
  await deleteDoc(areaRef);
}

export async function updateFogCells(sessionId, fogCells) {
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  await updateDoc(sessionRef, { fogCells: fogCells || [] });
}
