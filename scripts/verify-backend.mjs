/**
 * End-to-end backend verification suite. Exercises the exact same reads and
 * writes the app performs (enrollment, QR verification lookup, admin CRUD,
 * security rules) against the Firebase Local Emulator Suite and reports
 * PASS/FAIL for each check.
 *
 * Run with emulators managed automatically:   npm run test:backend
 * Run against already-running emulators:      node scripts/verify-backend.mjs
 *
 * Only ever talks to the local emulators (demo- project id) - it cannot
 * touch production data.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-coou-student-id';
const HOST = process.env.EMULATOR_HOST || '127.0.0.1';
const ADMIN_EMAIL = 'admin@coou.edu.ng';
const ADMIN_PASSWORD = 'Admin123!';

const RUN = Date.now(); // unique suffix so the suite is re-runnable on a warm emulator

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed++;
  console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
}
function bad(name, detail) {
  failed++;
  failures.push(name);
  console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` - ${detail}` : ''}`);
}
function check(name, condition, detail) {
  condition ? ok(name) : bad(name, detail);
}
async function expectDenied(name, fn) {
  try {
    await fn();
    bad(name, 'operation unexpectedly succeeded');
  } catch (err) {
    check(name, err?.code === 'permission-denied', `unexpected error: ${err?.code || err}`);
  }
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Each client gets its own app instance so several identities can act at once. */
function makeClient(name) {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, name);
  const auth = getAuth(app);
  const db = getFirestore(app);
  // Ports must match the "emulators" section of firebase.json.
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, HOST, 8181);
  return { auth, db };
}

