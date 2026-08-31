// Firebase — initialized via the CDN modular SDK so this works with zero
// build step (no bundler needed for bare "firebase/app" style imports).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUL2hCXbG8WDW1XuLb3c-37rn4pkOHPWY",
  authDomain: "zomb-io.firebaseapp.com",
  projectId: "zomb-io",
  storageBucket: "zomb-io.firebasestorage.app",
  messagingSenderId: "1073795238758",
  appId: "1:1073795238758:web:64c7a311ff0d38c7b116a7",
  measurementId: "G-FH2H7H34ZB",
  // Add your specific database URL right here:
  databaseURL: "https://zomb-io-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);

export { app, auth, rtdb };
