#!/usr/bin/env bash
set -euo pipefail

# runtest.sh - Automated Isolated Test Runner for MyAbsence v2.0
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "[*] Running MyAbsence test suite..."
node --test --test-concurrency=1 tests/**/*.test.js
echo "[OK] All tests completed with zero errors."
