"""Seeded physical datasets and graph features for explicitly bounded surrogates."""
from hashlib import sha256
from pathlib import Path
from time import perf_counter
import json
import math
import numpy as np

from .ensemble import batch_solve
from .io import digest, load_networks, utc_now, write_json
from .model import assemble, solve, NetworkError, MASS_TOLERANCE, PRESSURE_TOLERANCE

VERSION = "1.0.0"
METHODS = ("topology-mlp", "graph-surrogate")
REGIMES = (
    {"id": "nominal", "name": {"en": "Design speed", "es": "Velocidad de diseño"}, "description": {"en": "Original resistance and nominal fan speed.", "es": "Resistencia original y velocidad nominal del ventilador."}, "speed": 1.0},
    {"id": "turndown", "name": {"en": "Fan turndown", "es": "Reducción de velocidad"}, "description": {"en": "65% speed, lower airflow and cubic power response.", "es": "Velocidad al 65%, menor caudal y respuesta cúbica de potencia."}, "speed": .65},
    {"id": "boost", "name": {"en": "Fan boost", "es": "Aumento de velocidad"}, "description": {"en": "125% speed, higher airflow and energy demand.", "es": "Velocidad al 125%, mayor caudal y demanda de energía."}, "speed": 1.25},
    {"id": "working-restriction", "name": {"en": "Restricted workings", "es": "Labores restringidas"}, "description": {"en": "Working-airway resistance multiplied by three.", "es": "Resistencia de las labores multiplicada por tres."}, "speed": 1.0},
    {"id": "return-restriction", "name": {"en": "Restricted returns", "es": "Retornos restringidos"}, "description": {"en": "Return-airway resistance multiplied by three.", "es": "Resistencia de los retornos multiplicada por tres."}, "speed": 1.0},
    {"id": "roughness", "name": {"en": "Distributed resistance", "es": "Resistencia distribuida"}, "description": {"en": "All airway resistances multiplied by 1.5; fan curve unchanged.", "es": "Todas las resistencias multiplicadas por 1,5; curva del ventilador sin cambios."}, "speed": 1.0},
)
FACTOR_BOUNDS = (.35, 5.8)
SPEED_BOUNDS = (0.0, 1.5)
SPLITS = ("train", "validation", "calibration", "test")


def file_identity(path):
    content = Path(path).read_bytes()
    return {"sha256": sha256(content).hexdigest(), "bytes": len(content)}


def physical_identity(network):
    """Changes irrelevant to airflow (names, display coordinates, targets, area) excluded."""
    return digest({"nodes": [{"id": n["id"], "boundary": n.get("boundary")} for n in network["nodes"]],
                   "edges": [{"id": e["id"], "from": e["from"], "to": e["to"], "kind": e["kind"], "fan": e.get("fan")} for e in network["edges"]]})


def regime_options(network, regime_id):
    regime = next((r for r in REGIMES if r["id"] == regime_id), None)
    if regime is None:
        raise NetworkError(f"Unknown surrogate regime: {regime_id}")
    options = {"speed": regime["speed"], "resistanceScale": 1., "overrides": {}}
    for edge in network["edges"]:
        factor = 3. if ((regime_id == "working-restriction" and edge["kind"] == "working") or
                        (regime_id == "return-restriction" and edge["kind"] == "return")) else 1.
        if regime_id == "roughness":
            factor = 1.5
        if factor != 1:
            options["overrides"][edge["id"]] = {"resistance": factor * edge["resistance"]}
    return options


def ingest(source, work):
    work = Path(work)
    networks = load_networks(source)
    if any(any(n.get("boundary", 0) != 0 for n in net["nodes"]) for net in networks):
        raise NetworkError("Surrogate training requires zero fixed boundary pressures for speed homogeneity")
    write_json(work / "networks.json", networks)
    receipt = {"schema": "aerovia.surrogate-ingest/v1", "createdAt": utc_now(), "sourceSha256": digest(networks),
               "cases": len(networks), "sourceKind": "authored-numerical-inputs", "networks": [{"id": n["id"], "sha256": digest(n), "physicalSha256": physical_identity(n)} for n in networks]}
    write_json(work / "ingest.json", receipt)
    return receipt


