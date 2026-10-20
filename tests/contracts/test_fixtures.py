"""The provider tree and the examples are generated (tests/contracts/make_fixtures.py): regenerate them in a temporary
directory and hold every file to its schema, so the generator and the committed tree cannot drift from the contracts."""
from __future__ import annotations

import json
import shutil

import pytest

import contract_schemas as cs
import make_fixtures
import pt_reader
import support as sp


@pytest.fixture(scope="module")
def generated(tmp_path_factory):
    out = tmp_path_factory.mktemp("fixtures")
    make_fixtures.build(out, transport=False)
    return out


def test_the_generator_writes_documents_that_satisfy_their_schemas(generated) -> None:
    data = generated / "fixtures" / "data"
    for row, (schema, rel) in sp.FILES.items():
        if row == "readiness":
            continue
        assert cs.errors(schema, json.loads((data / rel[len("data/"):]).read_text(encoding="utf-8"))) == [], row
    assert cs.errors("readiness", json.loads((data / "readiness.json").read_text(encoding="utf-8"))) == []
    ckpt = pt_reader.read_checkpoint(next((data / "models").rglob("*.pt")))
    assert cs.errors("checkpoint", ckpt) == []
    assert cs.errors("model-io", sp.onnx_io(next((data / "models").rglob("*.onnx")))) == []


def test_the_generator_is_stable_apart_from_timings(generated) -> None:
    committed = cs.FIXTURE_ROOT / "data"
    fresh = generated / "fixtures" / "data"
    for rel in ("cases.json", "models/registry.json", "models/parity-fixtures.json", "readiness.json", "artifacts/csv/room-pillar.csv"):
        assert (committed / rel).read_bytes() == (fresh / rel).read_bytes(), rel
    for rel in ("models/topology-mlp/room-pillar.onnx", "models/topology-mlp/room-pillar.pt"):
        assert (committed / rel).read_bytes() == (fresh / rel).read_bytes(), rel


def test_the_fixture_checkpoint_loads_in_torch_when_torch_is_installed() -> None:
    torch = pytest.importorskip("torch")
    path = next((cs.FIXTURE_ROOT / "data" / "models").rglob("*.pt"))
    loaded = torch.load(path, map_location="cpu", weights_only=True)
    assert loaded["schema"] == "aerovia.checkpoint/v1"
    assert all(hasattr(v, "shape") for v in loaded["stateDict"].values())


def test_the_fixture_tree_is_small() -> None:
    total = sum(p.stat().st_size for p in cs.FIXTURE_ROOT.rglob("*") if p.is_file())
    assert total < 1_000_000
    assert shutil.which("git")
