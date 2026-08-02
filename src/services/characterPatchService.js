import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

/** Lê ficha de outro usuário (necessário para painel GM / ticks). */
export async function fetchCharacterSheet(ownerUsername, characterId) {
  if (!ownerUsername || !characterId) return null;
  const ref = doc(db, "users", ownerUsername, "characters", characterId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Patch parcial / substituição controlada da ficha. */
export async function patchCharacterSheet(ownerUsername, characterId, patch) {
  if (!ownerUsername || !characterId || !patch) return;
  const ref = doc(db, "users", ownerUsername, "characters", characterId);
  await updateDoc(ref, patch);
}

export async function writeCharacterSheet(ownerUsername, characterId, sheet) {
  if (!ownerUsername || !characterId || !sheet) return;
  const ref = doc(db, "users", ownerUsername, "characters", characterId);
  const { id, ...data } = sheet;
  await setDoc(ref, { ...data, owner: ownerUsername }, { merge: true });
}
