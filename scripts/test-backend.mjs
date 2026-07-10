/**
 * Runs the backend verification suite (scripts/verify-backend.mjs).
 *
 *   npm run test:backend
 *
 * - If the Firebase emulators are already running (e.g. via the dev menu),
 *   the suite runs directly against them.
 * - Otherwise the emulators are started just for the test run via
 *   `firebase emulators:exec` and shut down afterwards. Any emulator process
 *   that firebase-tools fails to terminate (a recurring issue on Windows,
 *   where the Java Firestore emulator survives shutdown and keeps the port
 *   taken) is cleaned up so the next run starts fresh.
 */
import { spawn } from 'node:child_process';
import {
  DEMO_PROJECT,
  firestoreEmulatorUp,
  authEmulatorUp,
  cleanupStaleEmulators,
} from './emulator-utils.mjs';

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const fsUp = await firestoreEmulatorUp();
  const authUp = await authEmulatorUp();

  if (fsUp && authUp) {
    console.log('[test:backend] Emulators already running - running the suite against them.');
    process.exit(await run('node', ['scripts/verify-backend.mjs']));
  }

  if (fsUp || authUp) {
    console.log('[test:backend] Found a stale emulator process from a previous run - cleaning it up.');
    await cleanupStaleEmulators();
  }

  const code = await run('npx', [
    'firebase', 'emulators:exec',
    '--project', DEMO_PROJECT,
    '--only', 'auth,firestore',
    '"node scripts/verify-backend.mjs"',
  ]);

  // firebase-tools may have orphaned the Java Firestore emulator on exit;
  // remove it so the ports are free for the next run.
  await new Promise((r) => setTimeout(r, 2000));
  if (await cleanupStaleEmulators()) {
    console.log('[test:backend] Cleaned up emulator processes left behind by firebase-tools.');
  }

  process.exit(code);
}

main().catch((err) => {
  console.error('[test:backend] Fatal:', err?.stack || err);
  process.exit(1);
});
