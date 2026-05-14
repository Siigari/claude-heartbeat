#!/usr/bin/env node
// heartbeat.js — stateless autonomous agent via stop hook
//
// Idle: blocks with minimal tick, session stays alive (cheap)
// Message: blocks with message content, sets .responded flag
// After response: sees flag → approves stop → session exits → supervisor restarts clean
//
// Result: each real message gets fresh context. Idle ticks cost ~20 tokens.
//
// env vars:
//   HEARTBEAT_INTERVAL  minimum seconds between idle ticks (default: 60)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CWD = path.resolve(__dirname, '..');
const INBOX = path.join(CWD, 'io', 'inbox.jsonl');
const OFFSET_FILE = path.join(CWD, 'io', '.inbox-offset');
const LAST_TICK_FILE = path.join(CWD, 'io', '.last-tick');
const RESPONDED_FLAG = path.join(CWD, 'io', '.responded');
const RESTART_FLAG = path.join(CWD, 'io', '.restart');
const IS_WIN = process.platform === 'win32';
const MIN_INTERVAL = (parseInt(process.env.HEARTBEAT_INTERVAL || '60')) * 1000;

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

function readOffset() {
  try { return parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeSync(filepath, data) {
  const fd = fs.openSync(filepath, 'w');
  fs.writeSync(fd, data);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

function writeOffset(n) {
  writeSync(OFFSET_FILE, String(n));
}

function readLastTick() {
  try { return parseInt(fs.readFileSync(LAST_TICK_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeLastTick() {
  writeSync(LAST_TICK_FILE, String(Date.now()));
}

function checkInbox() {
  try {
    if (!fs.existsSync(INBOX)) return null;
    const size = fs.statSync(INBOX).size;
    const offset = readOffset();
    if (size <= offset) return null;

    const buf = Buffer.alloc(size - offset);
    const fd = fs.openSync(INBOX, 'r');
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);

    const raw = buf.toString('utf8');
    const nlIndex = raw.indexOf('\n');
    const line = nlIndex === -1 ? raw : raw.slice(0, nlIndex);
    if (!line.trim()) return null;

    // Advance offset by just this one line (+ newline if present)
    writeOffset(offset + Buffer.byteLength(line, 'utf8') + (nlIndex === -1 ? 0 : 1));

    try { return JSON.parse(line); } catch {
      return { ts: new Date().toISOString(), channel: 'inbox', author: 'user', content: line.trim() };
    }
  } catch { return null; }
}

function formatMessage(m) {
  const time = new Date(m.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const channel = m.channel || 'unknown';
  const author = m.author || 'system';
  const content = m.content || '';
  return `[${time}] #${channel} ${author}: ${content}`;
}

function sleepSecs(secs) {
  try {
    if (IS_WIN) {
      execSync(`ping -n ${secs + 1} 127.0.0.1 > nul`, { timeout: (secs + 5) * 1000, windowsHide: true });
    } else {
      execSync(`sleep ${secs}`, { timeout: (secs + 5) * 1000 });
    }
  } catch {}
}

const IDLE_TICK = '--- TURN START ---\n--- TURN END ---';

// --- main ---

// 0. Did the agent just respond to a real message? Signal restart for fresh context.
//    But first check if another message is queued — process it before restarting.
if (fs.existsSync(RESPONDED_FLAG)) {
  fs.unlinkSync(RESPONDED_FLAG);
  const next = checkInbox();
  if (next) {
    writeSync(RESPONDED_FLAG, '');
    block(formatMessage(next));
  }
  writeSync(RESTART_FLAG, '');
  block(IDLE_TICK);
}

// 1. Immediate inbox check — deliver one message
const msg = checkInbox();
if (msg) {
  writeLastTick();
  writeSync(RESPONDED_FLAG, '');
  block(formatMessage(msg));
}

// 2. No messages — check throttle
const elapsed = Date.now() - readLastTick();
if (elapsed < MIN_INTERVAL) {
  sleepSecs(15);

  const retryMsg = checkInbox();
  if (retryMsg) {
    writeLastTick();
    writeSync(RESPONDED_FLAG, '');
    block(formatMessage(retryMsg));
  }

  block(IDLE_TICK);
}

// 3. Interval elapsed — send idle tick
writeLastTick();
block(IDLE_TICK);
