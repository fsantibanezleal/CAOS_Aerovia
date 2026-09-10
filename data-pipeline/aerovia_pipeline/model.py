"""Strict public input contract and independent SciPy network reference."""
from copy import deepcopy
from time import perf_counter
import math
import re

import numpy as np
from scipy.optimize import least_squares

MAX_NODES = 120
MAX_EDGES = 240
MASS_TOLERANCE = 1e-6
PRESSURE_TOLERANCE = 1e-5


class NetworkError(ValueError):
    """An invalid or unsupported network, with a user-readable explanation."""


def number(value, field, lo, hi):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not lo <= value <= hi:
        raise NetworkError(f"{field} must be finite in [{lo}, {hi}]")


def localized(value, field):
    if not isinstance(value, dict) or any(not isinstance(value.get(lang), str) or not 1 <= len(value[lang]) <= 4000 for lang in ("en", "es")):
        raise NetworkError(f"{field} requires nonempty en and es strings (maximum 4000 characters)")


def identifier(value, field):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}", value):
        raise NetworkError(f"{field} requires a portable identifier of 1-80 characters")


def validate_network(network, options=None):
    if not isinstance(network, dict) or network.get("schema") != "aerovia.network/v1":
        raise NetworkError("Expected an aerovia.network/v1 object")
    identifier(network.get("id"), "id")
    localized(network.get("name"), "name")
    localized(network.get("description"), "description")
    provenance = network.get("provenance")
    if not isinstance(provenance, dict) or provenance.get("kind") not in ("authored", "imported"):
        raise NetworkError("provenance.kind must be authored or imported")
    for key in ("source", "license"):
        if not isinstance(provenance.get(key), str) or not 1 <= len(provenance[key]) <= 4000:
            raise NetworkError(f"provenance.{key} requires a nonempty string")
    nodes, edges = network.get("nodes"), network.get("edges")
    if not isinstance(nodes, list) or not 2 <= len(nodes) <= MAX_NODES:
        raise NetworkError(f"nodes must contain 2-{MAX_NODES} items")
    if not isinstance(edges, list) or not 1 <= len(edges) <= MAX_EDGES:
        raise NetworkError(f"edges must contain 1-{MAX_EDGES} items")
    node_ids, edge_ids, boundaries = set(), set(), set()
    for i, node in enumerate(nodes):
        if not isinstance(node, dict):
            raise NetworkError(f"nodes[{i}] must be an object")
        identifier(node.get("id"), f"nodes[{i}].id")
        if node["id"] in node_ids:
            raise NetworkError("Duplicate node id")
        node_ids.add(node["id"])
        for coordinate in ("x", "y", "z"):
            number(node.get(coordinate), f"node {node['id']}.{coordinate}", -1e6, 1e6)
        if "boundary" in node:
            number(node["boundary"], "boundary pressure", -1e6, 1e6)
            boundaries.add(node["id"])
    if not boundaries:
        raise NetworkError("At least one fixed pressure boundary is required")
    for i, edge in enumerate(edges):
        if not isinstance(edge, dict):
            raise NetworkError(f"edges[{i}] must be an object")
        identifier(edge.get("id"), f"edges[{i}].id")
        if edge["id"] in edge_ids:
            raise NetworkError("Duplicate edge id")
        edge_ids.add(edge["id"])
        if not isinstance(edge.get("from"),str) or not isinstance(edge.get("to"),str) or edge["from"] not in node_ids or edge["to"] not in node_ids or edge["from"] == edge["to"]:
            raise NetworkError(f"Edge {edge['id']} needs two distinct existing endpoint nodes")
        localized(edge.get("name"), f"edge {edge['id']}.name")
        if edge.get("kind") not in ("intake", "return", "working", "crosscut", "fan"):
            raise NetworkError("Unknown edge kind")
        number(edge.get("area"), "area", .1, 1000)
        number(edge.get("resistance"), "resistance", 1e-6, 1e6)
        number(edge.get("target"), "target", 0, 10000)
        if 0 < edge["target"] < 1e-6:
            raise NetworkError("A positive target must be at least 1e-6 m3/s; use zero to disable")
        number(edge.get("level"), "level", -100, 100)
        if "fan" in edge:
            fan = edge["fan"]
            if not isinstance(fan, dict) or edge["kind"] != "fan":
                raise NetworkError("A fan curve requires kind=fan")
            number(fan.get("pressure"), "fan pressure", 0, 1e5)
            number(fan.get("coefficient"), "fan coefficient", 0, 1e4)
            number(fan.get("efficiency"), "fan efficiency", .05, 1)
        elif edge["kind"] == "fan":
            raise NetworkError("A fan branch requires a fan curve")
    options = options or {}
    if not isinstance(options, dict):
        raise NetworkError("options must be an object")
    number(options.get("speed", 1), "speed", 0, 1.5)
    number(options.get("resistanceScale", 1), "resistanceScale", .05, 20)
    overrides = options.get("overrides", {})
    if not isinstance(overrides, dict):
        raise NetworkError("overrides must be an object")
    for key, value in overrides.items():
        if key not in edge_ids or not isinstance(value, dict):
            raise NetworkError("Each override must refer to an existing edge and contain an object")
        if set(value) - {"resistance", "area", "target", "closed"}:
            raise NetworkError("Unknown edge override field")
        for field, low, high in (("resistance", 1e-6, 1e6), ("area", .1, 1000), ("target", 0, 10000)):
            if field in value:
                number(value[field], f"override.{field}", low, high)
                if field == "target" and 0 < value[field] < 1e-6:
                    raise NetworkError("A positive target must be at least 1e-6 m3/s; use zero to disable")
        if "closed" in value and not isinstance(value["closed"], bool):
            raise NetworkError("closed must be boolean")
    neighbours = {key: set() for key in node_ids}
    for edge in edges:
        if not overrides.get(edge["id"], {}).get("closed", False):
            neighbours[edge["from"]].add(edge["to"])
            neighbours[edge["to"]].add(edge["from"])
    reached, todo = set(boundaries), list(boundaries)
    while todo:
        for key in neighbours[todo.pop()] - reached:
            reached.add(key)
            todo.append(key)
    if reached != node_ids:
        raise NetworkError("Every node needs an open path to a fixed pressure boundary")
    return network


