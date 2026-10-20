"""Contract readiness: the document is a pure function of the catalog and the repository; the rules, reasons and states
are the catalog's Missing-data table; the committed document is current; the provider tree's says provider."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import pytest

import contract_schemas as cs
import support as sp
from aerovia_pipeline import __version__ as ENGINE
from aerovia_pipeline import readiness

ROOT = sp.ROOT
RUNTIME = ("engine-worker", "transport", "project", "release-identity")


def by_id(doc: dict) -> dict[str, dict]:
    return {e["id"]: e for e in doc["contracts"]}


def table_reasons() -> dict[str, tuple[str, str]]:
    """{template key: (en, es)} from the catalog's Missing-data states table, keyed by its English reason."""
    text = sp.CATALOG.read_text(encoding="utf-8")
    section = text.split("## Missing-data states", 1)[1].split("\n## ", 1)[0]
    out = {}
    for line in section.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if line.startswith("|") and len(cells) == 6 and cells[0] not in ("Row kind", "---") and not set(cells[0]) <= set("-"):
            out[cells[4]] = (cells[4], cells[5])
    return out


@pytest.fixture()
def tree(tmp_path: Path) -> Path:
    """A writable copy of the parts of the repository the readiness reads."""
    shutil.copytree(ROOT / "data", tmp_path / "data")
    (tmp_path / "docs" / "contracts").mkdir(parents=True)
    shutil.copy(sp.CATALOG, tmp_path / "docs" / "contracts" / "catalog.md")
    shutil.copy(ROOT / "VERSION", tmp_path / "VERSION")
    (tmp_path / "data" / "readiness.json").unlink(missing_ok=True)
    return tmp_path


def test_the_committed_document_is_current() -> None:
    fresh = readiness.compute(repo_root=ROOT)
    path = ROOT / "data" / "readiness.json"
    assert path.read_bytes() == readiness.encode(fresh)
    assert cs.errors("readiness", json.loads(path.read_text(encoding="utf-8"))) == []


def test_the_document_covers_every_row_but_itself_in_catalog_order() -> None:
    doc = json.loads((ROOT / "data" / "readiness.json").read_text(encoding="utf-8"))
    assert [e["id"] for e in doc["contracts"]] == [r["id"] for r in sp.catalog_rows() if r["id"] != "readiness"]
    assert len(doc["contracts"]) == 16


def test_the_real_tree_is_available_and_the_runtime_rows_are_missing() -> None:
    states = by_id(readiness.compute(repo_root=ROOT))
    for rid in RUNTIME:
        assert states[rid]["state"] == "missing" and states[rid]["provenance"] is None, rid
    for rid in ("network", "catalog", "reference-checks", "science", "branch-table", "artifact-manifest", "browser-evidence",
                "model-manifest", "model-registry", "onnx-parity", "model-io", "checkpoint"):
        assert states[rid]["state"] == "available", (rid, states[rid])


def test_catalog_absent_is_missing_for_the_bake_group(tree: Path) -> None:
    (tree / "data" / "artifacts" / "catalog.json").unlink()
    states = by_id(readiness.compute(repo_root=tree))
    for rid in ("catalog", "reference-checks", "branch-table", "artifact-manifest"):
        assert states[rid]["state"] == "missing", rid
    assert states["network"]["state"] == "available"


def test_a_network_the_catalog_lists_but_cases_lacks_is_partial(tree: Path) -> None:
    path = tree / "data" / "cases.json"
    cases = json.loads(path.read_text(encoding="utf-8"))
    dropped = cases.pop(3)["id"]
    path.write_text(json.dumps(cases), encoding="utf-8")
    entry = by_id(readiness.compute(repo_root=tree))["network"]
    assert entry["state"] == "partial" and entry["missing"] == [dropped]
    assert cs.errors("readiness", readiness.compute(repo_root=tree)) == []


