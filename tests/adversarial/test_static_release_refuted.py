"""Adversarial checks of the static-release feature (the build, the identity and the deployment): one planted defect per
requirement, in a throwaway copy of the repository, and the requirement's own gate run on the copy.

The gates are the data preparation (``frontend/scripts/prepare-data.mjs``) and the deployment check
(``frontend/scripts/verify-deployment.mjs``), both run with node; the guards under ``scripts/`` (version coherence, deploy
place, base integrity, public safety, content standards, CI budget), run as the CI runs them on a copy; the contract and vendor
tests (``tests/contracts``, ``tests/python``), run by a child pytest rooted in a copy; and the browser journey of the deep link.
Where a requirement names a test of a guard, the guard is planted twice: the hostile input is given to the guard (the guard must
refuse it), and the guard itself is weakened in another copy (the named test must fail). The node and browser plants skip with
that reason when the tool is absent. Nothing here writes into the real tree."""
from __future__ import annotations

import shutil
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
from _web_tools import (BROWSER_MISSING, BROWSER_REASON, NODE_MISSING, NODE_REASON, _negative_control, _utf8_output, assert_journeys_caught, assert_journeys_clean,  # noqa: F401
                        assert_pytest_caught, assert_pytest_clean, edit_json, fe, findings, plant, web)
from planting import edit, git_commit, guard, make_tree
from webtools import NODE

needs_node = pytest.mark.skipif(NODE_MISSING, reason=NODE_REASON)
needs_browser = pytest.mark.skipif(BROWSER_MISSING, reason=BROWSER_REASON)

RUNTIME = "tests/contracts/test_runtime.py"
GUARDS = "tests/contracts/test_guards.py"
VENDOR = "tests/python/test_vendor_notices.py"
SR002 = [f"{RUNTIME}::test_release_identity_is_strict", f"{RUNTIME}::test_release_identity_matches_what_prepare_data_writes"]
SR006 = [f"{GUARDS}::test_an_undeclared_model_file_does_not_pass_base_integrity", f"{GUARDS}::test_a_declared_model_over_five_megabytes_fails"]
SR007 = [f"{VENDOR}::test_untrusted_vendor_block_fails_both_guards[{p}]" for p in ("mutate", "delete", "duplicate", "provenance")]
DEEP_LINK = "a deep link to /app loads the App directly"
MB = 1024 * 1024


