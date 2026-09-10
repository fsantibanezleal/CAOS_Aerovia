"""Same-input metrics, complete regime cells, empirical calibration and controls."""
from pathlib import Path
import json
import math
import numpy as np

from .io import write_json, utc_now
from .model import NetworkError, assemble
from .surrogate_data import METHODS, REGIMES, arrays


def physical_metrics(network, factors, q, p):
    model = assemble(network)
    mass = np.max(np.abs(q @ model["bi"].T), axis=1)
    closure = np.max(np.abs(p @ model["b"] + model["h"] - (factors*model["r"]+model["k"])*q*np.abs(q)), axis=1)
    heads = model["h"]-model["k"]*q*np.abs(q)
    fans = np.array([bool(edge.get("fan")) for edge in network["edges"]])
    power = np.sum(np.where(fans, np.maximum(heads,0)*np.maximum(q,0)/model["efficiency"]/1000.,0), axis=1)
    unsupported = np.any(fans & ((q < -1e-7) | (heads < -1e-6)), axis=1)
    return mass, closure, power, unsupported


def confusion_metrics(predicted, reference, targets):
    target_mask = targets > 0
    actual = reference[:, target_mask] < targets[target_mask]
    predicted = predicted[:, target_mask] < targets[target_mask]
    tp = int(np.count_nonzero(predicted & actual))
    fn = int(np.count_nonzero(~predicted & actual))
    tn = int(np.count_nonzero(~predicted & ~actual))
    fp = int(np.count_nonzero(predicted & ~actual))
    return {"shortfallTruePositive": tp, "shortfallFalseNegative": fn, "adequateTrueNegative": tn, "adequateFalsePositive": fp,
            "shortfallRecall": tp/(tp+fn) if tp+fn else None, "adequateRecall": tn/(tn+fp) if tn+fp else None,
            "classificationObservations": tp+fn+tn+fp, "classificationMeaning": "derived branch flow below configured target; not an operational safety classifier"}


def score_arrays(network, factors, raw, flow, pressure, q_reference, p_reference, speeds):
    # Residuals computed at unit speed then scaled by their exact physical degree.
    mass, closure, power, unsupported = physical_metrics(network, factors, flow, pressure)
    _, _, ref_power, _ = physical_metrics(network, factors, q_reference, p_reference)
    q_delta = (flow-q_reference)*speeds[:, None]
    p_delta = (pressure-p_reference)*speeds[:, None]**2
    raw_delta = (raw-q_reference)*speeds[:, None]
    targets = np.array([e["target"] for e in network["edges"]])
    stable_scale = np.maximum(np.abs(q_reference)*speeds[:, None],5.)
    values = {"samples": len(flow), "edgeObservations": int(flow.size), "nodeObservations": int(pressure.size),
              "flowMAE": float(np.mean(np.abs(q_delta))), "flowRMSE": float(np.sqrt(np.mean(q_delta**2))),
              "flowMaxError": float(np.max(np.abs(q_delta))), "flowNormalizedRMSE": float(np.sqrt(np.mean((q_delta/stable_scale)**2))),
              "rawFlowMAE": float(np.mean(np.abs(raw_delta))), "rawFlowRMSE": float(np.sqrt(np.mean(raw_delta**2))),
              "pressureMAE": float(np.mean(np.abs(p_delta))), "pressureRMSE": float(np.sqrt(np.mean(p_delta**2))),
              "pressureMaxError": float(np.max(np.abs(p_delta))), "massResidualMax": float(np.max(mass*speeds)),
              "pressureResidualMax": float(np.max(closure*speeds**2)),
              "powerMAE": float(np.mean(np.abs(power-ref_power)*speeds**3)),
              "powerMaxError": float(np.max(np.abs(power-ref_power)*speeds**3)),
              "unsupportedFanPredictions": int(unsupported.sum()), "nonfinitePredictions": 0,
              "normalization": "elementwise max(abs(reference flow),5 m3/s); zeros retained"}
    values.update(confusion_metrics(flow*speeds[:,None], q_reference*speeds[:,None], targets))
    return values


def aggregate_rows(rows, method):
    subset = [row for row in rows if row["methodId"] == method]
    edge_count = sum(row["edgeObservations"] for row in subset)
    node_count = sum(row["nodeObservations"] for row in subset)
    samples = sum(row["samples"] for row in subset)
    result = {"methodId": method, "samples": samples, "cells": len(subset), "edgeObservations": edge_count,
              "nodeObservations": node_count, "flowMAE": sum(r["flowMAE"]*r["edgeObservations"] for r in subset)/edge_count,
              "flowRMSE": math.sqrt(sum(r["flowRMSE"]**2*r["edgeObservations"] for r in subset)/edge_count),
              "flowNormalizedRMSE": math.sqrt(sum(r["flowNormalizedRMSE"]**2*r["edgeObservations"] for r in subset)/edge_count),
              "flowMaxError": max(r["flowMaxError"] for r in subset),
              "pressureMAE": sum(r["pressureMAE"]*r["nodeObservations"] for r in subset)/node_count,
              "pressureMaxError": max(r["pressureMaxError"] for r in subset),
              "massResidualMax": max(r["massResidualMax"] for r in subset), "pressureResidualMax": max(r["pressureResidualMax"] for r in subset),
              "powerMAE": sum(r["powerMAE"]*r["samples"] for r in subset)/samples,
              "unsupportedFanPredictions": sum(r["unsupportedFanPredictions"] for r in subset), "nonfinitePredictions": 0}
    for key in ("shortfallTruePositive", "shortfallFalseNegative", "adequateTrueNegative", "adequateFalsePositive", "classificationObservations"):
        result[key] = sum(r[key] for r in subset)
    tp, fn, tn, fp = (result[key] for key in ("shortfallTruePositive", "shortfallFalseNegative", "adequateTrueNegative", "adequateFalsePositive"))
    result["shortfallRecall"] = tp/(tp+fn) if tp+fn else None
    result["adequateRecall"] = tn/(tn+fp) if tn+fp else None
    return result


