"""Fixtures of the adversarial tests (template 0.08.002, as CAOS_Fragmenta adapted it, to Aerovia's tree): a throwaway copy of
the repository's relevant files, one planted defect, the real gate run on the copy.

The copy holds every file the guards and the tests read and none of the heavy or generated trees (node_modules, dist,
venvs). ``base_copy`` is made once per session; ``repo`` is a fresh copy of it per test. A test that needs only a few
inputs builds a smaller tree with ``planting.make_tree``."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from planting import add_schema

ROOT = Path(__file__).resolve().parents[2]
SKIP = shutil.ignore_patterns("node_modules", "dist", "gate-output", "__pycache__", ".venv*", ".git", ".pytest_cache",
                              ".ruff_cache", "*.pyc", "build", "test-results")
COPIED = ("scripts", "docs", "data", "data-pipeline", "frontend", "tests", ".github", "deploy", "content", "changes")
FILES = ("VERSION", "product.json", "CHANGELOG.md", "requirements.txt", "requirements-gpu.txt", "requirements-surrogates.txt",
         ".template-version", ".gitignore", ".gitattributes", ".env.example", "README.md", "LICENSE", "CONTRIBUTING.md",
         "SECURITY.md", "CODE_OF_CONDUCT.md")


@pytest.fixture(scope="session")
def base_copy(tmp_path_factory: pytest.TempPathFactory) -> Path:
    base = tmp_path_factory.mktemp("repo-base")
    for name in COPIED:
        if (ROOT / name).exists():
            shutil.copytree(ROOT / name, base / name, ignore=SKIP)
    for name in FILES:
        if (ROOT / name).exists():
            shutil.copy2(ROOT / name, base / name)
    return add_schema(base)


@pytest.fixture
def repo(base_copy: Path, tmp_path: Path) -> Path:
    """A fresh copy of the repository's relevant files, to plant one defect in."""
    dest = tmp_path / "repo"
    shutil.copytree(base_copy, dest)
    return dest


# The heavy plants. A plant that needs a full build and a Playwright run (a throwaway copy built with vite, served, and a
# journey of the real e2e suite run on it) takes 35 to 130 s and cannot be narrowed without changing what it plants: it is
# marked `full_plants` and runs only when AEROVIA_FULL_PLANTS is set (at release, locally). CI does not set it (ADR-0074:
# cheap); the check cell of each such row says "(local-only: the full solve, run at release with AEROVIA_FULL_PLANTS=1)".
FULL_PLANTS = bool(os.environ.get("AEROVIA_FULL_PLANTS"))
FULL_PLANTS_REASON = "local-only: the full build and browser run, run at release with AEROVIA_FULL_PLANTS=1"


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "full_plants: a heavy plant (full build and browser run), skipped unless AEROVIA_FULL_PLANTS is set")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if FULL_PLANTS:
        return
    skip = pytest.mark.skip(reason=FULL_PLANTS_REASON)
    for item in items:
        if "full_plants" in item.keywords:
            item.add_marker(skip)
