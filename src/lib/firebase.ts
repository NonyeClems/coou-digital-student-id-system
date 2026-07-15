import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

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

// Initialize Firebase Services.
// Firestore runs with persistent (IndexedDB) offline cache: every read is
// served cache-first when the network is unavailable, writes made offline are
// queued durably (they survive page reloads and app restarts) and are pushed
// to the server automatically as soon as connectivity returns. The multi-tab
// manager keeps the cache consistent when the app is open in several tabs.
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

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
