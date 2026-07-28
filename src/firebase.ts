import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import firebaseConfigJson from "../firebase-applet-config.json";

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "AIzaSyAazApXr00a3BZ3jb-KFfNrUP1CPXNFDxQ",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "campuswallethackathon.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "campuswallethackathon",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "campuswallethackathon.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "109089162220",
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "1:109089162220:web:531d4108d2909dc07836c9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const customDatabaseId = metaEnv.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId;

let db: Firestore;
try {
  if (customDatabaseId && customDatabaseId !== "(default)") {
    db = getFirestore(app, customDatabaseId);
  } else {
    db = getFirestore(app);
  }
} catch (err) {
  console.warn("Using default Firestore instance:", err);
  db = getFirestore(app);
}

export { app, auth, db };
export default app;