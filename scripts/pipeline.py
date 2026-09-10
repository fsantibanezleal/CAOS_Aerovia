#!/usr/bin/env python3
"""Portable entry point; no editable install or machine-specific path required."""
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"data-pipeline"))
from aerovia_pipeline.cli import main

if __name__=="__main__":
    raise SystemExit(main())
