#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
gpu=false
if [[ "${1:-}" == --gpu ]]; then gpu=true; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: 00_install-prereqs.sh [--gpu]\n' >&2; exit 2; }
aerovia_node
command -v python3.13 >/dev/null || { printf 'Install Python 3.13 from https://www.python.org/downloads/ or your system package manager.\n' >&2; exit 1; }
python3.13 -c 'import sys; assert sys.version_info[:2] == (3,13); print("Python", sys.version.split()[0])'
if $gpu; then
  command -v python3.12 >/dev/null || { printf 'The tested CUDA environment needs Python 3.12 alongside the CPU Python 3.13 installation.\n' >&2; exit 1; }
  python3.12 --version
fi
git --version
printf 'Prerequisites available. Next: bash scripts/local/01_init.sh\n'
