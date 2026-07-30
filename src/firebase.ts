import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAazApXr00a3BZ3jb-KFfNrUP1CPXNFDxQ",
  authDomain: "campuswallethackathon.firebaseapp.com",
  projectId: "campuswallethackathon",
  storageBucket: "campuswallethackathon.firebasestorage.app",
  messagingSenderId: "109089162220",
  appId: "1:109089162220:web:9f9a874aeb5e49567836c9",
  measurementId: "G-S9XCNDCE50"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);