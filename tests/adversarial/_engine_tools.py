"""Helpers of the engine-feature plants (airflow-and-fans, network-cases, uncertainty, learned-screening, offline-pipeline):
run the requirement's own gate on a small throwaway copy that holds one planted defect.

Two kinds of gate are run here:

* the Python tests of ``tests/python`` and ``tests/contracts``: ``pytest`` in a subprocess on the copy, the result of each
  named test read from the ``-rA`` summary (``pytest_results``);
* the vitest tests of ``frontend/src``: ``vitest run --reporter=json`` with the real ``node_modules`` linked into the copy
  (``vitest_results``); a plant that needs them skips when node or the install is absent (``needs_web``), as the CI's
  checks job installs node and ``npm ci`` but no browser.

A plant never writes into the real tree: every file is edited in a copy under pytest's temporary folder."""
from __future__ import annotations

import contextlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterator

import pytest
from planting import ROOT, edit, make_tree
from webtools import NODE, NODE_MODULES, link_node_modules, unlink_node_modules

VITEST_ENTRY = NODE_MODULES / "vitest" / "vitest.mjs"
needs_web = pytest.mark.skipif(NODE is None or not VITEST_ENTRY.is_file(), reason="needs node and `npm ci` in frontend/ (vitest)")

WEB_AVAILABLE = NODE is not None and VITEST_ENTRY.is_file()
#: what the vitest suites read: the sources, the build files, the case library and the committed artifacts
WEB_INPUTS = ("frontend/src", "frontend/package.json", "frontend/tsconfig.json", "frontend/vite.config.ts", "VERSION",
              "data/cases.json", "data/artifacts/catalog.json", "data/artifacts/reference-checks.json", "data/artifacts/manifest.json")
#: what the Python gates read: the pipeline, the tests and their support, the schemas and the committed data
PY_INPUTS = ("data-pipeline", "tests/python", "tests/contracts", "scripts", "docs/contracts", "data", "VERSION", "product.json",
             "requirements.txt")

_PY_RESULT = re.compile(r"^(PASSED|FAILED|ERROR|SKIPPED|XFAIL|XPASS)\s+(\S+)", re.MULTILINE)


def py_env(tmp: Path) -> dict[str, str]:
    env = dict(os.environ)
    env.update(PYTHONUTF8="1", PYTHONDONTWRITEBYTECODE="1")
    env.pop("PYTEST_ADDOPTS", None)
    return env


def pytest_results(tree: Path, *nodeids: str) -> tuple[int, dict[str, str], str]:
    """Run the named tests (``path::name``, relative to the copy) with pytest in the copy; returns the exit code, the outcome
    of each test the summary lists (``PASSED`` or ``FAILED``...) and the output. A node id with no match is an error code."""
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "--tb=short", "-rA", "-p", "no:cacheprovider", *nodeids],
                       cwd=tree, capture_output=True, encoding="utf-8", errors="replace", timeout=300, env=py_env(tree))
    out = r.stdout + r.stderr
    return r.returncode, {m.group(2).split(" - ")[0]: m.group(1) for m in _PY_RESULT.finditer(r.stdout)}, out


def outcomes(results: dict[str, str], nodeid: str) -> list[str]:
    """The outcome of a gate: of the test itself, or of each parametrization of it (``nodeid[param]``)."""
    return [v for k, v in results.items() if k == nodeid or k.startswith(nodeid + "[")]


def assert_py_passes(tree: Path, *nodeids: str) -> None:
    code, results, out = pytest_results(tree, *nodeids)
    bad = [n for n in nodeids if not outcomes(results, n) or any(o != "PASSED" for o in outcomes(results, n))]
    assert code == 0 and not bad, f"the gates did not pass on the clean copy: {bad}\n{out[-2000:]}"


def assert_py_fails(tree: Path, *nodeids: str) -> None:
    """Every named gate ran in the copy and failed (a parametrized gate: at least one of its cases failed): a gate that passed,
    or that did not run, does not count."""
    code, results, out = pytest_results(tree, *nodeids)
    assert code != 0, f"the gates passed on the planted copy:\n{out[-2000:]}"
    survived = [n for n in nodeids if not any(o in ("FAILED", "ERROR") for o in outcomes(results, n))]
    assert not survived, f"these gates did not fail on the plant: {survived}\n{out[-2500:]}"


_PY_CLEAN: dict[tuple[str, ...], bool] = {}


