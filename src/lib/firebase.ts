import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Your Firebase configuration using Vite environment variables.
// If you are setting up the project, add these keys to a `.env.local` file at the root.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Local development against the Firebase Emulator Suite (`npm run dev:emulators`).
// The emulator host follows the page's hostname rather than being hardcoded to
// localhost, so the app still reaches the emulators when opened from a phone
// on the same network (the emulators are configured to listen on 0.0.0.0).
export const usingEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
if (usingEmulators) {
  // Ports must match the "emulators" section of firebase.json.
  const host = window.location.hostname || 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8181);
  console.info(
    `[firebase] Using LOCAL emulators (project: ${firebaseConfig.projectId}) - ` +
    `Auth http://${host}:9099, Firestore ${host}:8181. No production data is touched.`
  );
}
