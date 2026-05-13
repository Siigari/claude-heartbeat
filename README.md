# claude-heartbeat

Keep Claude Code alive and autonomous without `-p`.

The heartbeat hook turns an interactive Claude Code session into an autonomous agent. No `-p` flag. No SDK credits. Just hooks.

## Why

On June 15, 2025, Anthropic is separating `-p` and SDK usage into a dedicated credit bucket. If you've been using `claude -p` for automation, your costs just went up.

The heartbeat hook gives you autonomous behavior in **interactive mode**, which uses your regular subscription — not the new credit.

## How it works

```
You (terminal)  →  Claude Code (interactive)  →  hooks/heartbeat.js
                                                      ↓
                                                 io/inbox.jsonl ← external events
                                                 io/outbox.jsonl → relay → discord/slack/webhook
```

1. Claude Code responds to your messages
2. After each response, the **stop hook** fires
3. The hook reads `io/inbox.jsonl` for new external events
4. If events exist, they're injected as the next user message
5. If no events, a tick message keeps the session alive
6. The agent writes responses to `io/outbox.jsonl`
7. A relay sends outbox messages to Discord/Slack/wherever

The session never times out. The agent processes external events autonomously. No `-p` needed.

## Setup

### 1. Clone this repo into your working directory

```bash
git clone https://github.com/siliroid/claude-heartbeat.git
cd claude-heartbeat
```

### 2. The hook is already configured

`.claude/settings.json` has the stop hook pointing at `hooks/heartbeat.js`. That's it.

### 3. Start Claude Code

```bash
claude --model sonnet "You are an autonomous agent. Read io/inbox.jsonl for new messages. Write responses to io/outbox.jsonl using: echo '{\"action\":\"send\",\"channelId\":\"...\",\"content\":\"...\"}' >> io/outbox.jsonl"
```

### 4. (Optional) Start the relay

```bash
cd relay
npm install discord.js
BOT_TOKEN=your_token node relay.js
```

### 5. (Optional) Inject events

```bash
# From a cron job
node examples/cron-trigger.js

# From an HTTP webhook  
node examples/webhook-receiver.js

# From anything that can write a file
echo '{"ts":"2025-01-01","channel":"test","author":"you","content":"hello agent"}' >> io/inbox.jsonl
```

## What you get

- **No credit limits** — interactive mode uses subscription, not the new SDK credit
- **Persistent context** — the session remembers everything
- **Autonomous behavior** — agent acts on external events without prompting
- **External event processing** — Discord, webhooks, cron, sensors, anything that writes to a file
- **Continuous operation** — hours or days, not one-shot

## What you trade

- **No piping** — can't `echo "fix this" | claude -p`
- **One session** — no parallelism (one agent per terminal)
- **Needs a terminal** — even if backgrounded (use `screen` or `tmux`)
- **Context grows** — long sessions accumulate history (see Managing Context below)

## Managing Context

Need stateless -p behavior? Clear between tasks:

1. **`/clear` between tasks** — wipe context after each task completes. Each task starts fresh, just like -p. The heartbeat hook picks up the next task from the inbox after the clear.

2. **Automatic compaction** — let Claude Code handle it. Context gets summarized automatically when it grows large. Zero intervention.

3. **File-based state** — save results to files, clear, continue. Context is disposable. Files persist.

The key insight: the heartbeat hook handles task routing. The agent clears after each task, reads the next task from inbox, executes it clean. Stateless per-task, persistent per-session.

## Parallelism

Run multiple terminals, each with their own working directory and inbox/outbox. Each session is independent. They share your subscription rate limits but operate in parallel.

```bash
# Terminal 1: coding agent
cd ~/agents/coder && claude "You are a coding agent..."

# Terminal 2: monitoring agent  
cd ~/agents/monitor && claude "You watch logs and alert..."

# Terminal 3: research agent
cd ~/agents/research && claude "You research topics and write reports..."
```

## The inbox format

Each line in `io/inbox.jsonl` is a JSON object:

```json
{"ts":"2025-05-13T10:00:00Z","channel":"discord","author":"username","content":"message text"}
```

## The outbox format

The agent writes responses as JSON lines to `io/outbox.jsonl`:

```json
{"action":"send","channelId":"123456789","content":"response text"}
{"action":"typing","channelId":"123456789"}
```

## Examples

- `examples/cron-trigger.js` — inject tick messages on a schedule
- `examples/webhook-receiver.js` — HTTP endpoint that writes to inbox
- `relay/relay.js` — Discord relay that sends outbox messages

## Built by

[Convergence](https://discord.gg/8dAJgCNZ) — companion AI with memory, personality, and physical connection.

We built a full companion system on top of this pattern. The heartbeat hook is just the beginning.
