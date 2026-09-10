"""Seeded CUDA/CPU training, resumable checkpoints and complete batch inference."""
from pathlib import Path
from time import perf_counter
import json
import math
import os
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
import numpy as np
import torch

from .io import utc_now, write_json
from .model import NetworkError, solve
from .surrogate_data import METHODS, SPLITS, VERSION, arrays, file_identity
from .surrogate_models import TopologyMLP, GraphSurrogate, tensor_graph, loss_function, ExportedSurrogate


def runtime(device):
    if device not in ("cpu", "cuda") or (device == "cuda" and not torch.cuda.is_available()):
        raise NetworkError("Select an available CPU or CUDA device")
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    return {"device": device, "hardware": torch.cuda.get_device_name(0) if device == "cuda" else "CPU",
            "torch": str(torch.__version__), "cuda": torch.version.cuda, "precision": "float32", "tf32": False,
            "threads": torch.get_num_threads(), "deterministicAlgorithms": True}


def save_checkpoint(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    torch.save(value, temporary)
    os.replace(temporary, path)


def load_data(work, case_id, split, device):
    with np.load(Path(work) / "features" / f"{case_id}.{split}.npz", allow_pickle=False) as data:
        return torch.as_tensor(data["x"], device=device), torch.as_tensor(data["y"], device=device)


def build_model(method, edges, config):
    if method == "topology-mlp":
        return TopologyMLP(edges, config.get("hidden", 128))
    if method == "graph-surrogate":
        return GraphSurrogate(hidden=config.get("hidden", 32), steps=config.get("steps", 4))
    raise NetworkError(f"Unknown learned method {method}")


def load_model(path, device="cpu"):
    checkpoint = load_checkpoint(path)
    model = build_model(checkpoint["methodId"], checkpoint["edges"], checkpoint["architecture"])
    model.load_state_dict(checkpoint["stateDict"])
    return model.to(device).eval(), checkpoint


def load_checkpoint(path):
    # Early local training receipts used PyTorch's str subclass for its version.
    # Permit only that known inert type, retaining weights-only unpickling.
    from torch.torch_version import TorchVersion
    with torch.serialization.safe_globals([TorchVersion]):
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    checkpoint["runtime"]["torch"] = str(checkpoint["runtime"]["torch"])
    return checkpoint


def train_one(work, method, case_ids, device, epochs, batch_size, seed, resume=False, hidden=None, steps=4, namespace=None):
    work = Path(work)
    runtime_info = runtime(device)
    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)
    generator = torch.Generator().manual_seed(seed)
    graphs = {case: tensor_graph(arrays(work, case), device) for case in case_ids}
    training = {case: load_data(work, case, "train", device) for case in case_ids}
    validation = {case: load_data(work, case, "validation", device) for case in case_ids}
    architecture = {"hidden": hidden or (128 if method == "topology-mlp" else 32), "steps": steps}
    edges = training[case_ids[0]][0].shape[1]
    model = build_model(method, edges, architecture).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.0015 if method == "topology-mlp" else .001, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=.5, patience=20, min_lr=1e-5)
    name = case_ids[0] if method == "topology-mlp" else "shared"
    folder = work / "checkpoints" / (namespace or method)
    best_path, last_path = folder / f"{name}.best.pt", folder / f"{name}.last.pt"
    data_hashes = {case: file_identity(work / "features" / f"{case}.train.npz")["sha256"] for case in case_ids}
    start_epoch, best_loss, best_epoch, history, prior_seconds = 0, math.inf, 0, [], 0.
    if resume and last_path.exists():
        state = load_checkpoint(last_path)
        if state["datasetHashes"] != data_hashes or state["architecture"] != architecture or state["caseIds"] != case_ids:
            raise NetworkError("Resume checkpoint does not match the input dataset or architecture")
        model.load_state_dict(state["stateDict"])
        optimizer.load_state_dict(state["optimizer"])
        scheduler.load_state_dict(state["scheduler"])
        generator.set_state(state["shuffleState"])
        torch.set_rng_state(state["torchState"])
        if device == "cuda" and state.get("cudaStates"):
            torch.cuda.set_rng_state_all(state["cudaStates"])
        start_epoch, best_loss, best_epoch = state["epoch"], state["bestLoss"], state["bestEpoch"]
        history, prior_seconds = state["history"], state["elapsedSeconds"]
    started = perf_counter()
    for epoch in range(start_epoch+1, epochs+1):
        model.train()
        total_loss, batches = 0., 0
        order = torch.randperm(len(case_ids), generator=generator).tolist()
        for case_index in order:
            case = case_ids[case_index]
            x, y = training[case]
            indices = torch.randperm(len(x), generator=generator).to(device)
            for offset in range(0, len(x), batch_size):
                selected = indices[offset:offset+batch_size]
                optimizer.zero_grad(set_to_none=True)
                loss = loss_function(model, x[selected], y[selected], graphs[case])
                if not torch.isfinite(loss):
                    raise NetworkError("Non-finite training loss; no checkpoint promoted")
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
                optimizer.step()
                total_loss += float(loss.detach())
                batches += 1
        model.eval()
        with torch.inference_mode():
            validation_loss = sum(float(loss_function(model, *validation[case], graphs[case])) for case in case_ids) / len(case_ids)
        scheduler.step(validation_loss)
        history.append({"epoch": epoch, "trainLoss": total_loss/max(1,batches), "validationLoss": validation_loss, "learningRate": optimizer.param_groups[0]["lr"]})
        metadata = {"schema": "aerovia.checkpoint/v1", "version": VERSION, "methodId": method, "caseIds": case_ids, "edges": edges,
                    "architecture": architecture, "seed": seed, "epoch": epoch, "datasetHashes": data_hashes,
                    "runtime": runtime_info, "stateDict": {key: value.detach().cpu() for key, value in model.state_dict().items()}}
        if validation_loss < best_loss:
            best_loss, best_epoch = validation_loss, epoch
            save_checkpoint(best_path, {**metadata, "validationLoss": best_loss})
        if epoch % 25 == 0 or epoch == epochs:
            elapsed = prior_seconds + perf_counter()-started
            save_checkpoint(last_path, {**metadata, "optimizer": optimizer.state_dict(), "scheduler": scheduler.state_dict(),
                                       "shuffleState": generator.get_state(), "torchState": torch.get_rng_state(),
                                       "cudaStates": torch.cuda.get_rng_state_all() if device == "cuda" else [],
                                       "bestLoss": best_loss, "bestEpoch": best_epoch, "history": history, "elapsedSeconds": elapsed})
            print(f"train {method}/{name}: epoch {epoch}, validation={validation_loss:.6g}, best={best_loss:.6g}, seconds={elapsed:.1f}", flush=True)
    if not best_path.exists():
        raise NetworkError("Training produced no best checkpoint")
    result = {"methodId": method, "caseIds": case_ids, "architecture": architecture, "seed": seed, "epochs": epochs,
              "bestEpoch": best_epoch, "bestValidationLoss": best_loss, "batchSize": batch_size,
              "elapsedSeconds": prior_seconds + perf_counter()-started, "runtime": runtime_info, "history": history,
              "checkpoint": best_path.relative_to(work).as_posix(), **file_identity(best_path), "resumableCheckpoint": last_path.relative_to(work).as_posix(),
              "datasetHashes": data_hashes, "parameters": sum(value.numel() for value in model.parameters())}
    write_json(work / "training" / (namespace or method) / f"{name}.json", result)
    return result


