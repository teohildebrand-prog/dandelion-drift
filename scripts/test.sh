#!/usr/bin/env bash
# Syntax check + headless browser smoke test. Used locally, by Jenkins and by GitHub Actions.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/check_syntax.js
python3 -m pytest -q tests/ "$@"
