import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const SESSIONS_COLLECTION = "sessions";
const TOKENS_SUBCOLLECTION = "tokens";
const AREAS_SUBCOLLECTION = "areas";

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

  const ref = await addDoc(collection(db, SESSIONS_COLLECTION), {
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
      currentTurn: 1,
      activeHandoutUrl: "",
      activeSoundUrl: "",
    },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Busca os dados da sessão (uma vez).
 * @param {string} sessionId
 * @returns {Promise<{ id: string, gmUsername: string, mapWidth: number, mapHeight: number, name: string } | null>}
 */
export async function getSession(sessionId) {
  const snap = await getDoc(doc(db, SESSIONS_COLLECTION, sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Inscreve em tempo real nos dados da sessão.
 */
export function subscribeSession(sessionId, callback, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(
    doc(db, SESSIONS_COLLECTION, sessionId),
    (snap) => {
      if (!snap.exists()) callback(null);
      else callback({ id: snap.id, ...snap.data() });
    },
    (err) => {
      console.error("subscribeSession error:", err);
      if (onError) onError(err);
      else callback(null);
    }
  );
}

/**
 * Encerra a sessão (remove o documento). Subcoleções permanecem no Firestore.
 */
export async function endSession(sessionId) {
  if (!sessionId) return;
  await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
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

/**
 * Atualiza contador de rodadas/turnos e lembretes.
 */
export async function updateRoundTracker(sessionId, roundTracker) {
  await updateSession(sessionId, { roundTracker });
}

/**
 * Inscreve para atualizações em tempo real dos tokens da sessão.
 * @param {string} sessionId
 * @param {(tokens: Array<{ id: string, ownerUsername: string, characterId: string, characterName: string, x: number, y: number, color?: string }>) => void} callback
 * @returns {() => void} unsubscribe
 */
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

/**
 * Adiciona um token na sessão (jogador entrando ou mestre colocando).
 * @param {string} sessionId
 * @param {{ ownerUsername: string, characterId: string, characterName: string, x?: number, y?: number, color?: string }} data
 * @returns {Promise<string>} tokenId
 */
export async function addToken(sessionId, data) {
  const tokensCol = collection(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION);
  const ref = await addDoc(tokensCol, {
    ownerUsername: data.ownerUsername,
    characterId: data.characterId,
    characterName: data.characterName || "Personagem",
    x: Number(data.x) ?? 0,
    y: Number(data.y) ?? 0,
    color: data.color || "#6b7280",
    mapIndex: Number(data.mapIndex) ?? 0,
  });
  return ref.id;
}

/**
 * Atualiza a posição e/ou cor de um token.
 * @param {string} sessionId
 * @param {string} tokenId
 * @param {{ x?: number, y?: number, color?: string }} data
 */
export async function updateTokenPosition(sessionId, tokenId, data) {
  const tokenRef = doc(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION, tokenId);
  const update = {};
  if (data.x !== undefined) update.x = Number(data.x);
  if (data.y !== undefined) update.y = Number(data.y);
  if (data.color !== undefined) update.color = String(data.color);
  if (Object.keys(update).length === 0) return;
  await updateDoc(tokenRef, update);
}

/**
 * Remove um token do mapa (mestre).
 * @param {string} sessionId
 * @param {string} tokenId
 */
export async function deleteToken(sessionId, tokenId) {
  const tokenRef = doc(db, SESSIONS_COLLECTION, sessionId, TOKENS_SUBCOLLECTION, tokenId);
  await deleteDoc(tokenRef);
}

/**
 * Verifica se o usuário já tem um token nesta sessão (por ownerUsername + characterId).
 * @param {string} sessionId
 * @param {string} ownerUsername
 * @param {string} [characterId] - se não passar, verifica só por ownerUsername
 * @returns {Promise<boolean>}
 */
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

/**
 * Áreas de efeito: inscreve em tempo real.
 * @param {string} sessionId
 * @param {(areas: Array<{ id: string, name: string, type: string, cells: Array<{x: number, y: number}>, color?: string }>) => void} callback
 */
export function subscribeAreas(sessionId, callback) {
  const areasCol = collection(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION);
  return onSnapshot(areasCol, (snap) => {
    const areas = snap.docs.map((d) => {
      const data = d.data();
      const cells = Array.isArray(data.cells) ? data.cells.map((c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 })) : [];
      return { id: d.id, name: data.name || "", type: data.type || "freeform", cells, color: data.color || "#6366f180" };
    });
    callback(areas);
  });
}

/**
 * Adiciona uma área de efeito.
 * @param {string} sessionId
 * @param {{ name: string, type: 'circle'|'cone'|'freeform', cells: Array<{x: number, y: number}>, color?: string }} data
 */
export async function addArea(sessionId, data) {
  const areasCol = collection(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION);
  await addDoc(areasCol, {
    name: data.name || "Área",
    type: data.type || "freeform",
    cells: data.cells || [],
    color: data.color || "#6366f180",
  });
}

/**
 * Remove uma área de efeito.
 */
export async function deleteArea(sessionId, areaId) {
  const areaRef = doc(db, SESSIONS_COLLECTION, sessionId, AREAS_SUBCOLLECTION, areaId);
  await deleteDoc(areaRef);
}
