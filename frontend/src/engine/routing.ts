import type { Network, Result, SolveOptions } from "../contracts";
import { solveNetwork } from "./solver";
import { validateNetwork, validateOptions } from "./validation";

export interface RouteRequest {
  sourceNodeId: string;
  targetNodeId?: string;
  edgeLengths?: Record<string, number>;
}
export interface DirectedAirway {
  edgeId: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
  flow: number;
  velocity: number;
  length: number;
  nominalTransitSeconds: number | null;
  active: boolean;
  outgoingFraction: number;
}
export interface RouteNode {
  nodeId: string;
  reachable: boolean;
  minimumTransitSeconds: number | null;
  predecessorEdgeId: string | null;
}
export interface AirflowPath {
  nodeIds: string[];
  edgeIds: string[];
  length: number;
  nominalTransitSeconds: number;
  minimumFlow: number;
}
export interface RoutingResult {
  schema: "aerovia.routing/v1";
  converged: boolean;
  flow: Result;
  edges: DirectedAirway[];
  nodes: RouteNode[];
  path: AirflowPath | null;
  recirculation: Array<{ nodeIds: string[]; edgeIds: string[] }>;
  message?: string;
}

/** Geometric lengths are metres. Coincident endpoints require an explicit length. */
export function airwayLengths(
  network: Network,
  overrides: Record<string, number> = {},
): number[] {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    throw new Error("Airway length overrides must be an object.");
  const edgeIds = new Set(network.edges.map((edge) => edge.id));
  for (const [id, length] of Object.entries(overrides)) {
    if (!edgeIds.has(id))
      throw new Error(`Length override refers to unknown airway ${id}.`);
    if (
      typeof length !== "number" ||
      !Number.isFinite(length) ||
      length < 1e-6 ||
      length > 1e7
    )
      throw new Error(
        `Length for ${id} must be between 0.000001 and 10000000 m.`,
      );
  }
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  return network.edges.map((edge) => {
    const from = nodes.get(edge.from)!;
    const to = nodes.get(edge.to)!;
    const length = Object.prototype.hasOwnProperty.call(overrides, edge.id)
      ? overrides[edge.id]
      : Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (!Number.isFinite(length) || length <= 0)
      throw new Error(
        `Airway ${edge.id} has zero geometric length; supply an explicit positive length in metres.`,
      );
    if (length < 1e-6)
      throw new Error(
        `Airway ${edge.id} is shorter than the supported 0.000001 m minimum. Check coordinate units or supply its physical length.`,
      );
    return length;
  });
}

