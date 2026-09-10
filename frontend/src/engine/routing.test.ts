import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Network, NetworkEdge } from "../contracts";
import { DEFAULT_OPTIONS } from "./solver";
import { analyzeRoutes, airwayLengths } from "./routing";

const label = (en: string) => ({ en, es: en });
const edge = (
  id: string,
  from: string,
  to: string,
  resistance = 1,
): NetworkEdge => ({
  id,
  from,
  to,
  name: label(id),
  kind: "working",
  area: 10,
  resistance,
  target: 0,
  level: 0,
});
function single(): Network {
  return {
    schema: "aerovia.network/v1",
    id: "routing-test",
    name: label("Analytical airflow path"),
    description: label("Authored analytical network"),
    provenance: {
      kind: "authored",
      source: "Analytical test",
      license: "Apache-2.0",
    },
    nodes: [
      { id: "a", x: 0, y: 0, z: 0, boundary: 100 },
      { id: "b", x: 10, y: 0, z: 0, boundary: 0 },
    ],
    edges: [edge("ab", "a", "b")],
  };
}
const analyze = (network = single(), sourceNodeId = "a", targetNodeId = "b") =>
  analyzeRoutes(network, DEFAULT_OPTIONS, { sourceNodeId, targetNodeId });

describe("directed airflow routing", () => {
  it("derives travel weight from volume and the independently known signed flow", () => {
    const result = analyze();
    expect(result.converged).toBe(true);
    expect(result.path).toEqual({
      nodeIds: ["a", "b"],
      edgeIds: ["ab"],
      length: 10,
      nominalTransitSeconds: 10,
      minimumFlow: 10,
    });
    expect(result.edges[0]).toMatchObject({
      upstreamNodeId: "a",
      downstreamNodeId: "b",
      flow: 10,
      velocity: 1,
      length: 10,
      outgoingFraction: 1,
    });
  });
  it("uses flow direction rather than edge declaration orientation", () => {
    const network = single();
    network.edges[0] = { ...network.edges[0], from: "b", to: "a" };
    const result = analyze(network);
    expect(result.flow.flows[0]).toBe(-10);
    expect(result.path?.nodeIds).toEqual(["a", "b"]);
    expect(analyze(network, "b", "a").path).toBeNull();
  });
  it("chooses least nominal advective transit even when that route is geometrically longer", () => {
    const network = single();
    network.nodes.push(
      { id: "short", x: 5, y: 0, z: 0 },
      { id: "fast", x: 5, y: 10, z: 0 },
    );
    network.edges = [
      edge("as", "a", "short"),
      edge("sb", "short", "b"),
      edge("af", "a", "fast", 0.01),
      edge("fb", "fast", "b", 0.01),
    ];
    const result = analyze(network);
    expect(result.converged, result.message).toBe(true);
    expect(result.path?.edgeIds).toEqual(["af", "fb"]);
    expect(result.path!.length).toBeCloseTo(2 * Math.sqrt(125), 10);
    expect(result.path!.nominalTransitSeconds).toBeCloseTo(
      (2 * Math.sqrt(125) * 10) / Math.sqrt(5000),
      7,
    );
    expect(
      result.edges[0].outgoingFraction + result.edges[2].outgoingFraction,
    ).toBeCloseTo(1, 12);
  });
  it("terminates an air parcel at an external pressure boundary", () => {
    const network = single();
    network.nodes.push({ id: "c", x: 20, y: 0, z: 0, boundary: -100 });
    network.edges.push(edge("bc", "b", "c"));
    const result = analyze(network, "a", "c");
    expect(result.nodes.find((node) => node.nodeId === "b")?.reachable).toBe(
      true,
    );
    expect(result.nodes.find((node) => node.nodeId === "c")).toMatchObject({
      reachable: false,
      minimumTransitSeconds: null,
      predecessorEdgeId: null,
    });
    expect(result.path).toBeNull();
    expect(analyze(network, "b", "c").path?.edgeIds).toEqual(["bc"]);
  });
  it("represents closed and stagnant airways without fictitious finite travel times", () => {
    const closed = analyzeRoutes(
      single(),
      { ...DEFAULT_OPTIONS, overrides: { ab: { closed: true } } },
      { sourceNodeId: "a", targetNodeId: "b" },
    );
    expect(closed.converged).toBe(true);
    expect(closed.path).toBeNull();
    expect(closed.edges[0]).toMatchObject({
      active: false,
      nominalTransitSeconds: null,
      outgoingFraction: 0,
    });
    const network = single();
    network.nodes[0].boundary = 0;
    expect(analyze(network).edges[0].nominalTransitSeconds).toBeNull();
    expect(analyze(network).nodes[1].reachable).toBe(false);
  });
  it("returns a finite empty path when source equals destination", () => {
    const result = analyze(single(), "a", "a");
    expect(result.path).toEqual({
      nodeIds: ["a"],
      edgeIds: [],
      length: 0,
      nominalTransitSeconds: 0,
      minimumFlow: 0,
    });
    expect(JSON.parse(JSON.stringify(result)).path).toEqual(result.path);
  });
  it("identifies a fan-driven internal recirculation component from actual solved directions", () => {
    const network = single();
    network.nodes = [
      { id: "a", x: 0, y: 0, z: 0, boundary: 0 },
      { id: "b", x: 10, y: 0, z: 0 },
      { id: "c", x: 20, y: 0, z: 0 },
      { id: "d", x: 15, y: 10, z: 0 },
    ];
    network.edges = [
      edge("ab", "a", "b"),
      {
        ...edge("bc", "b", "c"),
        kind: "fan",
        fan: { pressure: 100, coefficient: 0, efficiency: 0.8 },
      },
      edge("cd", "c", "d"),
      edge("db", "d", "b"),
    ];
    const result = analyze(network, "b", "d");
    expect(result.converged, result.message).toBe(true);
    expect(result.recirculation).toEqual([
      { nodeIds: ["b", "c", "d"], edgeIds: ["bc", "cd", "db"] },
    ]);
    expect(result.path?.edgeIds).toEqual(["bc", "cd"]);
    expect(result.path!.minimumFlow).toBeCloseTo(Math.sqrt(100 / 3), 6);
  });
  it("never reports a cycle through a clean external reservoir as internal recirculation", () => {
    const network = single();
    network.nodes[0].boundary = 0;
    network.edges.push({
      ...edge("ba", "b", "a"),
      kind: "fan",
      fan: { pressure: 100, coefficient: 0, efficiency: 0.8 },
    });
    expect(analyze(network).recirculation).toEqual([]);
  });
  it("uses explicit length and effective area independently of the hydraulic resistance", () => {
    const result = analyzeRoutes(
      single(),
      { ...DEFAULT_OPTIONS, overrides: { ab: { area: 20 } } },
      { sourceNodeId: "a", targetNodeId: "b", edgeLengths: { ab: 50 } },
    );
    expect(result.path?.length).toBe(50);
    expect(result.path?.nominalTransitSeconds).toBe(100);
    expect(result.edges[0].velocity).toBe(0.5);
  });
});

