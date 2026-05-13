#!/bin/bash
# supervisor.sh — restart claude code if the session dies
# usage: bash supervisor.sh [model] [prompt]
# default model: sonnet, default prompt: "Read CLAUDE.md"

MODEL="${1:-sonnet}"
PROMPT="${2:-Read CLAUDE.md}"

echo "[SUPERVISOR] starting claude-heartbeat with model: $MODEL"
echo "[SUPERVISOR] press Ctrl+C to stop"

while true; do
  echo "[SUPERVISOR] launching session..."
  claude --model "$MODEL" --dangerously-skip-permissions "$PROMPT"
  EXIT_CODE=$?
  echo "[SUPERVISOR] session exited with code $EXIT_CODE. restarting in 5s..."
  sleep 5
done