def train(work, device="cuda", mlp_epochs=350, graph_epochs=400, batch_size=256, seed=20260910, resume=False, methods=METHODS):
    work = Path(work)
    networks = json.loads((work / "networks.json").read_text(encoding="utf-8"))
    ids = [n["id"] for n in networks]
    records = []
    if "topology-mlp" in methods:
        for index, case in enumerate(ids):
            records.append(train_one(work, "topology-mlp", [case], device, mlp_epochs, batch_size, seed+index*101, resume))
    if "graph-surrogate" in methods:
        records.append(train_one(work, "graph-surrogate", ids, device, graph_epochs, batch_size, seed+70001, resume))
    # Preserve records from a completed other-method run when training just one lane.
    old_path = work / "training.json"
    if old_path.exists():
        old = json.loads(old_path.read_text(encoding="utf-8"))
        records = [r for r in old["models"] if r["methodId"] not in methods] + records
    result = {"schema": "aerovia.surrogate-training/v1", "createdAt": utc_now(), "version": VERSION,
              "selection": "minimum validation loss; calibration and test excluded from checkpoint selection", "models": records}
    write_json(old_path, result)
    return result


def infer(work, device="cpu", splits=("calibration", "test")):
    work = Path(work)
    info = runtime(device)
    networks = json.loads((work / "networks.json").read_text(encoding="utf-8"))
    records = []
    shared, _ = load_model(work / "checkpoints/graph-surrogate/shared.best.pt", device)
    for net in networks:
        prepared = arrays(work, net["id"])
        for method in METHODS:
            if method == "topology-mlp":
                model, checkpoint = load_model(work / f"checkpoints/{method}/{net['id']}.best.pt", device)
            else:
                model = shared
            wrapper = ExportedSurrogate(model, prepared).to(device).eval()
            for split in splits:
                x, _ = load_data(work, net["id"], split, device)
                with torch.inference_mode():
                    for _ in range(3):
                        wrapper(x[:min(32, len(x))])
                    if device == "cuda":
                        torch.cuda.synchronize()
                    started = perf_counter()
                    raw, q, p = wrapper(x)
                    if device == "cuda":
                        torch.cuda.synchronize()
                    elapsed_ms = (perf_counter()-started)*1000
                raw, q, p = [v.cpu().numpy() for v in (raw, q, p)]
                if not all(np.all(np.isfinite(value)) for value in (raw, q, p)):
                    raise NetworkError("Inference returned non-finite values")
                output = work / "inference" / f"{method}.{net['id']}.{split}.npz"
                output.parent.mkdir(parents=True, exist_ok=True)
                np.savez_compressed(output, rawFlows=raw, flows=q, pressures=p)
                records.append({"methodId": method, "networkId": net["id"], "split": split, "samples": len(x),
                                "file": output.relative_to(work).as_posix(), **file_identity(output), "elapsedMs": elapsed_ms,
                                "timingScope": "warm batch model plus deterministic projection/pressure reconstruction; excludes file IO and model loading", "runtime": info})
            print(f"infer {method}/{net['id']}: calibration and test complete", flush=True)
        with np.load(work / "dataset" / f"{net['id']}.test.npz", allow_pickle=False) as data:
            reference_q, reference_p = [], []
            started = perf_counter()
            for factors in data["factors"]:
                result = solve(net, resistance_draw=factors*prepared["resistance"])
                if not result["converged"]:
                    raise NetworkError("Independent held-out SciPy inference failed")
                reference_q.append(result["flows"])
                reference_p.append(result["pressures"])
            elapsed_ms = (perf_counter()-started)*1000
        output = work / "inference" / f"scipy-reference.{net['id']}.test.npz"
        np.savez_compressed(output, rawFlows=np.asarray(reference_q), flows=np.asarray(reference_q), pressures=np.asarray(reference_p))
        records.append({"methodId": "scipy-reference", "networkId": net["id"], "split": "test", "samples": len(reference_q),
                        "file": output.relative_to(work).as_posix(), **file_identity(output), "elapsedMs": elapsed_ms,
                        "timingScope": "complete independent SciPy solves on identical held-out resistance vectors; excludes file IO", "runtime": {"device": "cpu", "precision": "float64"}})
        print(f"infer scipy-reference/{net['id']}: {len(reference_q)} independent held-out solves", flush=True)
    result = {"schema": "aerovia.surrogate-inference/v1", "createdAt": utc_now(), "records": records}
    write_json(work / "inference.json", result)
    return result