def assert_py_clean(tmp_path_factory: pytest.TempPathFactory, *nodeids: str) -> None:
    """The control: the same pytest gates pass on a copy with no plant. Run once per gate set in a session."""
    if nodeids in _PY_CLEAN:
        return
    assert_py_passes(py_copy(tmp_path_factory.mktemp("py-clean")), *nodeids)
    _PY_CLEAN[nodeids] = True


def py_plant(tmp_path: Path, tmp_path_factory: pytest.TempPathFactory, edits: list[tuple[str, str, str]], gates: list[str],
             *, extra: tuple[str, ...] = ()) -> Path:
    """Plant ``edits`` (file of the repository, old text, new text) in a copy and assert that every gate in ``gates``
    (``path::name``) fails there, after the control passed on a clean copy. Returns the planted copy."""
    assert_py_clean(tmp_path_factory, *gates)
    tree = py_copy(tmp_path / "py", *extra)
    for rel, old, new in edits:
        edit(tree, rel, old, new)
    assert_py_fails(tree, *gates)
    return tree


def py_copy(dest: Path, *extra: str) -> Path:
    return make_tree(dest, *PY_INPUTS, *extra)


@contextlib.contextmanager
def web_copy(dest: Path, *extra: str) -> Iterator[Path]:
    """A copy of the frontend inputs with the real ``node_modules`` linked in; the link is removed before the copy goes."""
    make_tree(dest, *WEB_INPUTS, *extra)
    link_node_modules(dest / "frontend")
    try:
        yield dest
    finally:
        unlink_node_modules(dest / "frontend")


def vitest_results(tree: Path, *files: str) -> tuple[int, dict[str, str], str]:
    """Run vitest on ``files`` (paths under ``frontend/``) in the copy; returns the exit code, the status of each test by its
    title (``passed`` or ``failed``) and the output."""
    out_file = tree / "vitest-result.json"
    r = subprocess.run([NODE, str(tree / "frontend" / "node_modules" / "vitest" / "vitest.mjs"), "run", *files,
                        "--reporter=json", f"--outputFile={out_file}"],
                       cwd=tree / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=300)
    results: dict[str, str] = {}
    if out_file.is_file():
        for suite in json.loads(out_file.read_text(encoding="utf-8")).get("testResults", []):
            for item in suite.get("assertionResults", []):
                results[item["title"]] = item["status"]
    return r.returncode, results, r.stdout + r.stderr


_CLEAN: dict[tuple[str, ...], bool] = {}


def assert_web_clean(tmp_path_factory: pytest.TempPathFactory, *files: str) -> None:
    """The control: the same vitest files pass on a copy with no plant. Run once per file set in a session."""
    if files in _CLEAN:
        return
    with web_copy(tmp_path_factory.mktemp("web-clean")) as tree:
        code, results, out = vitest_results(tree, *files)
    failed = [t for t, s in results.items() if s != "passed"]
    assert code == 0 and results and not failed, f"the clean copy does not pass {files}: {failed}\n{out[-1500:]}"
    _CLEAN[files] = True


def web_plant(tmp_path: Path, tmp_path_factory: pytest.TempPathFactory, test_file: str, edits: list[tuple[str, str, str]],
              must_fail: list[str], *, extra: tuple[str, ...] = (), also: tuple[str, ...] = (), mutate=None) -> dict[str, str]:
    """Plant ``edits`` (file under ``frontend/``, old text, new text) in a copy, run ``test_file`` (and ``also``) with vitest
    and assert that every test title in ``must_fail`` ran and failed. Returns the status of every test."""
    assert_web_clean(tmp_path_factory, test_file, *also)
    with web_copy(tmp_path / "web", *extra) as tree:
        for rel, old, new in edits:
            edit(tree, f"frontend/{rel}", old, new)
        if mutate is not None:
            mutate(tree)
        code, results, out = vitest_results(tree, test_file, *also)
    assert code != 0, f"the gate passed on the planted copy:\n{out[-1500:]}"
    ran = [t for t in must_fail if t in results]
    assert len(ran) == len(must_fail), f"these gates did not run: {sorted(set(must_fail) - set(ran))}\n{out[-1500:]}"
    survived = [t for t in must_fail if results[t] != "failed"]
    assert not survived, f"these gates did not fail on the plant: {survived}\n{out[-2500:]}"
    return results


def edit_json(tree: Path, rel: str, change) -> None:
    """Parse a JSON document of the copy, let ``change`` plant a defect in the parsed value, and write it back (a plant never
    depends on the formatting of a committed document). A change that returns False planted nothing and fails."""
    path = tree / rel
    data = json.loads(path.read_text(encoding="utf-8"))
    assert change(data) is not False, f"{rel}: the plant would change nothing"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_of(path: Path) -> str:
    import hashlib
    return hashlib.sha256(path.read_bytes()).hexdigest()


