import { describe, expect, it } from "vitest";
import {
  newDesign,
  drawAirway,
  moveJunction,
  splitAirway,
  removeAirway,
  editAirway,
  materializeOverrides,
  setBoundary,
  DRAW_DEFAULTS,
  type AirwayEdits,
} from "./editor";
import { solveNetwork as solve } from "./solver";
import { DEFAULT_OPTIONS } from "./index";

describe("direct network authoring", () => {
  it("draws, connects and places equipment without mutating the original design", () => {
    const original = newDesign("My design");
    const branch = drawAirway(original, "junction-1", { x: 40, y: 0, z: -30 });
    expect(original.nodes).toHaveLength(2);
    let next = drawAirway(branch.network, branch.nodeId, "surface").network;
    next = editAirway(next, "shaft-1", { kind: "fan" });
    expect(solve(next, DEFAULT_OPTIONS).converged).toBe(true);
    const moved = moveJunction(next, branch.nodeId, { x: 50, y: 8, z: -35 });
    expect(moved.nodes.find((n) => n.id === branch.nodeId)?.x).toBe(50);
    expect(next.nodes.find((n) => n.id === branch.nodeId)?.x).toBe(40);
  });
  it("splitting conserves total series resistance and places a fan only once", () => {
    const branch = drawAirway(newDesign(), "junction-1", {
      x: 30,
      y: 0,
      z: -30,
    });
    const next = drawAirway(branch.network, branch.nodeId, "surface", {
      area: 12,
      resistance: 0.1,
      target: 10,
      level: 0,
      kind: "fan",
    });
    const before = solve(next.network, DEFAULT_OPTIONS);
    const split = splitAirway(next.network, next.edgeId, 0.3).network;
    expect(split.edges.filter((e) => e.fan)).toHaveLength(1);
    expect(split.edges.filter((e) => e.target > 0)).toHaveLength(1);
    expect(solve(split, DEFAULT_OPTIONS).flows[0]).toBeCloseTo(
      before.flows[0],
      6,
    );
  });
  it("rejects invalid transactions and keeps existing data intact", () => {
    const design = newDesign();
    const snapshot = JSON.stringify(design);
    expect(() => drawAirway(design, "surface", "surface")).toThrow();
    expect(() =>
      moveJunction(design, "surface", { x: NaN, y: 0, z: 0 }),
    ).toThrow();
    expect(() => removeAirway(design, "shaft-1")).toThrow();
    expect(JSON.stringify(design)).toBe(snapshot);
  });
  it("preserves operating and closure inputs while materializing branch changes", () => {
    const result = materializeOverrides(newDesign(), {
      speed: 0.8,
      resistanceScale: 1.5,
      overrides: { "shaft-1": { resistance: 0.4, area: 15, closed: true } },
    });
    expect(result.network.edges[0].resistance).toBe(0.4);
    expect(result.options.resistanceScale).toBe(1.5);
    expect(result.options.overrides["shaft-1"]).toEqual({ closed: true });
  });
  it("rejects a coincident or nearly coincident junction move without changing geometry", () => {
    const original = newDesign();
    const snapshot = JSON.stringify(original);
    for (const z of [0, -0.001, -0.009])
      expect(() =>
        moveJunction(original, "junction-1", { x: 0, y: 0, z }),
      ).toThrow(/at least 0.01 m/);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(
      moveJunction(original, "junction-1", { x: 0, y: 0, z: -0.01 }).nodes[1].z,
    ).toBe(-0.01);
  });
  it("checks every incident edge when moving a shared junction", () => {
    const branch = drawAirway(newDesign(), "junction-1", {
      x: 30,
      y: 0,
      z: -30,
    });
    expect(() =>
      moveJunction(branch.network, "junction-1", { x: 30, y: 0, z: -30 }),
    ).toThrow(/geometric length/);
    expect(branch.network.nodes[1].x).toBe(0);
  });
  it("copies only coordinates when a move caller supplies a complete or forged node", () => {
    const original = newDesign();
    const caller = { id: "other-node", x: 40, y: 5, z: -20, boundary: 1234 };
    const result = moveJunction(original, "junction-1", caller);
    expect(result.nodes[1]).toEqual({ id: "junction-1", x: 40, y: 5, z: -20 });
    expect(original.nodes[1].x).toBe(0);
    expect(result.edges[0].to).toBe("junction-1");
  });
  it("does not inherit forged identity or boundary properties while drawing a new junction", () => {
    const result = drawAirway(newDesign(), "junction-1", {
      ...{ id: "surface", boundary: 100 },
      x: 30,
      y: 0,
      z: -30,
    });
    const node = result.network.nodes.find(
      (candidate) => candidate.id === result.nodeId,
    )!;
    expect(node.id).toBe("junction-2");
    expect(node.boundary).toBeUndefined();
    expect(
      result.network.nodes.filter((candidate) => candidate.id === "surface"),
    ).toHaveLength(1);
  });
  it("rejects identity or connectivity injection through drawing defaults and property edits", () => {
    const original = newDesign();
    expect(() =>
      drawAirway(
        original,
        "junction-1",
        { x: 30, y: 0, z: -30 },
        { ...DRAW_DEFAULTS, ...{ id: "shaft-1" } },
      ),
    ).toThrow(/defaults/);
    for (const key of ["id", "from", "to"]) {
      const values = { [key]: "replacement" } as unknown as AirwayEdits;
      expect(() => editAirway(original, "shaft-1", values)).toThrow(
        /Identity and endpoints/,
      );
    }
    expect(original.edges[0]).toMatchObject({
      id: "shaft-1",
      from: "surface",
      to: "junction-1",
    });
  });
  it("preserves bilingual labels and accepts equipment property updates without aliasing caller objects", () => {
    const original = newDesign();
    const name = { en: "New intake", es: "Nueva entrada" };
    const changed = editAirway(original, "shaft-1", {
      name,
      kind: "fan",
      fan: { pressure: 500, coefficient: 0.02, efficiency: 0.9 },
    });
    name.en = "Later caller mutation";
    expect(changed.edges[0].name.en).toBe("New intake");
    expect(changed.edges[0].fan?.pressure).toBe(500);
    expect(original.edges[0].kind).toBe("intake");
    const passive = editAirway(changed, "shaft-1", { kind: "return" });
    expect(passive.edges[0].fan).toBeUndefined();
    expect(changed.edges[0].fan?.pressure).toBe(500);
  });
  it("rejects contradictory fan equipment and invalid physical property edits transactionally", () => {
    const original = newDesign(),
      snapshot = JSON.stringify(original);
    expect(() =>
      editAirway(original, "shaft-1", {
        fan: { pressure: 500, coefficient: 0.02, efficiency: 0.9 },
      }),
    ).toThrow(/kind=fan/);
    for (const values of [
      { area: 0 },
      { resistance: NaN },
      { target: -1 },
      { level: 101 },
    ])
      expect(() => editAirway(original, "shaft-1", values)).toThrow();
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("does not create sub-minimum geometry or resistance during a split", () => {
    const short = newDesign();
    short.nodes[1].z = -0.015;
    expect(() => splitAirway(short, "shaft-1")).toThrow(/geometric length/);
    const smallResistance = newDesign();
    smallResistance.edges[0].resistance = 1e-6;
    expect(() => splitAirway(smallResistance, "shaft-1")).toThrow(/resistance/);
    expect(short.nodes).toHaveLength(2);
    expect(smallResistance.edges).toHaveLength(1);
  });
  it("preserves the original boundary when removing it would invalidate the network", () => {
    const original = newDesign();
    expect(() => setBoundary(original, "surface", null)).toThrow(
      /fixed-pressure boundary/,
    );
    expect(original.nodes[0].boundary).toBe(0);
    const twoBoundaries = setBoundary(original, "junction-1", -100);
    const changed = setBoundary(twoBoundaries, "surface", null);
    expect(changed.nodes[0].boundary).toBeUndefined();
    expect(changed.nodes[1].boundary).toBe(-100);
  });
  it("operates on deeply frozen inputs without mutating nested network values", () => {
    const original = newDesign();
    for (const node of original.nodes) Object.freeze(node);
    for (const edge of original.edges) {
      Object.freeze(edge.name);
      Object.freeze(edge);
    }
    Object.freeze(original.nodes);
    Object.freeze(original.edges);
    Object.freeze(original);
    expect(
      moveJunction(original, "junction-1", { x: 10, y: 0, z: -30 }).nodes[1].x,
    ).toBe(10);
    expect(editAirway(original, "shaft-1", { area: 20 }).edges[0].area).toBe(
      20,
    );
    expect(splitAirway(original, "shaft-1").network.edges).toHaveLength(2);
  });
});
