#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
port="${1:-5908}"
[[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1024 && port <= 65535)) || { printf 'Port must be 1024..65535.\n' >&2; exit 2; }
aerovia_node
if [[ ! -d "$AEROVIA_ROOT/frontend/node_modules" ]]; then bash "$AEROVIA_ROOT/scripts/local/01_init.sh"; fi
cd "$AEROVIA_ROOT/frontend"
exec npm run dev -- --host 127.0.0.1 --port "$port" --strictPort
