"""Plants for the offline-pipeline feature (OP-001 to OP-009): one planted defect per requirement, in a throwaway copy, and the
requirement's own gate run on the copy.

The gates are the pytest tests of ``tests/python/test_io.py`` and ``tests/contracts`` (pytest in a subprocess on the copy)
and, for OP-003 and OP-007, the pipeline's own ``verify`` command run on the copy. Nothing needs node or a browser, and no
plant bakes or trains: the pipeline runs on one authored case in a temporary folder, as the gates do."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from _engine_tools import assert_py_clean, assert_py_fails, edit_json, py_copy, py_env, py_plant
from planting import edit, git_commit

FACTORY = pytest.TempPathFactory
IO = "tests/python/test_io.py::"
WRITERS = "tests/contracts/test_writers.py::"
TABLES = "tests/contracts/test_branch_table.py::"
PIPE = "data-pipeline/aerovia_pipeline/"


def verify(tree: Path, *extra: str) -> subprocess.CompletedProcess:
    """The pipeline's verification of the copy's committed artifacts, as ``scripts/pipeline.py verify`` runs it."""
    return subprocess.run([sys.executable, "scripts/pipeline.py", "verify", "--artifacts", "data/artifacts", *extra], cwd=tree,
                          capture_output=True, encoding="utf-8", errors="replace", timeout=300, env=py_env(tree))


def test_op_001_an_unseeded_case_generator_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "cases.py", "from copy import deepcopy\n", "from copy import deepcopy\nimport random\n"),
              (PIPE + "cases.py", 'item = {"id": identifier, "x": x, "y": y, "z": z}', 'item = {"id": identifier, "x": x + random.random(), "y": y, "z": z}')],
             [IO + "test_deterministic_authoring_and_input_roundtrip"])


def test_op_002_a_writer_that_allows_nan_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the writer serialises NaN and the reader no longer refuses the constant
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "io.py", "indent=2, allow_nan=False) + ", "indent=2, allow_nan=True) + "),
              (PIPE + "io.py", ', parse_constant=lambda value: (_ for _ in ()).throw(NetworkError(f"Non-finite JSON value {value}"))', "")],
             [IO + "test_json_nonfinite_rejected"])


def test_op_003_a_tampered_artifact_of_equal_size_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    gate = "tests/contracts/test_models.py::test_artifact_manifest_lists_the_files_by_identity[bake]"
    assert_py_clean(tmp_path_factory, gate)
    tree = py_copy(tmp_path / "py")
    assert verify(tree).returncode == 0  # the control: the committed artifacts verify
    path = tree / "data" / "artifacts" / "csv" / "hard-rock.csv"
    raw = bytearray(path.read_bytes())
    at = next(i for i, byte in enumerate(raw) if chr(byte) in "12345678")
    raw[at] += 1  # another digit, the same size
    path.write_bytes(bytes(raw))
    assert verify(tree).returncode != 0  # verification refuses it
    assert_py_fails(tree, gate)


@pytest.mark.xfail(strict=True, reason="BLOCKED (gate cannot fail): the late failure of test_late_failure_preserves_all_previous_accepted_artifact_bytes "
                   "happens in the solve, before promote_artifacts runs, and the other named gate stops at the ownership check; no test makes "
                   "the move itself fail, so deleting before moving passes both. The gate is the product's; the finding is in the report.")
def test_op_004_a_promotion_that_deletes_before_it_moves_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "io.py", "        os.replace(destination,backup)", "        shutil.rmtree(destination)")],
             [IO + "test_late_failure_preserves_all_previous_accepted_artifact_bytes"])


def test_op_005_a_download_that_skips_the_digest_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "io.py", "if actual.lower() != expected_sha256.lower():", "if len(actual) != len(expected_sha256):"),
              (PIPE + "io.py", 'if urlparse(response.url).scheme != "https":', "if False:")],
             [IO + "test_pinned_download_validates_content_and_preserves_target_on_mismatch",
              IO + "test_download_rejects_credentials_and_insecure_redirect"])


def test_op_006_a_writer_that_validates_after_writing_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the call is in write_json (io.py), which calls contracts.check: it now runs once the file is in place
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "io.py", "    if schema is not None:\n        check_contract(schema, value)\n    path = Path(path)\n", "    path = Path(path)\n"),
              (PIPE + "io.py", "        temporary.unlink(missing_ok=True)\n\n\ndef load_networks",
               "        temporary.unlink(missing_ok=True)\n    if schema is not None:\n        check_contract(schema, value)\n\n\ndef load_networks")],
             [WRITERS + "test_a_broken_document_stops_the_write_and_names_the_field"])


def test_op_007_a_canonical_input_that_drifted_after_the_bake_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    gate = IO + "test_verification_detects_external_canonical_input_drift"
    assert_py_clean(tmp_path_factory, gate)
    tree = py_copy(tmp_path / "py")
    assert verify(tree, "--input", "data/cases.json").returncode == 0  # the control: the input is the one the bake recorded
    edit_json(tree, "data/cases.json", lambda nets: nets[0]["nodes"][0].__setitem__("x", nets[0]["nodes"][0]["x"] + 1))
    assert verify(tree, "--input", "data/cases.json").returncode != 0  # verification refuses the drifted input
    # and the check itself is gone: the named test must see it
    clean = py_copy(tmp_path / "gate")
    edit(clean, PIPE + "io.py", "if input_path is not None and digest(load_networks(input_path))!=source_hash:", "if False:")
    assert_py_fails(clean, gate)


def test_op_008_a_run_that_truncates_the_input_before_checking_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "cli.py", "    args=parser().parse_args(argv)\n",
               '    args=parser().parse_args(argv)\n    if args.command in ("solve","bake"):\n        open(args.input,"w").close()\n')],
             [IO + "test_cli_rejects_invalid_parameters_and_leaves_existing_input"])


def test_op_009_a_bad_cell_and_a_reader_of_the_download_are_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    cell = TABLES + "test_every_row_of_every_table_matches_the_schema[bake]"
    reader = TABLES + "test_published_download_has_no_reader_in_the_repository"
    assert_py_clean(tmp_path_factory, cell, reader)
    tree = py_copy(tmp_path / "cell")
    table = tree / "data" / "artifacts" / "csv" / "hard-rock.csv"
    lines = table.read_text(encoding="utf-8").split("\n")
    first = lines[1].split(",")
    first[4] = "not-a-number"  # a text value in a numeric column
    lines[1] = ",".join(first)
    table.write_text("\n".join(lines), encoding="utf-8")
    assert_py_fails(tree, cell)
    # a source file that reads the tables, in a copy that is a git repository (the gate asks git for the readers)
    tree2 = py_copy(tmp_path / "reader", "frontend/src/learned/index.ts")
    (tree2 / "frontend" / "src" / "tableReader.ts").write_text('export const tables = fetch("data/artifacts/csv/hard-rock.csv")\n', encoding="utf-8")
    git_commit(tree2)
    assert_py_fails(tree2, reader)
