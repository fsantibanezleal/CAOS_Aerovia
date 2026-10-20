"""The harness proves itself before any plant relies on it: the copy holds what the guards read and no heavy tree, a plant
that plants nothing fails, and a guard run on the clean copy passes."""
from __future__ import annotations

from pathlib import Path

import pytest
from planting import ROOT, edit, guard, make_tree


def test_adversarial_the_copy_holds_the_guarded_tree_and_no_heavy_tree(repo: Path) -> None:
    for rel in ("scripts/check_sdd.py", "docs/design/SDD.md", "product.json", "content/executive.json", "data/readiness.json"):
        assert (repo / rel).is_file(), rel
    assert not (repo / "frontend" / "node_modules" / ".package-lock.json").exists()
    assert not (repo / ".git").exists()


def test_adversarial_a_plant_that_changes_nothing_fails(repo: Path) -> None:
    with pytest.raises(AssertionError, match="the plant would change nothing"):
        edit(repo, "product.json", "a string that is not in product.json", "x")


def test_adversarial_the_tech_matrix_guard_passes_on_the_clean_copy_and_fails_on_a_changed_pin(repo: Path) -> None:
    assert guard(repo, "check_tech_matrix.py").returncode == 0
    req = (repo / "requirements.txt").read_text(encoding="utf-8")
    line = next(ln for ln in req.split("\n") if "==" in ln and not ln.startswith("#"))
    name, version = line.split("==", 1)
    edit(repo, "requirements.txt", line, f"{name}=={version.strip()}.1")
    assert guard(repo, "check_tech_matrix.py").returncode != 0


def test_adversarial_make_tree_copies_only_the_named_inputs(tmp_path: Path) -> None:
    tree = make_tree(tmp_path / "t", "product.json", "docs/contracts")
    assert (tree / "product.json").is_file() and (tree / "docs" / "contracts").is_dir()
    assert not (tree / "frontend").exists()
    assert (ROOT / "frontend").is_dir()
