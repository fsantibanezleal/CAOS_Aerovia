"""Vendor attribution cannot create a mutable exemption from public guards."""
from pathlib import Path
import sys
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import check_content_standards as content
import check_public_safety as safety
from vendor_notices import BEGIN, END, NOTICE_PATH, scanned_bytes


@pytest.fixture
def notice():
    return (ROOT / NOTICE_PATH).read_bytes()


def test_exact_pinned_attribution_is_distributable(notice):
    assert safety.inspect(NOTICE_PATH, notice) == []
    assert content.inspect(NOTICE_PATH, notice) == []
    assert scanned_bytes(NOTICE_PATH, notice).count(b"\n") == notice.count(b"\n")


@pytest.mark.parametrize("change", ["mutate", "delete", "duplicate", "provenance"])
def test_untrusted_vendor_block_fails_both_guards(notice, change):
    start = notice.index(BEGIN) + len(BEGIN)
    end = notice.index(END)
    if change == "mutate":
        modified = notice[:start] + b"x" + notice[start + 1:]
    elif change == "delete":
        modified = notice[:start] + notice[end:]
    elif change == "duplicate":
        modified = notice + BEGIN + notice[start:end] + END
    else:
        modified = notice.replace(b"Source: https://raw.githubusercontent.com/microsoft/onnxruntime/v1.29.0/ThirdPartyNotices.txt", b"Source: unavailable")
    assert any("vendor-notice" in rule for _, rule in safety.inspect(NOTICE_PATH, modified))
    assert any("vendor-notice" in hit for hit in content.inspect(NOTICE_PATH, modified))


@pytest.mark.parametrize("position", ["before", "after"])
def test_surrounding_content_remains_scanned(notice, position):
    payload = ("synthetic" + "@" + "example.invalid " + chr(0x2014) + chr(0x1F600)).encode()
    modified = payload + b"\n" + notice if position == "before" else notice + payload
    assert (NOTICE_PATH, "email-address") in safety.inspect(NOTICE_PATH, modified)
    hits = content.inspect(NOTICE_PATH, modified)
    assert any("em-dash" in hit for hit in hits)
    assert any("emoji" in hit for hit in hits)


def test_other_paths_never_receive_vendor_exemption(notice):
    other = "docs/copied-notices.txt"
    assert scanned_bytes(other, notice) == notice
    assert (other, "email-address") in safety.inspect(other, notice)
    assert any("em-dash" in hit for hit in content.inspect(other, notice))
