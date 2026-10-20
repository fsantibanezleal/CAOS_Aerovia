"""Contract branch-table: the 15-column CSV per case, a published download with no reader in the repository."""
from __future__ import annotations

import subprocess

import pytest

import contract_schemas as cs
import support as sp

TREE_IDS = list(sp.TREES)


def typed(row: dict[str, str]) -> dict:
    out: dict = {}
    for key, value in row.items():
        if key in ("edge_id", "kind", "from_node", "to_node"):
            out[key] = value
        elif key == "closed":
            out[key] = {"True": True, "False": False}.get(value, value)
        else:
            out[key] = None if value == "" else float(value)
    return out


@pytest.mark.parametrize("tree", TREE_IDS)
def test_every_row_of_every_table_matches_the_schema(tree: str) -> None:
    columns = cs.load_json(cs.SCHEMAS / "branch-table.schema.json")["x-columns"]
    files = sp.csv_files(tree)
    assert files, tree
    nets = {n["id"]: n for n in sp.networks(tree)}
    for path in files:
        header, rows = sp.read_csv(path)
        assert header == columns, path.name
        net = nets[path.stem]
        assert [r["edge_id"] for r in rows] == [e["id"] for e in net["edges"]], path.name
        for row in rows:
            assert cs.errors("branch-table", typed(row)) == [], (path.name, row["edge_id"])


def test_there_is_one_table_per_committed_network() -> None:
    assert {p.stem for p in sp.csv_files("bake")} == {n["id"] for n in sp.networks("bake")}
    assert len(sp.csv_files("bake")) == 12


def test_a_bad_cell_is_rejected() -> None:
    _, rows = sp.read_csv(sp.csv_files("bake")[0])
    row = typed(rows[0])
    assert cs.errors("branch-table", row) == []
    for key, value in (("kind", "shaft"), ("closed", "maybe"), ("target_probability", 2.0), ("area_m2", -1.0)):
        assert cs.errors("branch-table", {**row, key: value}), key
    assert cs.errors("branch-table", {k: v for k, v in row.items() if k != "edge_id"})


def test_the_tables_are_utf8_lf_without_bom() -> None:
    for path in sp.csv_files("bake"):
        raw = path.read_bytes()
        assert not raw.startswith(b"\xef\xbb\xbf") and b"\r\n" not in raw, path.name


# The generated types carry the schema description, which names the download's path: a type declaration is not a reader.
GENERATED_TYPES = "frontend/src/lib/contract.gen.ts"
SEARCHED = ("frontend/src", "frontend/scripts", "data-pipeline", "scripts")


def readers_of_the_download(cwd) -> list[str]:
    """Every tracked line under the searched folders that names the download, except the generated types file (by its path)."""
    return subprocess.run(["git", "grep", "-nE", "artifacts/csv", "--", *SEARCHED, f":(exclude){GENERATED_TYPES}"],
                          cwd=cwd, capture_output=True, text=True).stdout.splitlines()


def test_published_download_has_no_reader_in_the_repository() -> None:
    """The catalog row names this test as its consumer: the tables are a published download, so no source reads them."""
    out = readers_of_the_download(sp.ROOT)
    assert out == [], out


def test_the_reader_search_skips_the_generated_types_by_path_and_nothing_else(tmp_path) -> None:
    """Only the generated file is exempt: the same text in any other source file, or in a file of another name, is a reader."""
    def git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=tmp_path, check=True, capture_output=True)

    git("init", "-q")
    for rel, text in (("frontend/src/lib/contract.gen.ts", "/** data/artifacts/csv/x.csv */"),
                      ("frontend/src/lib/contract.types.ts", "const a = 1"),
                      ("scripts/ok.py", "x = 1")):
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / rel).write_text(text, encoding="utf-8")
    git("add", ".")
    assert readers_of_the_download(tmp_path) == []
    (tmp_path / "frontend/src/lib/contract.types.ts").write_text("fetch('data/artifacts/csv/x.csv')", encoding="utf-8")
    (tmp_path / "frontend/src/lib/contract.gen.tsx").write_text("data/artifacts/csv/y.csv", encoding="utf-8")
    git("add", ".")
    hits = readers_of_the_download(tmp_path)
    assert sorted(h.split(":")[0] for h in hits) == ["frontend/src/lib/contract.gen.tsx", "frontend/src/lib/contract.types.ts"], hits
