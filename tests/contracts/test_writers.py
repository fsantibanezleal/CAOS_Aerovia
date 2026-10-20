"""Validation at the producers: write_json checks a document against its schema before writing, and a failure stops the
run naming the field. Run on deliberately broken documents in a temporary directory."""
from __future__ import annotations

import copy
import json

import pytest

import support as sp
from aerovia_pipeline.io import write_json, write_manifest
from aerovia_pipeline.model import NetworkError


def test_a_valid_document_is_written_unchanged(tmp_path) -> None:
    nets = sp.networks("bake")
    target = tmp_path / "cases.json"
    write_json(target, nets, schema="network")
    assert json.loads(target.read_text(encoding="utf-8")) == nets
    raw = target.read_bytes()
    assert raw.endswith(b"\n") and b"\r\n" not in raw and not raw.startswith(b"\xef\xbb\xbf")


def test_a_broken_document_stops_the_write_and_names_the_field(tmp_path) -> None:
    nets = copy.deepcopy(sp.networks("bake"))
    nets[2]["edges"][5]["area"] = -4
    target = tmp_path / "out" / "cases.json"
    with pytest.raises(NetworkError) as raised:
        write_json(target, nets, schema="network")
    message = str(raised.value)
    assert "2/edges/5/area" in message and "network" in message
    assert not target.exists(), "nothing may be written for an invalid document"
    assert list(tmp_path.rglob(".aerovia-*")) == []


def test_the_catalog_and_manifest_writers_validate(tmp_path) -> None:
    catalog = copy.deepcopy(sp.doc("bake", "catalog"))
    del catalog["cases"][0]["result"]["flows"]
    with pytest.raises(NetworkError, match="cases/0/result"):
        write_json(tmp_path / "catalog.json", catalog, schema="catalog")
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "catalog.json").write_text("{}", encoding="utf-8")
    with pytest.raises(NetworkError, match="sourceSha256"):
        write_manifest(tmp_path / "a", {"engineVersion": "0.1.0", "sourceSha256": "nothex", "device": "cpu", "caseCount": 1})


def test_a_document_without_a_schema_is_still_written(tmp_path) -> None:
    write_json(tmp_path / "failure.json", {"anything": [1, 2]})
    assert json.loads((tmp_path / "failure.json").read_text(encoding="utf-8")) == {"anything": [1, 2]}


def test_the_pipeline_cli_create_writes_documents_the_schema_accepts(tmp_path) -> None:
    from aerovia_pipeline.cli import main
    out = tmp_path / "cases.json"
    assert main(["create", "--output", str(out)]) == 0
    assert json.loads(out.read_text(encoding="utf-8")) == sp.networks("bake")