def test_a_model_file_the_manifest_lists_but_is_absent_is_partial_for_its_row(tree: Path) -> None:
    (tree / "data" / "models" / "topology-mlp" / "hard-rock.onnx").unlink()
    states = by_id(readiness.compute(repo_root=tree))
    assert states["model-io"]["state"] == "partial" and states["model-io"]["missing"] == ["topology-mlp/hard-rock.onnx"]
    assert states["checkpoint"]["state"] == "available"
    (tree / "data" / "models" / "diagnostics" / "room-pillar-holdout.pt").unlink()
    states = by_id(readiness.compute(repo_root=tree))
    assert states["checkpoint"]["state"] == "partial" and states["checkpoint"]["missing"] == ["diagnostics/room-pillar-holdout.pt"]


def test_a_catalog_baked_by_another_engine_version_is_stale(tree: Path) -> None:
    path = tree / "data" / "artifacts" / "catalog.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["benchmark"]["engineVersion"] = "0.0.9"
    path.write_text(json.dumps(doc), encoding="utf-8")
    states = by_id(readiness.compute(repo_root=tree))
    assert states["catalog"]["state"] == "stale" and states["catalog"]["provenance"] == "real"
    assert "0.0.9" in states["catalog"]["reason"]["en"] and ENGINE in states["catalog"]["reason"]["en"]
    assert states["network"]["state"] == "available"


def test_an_absent_document_is_missing(tree: Path) -> None:
    (tree / "data" / "models" / "browser-evidence.json").unlink()
    (tree / "data" / "artifacts" / "science.json").unlink()
    states = by_id(readiness.compute(repo_root=tree))
    assert states["browser-evidence"]["state"] == "missing" and states["science"]["state"] == "missing"


def test_every_reason_is_held_to_the_catalog_table() -> None:
    table = table_reasons()
    templates = [t for name, t in vars(readiness).items() if name.startswith("T_") and isinstance(t, tuple)]
    assert len(templates) == 7
    for en, es in templates:
        assert (en, es) in table.values(), en


def test_the_catalog_says_the_document_is_bound_to_its_sha() -> None:
    doc = json.loads((ROOT / "data" / "readiness.json").read_text(encoding="utf-8"))
    raw = sp.CATALOG.read_bytes().replace(b"\r\n", b"\n")
    import hashlib
    assert doc["catalog_sha256"] == hashlib.sha256(raw).hexdigest()
    assert doc["product_version"] == (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def test_a_status_the_rules_do_not_know_is_refused(tmp_path: Path) -> None:
    text = sp.CATALOG.read_text(encoding="utf-8").replace("| real |", "| Real |", 1)
    bad = tmp_path / "catalog.md"
    bad.write_text(text, encoding="utf-8")
    with pytest.raises(ValueError):
        readiness.compute(repo_root=ROOT, catalog_path=bad)


def test_the_provider_tree_readiness_says_provider() -> None:
    doc = json.loads((cs.FIXTURE_ROOT / "data" / "readiness.json").read_text(encoding="utf-8"))
    assert cs.errors("readiness", doc) == []
    assert [e["id"] for e in doc["contracts"]] == [r["id"] for r in sp.catalog_rows() if r["id"] != "readiness"]
    for e in doc["contracts"]:
        assert e["state"] == "provider" and e["status"] == "active" and e["provenance"] in ("fixture", "baseline"), e["id"]
    assert (cs.FIXTURE_ROOT / "data" / "readiness.json").read_bytes() == readiness.encode(readiness.provider_document(sp.CATALOG.read_text(encoding="utf-8")))


def test_the_schema_refuses_an_available_row_with_a_reason() -> None:
    doc = json.loads((ROOT / "data" / "readiness.json").read_text(encoding="utf-8"))
    entry = next(e for e in doc["contracts"] if e["state"] == "available")
    entry["reason"] = {"en": "x", "es": "y"}
    assert cs.errors("readiness", doc)
    doc = json.loads((ROOT / "data" / "readiness.json").read_text(encoding="utf-8"))
    entry = next(e for e in doc["contracts"] if e["state"] == "missing")
    entry["provenance"] = "real"
    assert cs.errors("readiness", doc)


def test_the_document_has_no_wall_clock() -> None:
    a = readiness.encode(readiness.compute(repo_root=ROOT))
    b = readiness.encode(readiness.compute(repo_root=ROOT))
    assert a == b and re.search(rb"\d{4}-\d{2}-\d{2}T", a) is None
