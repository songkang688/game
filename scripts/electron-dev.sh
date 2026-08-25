#!/usr/bin/env bash
# 开发模式跑 Electron:先起 Vite 开发服务器,再让 Electron 指向它。
set -euo pipefail
cd "$(dirname "$0")/.."

npx vite --port 5173 &
VITE_PID=$!
trap 'kill "$VITE_PID" 2>/dev/null || true' EXIT

# 等开发服务器就绪
for _ in $(seq 1 40); do
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then break; fi
  sleep 0.5
done

ELECTRON_START_URL=http://localhost:5173 npx electron .
