import csv
import json
from pathlib import Path
import pytest

from aerovia_pipeline.cli import main
from aerovia_pipeline.cases import create_cases
from aerovia_pipeline.io import digest, export_csv, load_networks, verify_artifacts, write_json
from aerovia_pipeline.model import NetworkError, solve


def test_deterministic_authoring_and_input_roundtrip(tmp_path):
    first,second=create_cases(),create_cases()
    assert digest(first)==digest(second)
    assert len(first)==12
    path=tmp_path/"cases.json"
    write_json(path,first)
    assert load_networks(path)==first


def test_json_nonfinite_rejected(tmp_path):
    path=tmp_path/"invalid.json"
    path.write_text('{"bad":NaN}',encoding="utf-8")
    with pytest.raises(NetworkError,match="Non-finite"):
        load_networks(path)


def test_solver_export_manifest_and_tamper_detection(tmp_path):
    case=create_cases()[2]
    source=tmp_path/"network.json"
    write_json(source,case)
    output=tmp_path/"results"
    assert main(["solve","--input",str(source),"--output",str(output)])==0
    assert verify_artifacts(output)["verifiedCases"]==1
    path=output/"csv"/(case["id"]+".csv")
    path.write_text(path.read_text(encoding="utf-8")+"tampered",encoding="utf-8")
    with pytest.raises(NetworkError,match="Integrity mismatch"):
        verify_artifacts(output)


def test_csv_exports_effective_overrides(tmp_path):
    n=create_cases()[0]
    edge=n["edges"][2]
    options={"resistanceScale":2,"overrides":{edge["id"]:{"area":12,"resistance":.2,"target":33}}}
    result=solve(n,options)
    path=tmp_path/"flows.csv"
    export_csv(path,n,result,options=options)
    with path.open(encoding="utf-8",newline="") as handle:
        rows=list(csv.DictReader(handle))
    row=next(row for row in rows if row["edge_id"]==edge["id"])
    assert float(row["area_m2"])==12
    assert float(row["resistance_Pa_s2_m6"])==.4
    assert float(row["target_m3_s"])==33


def test_cli_rejects_invalid_parameters_and_leaves_existing_input(tmp_path):
    source=tmp_path/"network.json"
    write_json(source,create_cases()[0])
    before=source.read_bytes()
    assert main(["solve","--input",str(source),"--output",str(tmp_path/"out"),"--speed","9"])==2
    assert source.read_bytes()==before


def test_imported_browser_project_retains_speed_resistance_and_closures(tmp_path):
    n=create_cases()[0]
    options={"speed":.8,"resistanceScale":1.3,"overrides":{"ramp-link-1":{"closed":True},"l0-working-0":{"resistance":2.1,"target":13}}}
    source=tmp_path/"project.json"
    write_json(source,{"schema":"aerovia.project/v1","network":n,"options":options,"savedAt":"2026-09-09T00:00:00Z"})
    output=tmp_path/"result"
    assert main(["solve","--input",str(source),"--output",str(output)])==0
    catalog=json.loads((output/"catalog.json").read_text(encoding="utf-8"))
    assert catalog["cases"][0]["options"]==options
    assert catalog["cases"][0]["result"]["flows"]==pytest.approx(solve(n,options)["flows"],abs=1e-8)
