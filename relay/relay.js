#!/usr/bin/env node
// relay.js — bridges outbox.jsonl to discord
// reads new lines from io/outbox.jsonl, sends them via discord.js bot
// minimal. no dependencies beyond discord.js.
//
// usage: BOT_TOKEN=xxx node relay.js
// the agent writes {"action":"send","channelId":"...","content":"..."} to outbox
// this script picks it up and sends it

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');

const OUTBOX = path.resolve(__dirname, '..', 'io', 'outbox.jsonl');
const OFFSET_FILE = path.resolve(__dirname, '..', 'io', '.outbox-offset');
const POLL_MS = 1000;

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('set BOT_TOKEN env var'); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function readOffset() {
  try { return parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}

function writeOffset(n) {
  fs.writeFileSync(OFFSET_FILE, String(n));
}

function poll() {
  if (!fs.existsSync(OUTBOX)) return;
  const content = fs.readFileSync(OUTBOX, 'utf8');
  const offset = readOffset();
  if (content.length <= offset) return;

  const newContent = content.slice(offset);
  writeOffset(content.length);

  const lines = newContent.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.action === 'typing' && msg.channelId) {
        client.channels.fetch(msg.channelId).then(ch => {
          if (ch) ch.sendTyping();
        }).catch(() => {});
        continue;
      }
      if (msg.action !== 'send' || !msg.channelId || !msg.content) continue;
      client.channels.fetch(msg.channelId).then(channel => {
        if (!channel) return;
        const opts = { content: msg.content };
        if (msg.files && msg.files.length > 0) {
          opts.files = msg.files.map(f => new AttachmentBuilder(f));
        }
        channel.send(opts).then(sent => {
          console.log(`[RELAY] → ${channel.name}: ${sent.id}`);
        });
      }).catch(err => {
        console.error(`[RELAY] error: ${err.message}`);
      });
    } catch {}
  }
}

client.once('ready', () => {
  console.log(`[RELAY] ${client.user.tag} online`);
  // initialize offset to current file size (don't replay old messages)
  if (!fs.existsSync(OFFSET_FILE) && fs.existsSync(OUTBOX)) {
    writeOffset(fs.readFileSync(OUTBOX, 'utf8').length);
  }
  setInterval(poll, POLL_MS);
});

client.login(TOKEN);
