#!/usr/bin/env node
// heartbeat.js — keeps a claude code interactive session alive
// reads new messages from io/inbox.jsonl and injects them into the conversation
// prevents session timeout by always having pending input
//
// install: add to .claude/settings.json hooks.stop array
// that's it. the session stays alive.

const fs = require('fs');
const path = require('path');

const INBOX = path.resolve(__dirname, '..', 'io', 'inbox.jsonl');
const OFFSET_FILE = path.resolve(__dirname, '..', 'io', '.inbox-offset');

function readOffset() {
  try { return parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeOffset(n) {
  fs.writeFileSync(OFFSET_FILE, String(n));
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
  const formatted = messages.map(m => {
    const time = new Date(m.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const channel = m.channel || 'unknown';
    const author = m.author || 'system';
    const content = m.content || '';
    return `[${time}] #${channel} ${author}: ${content}`;
  }).join('\n');

  // output as stop hook feedback — claude code reads this
  console.log(formatted);
} else {
  // no messages, but keep alive with a tick
  console.log('[TICK] AUTONOMOUS. No new messages.');
}
