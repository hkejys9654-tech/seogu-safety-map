import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCm3CpLfdNiaD93OkMd0wQx-L2u9LTENKg",
  authDomain: "seogu-safety-map.firebaseapp.com",
  projectId: "seogu-safety-map",
  storageBucket: "seogu-safety-map.firebasestorage.app",
  messagingSenderId: "681010600408",
  appId: "1:681010600408:web:2d45e4dbfe35395bc8faad",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const FAMILY_COLLECTION = "hamkkeFamilies";
