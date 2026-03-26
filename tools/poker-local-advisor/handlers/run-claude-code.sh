#!/usr/bin/env bash
# Optional wrapper so POKER_ADVISOR_HANDLER can point here without chmod+x on the .mjs file.
# Prefer: node server.mjs --handler claude-code
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/claude-code.mjs"
