#!/usr/bin/env bash
# Serve the game locally: ./scripts/serve.sh [port]   then open http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")/../src"
exec python3 -m http.server "${1:-8000}"
