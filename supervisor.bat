@echo off
REM supervisor.bat — restart claude code if the session dies (Windows)
REM usage: supervisor.bat [model] [prompt]

set MODEL=%1
if "%MODEL%"=="" set MODEL=sonnet

set PROMPT=%2
if "%PROMPT%"=="" set PROMPT=Read CLAUDE.md

echo [SUPERVISOR] starting claude-heartbeat with model: %MODEL%
echo [SUPERVISOR] press Ctrl+C to stop

:loop
echo [SUPERVISOR] launching session...
claude --model %MODEL% --dangerously-skip-permissions "%PROMPT%"
echo [SUPERVISOR] session exited. restarting in 5s...
timeout /t 5 /nobreak
goto loop
