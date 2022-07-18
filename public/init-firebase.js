import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCra6bDlw0RSVPn6MVaVuLkl4wStx0SKWY",
  authDomain: "webrtc-sample-77593.firebaseapp.com",
  databaseURL: "https://webrtc-sample-77593-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webrtc-sample-77593",
  storageBucket: "webrtc-sample-77593.appspot.com",
  messagingSenderId: "993972885831",
  appId: "1:993972885831:web:0a077e1886d3b793f6d462",
  measurementId: "G-Y7XEVWPBF6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