describe("routing validation and catalog coverage", () => {
  it("rejects unknown nodes and unusable length overrides", () => {
    expect(() => analyze(single(), "unknown")).toThrow(/source node/);
    expect(() => analyze(single(), "a", "unknown")).toThrow(/destination node/);
    const badOverrides: Array<Record<string, number>> = [
      { unknown: 10 },
      { ab: 0 },
      { ab: -1 },
      { ab: NaN },
      { ab: Infinity },
      { ab: 1e-300 },
    ];
    for (const overrides of badOverrides)
      expect(() => airwayLengths(single(), overrides)).toThrow();
    const network = single();
    network.nodes[1].x = 0;
    expect(() => analyze(network)).toThrow(/zero geometric length/);
    expect(airwayLengths(network, { ab: 25 })).toEqual([25]);
  });
  it("reports isolated airflow failure with no purported paths", () => {
    const network = single();
    network.nodes.push({ id: "c", x: 20, y: 0, z: 0 });
    network.edges.push(edge("bc", "b", "c"));
    const result = analyzeRoutes(
      network,
      { ...DEFAULT_OPTIONS, overrides: { bc: { closed: true } } },
      { sourceNodeId: "a", targetNodeId: "c" },
    );
    expect(result.converged).toBe(false);
    expect(result.message).toMatch(/isolate/);
    expect(result.path).toBeNull();
    expect(result.edges).toEqual([]);
  });
  it("supports reachable-node exploration without selecting a destination", () => {
    const result = analyzeRoutes(single(), DEFAULT_OPTIONS, {
      sourceNodeId: "a",
    });
    expect(result.path).toBeNull();
    expect(result.nodes[1].minimumTransitSeconds).toBe(10);
  });
  const catalog = JSON.parse(
    readFileSync(new URL("../../../data/cases.json", import.meta.url), "utf8"),
  ) as Network[];
  it.each(catalog.map((network) => [network.id, network] as const))(
    "produces finite JSON and valid directed predecessor paths for %s",
    (_id, network) => {
      const result = analyzeRoutes(network, DEFAULT_OPTIONS, {
        sourceNodeId: network.nodes[0].id,
      });
      expect(result.converged, result.message).toBe(true);
      expect(JSON.parse(JSON.stringify(result)).nodes).toEqual(result.nodes);
      result.nodes
        .filter((node) => node.predecessorEdgeId !== null)
        .forEach((node) => {
          const predecessor = result.edges.find(
            (edge) => edge.edgeId === node.predecessorEdgeId,
          )!;
          expect(predecessor.active).toBe(true);
          expect(predecessor.downstreamNodeId).toBe(node.nodeId);
          expect(node.minimumTransitSeconds).toBeGreaterThan(0);
        });
    },
  );
});
