#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "[launcher] node_modules missing, installing deps..."
  npm install
fi

echo "[launcher] starting Vite dev server..."
npm run dev > /tmp/<GAME_NAME>-vite.log 2>&1 &
VITE_PID=$!

echo "[launcher] waiting for server..."
URL=""
for i in {1..80}; do
  URL=$(grep -Eo 'Local:\s+http://[^ ]+' /tmp/<GAME_NAME>-vite.log | tail -n1 | awk '{print $2}' || true)
  if [ -n "$URL" ]; then
    echo "[launcher] server is up (pid=$VITE_PID)"
    break
  fi
  sleep 0.25
done

if [ -z "$URL" ]; then
  echo "[launcher] could not detect server URL; check /tmp/<GAME_NAME>-vite.log"
fi

if [ -n "$URL" ]; then
  echo "[launcher] opening $URL"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" || true; fi
  if command -v open >/dev/null 2>&1; then open "$URL" || true; fi
fi

echo "[launcher] press Enter to stop..."
read -r || true
kill "$VITE_PID" >/dev/null 2>&1 || true
echo "[launcher] stopped."
