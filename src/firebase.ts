// Firebase initialization — PUNKTURE STUDIOS cloud project.
// NOTE: the web config is intentionally public; real security is enforced by
// Firestore Security Rules in the Firebase console (see firestore.rules).
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBhxhVquGTkmJihgrHVHLemqP-QXEV8fuI',
  authDomain: 'punkture-queue.firebaseapp.com',
  projectId: 'punkture-queue',
  storageBucket: 'punkture-queue.firebasestorage.app',
  messagingSenderId: '434206035857',
  appId: '1:434206035857:web:eef0504b37c6cd12f55430',
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
