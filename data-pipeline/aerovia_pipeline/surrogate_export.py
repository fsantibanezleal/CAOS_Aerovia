"""Verified model export, compact scientific replay and independent release validation."""
from copy import deepcopy
from pathlib import Path
from time import perf_counter
import json
import os
import shutil
import tempfile
import numpy as np
import torch

from .io import digest, write_json, utc_now, write_manifest, verify_artifacts
from .model import NetworkError, assemble, build_result, solve
from .surrogate_data import METHODS, REGIMES, VERSION, FACTOR_BOUNDS, SPEED_BOUNDS, arrays, file_identity, physical_identity, regime_options, domain_status
from .surrogate_models import ExportedSurrogate
from .surrogate_validate import validate_models, validate_release
from .surrogate_train import load_model, runtime, save_checkpoint

ONNX_FLOW_TOLERANCE = .001
ONNX_PRESSURE_TOLERANCE = .05


def export_onnx(wrapper, x, destination):
    import onnx
    import onnxruntime as ort
    wrapper = wrapper.cpu().eval()
    batch = torch.export.Dim("batch", min=1, max=8192)
    torch.onnx.export(wrapper, (torch.zeros((2, x.shape[1]),dtype=torch.float32),), str(destination),
                      input_names=["logResistanceRatios"], output_names=["rawFlows", "flows", "pressures"],
                      dynamic_shapes={"logResistanceRatios": {0: batch}}, opset_version=18, dynamo=True,
                      external_data=False, verbose=False)
    model = onnx.load(destination)
    # Export stack metadata may include source-machine paths. Only numerical graph data is public.
    model.doc_string = "Aerovia learned unit-speed airflow approximation; Apache-2.0; see registry.json."
    del model.metadata_props[:]
    model.graph.doc_string = ""
    for node in model.graph.node:
        node.doc_string = ""
        del node.metadata_props[:]
    for value in (*model.graph.input, *model.graph.output, *model.graph.value_info):
        value.doc_string = ""
        del value.metadata_props[:]
    onnx.checker.check_model(model)
    onnx.save(model, destination)
    options = ort.SessionOptions()
    options.intra_op_num_threads, options.inter_op_num_threads = 1, 1
    session = ort.InferenceSession(str(destination), sess_options=options, providers=["CPUExecutionProvider"])
    with torch.inference_mode():
        expected = [value.numpy() for value in wrapper(torch.as_tensor(x, dtype=torch.float32))]
    actual = session.run(None, {"logResistanceRatios": x.astype(np.float32)})
    deltas = [float(np.max(np.abs(a-b))) for a,b in zip(actual,expected)]
    if max(deltas[:2]) > ONNX_FLOW_TOLERANCE or deltas[2] > ONNX_PRESSURE_TOLERANCE:
        raise NetworkError(f"ONNX parity failed: flow {max(deltas[:2]):.6g}, pressure {deltas[2]:.6g}")
    # A one-row call is a separate dynamic-shape gate, not inferred from a large batch.
    single = session.run(None, {"logResistanceRatios": x[:1].astype(np.float32)})
    if any(np.max(np.abs(a-b[:1])) > (ONNX_PRESSURE_TOLERANCE if i==2 else ONNX_FLOW_TOLERANCE) for i,(a,b) in enumerate(zip(single,actual))):
        raise NetworkError("Dynamic single-sample ONNX parity failed")
    return {"samples": len(x), "rawFlowMaxAbs": deltas[0], "flowMaxAbs": deltas[1], "pressureMaxAbs": deltas[2],
            "flowTolerance": ONNX_FLOW_TOLERANCE, "pressureTolerance": ONNX_PRESSURE_TOLERANCE,
            "runtime": f"ONNX Runtime {ort.__version__} CPU", "singleSamplePassed": True}


def signature(network):
    return {"nodeIds": [n["id"] for n in network["nodes"]], "boundaries": [n.get("boundary") for n in network["nodes"]],
            "edgeIds": [e["id"] for e in network["edges"]], "from": [e["from"] for e in network["edges"]],
            "to": [e["to"] for e in network["edges"]], "kinds": [e["kind"] for e in network["edges"]],
            "fanPressure": [e.get("fan",{}).get("pressure",0) for e in network["edges"]],
            "fanCoefficient": [e.get("fan",{}).get("coefficient",0) for e in network["edges"]],
            "fanEfficiency": [e.get("fan",{}).get("efficiency",1) for e in network["edges"]]}


