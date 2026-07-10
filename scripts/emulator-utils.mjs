/**
 * Shared helpers for working with the Firebase Local Emulator Suite from the
 * dev tooling. Ports and project id must match firebase.json / .env.emulators.
 */
import { exec } from 'node:child_process';
import net from 'node:net';

export const DEMO_PROJECT = 'demo-coou-student-id';
export const AUTH_PORT = 9099;
export const FIRESTORE_PORT = 8181;
export const EMULATOR_UI_PORT = 4000;

const isWin = process.platform === 'win32';

export function portBusy(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}

/** The Firestore emulator answers 200 "Ok" at its HTTP root. */
export async function firestoreEmulatorUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${FIRESTORE_PORT}/`);
    return res.ok && (await res.text()).trim() === 'Ok';
  } catch {
    return false;
  }
}

export async function authEmulatorUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTH_PORT}/`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Kills whatever is still listening on an emulator port. Needed because
 * firebase-tools on Windows regularly fails to terminate the Java Firestore
 * emulator on shutdown, leaving the port taken and every subsequent start
 * failing with "port taken". Only call this for the emulator ports.
 */
export function killPortListeners(port) {
  return new Promise((resolve) => {
    if (isWin) {
      exec('netstat -ano -p tcp', (err, stdout) => {
        if (err) return resolve();
        const pids = new Set();
        for (const line of (stdout || '').split(/\r?\n/)) {
          const cols = line.trim().split(/\s+/);
          // TCP  <local>  <remote>  LISTENING  <pid>
          if (cols[0] === 'TCP' && cols[3] === 'LISTENING' && cols[1]?.endsWith(`:${port}`)) {
            const pid = Number(cols[4]);
            if (pid > 4) pids.add(pid); // never touch System/Idle
          }
        }
        if (pids.size === 0) return resolve();
        let remaining = pids.size;
        for (const pid of pids) {
          exec(`taskkill /pid ${pid} /T /F`, () => { if (--remaining === 0) resolve(); });
        }
      });
    } else {
      exec(`lsof -ti tcp:${port}`, (err, stdout) => {
        const pids = (stdout || '').split(/\s+/).filter(Boolean);
        if (pids.length === 0) return resolve();
        exec(`kill -9 ${pids.join(' ')}`, () => resolve());
      });
    }
  });
}

/** Best-effort cleanup of stale/orphaned emulator processes on our ports. */
export async function cleanupStaleEmulators() {
  const staleFirestore = await portBusy(FIRESTORE_PORT);
  const staleAuth = await portBusy(AUTH_PORT);
  if (staleFirestore) await killPortListeners(FIRESTORE_PORT);
  if (staleAuth) await killPortListeners(AUTH_PORT);
  if (staleFirestore || staleAuth) {
    // Give the OS a moment to release the sockets.
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  }
  return false;
}
