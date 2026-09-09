#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# MyAbsence v2.0 - End-to-End Deployment Bundle
# Single-Enter Execution for Global Educational Platform
# ═══════════════════════════════════════════════════════════════════

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "==================================================================="
echo "[*] Initializing MyAbsence v2.0 Production Deployment"
echo "==================================================================="

# 1. Environment & Storage Directory Preparation
echo "[*] Checking runtime storage directories..."
mkdir -p "$APP_DIR/data" "$APP_DIR/public"

# 2. Automated Test Suite Pre-Flight Check
echo "[*] Executing pre-flight automated test suite..."
if command -v node >/dev/null 2>&1; then
    node --test --test-concurrency=1 tests/**/*.test.js
    echo "[OK] Pre-flight tests passed successfully."
else
    echo "[!] Node.js not detected on host, will deploy via Docker container."
fi

# 3. Launch Strategy (Docker or Direct Node)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "[*] Deploying via Docker Compose..."
    docker compose up -d --build
    echo "[OK] MyAbsence container is running."
    echo "[OK] Access endpoint at: http://localhost:3000"
else
    echo "[*] Starting MyAbsence production server directly..."
    nohup node server.js > app.log 2>&1 &
    echo "[OK] Server started in background. Logs: app.log"
    echo "[OK] Access endpoint at: http://localhost:3000"
fi

echo "==================================================================="
echo "[OK] MyAbsence v2.0 is live and ready for educators!"
echo "==================================================================="
