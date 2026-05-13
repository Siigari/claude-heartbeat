#!/usr/bin/env node
// cron-trigger.js — inject a message into the agent's inbox on a schedule
// usage: node cron-trigger.js
// writes a tick message to io/inbox.jsonl every 60 seconds
// the heartbeat hook picks it up and feeds it to the agent

const fs = require('fs');
const path = require('path');

const INBOX = path.resolve(__dirname, '..', 'io', 'inbox.jsonl');
const INTERVAL_MS = 60000;

function tick() {
  const entry = {
    ts: new Date().toISOString(),
    channel: 'cron',
    author: 'scheduler',
    content: '[CRON] scheduled tick. check your tasks.'
  };
  fs.appendFileSync(INBOX, JSON.stringify(entry) + '\n');
  console.log(`[CRON] tick at ${entry.ts}`);
}

setInterval(tick, INTERVAL_MS);
tick(); // first tick immediately
console.log(`[CRON] running. injecting every ${INTERVAL_MS / 1000}s into ${INBOX}`);
