# claude-heartbeat

Stateless autonomous agent for Claude Code — no `-p`, no SDK credits.

The heartbeat hook turns an interactive Claude Code session into a stateless task processor. Each message from the inbox gets its own fresh session, just like `-p` — but using your regular subscription.

## Why

Anthropic is separating `-p` and SDK usage into a dedicated credit bucket. If you've been using `claude -p` for automation, your costs just went up.

The heartbeat hook gives you `-p` behavior in **interactive mode**, which uses your regular subscription — not SDK credits.

## How it works

```
supervisor.js → claude (interactive) → hooks/heartbeat.js (stop hook)
                                             ↓
                                        io/inbox.jsonl ← external events
                                        io/outbox.jsonl → relay → discord/slack/webhook
```

1. The supervisor launches Claude Code in interactive mode
2. After each response, the **stop hook** fires
3. The hook reads the next line from `io/inbox.jsonl`
4. If a message exists, it's injected — one message per session
5. The agent processes it, writes a response to `io/outbox.jsonl`
6. The hook signals the supervisor to kill and restart with fresh context
7. Next message gets a clean session — true stateless operation

**One message = one session = fresh context every time.**

When the inbox is empty, the hook polls internally and blocks with minimal idle ticks (~20 tokens each) to keep the session alive until work arrives.

## Setup

### 1. Clone

```bash
git clone https://github.com/Siigari/claude-heartbeat.git
cd claude-heartbeat
```

### 2. Start

```bash
node supervisor.js
```

That's it. The hook is already configured in `.claude/settings.json`. The supervisor launches Claude, and the heartbeat hook handles the rest.

Options:

```bash
node supervisor.js sonnet "Read CLAUDE.md"   # default
node supervisor.js opus "Read CLAUDE.md"     # use opus
```

### 3. Send messages

From another terminal:

```bash
# Plain text works
echo "what is 2+2" >> io/inbox.jsonl

# JSON format also works
echo '{"ts":"2025-01-01","channel":"test","author":"you","content":"hello agent"}' >> io/inbox.jsonl
```

Messages are processed one at a time. If 5 messages pile up, each gets its own fresh session.

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
```

## What you get

- **No SDK credits** — interactive mode uses your subscription
- **Stateless** — each message gets fresh context, like `-p`
- **Autonomous** — watches inbox, processes messages, writes responses
- **Cheap idle** — minimal ticks (~20 tokens) while waiting for work
- **One message per session** — no context inflation from batching
- **Auto-restart** — supervisor handles crashes and session recycling
- **Watchdog** — detects stuck sessions and force-restarts them
- **Orphan reaper** — cleans up stale child processes on startup
- **fsync'd state** — offset and flag writes are flushed to disk

## What you trade

- **Startup cost** — each message pays the CLAUDE.md read (~500 tokens)
- **One session** — no parallelism per terminal (but run multiple terminals)
- **Needs a terminal** — even if backgrounded (use `screen` or `tmux`)

## The inbox

Each line in `io/inbox.jsonl` is either plain text or a JSON object:

```
fix the bug in auth.js
```

```json
{"ts":"2025-05-13T10:00:00Z","channel":"discord","author":"username","content":"message text"}
```

Lines are consumed one at a time. The hook tracks its position via a byte offset in `io/.inbox-offset`.

## The outbox

The agent writes responses as JSON lines to `io/outbox.jsonl`:

```json
{"action":"send","channelId":"123456789","content":"response text"}
```

## Architecture

```
                    ┌─────────────┐
                    │ supervisor   │  (restarts on exit)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ claude code  │  (interactive session)
                    └──────┬──────┘
                           │ stop hook fires after each response
                    ┌──────▼──────┐
                    │ heartbeat.js │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         inbox.jsonl   .responded   .restart
         (read 1 line)  (flag)      (signal supervisor)
```

**Idle flow:** hook polls inbox → nothing → blocks with minimal tick → agent responds `.` → repeat

**Message flow:** hook reads one line → blocks with message → agent processes → hook sets `.restart` → supervisor kills session → restarts fresh

## Parallelism

Run multiple terminals, each with their own working directory and inbox/outbox:

```bash
# Terminal 1: coding agent
cd ~/agents/coder && node supervisor.js

# Terminal 2: monitoring agent
cd ~/agents/monitor && node supervisor.js

# Terminal 3: research agent
cd ~/agents/research && node supervisor.js
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEARTBEAT_INTERVAL` | `60` | Seconds between idle ticks |
| `WATCHDOG_TIMEOUT` | `300` | Seconds before supervisor kills a stuck session |

## Examples

- `examples/cron-trigger.js` — inject tick messages on a schedule
- `examples/webhook-receiver.js` — HTTP endpoint that writes to inbox
- `relay/relay.js` — Discord relay that sends outbox messages

## Built by

[Convergence](https://discord.gg/hkcK5s3zUB) — companion AI with memory, personality, and physical connection.