def assemble(network, options=None):
    options = options or {}
    validate_network(network, options)
    nodes, edges = network["nodes"], network["edges"]
    overrides = options.get("overrides", {})
    indices = {node["id"]: i for i, node in enumerate(nodes)}
    active = [i for i, edge in enumerate(edges) if not overrides.get(edge["id"], {}).get("closed", False)]
    internal = [i for i, node in enumerate(nodes) if "boundary" not in node]
    boundary = [i for i, node in enumerate(nodes) if "boundary" in node]
    b = np.zeros((len(nodes), len(active)))
    resistance, coefficient, source, area, target, efficiency = [], [], [], [], [], []
    for column, index in enumerate(active):
        edge = edges[index]
        override = overrides.get(edge["id"], {})
        b[indices[edge["from"]], column] = 1
        b[indices[edge["to"]], column] = -1
        fan = edge.get("fan", {})
        resistance.append(override.get("resistance", edge["resistance"]) * options.get("resistanceScale", 1))
        coefficient.append(fan.get("coefficient", 0))
        source.append(fan.get("pressure", 0) * options.get("speed", 1)**2)
        area.append(override.get("area", edge["area"]))
        target.append(override.get("target", edge["target"]))
        efficiency.append(fan.get("efficiency", 1))
    fixed = np.zeros(len(nodes))
    for i in boundary:
        fixed[i] = nodes[i]["boundary"]
    result = {"b": b, "bi": b[internal], "fixed": fixed, "active": active, "internal": internal, "boundary": boundary}
    for key, values in (("r", resistance), ("k", coefficient), ("h", source), ("area", area), ("target", target), ("efficiency", efficiency)):
        result[key] = np.array(values, dtype=np.float64)
    result["forcing"] = result["h"] + b.T @ fixed
    result["pScale"] = max(100., float(np.max(np.abs(result["forcing"]), initial=0)))
    median = float(np.median(result["r"] + result["k"])) if active else 1.
    result["qScale"] = max(10., math.sqrt(result["pScale"] / max(.01, median)))
    return result