def run_node(repo: Path, script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([NODE, script, *args], cwd=repo / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=180)


# ---------------------------------------------------------------- the clean copy passes every gate used below

def test_every_python_gate_of_static_release_passes_on_the_clean_copy(repo: Path) -> None:
    pytest.importorskip("scipy")  # test_runtime.py imports the pipeline, which reads numpy and scipy (pinned in requirements.txt)
    assert_pytest_clean(repo, SR002 + SR006 + SR007)
    for script in ("check_version_coherence.py", "check_deploy_place.py", "check_ci_budget.py"):
        r = guard(repo, script)
        assert r.returncode == 0, (script, r.stdout)


@needs_node
def test_the_data_preparation_and_the_deployment_check_pass_on_the_clean_copy(web: Path) -> None:
    git_commit(web)
    r = run_node(web, "scripts/prepare-data.mjs")
    assert r.returncode == 0, r.stderr[-800:]
    assert (web / "frontend" / "public" / "release.json").is_file()
    with served(*site_files(web)) as (url, _):
        v = run_node(web, "scripts/verify-deployment.mjs", url, "a" * 40)
    assert v.returncode == 0, v.stderr[-800:]


# ---------------------------------------------------------------- the build and the identity

@needs_node
def test_sr_001_a_catalog_that_differs_from_its_recorded_digest_is_caught(web: Path) -> None:
    git_commit(web)
    manifest = "data/artifacts/manifest.json"
    recorded = {}

    def break_catalog(doc: dict) -> None:
        recorded.update(doc["files"]["catalog.json"])
        doc["files"]["catalog.json"]["sha256"] = "0" * 64

    edit_json(web, manifest, break_catalog)
    r = run_node(web, "scripts/prepare-data.mjs")
    assert r.returncode != 0 and "Catalog checksum mismatch" in r.stderr, r.stderr[-800:]
    # the recorded size is held too
    edit_json(web, manifest, lambda doc: doc["files"]["catalog.json"].update(recorded, bytes=recorded["bytes"] + 1))
    r = run_node(web, "scripts/prepare-data.mjs")
    assert r.returncode != 0 and "Catalog checksum mismatch" in r.stderr, r.stderr[-800:]
    # a model whose bytes differ from its recorded digest
    edit_json(web, manifest, lambda doc: doc["files"]["catalog.json"].update(recorded))
    model = next((web / "data" / "models").rglob("*.onnx"))
    model.write_bytes(model.read_bytes() + b"\0")
    r = run_node(web, "scripts/prepare-data.mjs")
    assert r.returncode != 0 and "checksum mismatch" in r.stderr, r.stderr[-800:]


def test_sr_002_a_release_identity_with_an_unknown_field_is_caught(repo: Path) -> None:
    pytest.importorskip("scipy")  # test_runtime.py imports the pipeline, which reads numpy and scipy (pinned in requirements.txt)
    # the schema stops being strict: an unknown field and a short commit are accepted, so the strictness test must fail
    def loosen(schema: dict) -> None:
        schema["additionalProperties"] = True
        schema["properties"]["commit"].pop("pattern", None)
        schema["properties"]["commit"].pop("minLength", None)
        schema["properties"]["commit"].pop("maxLength", None)

    edit_json(repo, "docs/contracts/schemas/release-identity.schema.json", loosen)
    # the data preparation stops writing a key the schema requires
    plant(repo, "frontend/scripts/prepare-data.mjs", "      scienceSha256: scienceRecorded.sha256,\n", "")
    assert_pytest_caught(repo, SR002)


# ---------------------------------------------------------------- the deployment check

class _Site(BaseHTTPRequestHandler):
    files: dict[str, bytes] = {}

    def do_GET(self) -> None:  # noqa: N802
        body = self.files.get(self.path.lstrip("/"))
        self.send_response(200 if body is not None else 404)
        self.end_headers()
        if body is not None:
            self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass


def site_files(repo: Path) -> tuple[dict[str, bytes], str]:
    """A tiny release: two files and the manifest that records their size and digest, as generate-manifest.mjs writes it."""
    import hashlib
    import json
    files = {"index.html": b"<!doctype html><title>Aerovia</title>\n", "assets/app.js": b"console.log('aerovia');\n"}
    manifest = {"schema": "aerovia.static-release/v1", "version": "0.4.0", "commit": "a" * 40, "workingTreeDirty": False,
                "catalogSha256": "b" * 64, "scienceSha256": "c" * 64,
                "files": {p: {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()} for p, b in files.items()}}
    return {**files, "asset-manifest.json": json.dumps(manifest).encode()}, "a" * 40


class served:
    """The release served on 127.0.0.1 by a thread, with the bytes of ``changed`` altered on the wire when given."""

    def __init__(self, files: dict[str, bytes], commit: str, changed: str | None = None) -> None:
        self.files = dict(files)
        if changed:
            self.files[changed] = bytes([self.files[changed][0] ^ 1]) + self.files[changed][1:]  # one byte, same length

    def __enter__(self):
        handler = type("Handler", (_Site,), {"files": self.files})
        self.server = HTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        return f"http://127.0.0.1:{self.server.server_port}/", self

    def __exit__(self, *exc: object) -> None:
        self.server.shutdown()
        self.server.server_close()


@needs_node
def test_sr_003_a_served_file_with_a_changed_byte_is_caught(tmp_path: Path) -> None:
    copy = make_tree(tmp_path / "t", "frontend/scripts/verify-deployment.mjs")
    files, commit = site_files(copy)
    with served(files, commit) as (url, _):
        assert run_node_in(copy, url, commit).returncode == 0
    with served(files, commit, changed="assets/app.js") as (url, _):
        r = run_node_in(copy, url, commit)
        assert r.returncode != 0 and "Release identity mismatch" in r.stderr, r.stderr[-800:]
    with served(files, commit) as (url, _):
        r = run_node_in(copy, url, "d" * 40)  # not the expected clean revision
        assert r.returncode != 0 and "differs from the expected revision" in r.stderr, r.stderr[-800:]
    r = run_node_in(copy, "http://example.invalid/", commit)  # a plain HTTP origin that is not local
    assert r.returncode != 0 and "HTTPS" in r.stderr, r.stderr[-800:]


def run_node_in(copy: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([NODE, "scripts/verify-deployment.mjs", *args], cwd=copy / "frontend", capture_output=True,
                          encoding="utf-8", errors="replace", timeout=60)


# ---------------------------------------------------------------- the version, the place and the integrity guards

def test_sr_004_a_version_stated_twice_and_disagreeing_is_caught(repo: Path) -> None:
    assert guard(repo, "check_version_coherence.py").returncode == 0
    edit(repo, "frontend/package.json", '"version": "0.3.0"', '"version": "9.9.9"')
    r = guard(repo, "check_version_coherence.py")
    assert r.returncode != 0 and "package.json" in r.stdout, r.stdout


def test_sr_005_a_missing_or_mismatched_deploy_target_is_caught(repo: Path, tmp_path: Path) -> None:
    other = tmp_path / "vps"
    shutil.copytree(repo, other)
    (repo / "deploy" / "TARGET").unlink()
    r = guard(repo, "check_deploy_place.py")
    assert r.returncode != 0 and "deploy/TARGET is missing" in r.stdout, r.stdout
    (other / "deploy" / "aerovia.service").write_text("[Service]\n", encoding="utf-8")  # a VPS unit beside the Pages workflow
    r = guard(other, "check_deploy_place.py")
    assert r.returncode != 0 and "VPS files remain" in r.stdout, r.stdout


def _git_tree(dest: Path, *rels: str) -> Path:
    tree = make_tree(dest, "scripts", "docs/contracts", *rels)
    git_commit(tree)
    return tree


def test_sr_006_an_undeclared_and_an_oversized_model_file_are_caught(repo: Path, tmp_path: Path) -> None:
    tree = _git_tree(tmp_path / "planted", "data/models")
    assert guard(tree, "check_base_integrity.py").returncode == 0
    (tree / "models").mkdir()
    (tree / "models" / "stray.pt").write_bytes(b"x" * 100)  # a checkpoint no catalog row declares
    subprocess.run(["git", "add", "-A"], cwd=tree, check=True, capture_output=True)
    r = guard(tree, "check_base_integrity.py")
    assert r.returncode == 1 and "models/stray.pt" in r.stdout, r.stdout
    (tree / "models" / "stray.pt").unlink()
    declared = next((tree / "data" / "models").rglob("*.onnx"))
    declared.write_bytes(b"x" * (5 * MB + 1))  # a declared model grown past 5 MiB
    subprocess.run(["git", "add", "-A"], cwd=tree, check=True, capture_output=True)
    r = guard(tree, "check_base_integrity.py")
    assert r.returncode == 1 and "over 5 MB" in r.stdout, r.stdout
    # the guard itself weakened: both named tests must fail
    guard_path = "scripts/check_base_integrity.py"
    edit(repo, guard_path, "MAX_FILE = 5 * MB", "MAX_FILE = 500 * MB")
    edit(repo, guard_path, "    if refused:", "    if False:")
    assert_pytest_caught(repo, SR006)


def test_sr_007_a_local_path_and_an_untrusted_vendor_block_are_caught(repo: Path, tmp_path: Path) -> None:
    tree = _git_tree(tmp_path / "planted", "frontend/public/THIRD_PARTY_NOTICES.txt")
    # the template's own check_sdd.py names its author in a comment, which the public-safety guard already reports on the clean
    # tree (a finding of the product, reported by this unit); a plant counts when it adds a finding to the clean ones
    clean = {s: findings(guard(tree, s)) for s in ("check_public_safety.py", "check_content_standards.py")}
    # a local machine path in a tracked source
    (tree / "scripts" / "planted_path.py").write_text('PATH = "' + "C:" + "/_Re" + 'pos/somewhere"\n', encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=tree, check=True, capture_output=True)
    r = guard(tree, "check_public_safety.py")
    assert r.returncode != 0 and any("private-workstation-path" in x for x in findings(r) - clean["check_public_safety.py"]), r.stdout
    (tree / "scripts" / "planted_path.py").unlink()
    # a vendor block with text its pinned digest does not list
    notice = tree / "frontend" / "public" / "THIRD_PARTY_NOTICES.txt"
    data = notice.read_bytes()
    marker = b"BEGIN UNMODIFIED ONNX RUNTIME 1.29.0 THIRD-PARTY NOTICES\n"
    at = data.index(marker) + len(marker)
    notice.write_bytes(data[:at] + b"x" + data[at + 1:])
    subprocess.run(["git", "add", "-A"], cwd=tree, check=True, capture_output=True)
    for script in ("check_public_safety.py", "check_content_standards.py"):
        r = guard(tree, script)
        assert r.returncode != 0 and any("vendor-notice" in x for x in findings(r) - clean[script]), (script, r.stdout)
    # the vendor guard itself weakened (the digest is no longer held): the named test must fail
    plant(repo, "scripts/vendor_notices.py", "    if end < start or sha256(data[start:end]).hexdigest() != SOURCE_SHA256:", "    if end < start:")
    assert_pytest_caught(repo, SR007, any_of=True)


def test_sr_008_a_ci_step_broader_than_the_budget_is_caught(tmp_path: Path) -> None:
    tree = make_tree(tmp_path / "t", "scripts", ".github", "data-pipeline")
    assert guard(tree, "check_ci_budget.py").returncode == 0
    ci = tree / ".github" / "workflows" / "ci.yml"
    clean = ci.read_bytes().decode("utf-8").replace("\r\n", "\n")
    pull_request = clean.replace("  push:\n", "  pull_request:\n    branches: [main]\n  push:\n", 1)
    assert pull_request != clean
    ci.write_bytes(pull_request.encode("utf-8"))
    r = guard(tree, "check_ci_budget.py")
    assert r.returncode != 0 and "pull_request" in r.stdout, r.stdout
    broad = clean + "      - name: The whole suite\n        run: python -m pytest tests\n"
    ci.write_bytes(broad.replace("\r\n", "\n").encode("utf-8"))
    r = guard(tree, "check_ci_budget.py")
    assert r.returncode != 0, r.stdout


# ---------------------------------------------------------------- the deep link

@needs_browser
def test_the_deep_link_journey_passes_on_the_clean_build_served_as_a_static_host(web: Path) -> None:
    assert_journeys_clean(web, "routes.spec.ts", [DEEP_LINK], spa=False)


@needs_browser
def test_sr_009_a_build_without_the_app_route_entry_is_caught(web: Path) -> None:
    # `vite preview` answers any path with the index, so the build is served as a static host serves it (spa=False)
    plant(web, fe("scripts/generate-manifest.mjs"), 'for (const route of ["app", "introduction"', 'for (const route of ["introduction"')
    assert_journeys_caught(web, "routes.spec.ts", [DEEP_LINK], spa=False)
