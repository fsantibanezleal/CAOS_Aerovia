"""Paths for the contract tests: the pipeline package and this folder's helpers."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
for path in (HERE, ROOT / "data-pipeline", ROOT / "scripts"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))