def preprocess(work):
    work = Path(work)
    networks = load_networks(work / "networks.json")
    records = []
    for net in networks:
        model = assemble(net)
        baseline = solve(net)
        if not baseline["converged"]:
            raise NetworkError(f"Nominal reference failed for {net['id']}")
        bi = model["bi"]
        projector = np.eye(len(net["edges"])) - bi.T @ np.linalg.solve(bi @ bi.T, bi)
        pressure_map = np.linalg.solve(bi @ bi.T, bi)
        q = np.asarray(baseline["flows"])
        p = np.asarray(baseline["pressures"])
        q_scale = np.maximum(np.abs(q), 5.)
        p_scale = model["pScale"]
        global_q = max(10., np.max(np.abs(q)))
        indices = {n["id"]: i for i, n in enumerate(net["nodes"])}
        starts = np.array([indices[e["from"]] for e in net["edges"]])
        ends = np.array([indices[e["to"]] for e in net["edges"]])
        source_select = np.eye(len(net["nodes"]))[starts]
        target_select = np.eye(len(net["nodes"]))[ends]
        outgoing = source_select.T / np.maximum(1, source_select.sum(axis=0))[:, None]
        incoming = target_select.T / np.maximum(1, target_select.sum(axis=0))[:, None]
        kinds = ("fan", "intake", "return", "working", "crosscut")
        edge_static = np.column_stack((np.log(model["r"]) / 8., q / global_q, q_scale / global_q,
                                      p[starts] / p_scale, p[ends] / p_scale, model["h"] / p_scale,
                                      model["k"] * q_scale**2 / p_scale,
                                      np.array([[float(e["kind"] == k) for k in kinds] for e in net["edges"]])))
        node_static = np.column_stack(([float("boundary" in n) for n in net["nodes"]], p / p_scale,
                                       source_select.sum(axis=0) / 6., target_select.sum(axis=0) / 6.))
        p_full = np.zeros((len(net["nodes"]), len(net["edges"])))
        p_full[model["internal"]] = pressure_map
        payload = {"resistance": model["r"], "coefficient": model["k"], "forcing": model["h"], "incidence": model["b"],
                   "bi": bi, "projector": projector, "pressure_map": p_full, "q_base": q, "p_base": p,
                   "q_scale": q_scale, "p_scale": np.array(p_scale), "edge_static": edge_static, "node_static": node_static,
                   "source_select": source_select, "target_select": target_select, "outgoing": outgoing, "incoming": incoming}
        output = work / "preprocessed" / f"{net['id']}.npz"
        output.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(output, **payload)
        record = {"networkId": net["id"], "sourceSha256": digest(net), "physicalSha256": physical_identity(net),
                  "reference": baseline, "projectionMassMaxAbs": float(np.max(np.abs(bi @ projector))),
                  "calibration": "one nominal SciPy solution at unit fan speed", "file": output.relative_to(work).as_posix(), **file_identity(output)}
        if record["projectionMassMaxAbs"] > 1e-12:
            raise NetworkError("Conservation projection failed independent matrix identity")
        records.append(record)
    result = {"schema": "aerovia.surrogate-preprocess/v1", "cases": records, "sourceSha256": digest(networks)}
    write_json(work / "preprocess.json", result)
    return result


def arrays(work, case_id):
    with np.load(Path(work) / "preprocessed" / f"{case_id}.npz", allow_pickle=False) as data:
        return dict(data)