// Mirrors toDocId() in src/lib/utils.ts (the QR/document-ID contract).
const toDocId = (reg) => reg.trim().replace(/\//g, '-');

// Mirrors how StudentPortal builds the QR payload and how Scanner parses it.
function qrPayloadFor(docId, baseUrl = 'https://coou-id.example.com') {
  return `${baseUrl}/verify/${encodeURIComponent(docId)}`;
}
function parseQrPayload(decodedText) {
  let id = decodedText.trim();
  if (id.includes('/verify/')) {
    const parts = id.split('/verify/');
    id = parts[parts.length - 1];
  }
  try { id = decodeURIComponent(id); } catch { /* raw value */ }
  return id;
}

async function main() {
  console.log(`\nCOOU Digital Student ID - backend verification (emulators at ${HOST})`);

  const studentA = makeClient('studentA');
  const studentB = makeClient('studentB');
  const adminClient = makeClient('admin');
  const anonymous = makeClient('anonymous'); // never signs in - simulates a phone scanning a QR

  // ---------------------------------------------------------------- accounts
  section('1. Account registration (Firebase Auth)');

  const emailA = `student.a.${RUN}@example.com`;
  const emailB = `student.b.${RUN}@example.com`;
  const credA = await createUserWithEmailAndPassword(studentA.auth, emailA, 'Password1!');
  const credB = await createUserWithEmailAndPassword(studentB.auth, emailB, 'Password1!');
  check('students can register accounts', !!credA.user.uid && !!credB.user.uid);

  await setDoc(doc(studentA.db, 'profiles', credA.user.uid), {
    uid: credA.user.uid, email: emailA, displayName: 'Student A', role: 'student',
  });
  const profileA = await getDoc(doc(studentA.db, 'profiles', credA.user.uid));
  check('profile document persisted with role "student"',
    profileA.exists() && profileA.data().role === 'student');
  await setDoc(doc(studentB.db, 'profiles', credB.user.uid), {
    uid: credB.user.uid, email: emailB, displayName: 'Student B', role: 'student',
  });

  // ---------------------------------------------------------- enrollment (2)
  section('2. Enrollment submission persists to Firestore');

  const regNumberA = `2021/CS/${RUN % 100000}`; // slash format exercises toDocId()
  const docIdA = toDocId(regNumberA);
  const studentRecordA = {
    name: 'Student A Test',
    email: emailA,
    phone: '08012345678',
    gender: 'Male',
    dob: '2003-04-15',
    bloodGroup: 'O+',
    religion: 'Christianity',
    department: 'Computer Science',
    admissionYear: 2021,
    level: '400 Level',
    passportURL: 'data:image/jpeg;base64,dGVzdA==',
    id: regNumberA,
    docId: docIdA,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
  };
  await setDoc(doc(studentA.db, 'students', docIdA), studentRecordA);

  const persisted = await getDoc(doc(studentA.db, 'students', docIdA));
  check('enrollment creates the Firestore document', persisted.exists());
  if (persisted.exists()) {
    const data = persisted.data();
    const expectedKeys = Object.keys(studentRecordA);
    const missing = expectedKeys.filter((k) => !(k in data));
    check('document structure matches the Student data model',
      missing.length === 0, `missing fields: ${missing.join(', ')}`);
    check('field values persisted exactly as submitted',
      data.id === regNumberA && data.email === emailA && data.status === 'active' &&
      data.department === 'Computer Science' && data.level === '400 Level');
  }

  // StudentPortal's "does this account already have a record" query
  const byEmail = await getDocs(query(
    collection(studentA.db, 'students'), where('email', '==', emailA), limit(1)));
  check('record is immediately queryable by email (student portal fetch)', !byEmail.empty);

  // duplicate-registration guard used by both enrollment forms
  const dupCheck = await getDoc(doc(studentB.db, 'students', docIdA));
  check('duplicate registration number is detectable before submission',
    dupCheck.exists() && dupCheck.data().email !== emailB);

  // ------------------------------------------------------------- QR code (1)
  section('3. QR code resolves to the correct student (public, unauthenticated)');

  const qrA = qrPayloadFor(docIdA);
  const parsedId = parseQrPayload(qrA);
  check('QR payload round-trips to the correct document id', parsedId === docIdA);

  const scannedA = await getDoc(doc(anonymous.db, 'students', parsedId));
  check('scanning device (no login) can read the record', scannedA.exists());
  check('QR for Student A resolves to Student A only',
    scannedA.exists() && scannedA.data().email === emailA && scannedA.data().name === 'Student A Test');

  // fallback path used by Scanner/VerificationPortal when QR carries a raw reg number
  const byIdField = await getDocs(query(
    collection(anonymous.db, 'students'), where('id', '==', regNumberA), limit(1)));
  check('fallback lookup by registration-number field works', !byIdField.empty);

  const unknown = await getDoc(doc(anonymous.db, 'students', 'DOES-NOT-EXIST-123'));
  check('invalid QR id resolves to "record not found" (no crash)', !unknown.exists());

  // ------------------------------------------------------------- admin (3)
  section('4. Administrator authentication and management');

  let adminCred;
  try {
    adminCred = await createUserWithEmailAndPassword(adminClient.auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (err) {
    if (err?.code !== 'auth/email-already-in-use') throw err;
    adminCred = await signInWithEmailAndPassword(adminClient.auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  }
  check('admin credentials authenticate successfully', !!adminCred.user.uid);

  await setDoc(doc(adminClient.db, 'profiles', adminCred.user.uid), {
    uid: adminCred.user.uid, email: ADMIN_EMAIL, displayName: 'COOU Administrator', role: 'admin',
  });
  const adminProfile = await getDoc(doc(adminClient.db, 'profiles', adminCred.user.uid));
  check('allow-listed email may hold the "admin" role',
    adminProfile.exists() && adminProfile.data().role === 'admin');

  // Admin creates a record for a student who has no account (arbitrary email)
  const regNumberC = `2023/LAW/${RUN % 100000}`;
  const docIdC = toDocId(regNumberC);
  await setDoc(doc(adminClient.db, 'students', docIdC), {
    name: 'Student C ByAdmin', email: `student.c.${RUN}@example.com`,
    department: 'Law', admissionYear: 2023, level: '300 Level',
    passportURL: '', id: regNumberC, docId: docIdC,
    createdAt: Date.now(), updatedAt: Date.now(), status: 'active',
    phone: '', gender: 'Female', dob: '', bloodGroup: 'A+', religion: 'Other',
  });
  ok('admin can enroll a student with any email');

  // Admin dashboard listing query
  const listing = await getDocs(query(collection(adminClient.db, 'students'), orderBy('createdAt', 'desc')));
  const listedIds = listing.docs.map((d) => d.id);
  check('admin dashboard query lists all registered students',
    listedIds.includes(docIdA) && listedIds.includes(docIdC));

  // Admin updates a record (suspend)
  await setDoc(doc(adminClient.db, 'students', docIdC), { status: 'suspended', updatedAt: Date.now() }, { merge: true });
  const suspended = await getDoc(doc(anonymous.db, 'students', docIdC));
  check('admin update is immediately visible to verification',
    suspended.exists() && suspended.data().status === 'suspended');

  // ------------------------------------------------------ security rules (3)
  section('5. Role-based access control (Firestore security rules)');

  await expectDenied('unauthenticated client cannot write student records', () =>
    setDoc(doc(anonymous.db, 'students', 'HACKED-1'), { name: 'x', email: 'x@x.com' }));

  await expectDenied('student cannot overwrite another student\'s record', () =>
    setDoc(doc(studentB.db, 'students', docIdA), { ...studentRecordA, name: 'Impersonated' }));

  await expectDenied('student cannot delete another student\'s record', () =>
    deleteDoc(doc(studentB.db, 'students', docIdA)));

  await expectDenied('student cannot self-promote to admin role', () =>
    setDoc(doc(studentB.db, 'profiles', credB.user.uid), {
      uid: credB.user.uid, email: emailB, displayName: 'Student B', role: 'admin',
    }));

  await expectDenied('student cannot read another user\'s profile', () =>
    getDoc(doc(studentB.db, 'profiles', credA.user.uid)));

  // -------------------------------------------------- deletion lifecycle (1)
  section('6. Deleted records fail verification gracefully');

  await deleteDoc(doc(adminClient.db, 'students', docIdC));
  const afterDelete = await getDoc(doc(anonymous.db, 'students', docIdC));
  check('admin can delete a record', !afterDelete.exists());

  await deleteDoc(doc(studentA.db, 'students', docIdA)); // student deletes own record
  const afterOwnDelete = await getDoc(doc(anonymous.db, 'students', docIdA));
  check('student can delete their own record; its QR then reads as not found', !afterOwnDelete.exists());

  // ------------------------------------------------------------------ result
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('  Failed checks:');
    for (const f of failures) console.log(`    - ${f}`);
  }
  console.log('-'.repeat(60) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSuite aborted with an unexpected error:', err?.stack || err);
  console.error('Are the Firebase emulators running? Use: npm run test:backend');
  process.exit(1);
});
