import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

const LIBRARY_ROOT_DOC = "default";

/** Coleção: users/{username}/gmLibrary/default/{type} (5 segmentos — válido no Firestore) */
function libCollectionRef(username, type) {
  return collection(db, "users", username, "gmLibrary", LIBRARY_ROOT_DOC, type);
}

function libDocRef(username, type, id) {
  return doc(db, "users", username, "gmLibrary", LIBRARY_ROOT_DOC, type, id);
}

function normalizeItem(data, type) {
  return {
    name: String(data.name || (type === "images" ? "Imagem" : "Som")).slice(0, 120),
    url: String(data.url || ""),
    tags: Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 15)
      : [],
    createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
  };
}

export function subscribeGmLibrary(username, type, callback) {
  if (!username || !type) return () => {};
  const col = libCollectionRef(username, type);
  return onSnapshot(col, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(items);
  }, (err) => {
    console.error("subscribeGmLibrary error:", err);
    callback([]);
  });
}

export async function addGmLibraryItem(username, type, data) {
  const payload = normalizeItem(data, type);
  if (!payload.url) throw new Error("URL ou arquivo obrigatório.");
  const ref = await addDoc(libCollectionRef(username, type), payload);
  return ref.id;
}

export async function updateGmLibraryItem(username, type, id, data) {
  const update = {};
  if (data.name !== undefined) update.name = String(data.name).slice(0, 120);
  if (data.url !== undefined) update.url = String(data.url);
  if (data.tags !== undefined) {
    update.tags = Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 15)
      : [];
  }
  if (Object.keys(update).length === 0) return;
  await updateDoc(libDocRef(username, type, id), update);
}

export async function deleteGmLibraryItem(username, type, id) {
  await deleteDoc(libDocRef(username, type, id));
}

export async function readFileAsDataUrl(file, maxBytes = 800000) {
  if (!file) throw new Error("Arquivo inválido.");
  if (file.size > maxBytes) {
    throw new Error(`Arquivo muito grande (máx. ~${Math.round(maxBytes / 1000)} KB). Use uma URL externa.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) || String(url).startsWith("data:image/");
}

export function isAudioUrl(url) {
  return /\.(mp3|wav|ogg|m4a|webm)(\?|$)/i.test(url) || String(url).startsWith("data:audio/");
}
