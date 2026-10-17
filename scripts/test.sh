#!/usr/bin/env bash
# Syntax check + headless browser smoke test. Used locally, by Jenkins and by GitHub Actions.
set -euo pipefail
cd "$(dirname "$0")/.."
# The smoke test also reports script syntax errors; this check just names the file faster.
if command -v node >/dev/null; then node scripts/check_syntax.js; else echo "node not found, skipping syntax check"; fi
python3 -m pytest -q tests/ "$@"
