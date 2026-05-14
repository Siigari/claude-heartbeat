#!/usr/bin/env node
// supervisor.js — launches claude and kills/restarts when heartbeat requests it
//
// Features:
//   - Polls for .restart flag (heartbeat-driven restart for fresh context)
//   - Watchdog: kills session if .last-tick goes stale (stuck detection)
//   - PID file: tracks child process, reaps orphans on startup
//   - Graceful shutdown on SIGINT/SIGTERM
//
// usage: node supervisor.js [model] [prompt]
// env:   WATCHDOG_TIMEOUT  seconds before a session is considered stuck (default: 300)

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = __dirname;
const IO_DIR = path.join(CWD, 'io');
const RESTART_FLAG = path.join(IO_DIR, '.restart');
const LAST_TICK_FILE = path.join(IO_DIR, '.last-tick');
const PID_FILE = path.join(IO_DIR, '.supervisor.pid');
const CHILD_PID_FILE = path.join(IO_DIR, '.child.pid');
const MODEL = process.argv[2] || 'sonnet';
const PROMPT = process.argv[3] || 'Read CLAUDE.md';
const IS_WIN = process.platform === 'win32';
const WATCHDOG_TIMEOUT = (parseInt(process.env.WATCHDOG_TIMEOUT || '300')) * 1000;

function cleanup() {
  try { fs.unlinkSync(RESTART_FLAG); } catch {}
}

function killProcess(pid) {
  try {
    if (IS_WIN) {
      execSync(`taskkill /PID ${pid} /F /T 2>nul`, { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {}
}

function isProcessRunning(pid) {
  try {
    if (IS_WIN) {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /NH 2>nul`, { encoding: 'utf8', windowsHide: true });
      return out.includes(String(pid));
    } else {
      process.kill(pid, 0);
      return true;
    }
  } catch { return false; }
}

function reapOrphans() {
  for (const pidFile of [CHILD_PID_FILE, PID_FILE]) {
    try {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      if (oldPid && oldPid !== process.pid && isProcessRunning(oldPid)) {
        console.log(`[SUPERVISOR] reaping orphaned process ${oldPid} from ${path.basename(pidFile)}`);
        killProcess(oldPid);
      }
    } catch {}
  }
}

function writePid(file, pid) {
  fs.writeFileSync(file, String(pid));
}

function removePidFiles() {
  try { fs.unlinkSync(PID_FILE); } catch {}
  try { fs.unlinkSync(CHILD_PID_FILE); } catch {}
}

function readLastTick() {
  try { return parseInt(fs.readFileSync(LAST_TICK_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

let currentChild = null;
let currentPoll = null;

function launch() {
  cleanup();
  console.log(`[SUPERVISOR] launching claude --model ${MODEL} ...`);

  const child = spawn('claude', ['--model', MODEL, '--dangerously-skip-permissions', PROMPT], {
    stdio: 'inherit',
    shell: true
  });
  currentChild = child;

  if (child.pid) {
    writePid(CHILD_PID_FILE, child.pid);
  }

  const poll = setInterval(() => {
    // Check restart flag
    if (fs.existsSync(RESTART_FLAG)) {
      cleanup();
      console.log('[SUPERVISOR] restart signal received — killing session for fresh context...');
      killProcess(child.pid);
      return;
    }

    // Watchdog: check if heartbeat is stale
    const lastTick = readLastTick();
    if (lastTick > 0) {
      const age = Date.now() - lastTick;
      if (age > WATCHDOG_TIMEOUT) {
        console.log(`[SUPERVISOR] watchdog: last tick was ${Math.round(age / 1000)}s ago (timeout: ${WATCHDOG_TIMEOUT / 1000}s) — killing stuck session`);
        killProcess(child.pid);
      }
    }
  }, 2000);
  currentPoll = poll;

  child.on('exit', (code) => {
    clearInterval(poll);
    currentChild = null;
    currentPoll = null;
    try { fs.unlinkSync(CHILD_PID_FILE); } catch {}
    console.log(`[SUPERVISOR] session exited (code ${code}). restarting in 2s...`);
    setTimeout(launch, 2000);
  });
}

function shutdown() {
  console.log('\n[SUPERVISOR] shutting down...');
  if (currentPoll) clearInterval(currentPoll);
  if (currentChild && currentChild.pid) killProcess(currentChild.pid);
  removePidFiles();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
if (IS_WIN) {
  process.on('SIGHUP', shutdown);
}

// --- startup ---
reapOrphans();
writePid(PID_FILE, process.pid);

console.log('[SUPERVISOR] starting claude-heartbeat');
console.log(`[SUPERVISOR] watchdog timeout: ${WATCHDOG_TIMEOUT / 1000}s`);
console.log('[SUPERVISOR] press Ctrl+C to stop');
launch();
