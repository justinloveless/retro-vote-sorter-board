#!/usr/bin/env bash
# Optional wrapper for stdin/stdout use with POKER_ADVISOR_HANDLER.
# Prefer: node server.mjs --handler gemini-cli
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/gemini-cli.mjs"