def draw_factors(network, count, seed):
    """Stratified physical perturbations; augmentation occurs only inside its split."""
    rng = np.random.default_rng(seed)
    e = len(network["edges"])
    regimes = np.arange(count, dtype=np.int64) % len(REGIMES)
    rng.shuffle(regimes)
    factors = np.exp(rng.uniform(-.16, .16, (count, e)))
    kind = np.array([edge["kind"] for edge in network["edges"]])
    for row, regime in enumerate(regimes):
        factors[row] *= np.exp(rng.uniform(-.25, .25))
        # Background correlation across branches of a physical role.
        for role in ("intake", "return", "working", "crosscut"):
            factors[row, kind == role] *= np.exp(rng.uniform(-.22, .22))
        if regime == 3:
            factors[row, kind == "working"] *= rng.uniform(1.8, 3.4)
        elif regime == 4:
            factors[row, kind == "return"] *= rng.uniform(1.8, 3.4)
        elif regime == 5:
            factors[row] *= rng.uniform(1.2, 1.9)
        elif regime == 2 and np.any(kind == "crosscut"):
            factors[row, kind == "crosscut"] *= rng.uniform(.55, 1.1)
    factors = np.clip(factors, *FACTOR_BOUNDS)
    speeds = np.array([REGIMES[int(i)]["speed"] for i in regimes])
    return factors, regimes, speeds


def dataset(work, device="cuda", seed=20260910, train=2048, validation=256, calibration=256, test=256, checks=8):
    if any(count < 12 or count > 65536 for count in (train, validation, calibration, test)):
        raise NetworkError("Each split needs 12-65536 samples per case")
    if not 1 <= checks <= min(train, validation, calibration, test):
        raise NetworkError("SciPy checks must be positive and no larger than a split")
    work = Path(work)
    networks = load_networks(work / "networks.json")
    records, total_seconds = [], perf_counter()
    for case_index, net in enumerate(networks):
        model, baseline = assemble(net), solve(net)
        for split_index, (split, count) in enumerate(zip(SPLITS, (train, validation, calibration, test))):
            split_seed = int(seed + case_index * 100003 + split_index * 1009)
            factors, regimes, speeds = draw_factors(net, count, split_seed)
            resistance = factors * model["r"]
            q_chunks, p_chunks, failures, max_mass, max_pressure = [], [], 0, 0., 0.
            label_ms = 0.
            for start in range(0, count, 256):
                q, p, mass, closure, failed, _, ms, hardware, backend = batch_solve(model, resistance[start:start+256], baseline, device)
                fan_indices = np.array([bool(e.get("fan")) for e in net["edges"]])
                unsupported = np.any(fan_indices[None, :] & ((q < -1e-7) | ((model["h"] - model["k"] * q * np.abs(q)) < -1e-6)), axis=1)
                bad = failed | unsupported | (mass > MASS_TOLERANCE) | (closure > PRESSURE_TOLERANCE)
                failures += int(bad.sum())
                max_mass, max_pressure = max(max_mass, float(mass.max())), max(max_pressure, float(closure.max()))
                label_ms += ms
                q_chunks.append(q)
                p_chunks.append(p)
            if failures:
                raise NetworkError(f"{net['id']}/{split}: {failures} invalid teacher states; no failed labels are admitted")
            q, p = np.concatenate(q_chunks), np.concatenate(p_chunks)
            check_indices = np.unique(np.linspace(0, count-1, checks, dtype=int))
            parity_q, parity_p, scipy_ms = 0., 0., 0.
            references = []
            for index in check_indices:
                ref = solve(net, resistance_draw=resistance[index])
                if not ref["converged"]:
                    raise NetworkError("Independent SciPy certification failed")
                dq, dp = float(np.max(np.abs(q[index] - ref["flows"]))), float(np.max(np.abs(p[index] - ref["pressures"])))
                parity_q, parity_p = max(parity_q, dq), max(parity_p, dp)
                scipy_ms += ref["elapsedMs"]
                references.append({"sampleIndex": int(index), "flowMaxAbs": dq, "pressureMaxAbs": dp, "elapsedMs": ref["elapsedMs"]})
            if parity_q > 2e-6 or parity_p > 1e-4:
                raise NetworkError("CUDA/CPU teacher labels failed SciPy parity")
            output = work / "dataset" / f"{net['id']}.{split}.npz"
            output.parent.mkdir(parents=True, exist_ok=True)
            np.savez_compressed(output, factors=factors, flows=q, pressures=p, regimes=regimes, speeds=speeds)
            record = {"networkId": net["id"], "split": split, "samples": count, "seed": split_seed, "file": output.relative_to(work).as_posix(),
                      **file_identity(output), "regimeCounts": {r["id"]: int(np.count_nonzero(regimes == i)) for i, r in enumerate(REGIMES)},
                      "inputSha256": sha256(factors.tobytes()).hexdigest(), "failures": failures, "massResidualMax": max_mass,
                      "pressureResidualMax": max_pressure, "labelMs": label_ms, "device": device, "hardware": hardware, "backend": backend,
                      "scipyChecks": references, "scipyCheckMs": scipy_ms, "parityMaxAbsFlow": parity_q, "parityMaxAbsPressure": parity_p}
            records.append(record)
            print(f"dataset {net['id']}/{split}: {count} valid; SciPy max-flow delta {parity_q:.3g}", flush=True)
    result = {"schema": "aerovia.surrogate-dataset/v1", "createdAt": utc_now(), "sourceSha256": digest(networks), "seed": seed,
              "factorBounds": list(FACTOR_BOUNDS), "splitRule": "independent seeded resistance vectors; all speed derivatives remain within the same split",
              "teacher": "float64 batched nonlinear solver with independent same-input SciPy checks", "cases": records, "elapsedSeconds": perf_counter()-total_seconds}
    write_json(work / "dataset.json", result)
    return result


