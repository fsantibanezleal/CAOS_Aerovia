#!/usr/bin/env python3
"""Public-source release gate. Diagnostics contain paths and rule IDs, never matched values."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import subprocess
from vendor_notices import scanned_bytes

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "private-key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "github-token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b"),
    "provider-token": re.compile(rb"\b(?:AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b"),
    "credential-url": re.compile(rb"https?://[^\s/:]+:[^\s/@]+@"),
    "private-workstation-path": re.compile(rb"\b[A-Za-z]:[\\/](?:Users|_Repos|_Temp)[\\/]", re.I),
    "private-host-path": re.compile((r"(?:/ho" + r"me/[^\s/]+/|/opt/" + "fasl-apps/|/etc/" + "fasl/)").encode()),
    "personal-attribution": re.compile(("Feli" + "pe\\s+San" + "tib").encode(), re.I),
    "private-owner-name": re.compile((r"\bFeli" + r"pe\b").encode(), re.I),
    "email-address": re.compile(rb"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
}
FORBIDDEN_NAMES = {".env", "id_rsa", "id_ed25519", "credentials.json", "credentials.yaml"}
# These lockfile strings describe public dependencies; source/UI/docs still reject contact details.
DEPENDENCY_METADATA = {"frontend/package-lock.json"}


def git(*arguments: str, allow_failure: bool = False) -> bytes:
    result = subprocess.run(["git", *arguments], cwd=ROOT, capture_output=True, check=False)
    if result.returncode and not allow_failure:
        raise RuntimeError("Git inspection failed; run this gate from a Git checkout.")
    return result.stdout


def inspect(path: str, data: bytes) -> list[tuple[str, str]]:
    findings = []
    try:
        data = scanned_bytes(path, data)
    except ValueError as error:
        findings.append((path, str(error)))
    if Path(path).name in FORBIDDEN_NAMES or Path(path).suffix.lower() in {".pem", ".pfx", ".p12"}:
        findings.append((path, "credential-file"))
    if b"\x00" in data[:8192]:
        return findings
    for rule, pattern in RULES.items():
        if rule == "email-address" and path in DEPENDENCY_METADATA:
            continue
        if pattern.search(data):
            findings.append((path, rule))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true", help="Also inspect all reachable Git blobs.")
    options = parser.parse_args()
    findings: set[tuple[str, str]] = set()
    paths = {item.decode("utf-8") for item in git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split(b"\0") if item}
    for relative in sorted(paths):
        path = ROOT / relative
        if path.is_symlink():
            findings.add((relative, "symlink-review-required"))
        elif path.is_file():
            findings.update(inspect(relative, path.read_bytes()))
    blobs = 0
    if options.history:
        objects = git("rev-list", "--objects", "--all", allow_failure=True).decode("utf-8").splitlines()
        for item in objects:
            object_id, separator, relative = item.partition(" ")
            if not separator or git("cat-file", "-t", object_id).strip() != b"blob":
                continue
            blobs += 1
            findings.update((f"history:{relative}", rule) for _, rule in inspect(relative, git("cat-file", "blob", object_id)))
    for path, rule in sorted(findings):
        print(f"FAIL {rule}: {path}")
    if findings:
        print(f"Public safety gate failed: {len(findings)} finding(s). Values intentionally redacted.")
        return 1
    print(f"Public safety gate passed: {len(paths)} working-tree paths, {blobs} historical blobs; no configured pattern matched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