def build_result(network, options, model, flows, pressures, iterations, elapsed, solver_message="", residual_override=None):
    active, b, bi = model["active"], model["b"], model["bi"]
    resistance = model["r"] if residual_override is None else residual_override
    mass = float(np.max(np.abs(bi @ flows), initial=0))
    pressure = float(np.max(np.abs(b.T @ pressures + model["h"] - (resistance + model["k"]) * flows * np.abs(flows)), initial=0))
    heads = model["h"] - model["k"] * flows * np.abs(flows)
    fans = np.array(["fan" in network["edges"][i] for i in active],dtype=bool)
    unsupported = bool(np.any(fans & ((flows < -1e-7) | (heads < -1e-6))))
    finite = bool(np.all(np.isfinite(flows)) and np.all(np.isfinite(pressures)))
    converged = finite and mass <= MASS_TOLERANCE and pressure <= PRESSURE_TOLERANCE and not unsupported
    q_full, velocity, shortfalls = np.zeros(len(network["edges"])), np.zeros(len(network["edges"])), np.zeros(len(network["edges"]))
    q_full[active], velocity[active] = flows, flows / model["area"]
    targets = np.array([options.get("overrides", {}).get(edge["id"], {}).get("target", edge["target"]) for edge in network["edges"]])
    shortfalls = np.maximum(0, targets - q_full)
    ratio = float(np.min(q_full[targets>0] / targets[targets>0], initial=np.inf)) if np.any(targets>0) else 1.
    power = float(np.sum(np.where(fans, np.maximum(0, heads) * np.maximum(0, flows) / model["efficiency"] / 1000, 0)))
    result = {"schema": "aerovia.result/v1", "converged": converged, "iterations": int(iterations), "massResidual": mass,
              "pressureResidual": pressure, "flows": q_full.tolist(), "pressures": pressures.tolist(), "velocities": velocity.tolist(),
              "fanPowerKW": power, "totalIntake": float(np.maximum(0, (b @ flows)[model["boundary"]]).sum()),
              "targetRatio": ratio, "shortfalls": shortfalls.tolist(), "elapsedMs": elapsed}
    if not converged:
        result["message"] = "Unsupported fan reverse flow or negative delivery pressure" if unsupported else f"Residual acceptance failed: {solver_message}"
    return result


def solve(network, options=None, resistance_draw=None):
    started = perf_counter()
    options = options or {}
    model = assemble(network, options)
    if not model["active"]:
        return build_result(network,options,model,np.zeros(0),model["fixed"],0,(perf_counter()-started)*1000)
    bi, forcing = model["bi"], model["forcing"]
    q_scale, p_scale = model["qScale"], model["pScale"]
    r = model["r"] if resistance_draw is None else np.asarray(resistance_draw, dtype=np.float64)
    if r.shape != model["r"].shape or not np.all(np.isfinite(r)) or np.any(r <= 0):
        raise NetworkError("Resistance realization must be finite, positive and match active edge order")
    effective = r + model["k"]
    m, n = len(r), len(model["internal"])

    def residual(z):
        q, p = z[:m]*q_scale, z[m:]*p_scale
        return np.concatenate((bi@q/q_scale, (bi.T@p+forcing-effective*q*np.abs(q))/p_scale))

    def jacobian(z):
        jac = np.zeros((m+n, m+n))
        jac[:n, :m] = bi
        jac[n:, :m] = np.diag(-2*effective*np.abs(z[:m]*q_scale)*q_scale/p_scale)
        jac[n:, m:] = bi.T
        return jac

    linear = np.block([[bi, np.zeros((n,n))], [np.diag(-2*effective*q_scale*q_scale/p_scale), bi.T]])
    rhs = np.concatenate((np.zeros(n), -forcing/p_scale))
    initial = np.linalg.lstsq(linear, rhs, rcond=None)[0]
    fit = least_squares(residual, initial, jac=jacobian, method="trf", ftol=1e-13, xtol=1e-13, gtol=1e-13, max_nfev=1500)
    q = fit.x[:m]*q_scale
    p = model["fixed"].copy()
    p[model["internal"]] = fit.x[m:]*p_scale
    return build_result(network, options, model, q, p, fit.nfev, (perf_counter()-started)*1000, fit.message, r)
