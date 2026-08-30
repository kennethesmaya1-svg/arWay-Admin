import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDlsJm4H5dGlM4GcvB-y3rCcQm41sbi4As",
  authDomain: "arway-ar-navigation.firebaseapp.com",
  projectId: "arway-ar-navigation",
  storageBucket: "arway-ar-navigation.firebasestorage.app",
  messagingSenderId: "248538698533",
  appId: "1:248538698533:web:2858a243eb1219f99100cc",
  measurementId: "G-5ZC9SXX5D8"
};

export const app = initializeApp(firebaseConfig);