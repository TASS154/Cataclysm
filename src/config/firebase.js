import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2SG2b9DeoVb1uILBVKPej53e9wHURq4E",
  authDomain: "num-sei-57bbb.firebaseapp.com",
  projectId: "num-sei-57bbb",
  storageBucket: "num-sei-57bbb.firebasestorage.app",
  messagingSenderId: "617984148831",
  appId: "1:617984148831:web:b7f14392449a4389a022ea",
  measurementId: "G-1390LQNF0M"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;

