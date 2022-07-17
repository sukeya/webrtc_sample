import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDfeWiwQTubuDDpaeGZZYR2DTQESZfuKyE",
  authDomain: "fir-rtc-fa7f8.firebaseapp.com",
  databaseURL: "https://fir-rtc-fa7f8-default-rtdb.firebaseio.com",
  projectId: "fir-rtc-fa7f8",
  storageBucket: "fir-rtc-fa7f8.appspot.com",
  messagingSenderId: "46016288441",
  appId: "1:46016288441:web:5baf0d35111754e5e0ad68",
  measurementId: "G-HTQKZ0RF2X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