__all__ = ["WEB_AVAILABLE", "browser_plant", "needs_browser", "ROOT", "assert_py_clean", "py_plant", "assert_py_fails", "outcomes", "assert_py_passes", "assert_web_clean", "needs_web", "py_copy", "pytest_results",
           "shutil", "vitest_results", "web_copy", "web_plant", "sha256_of", "edit_json"]


# ------------------------------------------------------------------ the browser journeys (local-only)

PORT = "4203"
BROWSER_INPUTS = ("frontend/src", "frontend/package.json", "frontend/tsconfig.json", "frontend/vite.config.ts", "frontend/index.html",
                  "frontend/public", "frontend/scripts", "frontend/e2e", "frontend/playwright.config.ts", "VERSION", "product.json",
                  "content", "data")


def _browsers_path() -> Path:
    env = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    return Path(env) if env else Path(os.environ.get("LOCALAPPDATA", str(Path.home() / ".cache"))) / "ms-playwright"


needs_browser = pytest.mark.skipif(
    NODE is None or not VITEST_ENTRY.is_file() or not (NODE_MODULES / "@playwright" / "test" / "cli.js").is_file()
    or not any(_browsers_path().glob("chromium-*")),
    reason="local-only: needs node, `npm ci` in frontend/ and a Playwright chromium (PLAYWRIGHT_BROWSERS_PATH)")


def _journey(tree: Path, spec: str, title: str) -> tuple[int, str]:
    """Build the copy, serve it on port 4203 with ``vite preview`` and run one Playwright journey of ``spec`` by its title. The
    server is stopped before returning, whatever the outcome. The build is the copy's own: no bake, no network."""
    from planting import git_commit
    git_commit(tree)  # prepare-data.mjs stamps the release with the copy's commit
    link_node_modules(tree / "frontend")
    env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH=str(_browsers_path()), AEROVIA_TEST_URL=f"http://127.0.0.1:{PORT}", PYTHONUTF8="1")
    server = None
    try:
        for step in (["scripts/prepare-data.mjs"], ["node_modules/vite/bin/vite.js", "build"]):
            r = subprocess.run([NODE, *step], cwd=tree / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=300, env=env)
            assert r.returncode == 0, f"{step[0]} failed on the copy:\n{(r.stdout + r.stderr)[-1500:]}"
        server = subprocess.Popen([NODE, "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", PORT, "--strictPort"],
                                  cwd=tree / "frontend", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import socket
        import time
        for _ in range(60):
            with socket.socket() as probe:
                probe.settimeout(0.5)
                if probe.connect_ex(("127.0.0.1", int(PORT))) == 0:
                    break
            assert server.poll() is None, f"the preview server stopped at once (is port {PORT} busy?)"
            time.sleep(0.5)
        r = subprocess.run([NODE, "node_modules/@playwright/test/cli.js", "test", spec, "-g", title, "--reporter=line", "--workers=1"],
                           cwd=tree / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=300, env=env)
        return r.returncode, r.stdout + r.stderr
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()
        unlink_node_modules(tree / "frontend")


_JOURNEY_CLEAN: dict[tuple[str, str], bool] = {}


def browser_plant(tmp_path: Path, tmp_path_factory: pytest.TempPathFactory, spec: str, title: str,
                  edits: list[tuple[str, str, str]]) -> str:
    """Plant ``edits`` (file under ``frontend/``, old text, new text) in a built copy and assert that the journey ``title`` of
    ``spec`` (a path under ``frontend/``) fails there, after it passed on a clean build (the control, once per journey)."""
    if (spec, title) not in _JOURNEY_CLEAN:
        clean = make_tree(tmp_path_factory.mktemp("journey-clean"), *BROWSER_INPUTS)
        code, out = _journey(clean, spec, title)
        assert code == 0 and "1 passed" in out, f"the journey does not pass on the clean build:\n{out[-2000:]}"
        _JOURNEY_CLEAN[(spec, title)] = True
    tree = make_tree(tmp_path / "journey", *BROWSER_INPUTS)
    for rel, old, new in edits:
        edit(tree, f"frontend/{rel}", old, new)
    code, out = _journey(tree, spec, title)
    assert code != 0 and "1 failed" in out, f"the journey passed on the planted build:\n{out[-2000:]}"
    return out
