// Firebase
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDUL2hCXbG8WDW1XuLb3c-37rn4pkOHPWY",
  authDomain: "zomb-io.firebaseapp.com",
  projectId: "zomb-io",
  storageBucket: "zomb-io.firebasestorage.app",
  messagingSenderId: "1073795238758",
  appId: "1:1073795238758:web:64c7a311ff0d38c7b116a7",
  measurementId: "G-FH2H7H34ZB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const realtimeDb = getDatabase(app);

export {
  app,
  analytics,
  db,
  auth,
  realtimeDb
};
