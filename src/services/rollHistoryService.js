import { db } from "../config/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export const saveRollToHistory = async (username, rollData) => {
  try {
    await addDoc(collection(db, `users/${username}/rollHistory`), {
      ...rollData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error saving roll history:", error);
  }
};

export const getRollHistory = (username, callback, limitCount = 10) => {
  if (!username) return () => {};
  
  const q = query(
    collection(db, `users/${username}/rollHistory`),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(history);
  }, (error) => {
    console.error("Error getting roll history:", error);
  });
};