def evaluate(work):
    work = Path(work)
    networks = json.loads((work / "networks.json").read_text(encoding="utf-8"))
    inference = json.loads((work / "inference.json").read_text(encoding="utf-8"))
    rows, calibration, parity = [], [], []
    all_methods = ("scipy-reference", *METHODS)
    for net in networks:
        with np.load(work / "dataset" / f"{net['id']}.test.npz", allow_pickle=False) as data:
            factors, q_ref, p_ref, regimes, speeds = (data[k] for k in ("factors", "flows", "pressures", "regimes", "speeds"))
        for method in all_methods:
            with np.load(work / "inference" / f"{method}.{net['id']}.test.npz", allow_pickle=False) as data:
                raw, q, p = (data[k] for k in ("rawFlows", "flows", "pressures"))
            if not all(np.all(np.isfinite(value)) for value in (raw,q,p)):
                raise NetworkError("Non-finite prediction in evaluation")
            for i, regime in enumerate(REGIMES):
                selected = regimes == i
                if not np.any(selected):
                    raise NetworkError("Missing held-out regime cell")
                metrics = score_arrays(net, factors[selected], raw[selected], q[selected], p[selected], q_ref[selected], p_ref[selected], speeds[selected])
                rows.append({"methodId": method, "networkId": net["id"], "regimeId": regime["id"], "split": "test", **metrics})
            if method == "scipy-reference":
                delta_q, delta_p = float(np.max(np.abs(q-q_ref))), float(np.max(np.abs(p-p_ref)))
                if delta_q > 2e-6 or delta_p > 1e-4:
                    raise NetworkError("Full held-out SciPy/CUDA label parity failed")
                parity.append({"networkId": net["id"], "samples": len(q), "flowMaxAbs": delta_q, "pressureMaxAbs": delta_p})
                continue
            with np.load(work / "dataset" / f"{net['id']}.calibration.npz", allow_pickle=False) as data:
                q_cal, p_cal = data["flows"], data["pressures"]
            with np.load(work / "inference" / f"{method}.{net['id']}.calibration.npz", allow_pickle=False) as data:
                q_cal_pred, p_cal_pred = data["flows"], data["pressures"]
            maxima = np.max(np.abs(q_cal_pred-q_cal),axis=1)
            index = min(len(maxima)-1, math.ceil((len(maxima)+1)*.95)-1)
            bound = float(np.sort(maxima)[index])
            p_bound = float(np.sort(np.max(np.abs(p_cal_pred-p_cal),axis=1))[index])
            covered = np.max(np.abs(q-q_ref),axis=1) <= bound
            calibration.append({"methodId": method, "networkId": net["id"], "samples": len(maxima), "nominalCoverage": .95,
                                "flowMaxErrorBoundUnitSpeed": bound, "pressureMaxErrorBoundUnitSpeed": p_bound,
                                "heldoutCovered": int(covered.sum()), "heldoutSamples": len(covered), "heldoutCoverage": float(covered.mean()),
                                "interpretation": "split-calibration maximum branch error at unit speed; empirical held-out coverage, no field-data or OOD guarantee"})
    aggregates = [aggregate_rows(rows, method) for method in all_methods]
    for aggregate in aggregates:
        timed = [r for r in inference["records"] if r["methodId"] == aggregate["methodId"] and r["split"] == "test"]
        aggregate["inferenceMs"] = sum(r["elapsedMs"] for r in timed)
        aggregate["msPerSample"] = aggregate["inferenceMs"]/aggregate["samples"]
        aggregate["timingScope"] = timed[0]["timingScope"]
        aggregate["runtime"] = timed[0]["runtime"]
    result = {"schema": "aerovia.surrogate-evaluation/v1", "createdAt": utc_now(), "rows": rows, "aggregate": aggregates,
              "calibration": calibration, "teacherParity": parity, "completeness": {"cases": len(networks), "regimes": len(REGIMES),
              "methods": len(all_methods), "expectedCells": len(networks)*len(REGIMES)*len(all_methods), "actualCells": len(rows), "missingCells": 0},
              "splitScope": "held-out resistance vectors on known authored topologies; no unseen-mine or field-data validation",
              "metricUnits": {"flowMAE": "m3/s", "flowRMSE": "m3/s", "flowMaxError": "m3/s", "pressureMAE": "Pa", "pressureResidualMax": "Pa", "massResidualMax": "m3/s", "powerMAE": "kW"}}
    write_json(work / "evaluation.json", result)
    return result
