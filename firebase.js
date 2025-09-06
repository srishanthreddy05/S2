// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your Firebase config (already correct)
const firebaseConfig = {
  apiKey: "AIzaSyD4wI4--LzSuGVjaBRPEdUOq4sPpWmaZJI",
  authDomain: "s2-app-49eca.firebaseapp.com",
  projectId: "s2-app-49eca",
  storageBucket: "s2-app-49eca.appspot.com",
  messagingSenderId: "274842107242",
  appId: "1:274842107242:web:6df70686c39a27742e7913",
  measurementId: "G-PH6KS2DZ61"
};

// 🔌 Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
