#!/usr/bin/env node
// heartbeat.js — keeps a claude code interactive session alive
// reads new messages from io/inbox.jsonl and injects them into the conversation
// prevents session timeout by always having pending input
//
// install: add to .claude/settings.json hooks.stop array
// that's it. the session stays alive.
//
// env vars:
//   HEARTBEAT_INTERVAL  minimum seconds between idle ticks (default: 0 = every response)
//                       set to 60 for one tick/min, 300 for one every 5 min
//                       messages from inbox are ALWAYS delivered regardless of interval

const fs = require('fs');
const path = require('path');

const INBOX = path.resolve(__dirname, '..', 'io', 'inbox.jsonl');
const OFFSET_FILE = path.resolve(__dirname, '..', 'io', '.inbox-offset');
const TICK_FILE = path.resolve(__dirname, '..', 'io', '.last-tick');
const MIN_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '0') * 1000;

function readOffset() {
  try { return parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeOffset(n) {
  fs.writeFileSync(OFFSET_FILE, String(n));
}

function readLastTick() {
  try { return parseInt(fs.readFileSync(TICK_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeLastTick() {
  fs.writeFileSync(TICK_FILE, String(Date.now()));
}

function getNewMessages() {
  if (!fs.existsSync(INBOX)) return [];
  const content = fs.readFileSync(INBOX, 'utf8');
  const offset = readOffset();
  if (content.length <= offset) return [];

  const newContent = content.slice(offset);
  writeOffset(content.length);

  return newContent.trim().split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

// main: check for new messages and output them as stop-hook feedback
const messages = getNewMessages();

if (messages.length > 0) {
  // always deliver real messages regardless of interval
  const formatted = messages.map(m => {
    const time = new Date(m.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const channel = m.channel || 'unknown';
    const author = m.author || 'system';
    const content = m.content || '';
    return `[${time}] #${channel} ${author}: ${content}`;
  }).join('\n');

  console.log(formatted);
  writeLastTick();
} else {
  // no messages — check interval before sending idle tick
  const elapsed = Date.now() - readLastTick();
  if (MIN_INTERVAL > 0 && elapsed < MIN_INTERVAL) {
    // too soon, stay quiet (session waits for user input)
    process.exit(0);
  }
  console.log('Stop hook feedback:\n[TICK] AUTONOMOUS. No new messages. You MUST respond to this. Check inbox. Report status. Never exit.');
  writeLastTick();
}
