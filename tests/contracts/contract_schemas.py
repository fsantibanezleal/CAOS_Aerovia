"""Schema access for the contract tests (docs/contracts/catalog.md): every schema file under docs/contracts/schemas,
validated with jsonschema (Draft 2020-12) through one referencing registry, so a ``$ref`` from one schema file to another
(network, options and result are shared) resolves to that file. The schema files are the single source of every contract;
no test re-declares a shape. The same module serves ``scripts/check_documents.py``."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "docs" / "contracts"
SCHEMAS = CONTRACTS / "schemas"
EXAMPLES = CONTRACTS / "examples"
# the provider tree mirrors the repository layout: <root>/data/artifacts, <root>/data/models, <root>/data/cases.json
FIXTURE_ROOT = CONTRACTS / "fixtures"
TREES = {"bake": ROOT, "fixture": FIXTURE_ROOT}

BASE = "https://contracts.invalid/"  # a base URI only; nothing is fetched


def load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def registry() -> Registry:
    """Every schema file at BASE/schemas/<file>."""
    resources = [(f"{BASE}schemas/{f.name}", Resource.from_contents(load_json(f), default_specification=DRAFT202012))
                 for f in sorted(SCHEMAS.glob("*.schema.json"))]
    return Registry().with_resources(resources)


def _validator_for(ref: str) -> Draft202012Validator:
    return Draft202012Validator({"$schema": "https://json-schema.org/draft/2020-12/schema", "$ref": ref}, registry=registry())


@lru_cache(maxsize=None)
def validator(name: str) -> Draft202012Validator:
    """The validator of docs/contracts/schemas/<name>.schema.json (the schema itself is checked first)."""
    path = SCHEMAS / f"{name}.schema.json"
    Draft202012Validator.check_schema(load_json(path))
    return _validator_for(f"{BASE}schemas/{path.name}")


def _messages(v: Draft202012Validator, instance: Any) -> list[str]:
    found = sorted(v.iter_errors(instance), key=lambda e: [str(p) for p in e.absolute_path])
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '$'}: {e.message}" for e in found]


def errors(name: str, instance: Any) -> list[str]:
    """Every way ``instance`` departs from schema ``name``, as ``path: message``; empty when it conforms."""
    return _messages(validator(name), instance)


def component_errors(name: str, instance: Any) -> list[str]:
    """Every way ``instance`` departs from the ``$defs`` entry ``<schema>#<def>`` written ``schema:def`` (for example ``transport:result``)."""
    schema, _, definition = name.partition(":")
    if not definition:
        raise ValueError(f"expected '<schema>:<def>', got {name!r}")
    return _messages(_validator_for(f"{BASE}schemas/{schema}.schema.json#/$defs/{definition}"), instance)


def def_errors(schema: str, definition: str, instance: Any) -> list[str]:
    return component_errors(f"{schema}:{definition}", instance)
