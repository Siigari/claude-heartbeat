#!/usr/bin/env node
// webhook-receiver.js — HTTP endpoint that writes to inbox
// any external service can POST to this and the agent receives it
// usage: PORT=3457 node webhook-receiver.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const INBOX = path.resolve(__dirname, '..', 'io', 'inbox.jsonl');
const PORT = process.env.PORT || 3457;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/inject') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const entry = {
          ts: new Date().toISOString(),
          channel: data.channel || 'webhook',
          author: data.author || 'external',
          content: data.content || ''
        };
        fs.appendFileSync(INBOX, JSON.stringify(entry) + '\n');
        console.log(`[WEBHOOK] ${entry.author}: ${entry.content.substring(0, 80)}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end('bad json');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('POST /inject');
});

server.listen(PORT, () => {
  console.log(`[WEBHOOK] listening on :${PORT}`);
  console.log(`[WEBHOOK] POST /inject {"channel":"...", "author":"...", "content":"..."}`);
});
