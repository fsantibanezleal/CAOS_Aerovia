"""Tools of the planted-defect tests of the web, design, transport and release features (this unit's own; the harness files
stay as the template wrote them).

Three kinds of gate are run on a throwaway copy of the repository, never on the real tree:

* the frontend's vitest tests (``run_vitest``): the plant is a change of the copy's source, the named test is run with node on
  the copy (the real ``node_modules`` is linked in, see ``webtools.py``) and must fail by name, while the same test passes on
  the clean copy (``assert_vitest_clean``);
* the Python tests of ``tests/contracts`` and ``tests/python`` (``run_pytest``): the plant is a change of the copy's catalog,
  schema, document or script, and the named test is run by a child pytest rooted in the copy (the tests read their own
  location, so they test the copy);
* the browser journeys of ``frontend/e2e`` (``Site``): the plant is built and served on port 4204 and the named journey runs
  with Playwright against it. They need a Playwright browser, and skip with that reason when there is none (CI's checks job
  installs none).

Nothing here writes into the real tree: every path is under the copy, and the preview server is stopped before a test ends."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest
from planting import git_commit
from webtools import NODE, NODE_MODULES, SHELL_INSTALLED, link_node_modules, unlink_node_modules

PORT = 4204  # never 4191 (CAOS_Fragmenta's gate)
VITEST = NODE_MODULES / "vitest" / "vitest.mjs"
VITE = NODE_MODULES / "vite" / "bin" / "vite.js"
PLAYWRIGHT = NODE_MODULES / "@playwright" / "test" / "cli.js"

NODE_MISSING = NODE is None or not SHELL_INSTALLED or not VITEST.is_file()
NODE_REASON = "local-only: needs node and `npm ci` in frontend/ (vitest and the installed shell)"


def browsers_path() -> Path | None:
    """The directory holding the Playwright Chromium, or None: PLAYWRIGHT_BROWSERS_PATH, then the library's
    default folder."""
    candidates = []
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        candidates.append(Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"]))
    if os.name == "nt":
        candidates.append(Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright")
    else:
        candidates += [Path.home() / ".cache" / "ms-playwright", Path.home() / "Library" / "Caches" / "ms-playwright"]
    for path in candidates:
        if path.is_dir() and any(path.glob("chromium*")):
            return path
    return None


BROWSERS = browsers_path()
BROWSER_MISSING = NODE_MISSING or not PLAYWRIGHT.is_file() or BROWSERS is None
BROWSER_REASON = "local-only: needs node, `npm ci` in frontend/ and a Playwright browser (the checks job installs none)"


@pytest.fixture(autouse=True)
def _utf8_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PYTHONUTF8", "1")


@pytest.fixture
def web(repo: Path):
    """The copy with the real node_modules linked into its frontend; the link is removed before the copy goes."""
    if NODE is None or not SHELL_INSTALLED:
        pytest.skip("local-only: needs node and `npm ci` in frontend/")
    link_node_modules(repo / "frontend")
    try:
        yield repo
    finally:
        unlink_node_modules(repo / "frontend")


def fe(rel: str) -> str:
    return f"frontend/{rel}"


def edit_json(repo: Path, rel: str, change) -> None:
    """Load a JSON file of the copy, let ``change`` mutate it, and write it back (UTF-8, two-space indent, LF, one final newline)."""
    path = repo / rel
    doc = json.loads(path.read_bytes().decode("utf-8"))
    change(doc)
    path.write_bytes((json.dumps(doc, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))


def _read(repo: Path, rel: str) -> tuple[str, bool]:
    """A file of the copy as text with LF line ends, and whether it had CRLF (a Windows checkout), so a plant is written
    the same way on both."""
    text = (repo / rel).read_bytes().decode("utf-8")
    return text.replace("\r\n", "\n"), "\r\n" in text


def _write(repo: Path, rel: str, text: str, crlf: bool) -> None:
    (repo / rel).write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))


def plant(repo: Path, rel: str, old: str, new: str, *, count: int = 1) -> None:
    """Replace ``old`` by ``new`` (written with LF) in a file of the copy, whatever its line ends; fails when ``old`` is
    absent (a plant that plants nothing)."""
    text, crlf = _read(repo, rel)
    assert old in text, f"{rel} does not contain {old!r}: the plant would change nothing"
    _write(repo, rel, text.replace(old, new, count), crlf)


def plant_re(repo: Path, rel: str, pattern: str, new: str, *, flags: int = 0, count: int = 1) -> None:
    """Replace a regular expression (over LF text) in a file of the copy; fails when it matches nothing."""
    text, crlf = _read(repo, rel)
    changed, n = re.subn(pattern, new, text, count=count, flags=flags)
    assert n, f"{rel} does not match {pattern!r}: the plant would change nothing"
    _write(repo, rel, changed, crlf)


# ---------------------------------------------------------------- vitest

def run_vitest(repo: Path, files: str | list[str], names: list[str]) -> tuple[int, dict[str, str], str]:
    """Run the named vitest tests of ``files`` (paths under ``frontend/``) on the copy. Returns the exit code, the status of
    each test that ran (title to ``passed`` or ``failed``) and the output. A test with another title is not selected."""
    out_file = repo / "frontend" / ".vitest-result.json"
    out_file.unlink(missing_ok=True)
    pattern = "|".join(re.escape(n) for n in names)
    cmd = [NODE, str(repo / "frontend" / "node_modules" / "vitest" / "vitest.mjs"), "run", "--reporter=json", f"--outputFile={out_file}"]
    cmd += [files] if isinstance(files, str) else files
    cmd += ["-t", pattern]
    r = subprocess.run(cmd, cwd=repo / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=300)
    results: dict[str, str] = {}
    if out_file.is_file():
        data = json.loads(out_file.read_text(encoding="utf-8"))
        for suite in data.get("testResults", []):
            for a in suite.get("assertionResults", []):
                if a.get("status") in ("passed", "failed"):
                    for key in (a["title"], a.get("fullName", a["title"])):
                        results[key] = "failed" if "failed" in (a["status"], results.get(key)) else "passed"
    return r.returncode, results, r.stdout + r.stderr


def assert_vitest_clean(repo: Path, files: str | list[str], names: list[str]) -> None:
    code, results, out = run_vitest(repo, files, names)
    assert code == 0, out[-1500:]
    missing = [n for n in names if results.get(n) != "passed"]
    assert not missing, f"these gates did not run and pass on the clean copy: {missing}\n{out[-1500:]}"


def assert_vitest_caught(repo: Path, files: str | list[str], names: list[str], *, any_of: bool = False) -> None:
    """The planted copy: the gate exits non-zero and every named test ran and failed (a plant that failed only a neighbour
    does not count). ``any_of`` asks for at least one of them, for a row that lists alternatives."""
    code, results, out = run_vitest(repo, files, names)
    assert code != 0, f"the gate passed on the planted copy:\n{out[-1500:]}"
    failed = [n for n in names if results.get(n) == "failed"]
    if any_of:
        assert failed, f"none of these gates failed on the plant: {names}\n{out[-2500:]}"
    else:
        survived = [n for n in names if results.get(n) != "failed"]
        assert not survived, f"these gates did not fail on the plant: {survived}\n{out[-2500:]}"


# ---------------------------------------------------------------- pytest

OUTCOME = re.compile(r"^(PASSED|FAILED|ERROR) (\S+)", re.M)


def run_pytest(repo: Path, nodeids: list[str]) -> tuple[int, dict[str, str], str]:
    """Run the node ids (paths relative to the copy) with a child pytest rooted in the copy. Returns the exit code, the
    outcome of each node id (PASSED, FAILED or ERROR) and the output."""
    cmd = [sys.executable, "-m", "pytest", "-q", "-rA", "--tb=short", "-p", "no:cacheprovider", "-o", "addopts=", *nodeids]
    r = subprocess.run(cmd, cwd=repo, capture_output=True, encoding="utf-8", errors="replace", timeout=600)
    out = r.stdout + r.stderr
    results = {m.group(2): m.group(1) for m in OUTCOME.finditer(out)}
    return r.returncode, results, out


def assert_pytest_clean(repo: Path, nodeids: list[str]) -> None:
    code, results, out = run_pytest(repo, nodeids)
    assert code == 0, out[-1500:]
    missing = [n for n in nodeids if results.get(n) != "PASSED"]
    assert not missing, f"these gates did not run and pass on the clean copy: {missing}\n{out[-1500:]}"


def assert_pytest_caught(repo: Path, nodeids: list[str], *, any_of: bool = False) -> None:
    code, results, out = run_pytest(repo, nodeids)
    assert code != 0, f"the gate passed on the planted copy:\n{out[-1500:]}"
    failed = [n for n in nodeids if results.get(n) in ("FAILED", "ERROR")]
    if any_of:
        assert failed, f"none of these gates failed on the plant: {nodeids}\n{out[-2500:]}"
    else:
        survived = [n for n in nodeids if results.get(n) not in ("FAILED", "ERROR")]
        assert not survived, f"these gates did not fail on the plant: {survived}\n{out[-2500:]}"


# ---------------------------------------------------------------- the findings of a guard

def findings(r: subprocess.CompletedProcess) -> set[str]:
    """The lines a guard printed, to compare a planted copy with the clean one: a plant counts when it adds a line."""
    return {ln.strip() for ln in (r.stdout + r.stderr).splitlines() if ln.strip()}


# ---------------------------------------------------------------- the built site and the browser

def _port_free() -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", PORT)) != 0


def _kill(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def build_site(repo: Path) -> None:
    """Build the copy's site as ``npm run build`` does, without the type check (a plant may be a type error the compiler
    would refuse; the journeys are the gate under test): the data preparation, the bundle and the manifest. The copy is made
    a git repository first, as the data preparation reads the commit. The copy comes from the ``web`` fixture, which links the
    installed packages in."""
    if not (repo / ".git").exists():
        git_commit(repo)
    fr = repo / "frontend"
    for cmd in ([NODE, "scripts/prepare-data.mjs"], [NODE, "node_modules/vite/bin/vite.js", "build"], [NODE, "scripts/generate-manifest.mjs"]):
        r = subprocess.run(cmd, cwd=fr, capture_output=True, encoding="utf-8", errors="replace", timeout=300)
        assert r.returncode == 0, f"{cmd[1]} failed:\n{(r.stdout + r.stderr)[-1500:]}"


class Site:
    """A built copy served on port 4204 for the length of a ``with`` block: by ``vite preview`` (which answers any path with the
    index, as a single-page app does) or, with ``spa=False``, as a static host serves the folder: a path answers only with
    its file or the ``index.html`` of its folder, and any other path is a 404 (what GitHub Pages does)."""

    def __init__(self, repo: Path, spa: bool = True) -> None:
        self.repo = repo
        self.spa = spa
        self.proc: subprocess.Popen | None = None
        self.server: HTTPServer | None = None

    def _serve_static(self) -> "Site":
        root = (self.repo / "frontend" / "dist").resolve()

        class Static(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                path = (root / unquote(urlsplit(self.path).path).lstrip("/")).resolve()
                if path.is_dir():
                    path = path / "index.html"
                if root not in path.parents or not path.is_file():
                    self.send_response(404)
                    self.end_headers()
                    return
                body = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args: object) -> None:
                pass

        self.server = HTTPServer(("127.0.0.1", PORT), Static)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        return self

    def __enter__(self) -> "Site":
        assert _port_free(), f"port {PORT} is in use: stop what holds it"
        if not self.spa:
            return self._serve_static()
        flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        self.proc = subprocess.Popen(
            [NODE, "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", str(PORT), "--strictPort"],
            cwd=self.repo / "frontend", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags,
        )
        deadline = time.time() + 30
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise AssertionError("the preview server exited")
            if not _port_free():
                return self
            time.sleep(0.25)
        raise AssertionError("the preview server did not come up in 30 s")

    def __exit__(self, *exc: object) -> None:
        if self.server is not None:
            self.server.shutdown()
            self.server.server_close()
        if self.proc is not None:
            _kill(self.proc)

    def journeys(self, spec: str, titles: list[str]) -> tuple[int, dict[str, bool], str]:
        """Run the journeys of ``frontend/e2e/<spec>`` whose titles are given against the served site. Returns the exit
        code, whether each title that ran passed, and the output."""
        pattern = "|".join(re.escape(t) for t in titles)
        env = {**os.environ, "AEROVIA_TEST_URL": f"http://127.0.0.1:{PORT}", "PLAYWRIGHT_BROWSERS_PATH": str(BROWSERS), "CI": ""}
        r = subprocess.run(
            [NODE, "node_modules/@playwright/test/cli.js", "test", f"e2e/{spec}", "-g", pattern, "--reporter=json", "--workers=1"],
            cwd=self.repo / "frontend", capture_output=True, encoding="utf-8", errors="replace", timeout=300, env=env,
        )
        results: dict[str, bool] = {}
        try:
            data = json.loads(r.stdout)
        except ValueError:
            return r.returncode, results, (r.stdout + r.stderr)[-2500:]

        def walk(suite: dict) -> None:
            for s in suite.get("specs", []):
                results[s["title"]] = bool(s.get("ok"))
            for child in suite.get("suites", []):
                walk(child)

        for top in data.get("suites", []):
            walk(top)
        return r.returncode, results, (r.stdout[-1500:] + r.stderr[-1500:])


def assert_journeys_clean(repo: Path, spec: str, titles: list[str], *, spa: bool = True) -> None:
    build_site(repo)
    with Site(repo, spa) as site:
        code, results, out = site.journeys(spec, titles)
    assert code == 0, out
    missing = [t for t in titles if results.get(t) is not True]
    assert not missing, f"these journeys did not run and pass on the clean build: {missing}\n{out}"


def assert_journeys_caught(repo: Path, spec: str, titles: list[str], *, spa: bool = True) -> None:
    """Build the planted copy, serve it and run the journeys: each must have run and failed."""
    build_site(repo)
    with Site(repo, spa) as site:
        code, results, out = site.journeys(spec, titles)
    assert code != 0, f"the journeys passed on the planted build:\n{out}"
    survived = [t for t in titles if results.get(t) is not False]
    assert not survived, f"these journeys did not fail on the plant: {survived}\n{out}"


@contextmanager
def fork(repo: Path, name: str):
    """A second copy of a ``web`` copy, beside it and with the installed packages linked in, for a test with two plants that
    must not stack. Fork before planting; the link is removed before the copy goes."""
    dest = repo.parent / name
    shutil.copytree(repo, dest, ignore=shutil.ignore_patterns("node_modules"))
    link_node_modules(dest / "frontend")
    try:
        yield dest
    finally:
        unlink_node_modules(dest / "frontend")


@pytest.fixture(autouse=True)
def _negative_control(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """With ``ADVERSARIAL_NO_PLANT=1`` the planting helpers a test module imported do nothing, so a plant test must fail: the
    check that a test does not pass without its plant (run it on a sample, see the unit's report). Unset, this does nothing."""
    if os.environ.get("ADVERSARIAL_NO_PLANT") != "1":
        return
    for name in ("edit", "plant", "plant_re", "edit_json", "set_cell", "drop_row"):
        if hasattr(request.module, name):
            monkeypatch.setattr(request.module, name, lambda *a, **k: None)
