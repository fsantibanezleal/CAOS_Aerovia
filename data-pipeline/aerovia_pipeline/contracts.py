"""Validate a document against its schema file in docs/contracts/schemas/ before a writer writes it (ADR-0080).

The schema files are the single source of every contract; this module only reads them. ``check(name, value)`` raises
``NetworkError`` naming the first fields that depart, so a run stops before a bad document reaches ``data/``. The name is
the schema file stem, for example ``catalog`` for ``catalog.schema.json``.
"""
from functools import lru_cache
from pathlib import Path
import json

from .model import NetworkError

SCHEMAS = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "schemas"
BASE = "https://contracts.invalid/"  # a base URI only; nothing is fetched
MAX_REPORTED = 5


@lru_cache(maxsize=None)
def _registry():
    from referencing import Registry, Resource
    from referencing.jsonschema import DRAFT202012
    resources = [(BASE + "schemas/" + f.name, Resource.from_contents(json.loads(f.read_text(encoding="utf-8")), default_specification=DRAFT202012))
                 for f in sorted(SCHEMAS.glob("*.schema.json"))]
    return Registry().with_resources(resources)


@lru_cache(maxsize=None)
def _validator(name):
    from jsonschema import Draft202012Validator
    if not (SCHEMAS / (name + ".schema.json")).is_file():
        raise NetworkError(f"No schema file for contract {name}")
    return Draft202012Validator({"$ref": BASE + "schemas/" + name + ".schema.json"}, registry=_registry())


def problems(name, value):
    """Every way ``value`` departs from schema ``name``, as ``field/path: message``."""
    found = sorted(_validator(name).iter_errors(value), key=lambda e: [str(p) for p in e.absolute_path])
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '$'}: {e.message[:200]}" for e in found]


def check(name, value):
    found = problems(name, value)
    if found:
        more = f" (and {len(found) - MAX_REPORTED} more)" if len(found) > MAX_REPORTED else ""
        raise NetworkError(f"Document departs from contract {name}: " + "; ".join(found[:MAX_REPORTED]) + more)
