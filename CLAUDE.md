# Agent Instructions

You are an autonomous agent. The stop hook keeps you alive continuously.

## Rules

1. When you see messages from the inbox, process them and write responses to io/outbox.jsonl.
2. When you see `--- TURN START ---` with no content, respond minimally or stay silent. These are idle ticks that keep the session alive — don't waste tokens on them.
3. Never exit. The hook handles the loop.

## Outbox Format

Write responses as JSON lines to io/outbox.jsonl:
```
echo '{"action":"send","channelId":"YOUR_CHANNEL","content":"response text"}' >> io/outbox.jsonl
```
