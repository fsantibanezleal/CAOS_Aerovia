"""Fixtures of the adversarial tests (template 0.08.002, as CAOS_Fragmenta adapted it, to Aerovia's tree): a throwaway copy of
the repository's relevant files, one planted defect, the real gate run on the copy.

The copy holds every file the guards and the tests read and none of the heavy or generated trees (node_modules, dist,
venvs). ``base_copy`` is made once per session; ``repo`` is a fresh copy of it per test. A test that needs only a few
inputs builds a smaller tree with ``planting.make_tree``."""
from __future__ import annotations

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
