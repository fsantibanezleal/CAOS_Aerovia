"""One immutable upstream attribution block, confined to its distribution notice."""
from hashlib import sha256

NOTICE_PATH = "frontend/public/THIRD_PARTY_NOTICES.txt"
SOURCE_URL = "https://raw.githubusercontent.com/microsoft/onnxruntime/v1.29.0/ThirdPartyNotices.txt"
SOURCE_SHA256 = "53d3fa5821ac016ac24dd35775c996efec86e2ae0841e9a3a5e146c0ae916845"
BEGIN = b"BEGIN UNMODIFIED ONNX RUNTIME 1.29.0 THIRD-PARTY NOTICES\n"
END = b"\nEND UNMODIFIED ONNX RUNTIME 1.29.0 THIRD-PARTY NOTICES\n"


def scanned_bytes(path: str, data: bytes) -> bytes:
    """Mask only exact pinned vendor bytes, preserving diagnostic line numbers.

    No wildcard paths, caller-provided digest, or arbitrary marked block is trusted.
    Missing, duplicated, or mutated blocks in the notice fail closed. All other
    content remains subject to the normal source and content rules.
    """
    if path != NOTICE_PATH:
        return data
    if data.count(BEGIN) != 1 or data.count(END) != 1:
        raise ValueError("vendor-notice-integrity")
    start = data.index(BEGIN) + len(BEGIN)
    end = data.index(END)
    if end < start or sha256(data[start:end]).hexdigest() != SOURCE_SHA256:
        raise ValueError("vendor-notice-integrity")
    if SOURCE_URL.encode() not in data[:start] or SOURCE_SHA256.encode() not in data[:start]:
        raise ValueError("vendor-notice-provenance")
    # Retain every newline, so any surrounding-content diagnostic stays precise.
    masked = bytes(10 if byte == 10 else 32 for byte in data[start:end])
    return data[:start] + masked + data[end:]
