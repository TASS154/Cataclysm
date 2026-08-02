import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

export async function saveSessionRoll(sessionId, rollData) {
  if (!sessionId) return;
  try {
    await addDoc(collection(db, "sessions", sessionId, "rolls"), {
      ...rollData,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error saving session roll:", error);
  }
}

export function subscribeSessionRolls(sessionId, callback, limitCount = 40) {
  if (!sessionId) return () => {};
  const q = query(
    collection(db, "sessions", sessionId, "rolls"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error("subscribeSessionRolls", err)
  );
}
