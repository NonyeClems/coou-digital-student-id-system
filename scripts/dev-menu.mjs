/**
 * COOU Digital Student ID - interactive development console.
 *
 * Entry point: `npm start`
 *
 * Replaces the old "terminal gets cleared and you re-run commands by hand"
 * workflow with a menu:
 *
 *   - Start the app against the LOCAL Firebase Emulator Suite (recommended)
 *   - Start the app against live/production Firebase (.env.local credentials)
 *   - Run the backend verification suite
 *   - Type-check the project
 *   - Exit
 *
 * While the app is running:
 *   [R] Start Over - kills the dev server (and emulators), resets state and
 *       returns to the menu, without re-launching anything by hand.
 *   [Q] Exit       - gracefully shuts everything down and quits.
 */
import { spawn, exec } from 'node:child_process';
import readline from 'node:readline';
import os from 'node:os';
import {
  DEMO_PROJECT,
  AUTH_PORT,
  FIRESTORE_PORT,
  EMULATOR_UI_PORT,
  portBusy,
  firestoreEmulatorUp,
  authEmulatorUp,
  cleanupStaleEmulators,
} from './emulator-utils.mjs';

const isWin = process.platform === 'win32';
const isTTY = process.stdin.isTTY;

const APP_PORT = Number(process.env.PORT) || 3000;

/** Children belonging to the currently running session. */
let children = [];
/** True while the current session owns emulator processes it started itself. */
let sessionStartedEmulators = false;

const color = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function banner() {
  console.log('');
  console.log(color.green(color.bold('  COOU Digital Student ID - Development Console')));
  console.log(color.dim('  Chukwuemeka Odumegwu Ojukwu University'));
  console.log('');
}

function lanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true, // resolves npm/npx .cmd shims on Windows
    env: { ...process.env, ...extraEnv },
  });
  children.push(child);
  return child;
}

function killTree(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(resolve, 8000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    if (isWin) {
      exec(`taskkill /pid ${child.pid} /T /F`, () => {});
    } else {
      child.kill('SIGINT');
    }
  });
}

async function stopSession() {
  const toKill = children;
  children = [];
  if (toKill.length > 0) {
    console.log('');
    console.log(color.yellow('  Shutting down dev server / emulators...'));
    await Promise.all(toKill.map(killTree));
    if (sessionStartedEmulators) {
      // firebase-tools on Windows can leave the Java Firestore emulator
      // alive after its parent dies; free the ports for the next start.
      await cleanupStaleEmulators();
    }
    console.log(color.yellow('  All processes stopped.'));
  }
  sessionStartedEmulators = false;
}

async function gracefulExit(code = 0) {
  await stopSession();
  console.log('');
  console.log(color.green('  Goodbye! Run "npm start" to launch this console again.'));
  console.log('');
  process.exit(code);
}

/** Waits for a single keypress; resolves with the lowercase key name/char. */
function readKey() {
  return new Promise((resolve) => {
    const onKeypress = (str, key) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.pause();
      if (key && key.ctrl && key.name === 'c') return resolve('ctrl-c');
      resolve((str || key?.name || '').toLowerCase());
    };
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
  });
}

async function waitForHttp(url, label, timeoutMs, failedCheck) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (failedCheck && failedCheck()) {
      throw new Error(`${label} exited before it became ready`);
    }
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 750));
    }
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function runToCompletion(command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = run(command, args, extraEnv);
    child.once('exit', (code) => {
      children = children.filter((c) => c !== child);
      resolve(code ?? 1);
    });
  });
}

/**
 * QR codes embed the page origin; a phone cannot reach "localhost", so when
 * the developer has not configured VITE_APP_BASE_URL we point it at this
 * machine's LAN address to make on-phone QR scanning work out of the box.
 */
function qrBaseUrlEnv() {
  if (process.env.VITE_APP_BASE_URL) return {};
  const ip = lanIp();
  return ip ? { VITE_APP_BASE_URL: `http://${ip}:${APP_PORT}` } : {};
}