def features(work):
    work = Path(work)
    manifest = json.loads((work / "dataset.json").read_text(encoding="utf-8"))
    records, identities = [], set()
    for record in manifest["cases"]:
        data = np.load(work / record["file"], allow_pickle=False)
        prep = arrays(work, record["networkId"])
        x = np.log(data["factors"]).astype(np.float32)
        y = ((data["flows"] - prep["q_base"]) / prep["q_scale"]).astype(np.float32)
        for row in data["factors"]:
            key = (record["networkId"], sha256(row.tobytes()).hexdigest())
            if key in identities:
                raise NetworkError("Duplicate resistance vector across dataset splits")
            identities.add(key)
        output = work / "features" / f"{record['networkId']}.{record['split']}.npz"
        output.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(output, x=x, y=y)
        records.append({"networkId": record["networkId"], "split": record["split"], "samples": len(x), "inputWidth": x.shape[1],
                        "file": output.relative_to(work).as_posix(), **file_identity(output)})
    result = {"schema": "aerovia.surrogate-features/v1", "featureSchema": "aerovia.resistance-log-ratios/v1", "learnedNormalization": False,
              "description": "natural log effective/base resistance; unit-speed flow corrections scaled by max(abs(nominal flow),5 m3/s)",
              "duplicateInputs": 0, "uniqueInputs": len(identities), "cases": records}
    write_json(work / "features.json", result)
    return result


def domain_status(network, options, registered_network):
    if physical_identity(network) != physical_identity(registered_network):
        return "out-of-domain", "Connectivity, fan curve, edge kind or pressure boundaries differ from the calibrated topology", None
    if not SPEED_BOUNDS[0] <= options.get("speed", 1.) <= SPEED_BOUNDS[1]:
        return "out-of-domain", "Fan speed is outside the supported homogeneous scaling range", None
    overrides = options.get("overrides", {})
    if any(value.get("closed", False) for value in overrides.values()):
        return "out-of-domain", "Closed branches change the calibrated topology", None
    factors = np.array([overrides.get(e["id"], {}).get("resistance", e["resistance"]) * options.get("resistanceScale", 1.) / base["resistance"]
                        for e, base in zip(network["edges"], registered_network["edges"])])
    if not np.all(np.isfinite(factors)) or np.any(factors < FACTOR_BOUNDS[0]) or np.any(factors > FACTOR_BOUNDS[1]):
        return "out-of-domain", "Resistance ratio is outside the published training domain", None
    return "supported", "Known authored topology and bounded resistance parameters; approximation requires residual review", np.log(factors).astype(np.float32)
