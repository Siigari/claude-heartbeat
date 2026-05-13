#!/usr/bin/env node
// supervisor.js — launches claude and kills/restarts when heartbeat requests it
//
// The heartbeat hook writes io/.restart when the agent finishes processing
// a real message. This supervisor polls for that file, kills the session,
// and restarts with fresh context.
//
// usage: node supervisor.js [model] [prompt]

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = __dirname;
const RESTART_FLAG = path.join(CWD, 'io', '.restart');
const MODEL = process.argv[2] || 'sonnet';
const PROMPT = process.argv[3] || 'Read CLAUDE.md';
const IS_WIN = process.platform === 'win32';

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

function launch() {
  cleanup();
  console.log(`[SUPERVISOR] launching claude --model ${MODEL} ...`);

  const child = spawn('claude', ['--model', MODEL, '--dangerously-skip-permissions', PROMPT], {
    stdio: 'inherit',
    shell: true
  });

  const poll = setInterval(() => {
    if (fs.existsSync(RESTART_FLAG)) {
      cleanup();
      console.log('[SUPERVISOR] restart signal received — killing session for fresh context...');
      killProcess(child.pid);
    }
  }, 2000);

  child.on('exit', (code) => {
    clearInterval(poll);
    console.log(`[SUPERVISOR] session exited (code ${code}). restarting in 2s...`);
    setTimeout(launch, 2000);
  });
}

console.log('[SUPERVISOR] starting claude-heartbeat');
console.log('[SUPERVISOR] press Ctrl+C to stop');
launch();
