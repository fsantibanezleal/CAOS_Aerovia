import csv
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import pytest

from aerovia_pipeline.cli import main
from aerovia_pipeline.cases import create_cases
from aerovia_pipeline.io import digest, export_csv, fetch_network, load_networks, verify_artifacts, write_json
from aerovia_pipeline.model import NetworkError, solve


def test_deterministic_authoring_and_input_roundtrip(tmp_path):
    first,second=create_cases(),create_cases()
    assert digest(first)==digest(second)
    assert len(first)==12
    path=tmp_path/"cases.json"
    write_json(path,first)
    assert load_networks(path)==first
    assert b"\r" not in path.read_bytes()


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
    assert b"\r" not in path.read_bytes()


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


def test_pinned_download_validates_content_and_preserves_target_on_mismatch(tmp_path,monkeypatch):
    payload=json.dumps(create_cases()[0]).encode("utf-8")
    class Response(BytesIO):
        url="https://example.org/network.json"
    monkeypatch.setattr("aerovia_pipeline.io.urlopen",lambda request,timeout:Response(payload))
    path=tmp_path/"downloaded.json"
    receipt=fetch_network("https://example.org/network.json",sha256(payload).hexdigest(),path)
    assert receipt["validated"]
    assert load_networks(path)[0]["id"]=="hard-rock"
    before=path.read_bytes()
    with pytest.raises(NetworkError,match="checksum"):
        fetch_network("https://example.org/network.json","0"*64,path)
    assert path.read_bytes()==before


def test_download_rejects_credentials_and_insecure_redirect(tmp_path,monkeypatch):
    # Assemble a reserved synthetic authority; the repository contains no credential URL.
    invalid_authority=":".join(("invalid-user","invalid-password"))+chr(64)+"example.invalid"
    with pytest.raises(NetworkError,match="credentials"):
        fetch_network("https://"+invalid_authority+"/input","0"*64,tmp_path/"target")
    class Response(BytesIO):
        url="http://example.org/network.json"
    monkeypatch.setattr("aerovia_pipeline.io.urlopen",lambda request,timeout:Response(b"{}"))
    with pytest.raises(NetworkError,match="HTTPS"):
        fetch_network("https://example.org/network.json","0"*64,tmp_path/"target")


def test_late_failure_preserves_all_previous_accepted_artifact_bytes(tmp_path):
    good=create_cases()[0]
    source=tmp_path/"input.json"
    output=tmp_path/"accepted"
    write_json(source,good)
    assert main(["solve","--input",str(source),"--output",str(output)])==0
    previous={p.relative_to(output):p.read_bytes() for p in output.rglob("*") if p.is_file()}
    bad=create_cases()[2]
    bad["nodes"][1]["boundary"]=90000
    write_json(source,[good,bad])
    assert main(["solve","--input",str(source),"--output",str(output)])==2
    current={p.relative_to(output):p.read_bytes() for p in output.rglob("*") if p.is_file()}
    assert current==previous
    assert not list(tmp_path.glob(".aerovia-stage-*"))


def test_artifact_promotion_refuses_unowned_output_directory(tmp_path):
    source=tmp_path/"input.json"
    write_json(source,create_cases()[0])
    output=tmp_path/"user-files"
    output.mkdir()
    sentinel=output/"keep.txt"
    sentinel.write_text("retain unrelated work",encoding="utf-8")
    assert main(["solve","--input",str(source),"--output",str(output)])==2
    assert sentinel.read_text(encoding="utf-8")=="retain unrelated work"
    assert len(list(output.iterdir()))==1


def test_successful_promotion_replaces_complete_owned_catalog(tmp_path):
    source=tmp_path/"input.json"
    write_json(source,create_cases()[0])
    output=tmp_path/"accepted"
    assert main(["solve","--input",str(source),"--output",str(output)])==0
    assert main(["solve","--input",str(source),"--output",str(output),"--speed","0.8"])==0
    assert verify_artifacts(output)["verifiedCases"]==1
    catalog=json.loads((output/"catalog.json").read_text(encoding="utf-8"))
    assert catalog["cases"][0]["options"]["speed"]==.8
    assert not list(tmp_path.glob(".aerovia-backup-*"))


def test_verification_detects_external_canonical_input_drift(tmp_path):
    n=create_cases()[0]
    source=tmp_path/"input.json"
    write_json(source,n)
    output=tmp_path/"accepted"
    assert main(["solve","--input",str(source),"--output",str(output)])==0
    assert main(["verify","--artifacts",str(output),"--input",str(source)])==0
    n["edges"][0]["resistance"]*=2
    write_json(source,n)
    assert main(["verify","--artifacts",str(output),"--input",str(source)])==2
