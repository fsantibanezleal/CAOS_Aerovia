"""Helpers for the plants that need the installed web packages: the copy's ``frontend/node_modules`` becomes the real
one (a junction on Windows, a symlink elsewhere), as in the template suite, and is removed again before the copy goes."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from planting import ROOT

NODE = shutil.which("node")
NODE_MODULES = ROOT / "frontend" / "node_modules"
SHELL_INSTALLED = (NODE_MODULES / "@fasl-work" / "caos-app-shell").is_dir()


def link_node_modules(frontend: Path) -> None:
    target = frontend / "node_modules"
    if target.is_dir() and not target.is_symlink():
        shutil.rmtree(target)  # the copy holds only the executive schema the SDD guard reads (conftest add_schema)
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", str(target), str(NODE_MODULES)], check=True, capture_output=True)
    else:
        target.symlink_to(NODE_MODULES, target_is_directory=True)


def unlink_node_modules(frontend: Path) -> None:
    target = frontend / "node_modules"
    if os.name == "nt":
        os.rmdir(target)  # a junction: removes the link, never the real tree
    elif target.is_symlink():
        target.unlink()  # a symlink: os.rmdir raises NotADirectoryError on it (Linux CI)
