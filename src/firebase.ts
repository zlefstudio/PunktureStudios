// Firebase initialization — PUNKTURE STUDIOS cloud project.
// NOTE: the web config is intentionally public; real security is enforced by
// Firestore Security Rules in the Firebase console (see firestore.rules).
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDQHORJgFp4WS9dK6x9MM2D8ycvE92pvb8',
  authDomain: 'punkture-studios.firebaseapp.com',
  projectId: 'punkture-studios',
  storageBucket: 'punkture-studios.firebasestorage.app',
  messagingSenderId: '514800638322',
  appId: '1:514800638322:web:4ec9421ed70cc7613425eb',
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