async function startSession(mode) {
  const usingEmulators = mode === 'emulators';
  const extraEnv = qrBaseUrlEnv();

  if (await portBusy(APP_PORT)) {
    console.log('');
    console.log(color.red(`  Port ${APP_PORT} is already in use - is another dev server still running?`));
    console.log(color.red(`  Close it, or launch with a different port:  PORT=3001 npm start`));
    return 'menu';
  }

  if (usingEmulators) {
    const alreadyUp = (await firestoreEmulatorUp()) && (await authEmulatorUp());
    if (alreadyUp) {
      console.log('');
      console.log(color.yellow('  Firebase emulators are already running - reusing them.'));
    } else {
      if (await cleanupStaleEmulators()) {
        console.log(color.yellow('  Cleaned up a stale emulator process from a previous session.'));
      }
      console.log('');
      console.log(color.yellow('  Starting Firebase Local Emulator Suite (Auth + Firestore)...'));
      const emulators = run('npx', ['firebase', 'emulators:start', '--project', DEMO_PROJECT]);
      sessionStartedEmulators = true;
      let emulatorsDied = false;
      emulators.once('exit', () => { emulatorsDied = true; });

      try {
        await waitForHttp(`http://127.0.0.1:${FIRESTORE_PORT}/`, 'Firestore emulator', 120000, () => emulatorsDied);
        await waitForHttp(`http://127.0.0.1:${AUTH_PORT}/`, 'Auth emulator', 60000, () => emulatorsDied);
      } catch (err) {
        console.log(color.red(`  ${err.message}`));
        console.log(color.red('  (Is another emulator instance already running, or a port in use?)'));
        await stopSession();
        return 'menu';
      }
    }

    console.log(color.yellow('  Seeding development administrator account...'));
    await runToCompletion('node', ['scripts/seed-admin.mjs']);
  }

  console.log('');
  console.log(color.yellow(usingEmulators
    ? '  Starting the app in EMULATOR mode (no production data is touched)...'
    : '  Starting the app against LIVE Firebase (.env.local credentials)...'));
  const viteArgs = ['vite'];
  if (usingEmulators) viteArgs.push('--mode', 'emulators');
  viteArgs.push('--port', String(APP_PORT), '--strictPort', '--host', '0.0.0.0');
  const vite = run('npx', viteArgs, extraEnv);
  let viteDied = false;
  vite.once('exit', () => { viteDied = true; });

  try {
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`, 'dev server', 60000, () => viteDied);
  } catch (err) {
    console.log(color.red(`  ${err.message}`));
    await stopSession();
    return 'menu';
  }

  const ip = lanIp();
  console.log('');
  console.log(color.green(color.bold('  ------------------------------------------------------------')));
  console.log(color.green(`   App:            http://localhost:${APP_PORT}`));
  if (ip) {
    console.log(color.green(`   On your phone:  http://${ip}:${APP_PORT}   (same Wi-Fi network)`));
  }
  if (usingEmulators) {
    console.log(color.green(`   Emulator UI:    http://localhost:${EMULATOR_UI_PORT}   (inspect Firestore/Auth data)`));
    console.log(color.green('   Admin login:    admin@coou.edu.ng / Admin123!'));
  }
  console.log(color.green(color.bold('  ------------------------------------------------------------')));
  console.log('');
  console.log(`  ${color.bold('[R]')} Start Over (restart the app fresh)   ${color.bold('[Q]')} Exit`);
  console.log('');

  if (!isTTY) {
    // Non-interactive terminal (CI etc.): just keep running until killed.
    await new Promise(() => {});
    return 'menu';
  }

  for (;;) {
    const key = await readKey();
    if (key === 'r') {
      console.log(color.yellow('  Starting over - restarting the application with fresh state...'));
      await stopSession();
      return 'restart';
    }
    if (key === 'q' || key === 'x' || key === 'ctrl-c' || key === 'escape') {
      await gracefulExit(0);
    }
    if (viteDied) {
      console.log(color.red('  The dev server has stopped. Returning to menu.'));
      await stopSession();
      return 'menu';
    }
  }
}

async function menu() {
  banner();
  console.log(`  ${color.bold('[1]')} Start app with LOCAL Firebase emulators ${color.dim('(recommended for development)')}`);
  console.log(`  ${color.bold('[2]')} Start app with LIVE Firebase ${color.dim('(uses .env.local credentials)')}`);
  console.log(`  ${color.bold('[3]')} Run backend verification suite ${color.dim('(end-to-end checks against emulators)')}`);
  console.log(`  ${color.bold('[4]')} Type-check the project`);
  console.log(`  ${color.bold('[Q]')} Exit`);
  console.log('');
  process.stdout.write('  Select an option: ');
  const key = await readKey();
  console.log(key === 'ctrl-c' ? '' : key);
  return key;
}

async function main() {
  if (isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
  } else {
    console.log('(Non-interactive terminal detected - starting emulator mode directly.)');
    await startSession('emulators');
    return;
  }

  // Safety net: make sure children never outlive this process.
  process.on('SIGINT', () => gracefulExit(130));
  process.on('SIGTERM', () => gracefulExit(143));

  let next = null; // set to a mode name to restart that session without re-prompting
  for (;;) {
    const choice = next || (await menu());
    next = null;
    switch (choice) {
      case '1':
      case 'emulators': {
        const outcome = await startSession('emulators');
        if (outcome === 'restart') next = 'emulators';
        break;
      }
      case '2':
      case 'live': {
        const outcome = await startSession('live');
        if (outcome === 'restart') next = 'live';
        break;
      }
      case '3': {
        console.log('');
        const code = await runToCompletion('npm', ['run', 'test:backend', '--silent']);
        console.log(code === 0
          ? color.green('\n  Backend verification PASSED.')
          : color.red(`\n  Backend verification FAILED (exit code ${code}).`));
        console.log(color.dim('  Press any key to return to the menu...'));
        await readKey();
        break;
      }
      case '4': {
        console.log('');
        const code = await runToCompletion('npm', ['run', 'lint', '--silent']);
        console.log(code === 0
          ? color.green('\n  Type-check passed with no errors.')
          : color.red('\n  Type-check reported errors (see above).'));
        console.log(color.dim('  Press any key to return to the menu...'));
        await readKey();
        break;
      }
      case 'q':
      case 'x':
      case '0':
      case 'ctrl-c':
      case 'escape':
        await gracefulExit(0);
        break;
      default:
        console.log(color.dim('  Unrecognized option.'));
        break;
    }
  }
}

main().catch(async (err) => {
  console.error(color.red(`Fatal: ${err?.stack || err}`));
  await gracefulExit(1);
});
