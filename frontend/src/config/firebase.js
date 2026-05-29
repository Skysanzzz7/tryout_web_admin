import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Ambil dari Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyB1wUT3kxeucepomcUhxG3R0EYk9ioygMA",
  authDomain: "tryout-app-7ec6d.firebaseapp.com",
  projectId: "tryout-app-7ec6d",
  storageBucket: "tryout-app-7ec6d.firebasestorage.app",
  messagingSenderId: "586607744879",
  appId: "1:586607744879:web:475809c5c7c6871b507a9a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);