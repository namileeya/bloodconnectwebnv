// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC2RnQCThHOemJMooSlNdZL_BKgnIo8dvU",
  authDomain: "bloodconnectnv.firebaseapp.com",
  projectId: "bloodconnectnv",
  storageBucket: "bloodconnectnv.firebasestorage.app",
  messagingSenderId: "250941063322",
  appId: "1:250941063322:web:cf7c5012407df488741f23",
  measurementId: "G-SW9BJJZ1SG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Make sure this line exists
const analytics = getAnalytics(app); // Optional

console.log("🔥 Firebase initialized successfully!");
console.log("📊 Firestore database:", db);

// Export both app and db
export { app, db, analytics };
export default app;