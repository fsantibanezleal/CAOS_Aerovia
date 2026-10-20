"""The catalog and its guards: every row complete, versions and history, documents covered, and the base-integrity script
admitting exactly the declared model files (the refutation: an undeclared model file does not pass)."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import support as sp

ROOT = sp.ROOT
PY = sys.executable
EXPECTED = ["network", "catalog", "reference-checks", "science", "branch-table", "artifact-manifest", "browser-evidence", "model-manifest",
            "model-registry", "onnx-parity", "model-io", "checkpoint", "engine-worker", "transport", "project", "release-identity", "readiness"]


def run(*args: str, cwd: Path = ROOT) -> subprocess.CompletedProcess:
    return subprocess.run([PY, *args], cwd=cwd, capture_output=True, text=True)


def test_the_catalog_has_a_row_for_every_boundary() -> None:
    assert [r["id"] for r in sp.catalog_rows()] == EXPECTED


def test_every_cell_resolves_and_the_guards_pass() -> None:
    assert run("scripts/check_contracts.py", "docs/contracts/catalog.md", "--repo-root", ".").returncode == 0
    assert run("scripts/check_skeleton.py", "docs/contracts/catalog.md").returncode == 0
    assert run("scripts/check_contract_versions.py").returncode == 0
    proc = run("scripts/check_documents.py")
    assert proc.returncode == 0, proc.stdout
    assert run("scripts/check_readiness.py").returncode == 0


def test_a_swap_test_and_a_producer_test_name_a_real_test_in_every_row() -> None:
    for row in sp.catalog_rows():
        for column in ("producer test", "swap test"):
            for part in row[column].split(", "):
                path, _, name = part.partition("::")
                text = (ROOT / path.split(" ")[0]).read_text(encoding="utf-8")
                assert not name or f"def {name.split(' ')[0]}" in text, (row["id"], column, part)


def test_the_two_model_rows_are_declared_model_slots_with_io() -> None:
    rows = {r["id"]: r for r in sp.catalog_rows()}
    for rid in ("model-io", "checkpoint"):
        assert rows[rid]["model io"] not in ("", "-")
        assert rows[rid]["provider"].startswith("baseline:")
        assert "data/models/*/*.onnx" in rows["model-io"]["documents"] and "data/models/*/*.pt" in rows["checkpoint"]["documents"]


def test_base_integrity_admits_the_declared_models() -> None:
    proc = run("scripts/check_base_integrity.py")
    assert proc.returncode == 0, proc.stdout
    assert "38 model file(s)" in proc.stdout or "model file(s) admitted" in proc.stdout


def _repo(tmp: Path, extra: str | None) -> Path:
    """A one-commit repository holding the catalog, one declared model, and optionally one more tracked file."""
    root = tmp / "repo"
    (root / "docs" / "contracts").mkdir(parents=True)
    shutil.copy(sp.CATALOG, root / "docs" / "contracts" / "catalog.md")
    (root / "data" / "models" / "topology-mlp").mkdir(parents=True)
    (root / "data" / "models" / "topology-mlp" / "a.onnx").write_bytes(b"x" * 100)
    if extra:
        target = root / extra
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"x" * 100)
    for cmd in (["init", "-q"], ["add", "-A"], ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x"]):
        subprocess.run(["git", *cmd], cwd=root, check=True, capture_output=True)
    return root


def test_an_undeclared_model_file_does_not_pass_base_integrity(tmp_path: Path) -> None:
    ok = _repo(tmp_path / "ok", None)
    assert run(str(ROOT / "scripts" / "check_base_integrity.py"), str(ok)).returncode == 0
    for extra in ("models/stray.pt", "data/other/stray.onnx", "data/models/stray.onnx", "data/models/x/y/stray.pt"):
        root = _repo(tmp_path / extra.replace("/", "_"), extra)
        proc = run(str(ROOT / "scripts" / "check_base_integrity.py"), str(root))
        assert proc.returncode == 1, (extra, proc.stdout)
        assert extra in proc.stdout


def test_a_declared_model_over_five_megabytes_fails(tmp_path: Path) -> None:
    root = _repo(tmp_path, None)
    (root / "data" / "models" / "topology-mlp" / "a.onnx").write_bytes(b"x" * (5 * 1024 * 1024 + 1))
    subprocess.run(["git", "add", "-A"], cwd=root, check=True, capture_output=True)
    proc = run(str(ROOT / "scripts" / "check_base_integrity.py"), str(root))
    assert proc.returncode == 1 and "over 5 MB" in proc.stdout


def test_check_documents_skips_binary_and_csv_documents_and_catches_a_bad_json(tmp_path: Path) -> None:
    root = tmp_path / "r"
    shutil.copytree(ROOT / "docs", root / "docs")
    shutil.copytree(ROOT / "data", root / "data")
    (root / "data" / "models" / "t").mkdir(parents=True)
    (root / "data" / "models" / "t" / "m.onnx").write_bytes(bytes([0x80, 0x81, 0xff]))
    assert run(str(ROOT / "scripts" / "check_documents.py"), str(root)).returncode == 0
    (root / "docs" / "contracts" / "fixtures" / "data" / "artifacts" / "manifest.json").write_text("{}", encoding="utf-8")
    proc = run(str(ROOT / "scripts" / "check_documents.py"), str(root))
    assert proc.returncode == 1 and "artifact-manifest" in proc.stdout


def test_a_schema_change_without_a_version_bump_is_refused(tmp_path: Path) -> None:
    root = tmp_path / "r"
    shutil.copytree(ROOT / "docs", root / "docs")
    shutil.copytree(ROOT / "scripts", root / "scripts")
    schema = root / "docs" / "contracts" / "schemas" / "project.schema.json"
    schema.write_text(schema.read_text(encoding="utf-8").replace('"title": "Aerovia project file"', '"title": "Other title"'), encoding="utf-8", newline="\n")
    proc = subprocess.run([PY, "scripts/check_contract_versions.py", "--repo-root", str(root)], cwd=root, capture_output=True, text=True)
    assert proc.returncode == 1 and "project" in proc.stdout