/** Minimum nominal advective transit, not a human route or earliest tracer arrival. */
export function analyzeRoutes(
  input: Network,
  suppliedOptions: SolveOptions,
  request: RouteRequest,
): RoutingResult {
  const network = validateNetwork(input);
  const options = validateOptions(suppliedOptions, network);
  const nodeIndex = new Map(network.nodes.map((node, i) => [node.id, i]));
  if (!request || !nodeIndex.has(request.sourceNodeId))
    throw new Error("Select a source node that exists in the network.");
  if (
    request.targetNodeId !== undefined &&
    !nodeIndex.has(request.targetNodeId)
  )
    throw new Error("Select a destination node that exists in the network.");
  const lengths = airwayLengths(network, request.edgeLengths);
  const flow = solveNetwork(network, options);
  const result: RoutingResult = {
    schema: "aerovia.routing/v1",
    converged: flow.converged,
    flow,
    edges: [],
    nodes: [],
    path: null,
    recirculation: [],
  };
  if (!flow.converged)
    return {
      ...result,
      message:
        flow.message ??
        "The airflow state is unsupported; routes were not calculated.",
    };
  const outgoing = new Float64Array(network.nodes.length);
  const adjacency: number[][] = network.nodes.map(() => []);
  result.edges = network.edges.map((edge, i) => {
    const q = flow.flows[i];
    const upstreamNodeId = q < 0 ? edge.to : edge.from;
    const downstreamNodeId = q < 0 ? edge.from : edge.to;
    const magnitude = Math.abs(q);
    const area = options.overrides[edge.id]?.area ?? edge.area;
    const active = magnitude > 0 && !options.overrides[edge.id]?.closed;
    if (active) {
      const upstream = nodeIndex.get(upstreamNodeId)!;
      outgoing[upstream] += magnitude;
      adjacency[upstream].push(i);
    }
    return {
      edgeId: edge.id,
      upstreamNodeId,
      downstreamNodeId,
      flow: magnitude,
      velocity: magnitude / area,
      length: lengths[i],
      nominalTransitSeconds: active ? (lengths[i] * area) / magnitude : null,
      active,
      outgoingFraction: 0,
    };
  });
  for (const edge of result.edges) {
    const total = outgoing[nodeIndex.get(edge.upstreamNodeId)!];
    edge.outgoingFraction = total > 0 ? edge.flow / total : 0;
  }

  const source = nodeIndex.get(request.sourceNodeId)!;
  const distance = new Float64Array(network.nodes.length).fill(Infinity);
  const predecessor = new Int32Array(network.nodes.length).fill(-1);
  const visited = new Uint8Array(network.nodes.length);
  distance[source] = 0;
  for (let iteration = 0; iteration < network.nodes.length; iteration++) {
    let u = -1;
    for (let i = 0; i < distance.length; i++)
      if (!visited[i] && (u < 0 || distance[i] < distance[u])) u = i;
    if (u < 0 || !Number.isFinite(distance[u])) break;
    visited[u] = 1;
    // A pressure boundary is an external reservoir, never an intermediate junction.
    if (u !== source && network.nodes[u].boundary !== undefined) continue;
    for (const edgeIndex of adjacency[u]) {
      const edge = result.edges[edgeIndex];
      const v = nodeIndex.get(edge.downstreamNodeId)!;
      const candidate = distance[u] + edge.nominalTransitSeconds!;
      if (candidate < distance[v]) {
        distance[v] = candidate;
        predecessor[v] = edgeIndex;
      }
    }
  }
  result.nodes = network.nodes.map((node, i) => ({
    nodeId: node.id,
    reachable: Number.isFinite(distance[i]),
    minimumTransitSeconds: Number.isFinite(distance[i]) ? distance[i] : null,
    predecessorEdgeId:
      predecessor[i] >= 0 ? network.edges[predecessor[i]].id : null,
  }));
  if (request.targetNodeId !== undefined) {
    let at = nodeIndex.get(request.targetNodeId)!;
    if (Number.isFinite(distance[at])) {
      const edgeIds: string[] = [];
      const nodeIds = [network.nodes[at].id];
      let length = 0;
      let minimumFlow = Infinity;
      const nominalTransitSeconds = distance[at];
      while (at !== source) {
        const edge = result.edges[predecessor[at]];
        edgeIds.push(edge.edgeId);
        nodeIds.push(edge.upstreamNodeId);
        length += edge.length;
        minimumFlow = Math.min(minimumFlow, edge.flow);
        at = nodeIndex.get(edge.upstreamNodeId)!;
      }
      result.path = {
        nodeIds: nodeIds.reverse(),
        edgeIds: edgeIds.reverse(),
        length,
        nominalTransitSeconds,
        minimumFlow: edgeIds.length ? minimumFlow : 0,
      };
    }
  }

  // Tarjan components exclude pressure boundaries because parcels exit there.
  const discovery = new Int32Array(network.nodes.length).fill(-1);
  const low = new Int32Array(network.nodes.length);
  const onStack = new Uint8Array(network.nodes.length);
  const stack: number[] = [];
  let ordinal = 0;
  const visit = (u: number): void => {
    discovery[u] = low[u] = ordinal++;
    stack.push(u);
    onStack[u] = 1;
    for (const edgeIndex of adjacency[u]) {
      const v = nodeIndex.get(result.edges[edgeIndex].downstreamNodeId)!;
      if (network.nodes[v].boundary !== undefined) continue;
      if (discovery[v] === -1) {
        visit(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack[v]) low[u] = Math.min(low[u], discovery[v]);
    }
    if (low[u] !== discovery[u]) return;
    const component: number[] = [];
    let v: number;
    do {
      v = stack.pop()!;
      onStack[v] = 0;
      component.push(v);
    } while (v !== u);
    if (component.length < 2) return;
    const ids = new Set(component.map((i) => network.nodes[i].id));
    result.recirculation.push({
      nodeIds: [...ids].sort(),
      edgeIds: result.edges
        .filter(
          (edge) =>
            edge.active &&
            ids.has(edge.upstreamNodeId) &&
            ids.has(edge.downstreamNodeId),
        )
        .map((edge) => edge.edgeId),
    });
  };
  for (let i = 0; i < network.nodes.length; i++)
    if (network.nodes[i].boundary === undefined && discovery[i] === -1)
      visit(i);
  return result;
}