def summarize_prediction(network, options, raw, q, p, reference, elapsed_ms):
    model = assemble(network, options)
    result = build_result(network, options, model, q, p, 0, elapsed_ms, "learned approximation; inspect physical residuals")
    error = np.asarray(q)-reference["flows"]
    p_error = np.asarray(p)-reference["pressures"]
    return {"status": "supported", "lane": "offline", "modelVersion": VERSION, "rawFlows": np.asarray(raw).tolist(),
            "result": result, "errors": error.tolist(), "metrics": {"flowMAE": float(np.mean(np.abs(error))),
            "flowRMSE": float(np.sqrt(np.mean(error**2))), "flowMaxError": float(np.max(np.abs(error))),
            "pressureMAE": float(np.mean(np.abs(p_error))), "pressureMaxError": float(np.max(np.abs(p_error))),
            "powerAbsErrorKW": abs(result["fanPowerKW"]-reference["fanPowerKW"])},
            "interpretation": "learned approximation; the exact-solver converged field reports physical residual acceptance only"}


def export(work, models_output, science_output):
    work, models_output, science_output = Path(work), Path(models_output), Path(science_output)
    runtime("cpu")
    networks = json.loads((work / "networks.json").read_text(encoding="utf-8"))
    training = json.loads((work / "training.json").read_text(encoding="utf-8"))
    evaluation = json.loads((work / "evaluation.json").read_text(encoding="utf-8"))
    dataset = json.loads((work / "dataset.json").read_text(encoding="utf-8"))
    feature_manifest = json.loads((work / "features.json").read_text(encoding="utf-8"))
    models_output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".aerovia-models-", dir=models_output.parent))
    entries, cases, fixtures, controls, heldout_fixtures = [], [], [], [], []
    try:
        for net in networks:
            prepared = arrays(work, net["id"])
            wrappers = {}
            with np.load(work / "features" / f"{net['id']}.test.npz", allow_pickle=False) as data:
                check_x = data["x"][:32]
            for method in METHODS:
                key = net["id"] if method == "topology-mlp" else "shared"
                checkpoint_source = work / f"checkpoints/{method}/{key}.best.pt"
                model, checkpoint = load_model(checkpoint_source)
                wrapper = ExportedSurrogate(model, prepared).eval()
                wrappers[method] = wrapper
                folder = staging / method
                folder.mkdir(exist_ok=True)
                checkpoint_target = folder / f"{key}.pt"
                if not checkpoint_target.exists():
                    save_checkpoint(checkpoint_target,checkpoint)
                onnx_target = folder / f"{net['id']}.onnx"
                parity = export_onnx(wrapper, check_x, onnx_target)
                with torch.inference_mode():
                    outputs = [v.numpy() for v in wrapper(torch.as_tensor(check_x[:2]))]
                fixtures.append({"methodId": method, "networkId": net["id"], "input": check_x[:2].tolist(),
                                 "rawFlows": outputs[0].tolist(), "flows": outputs[1].tolist(), "pressures": outputs[2].tolist()})
                entries.append({"methodId": method, "networkId": net["id"], "version": VERSION, "license": "Apache-2.0",
                                "status": "implemented", "lane": "offline-and-onnx", "physicalSha256": physical_identity(net),
                                "sourceSha256": digest(net), "checkpoint": {"file": checkpoint_target.relative_to(staging).as_posix(), **file_identity(checkpoint_target)},
                                "onnx": {"file": onnx_target.relative_to(staging).as_posix(), **file_identity(onnx_target)},
                                "input": {"name": "logResistanceRatios", "dtype": "float32", "shape": ["batch",len(net["edges"])]},
                                "outputs": ["rawFlows", "flows", "pressures"], "outputSpeed": 1,
                                "factorBounds": list(FACTOR_BOUNDS), "speedBounds": list(SPEED_BOUNDS), "baseResistances": prepared["resistance"].tolist(),
                                "signature": signature(net), "onnxParity": parity, "trainingSeed": checkpoint["seed"],
                                "bestEpoch": checkpoint["epoch"], "validationLoss": checkpoint["validationLoss"],
                                "architecture": checkpoint["architecture"], "trainingCaseIds": checkpoint["caseIds"]})
                print(f"export {method}/{net['id']}: ONNX max-flow delta {parity['flowMaxAbs']:.3g}",flush=True)
            replay = []
            for regime in REGIMES:
                options = regime_options(net, regime["id"])
                reference = solve(net, options)
                if not reference["converged"]:
                    raise NetworkError("Canonical regime reference failed")
                status, reason, x = domain_status(net, options, net)
                if status != "supported":
                    raise NetworkError("Canonical regime outside model domain")
                predictions = {}
                for method, wrapper in wrappers.items():
                    started = perf_counter()
                    with torch.inference_mode():
                        raw, q, p = [v.numpy()[0] for v in wrapper(torch.as_tensor(x[None,:]))]
                    speed = options["speed"]
                    predictions[method] = summarize_prediction(net, options, raw*speed, q*speed, p*speed**2, reference, (perf_counter()-started)*1000)
                replay.append({"id": regime["id"], "options": options, "reference": reference, "predictions": predictions})
            cases.append({"networkId": net["id"], "sourceSha256": digest(net), "regimes": replay})
            with np.load(work / "dataset" / f"{net['id']}.test.npz",allow_pickle=False) as test_data:
                factors, speed = test_data["factors"][0], float(test_data["speeds"][0])
            heldout_options = {"speed": speed, "resistanceScale": 1., "overrides": {e["id"]: {"resistance": float(e["resistance"]*factor)} for e,factor in zip(net["edges"],factors)}}
            heldout_reference = solve(net,heldout_options)
            if not heldout_reference["converged"]:
                raise NetworkError("Exported held-out live comparison fixture failed reference solve")
            heldout_fixtures.append({"networkId": net["id"], "split": "test", "sampleId": f"{net['id']}:test:0", "sampleIndex": 0,
                                     "options": heldout_options, "reference": heldout_reference})
            # No hidden nonlinear fallback: actual domain rejection outcomes are recorded.
            for control_id, options in (("closure", {"overrides": {net["edges"][0]["id"]: {"closed": True}}}),
                                        ("resistance-extrapolation", {"resistanceScale": 10.}), ("fan-off", {"speed": 0.})):
                status, reason, x = domain_status(net, options, net)
                item = {"networkId": net["id"], "id": control_id, "status": status, "reason": reason}
                if control_id == "fan-off":
                    item["expectedFlowMaxAbs"] = 0.
                    item["interpretation"] = "exact homogeneous zero-forcing control, not evidence of learned accuracy"
                controls.append(item)
            altered = deepcopy(net)
            altered["edges"][0]["to"] = net["nodes"][-1]["id"]
            if altered["edges"][0]["to"] == net["edges"][0]["to"]:
                altered["edges"][0]["from"] = net["nodes"][-1]["id"]
            status, reason, _ = domain_status(altered, {}, net)
            controls.append({"networkId": net["id"], "id": "unknown-connectivity", "status": status, "reason": reason})
        source_identity = digest(networks)
        repository = Path(__file__).resolve().parents[2]
        implementation_files = {p.relative_to(repository).as_posix():file_identity(p) for p in sorted(Path(__file__).parent.glob("surrogate_*.py"))}
        diagnostic_checkpoints=[]
        if "familyHoldout" in evaluation:
            record=evaluation["familyHoldout"]["training"]
            _,checkpoint=load_model(work/record["checkpoint"])
            target=staging/"diagnostics"/"room-pillar-holdout.pt"
            save_checkpoint(target,checkpoint)
            diagnostic_checkpoints.append({"id":"room-pillar-family-holdout","file":target.relative_to(staging).as_posix(),**file_identity(target),
                                           "trainingCaseIds":checkpoint["caseIds"],"lane":"offline-diagnostic"})
        registry = {"schema": "aerovia.model-registry/v1", "version": VERSION, "createdAt": utc_now(), "sourceSha256": source_identity,
                    "featureSchema": "aerovia.resistance-log-ratios/v1", "entries": entries, "diagnosticCheckpoints":diagnostic_checkpoints,
                    "implementationAtExport":implementation_files,
                    "domain": "known calibrated authored topologies and bounded effective resistance ratios; closures, altered fans or boundaries rejected",
                    "postprocessing": "model outputs are unit speed; apply q*s,p*s^2 and recompute derived scalars; never silently solve instead"}
        write_json(staging / "registry.json", registry)
        write_json(staging / "parity-fixtures.json", {"schema": "aerovia.onnx-parity/v1", "flowTolerance": ONNX_FLOW_TOLERANCE,
                                                    "pressureTolerance": ONNX_PRESSURE_TOLERANCE, "fixtures": fixtures})
        model_files = {p.relative_to(staging).as_posix(): file_identity(p) for p in staging.rglob("*") if p.is_file()}
        write_json(staging / "manifest.json", {"schema": "aerovia.model-manifest/v1", "sourceSha256": source_identity, "files": model_files})
        methods = [{"id": "scipy-reference", "name": {"en": "Nonlinear reference", "es": "Referencia no lineal"}, "lane": "offline", "status": "implemented", "modelVersion": "SciPy reference"},
                   {"id": "topology-mlp", "name": {"en": "Topology MLP", "es": "MLP de topología"}, "lane": "offline-and-onnx", "status": "implemented", "modelVersion": VERSION},
                   {"id": "graph-surrogate", "name": {"en": "Graph surrogate", "es": "Modelo de grafos"}, "lane": "offline-and-onnx", "status": "implemented", "modelVersion": VERSION}]
        science = {"schema": "aerovia.science/v1", "version": VERSION, "createdAt": utc_now(), "sourceSha256": source_identity,
                   "methods": methods, "regimes": list(REGIMES), "cases": cases, "heldoutFixtures": heldout_fixtures, "benchmark": evaluation,
                   "training": {"models": [{k:v for k,v in model.items() if k not in ("history",)} for model in training["models"]],
                                "totalSamples": sum(r["samples"] for r in dataset["cases"]), "splits": {s: sum(r["samples"] for r in dataset["cases"] if r["split"]==s) for s in ("train","validation","calibration","test")},
                                "datasetSha256": file_identity(work / "dataset.json")["sha256"], "uniqueInputVectors": feature_manifest["uniqueInputs"],
                                "duplicateInputs": feature_manifest["duplicateInputs"], "teacher": dataset["teacher"], "datasetSeconds": dataset["elapsedSeconds"]},
                   "validation": {"onnx": [{"methodId": e["methodId"], "networkId": e["networkId"], **e["onnxParity"]} for e in entries],
                                  "controls": controls, "browserParity": "separate rendered/runtime gate; see browser test evidence"},
                   "provenance": {"dataKind": "authored engineering networks with computed nonlinear reference labels", "license": "Apache-2.0",
                                  "noFieldMeasurements": True, "calibration": "one nominal reference solve per known topology, disclosed as an input to both methods",
                                  "implementationAtExport":implementation_files,
                                  "sources": ["https://arxiv.org/abs/2403.18570", "https://proceedings.mlr.press/v70/gilmer17a.html", "https://doi.org/10.13272/j.issn.1671-251x.2024090057"]}}
        candidate_science = work/"release-candidate-science.json"
        write_json(candidate_science,science)
        validate_release(staging,candidate_science,work/"networks.json")
        backup = None
        if models_output.exists():
            validate_models(models_output, None)
            backup = models_output.with_name(models_output.name + ".previous")
            if backup.exists():
                raise NetworkError("Previous model backup exists; inspect it before a new promotion")
            os.replace(models_output, backup)
        try:
            os.replace(staging, models_output)
            write_json(science_output, science)
        except Exception:
            if backup is not None:
                if models_output.exists():
                    shutil.rmtree(models_output)
                os.replace(backup, models_output)
            raise
        if backup is not None:
            shutil.rmtree(backup)
        # Preserve and extend the existing numerical catalog manifest when publishing alongside it.
        artifact_manifest = science_output.parent / "manifest.json"
        if artifact_manifest.exists() and science_output.name == "science.json":
            current = json.loads(artifact_manifest.read_text(encoding="utf-8"))
            if current.get("schema") == "aerovia.manifest/v1":
                current["files"]["science.json"] = file_identity(science_output)
                write_json(artifact_manifest, current)
        return validate_release(models_output, science_output,work/"networks.json")
    finally:
        if staging.exists():
            shutil.rmtree(staging)
