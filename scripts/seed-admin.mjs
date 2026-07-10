/**
 * Seeds the local Firebase Emulator Suite with the development administrator
 * account so the Admin Dashboard can be used immediately:
 *
 *   email:    admin@coou.edu.ng
 *   password: Admin123!
 *
 * Run while the emulators are up:   npm run seed:admin
 * (or it runs automatically as part of `npm run dev:emulators` / the dev menu)
 *
 * Safe to run repeatedly - if the account already exists it just verifies it.
 * This script only ever talks to the local emulators (demo- project), never
 * to production Firebase.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-coou-student-id';
const EMULATOR_HOST = process.env.EMULATOR_HOST || '127.0.0.1';
const ADMIN_EMAIL = 'admin@coou.edu.ng';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_NAME = 'COOU Administrator';

const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' });
const auth = getAuth(app);
const db = getFirestore(app);
// Ports must match the "emulators" section of firebase.json.
connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
connectFirestoreEmulator(db, EMULATOR_HOST, 8181);

async function main() {
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    await updateProfile(credential.user, { displayName: ADMIN_NAME });
    console.log(`[seed] Created admin auth account ${ADMIN_EMAIL}`);
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log(`[seed] Admin auth account ${ADMIN_EMAIL} already exists`);
    } else {
      throw err;
    }
  }

  const uid = credential.user.uid;
  const profileRef = doc(db, 'profiles', uid);
  const existing = await getDoc(profileRef);
  if (existing.exists() && existing.data().role === 'admin') {
    console.log('[seed] Admin profile already present with role "admin"');
  } else {
    await setDoc(profileRef, {
      uid,
      email: ADMIN_EMAIL,
      displayName: ADMIN_NAME,
      role: 'admin',
    });
    console.log('[seed] Wrote admin profile with role "admin"');
  }

  console.log('');
  console.log('  Admin credentials for local development:');
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] FAILED:', err?.message || err);
    console.error('[seed] Are the Firebase emulators running? Start them with: npm run emulators');
    process.exit(1);
  });
