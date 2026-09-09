#!/usr/bin/env bash
set -euo pipefail

# redeploy.sh - Zero-Friction Redeployment Script
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "[*] Pulling latest updates from active branch..."
git pull origin "$(git rev-parse --abbrev-ref HEAD)"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "[*] Restarting Docker container..."
    docker compose down
    docker compose up -d --build
else
    echo "[*] Restarting server directly..."
    pkill -f "node server.js" || true
    nohup node server.js > app.log 2>&1 &
fi

echo "[OK] Redeployment completed successfully."
