import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";

const NOTES_PATH = (username) => `users/${username}/notes`;

/**
 * Estrutura de uma nota de perfil:
 * {
 *   id: string,
 *   title: string,
 *   body: string,         // markdown
 *   tags: string[],
 *   pinned: boolean,
 *   createdAt: number,
 *   updatedAt: number,
 * }
 *
 * Notas vivem em users/{username}/notes/{noteId}.
 * Cada usuário só lê/escreve as suas (mesma confiança das fichas).
 */

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter((t) => t.length > 0)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 20);
}

function normalizeNote(data) {
  return {
    title: String(data.title || "").slice(0, 200),
    body: String(data.body || ""),
    tags: sanitizeTags(data.tags),
    pinned: !!data.pinned,
  };
}

/**
 * Inscreve para atualizações em tempo real das notas.
 * @param {string} username
 * @param {(notes: Array<object>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeNotes(username, callback) {
  if (!username) return () => {};
  const col = collection(db, NOTES_PATH(username));
  return onSnapshot(col, (snap) => {
    const notes = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        title: data.title || "",
        body: data.body || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        pinned: !!data.pinned,
        createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
      };
    });
    callback(notes);
  });
}

export async function getAllNotesOnce(username) {
  if (!username) return [];
  const snap = await getDocs(collection(db, NOTES_PATH(username)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria uma nova nota. Retorna o id gerado.
 */
export async function createNote(username, data = {}) {
  if (!username) throw new Error("Usuário inválido.");
  const now = Date.now();
  const payload = {
    ...normalizeNote(data),
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, NOTES_PATH(username)), payload);
  return ref.id;
}

/**
 * Atualiza campos de uma nota existente.
 */
export async function updateNote(username, noteId, data = {}) {
  if (!username || !noteId) return;
  const update = {};
  if (data.title !== undefined) update.title = String(data.title || "").slice(0, 200);
  if (data.body !== undefined) update.body = String(data.body || "");
  if (data.tags !== undefined) update.tags = sanitizeTags(data.tags);
  if (data.pinned !== undefined) update.pinned = !!data.pinned;
  if (Object.keys(update).length === 0) return;
  update.updatedAt = Date.now();
  await updateDoc(doc(db, NOTES_PATH(username), noteId), update);
}

/**
 * Cria/sobrescreve nota com id explícito (útil para import).
 */
export async function upsertNoteWithId(username, noteId, data = {}) {
  if (!username || !noteId) throw new Error("Parâmetros inválidos.");
  const now = Date.now();
  const payload = {
    ...normalizeNote(data),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : now,
    updatedAt: now,
  };
  await setDoc(doc(db, NOTES_PATH(username), noteId), payload);
}

/**
 * Remove uma nota.
 */
export async function deleteNote(username, noteId) {
  if (!username || !noteId) return;
  await deleteDoc(doc(db, NOTES_PATH(username), noteId));
}
