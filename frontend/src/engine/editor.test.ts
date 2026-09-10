import { describe, expect, it } from 'vitest';
import { newDesign, drawAirway, moveJunction, splitAirway, removeAirway, editAirway, materializeOverrides } from './editor';
import { solveNetwork as solve } from './solver';
import { DEFAULT_OPTIONS } from './index';

describe('direct network authoring', () => {
  it('draws, connects and places equipment without mutating the original design', () => {
    const original = newDesign('My design');
    const branch = drawAirway(original, 'junction-1', { x: 40, y: 0, z: -30 });
    expect(original.nodes).toHaveLength(2);
    let next = drawAirway(branch.network, branch.nodeId, 'surface').network;
    next = editAirway(next, 'shaft-1', { kind: 'fan' });
    expect(solve(next, DEFAULT_OPTIONS).converged).toBe(true);
    const moved = moveJunction(next, branch.nodeId, { x: 50, y: 8, z: -35 });
    expect(moved.nodes.find(n => n.id === branch.nodeId)?.x).toBe(50);
    expect(next.nodes.find(n => n.id === branch.nodeId)?.x).toBe(40);
  });
  it('splitting conserves total series resistance and places a fan only once', () => {
    const branch = drawAirway(newDesign(), 'junction-1', { x: 30, y: 0, z: -30 });
    const next = drawAirway(branch.network, branch.nodeId, 'surface', { area: 12, resistance: 0.1, target: 10, level: 0, kind: 'fan' });
    const before = solve(next.network, DEFAULT_OPTIONS);
    const split = splitAirway(next.network, next.edgeId, 0.3).network;
    expect(split.edges.filter(e => e.fan)).toHaveLength(1);
    expect(split.edges.filter(e => e.target > 0)).toHaveLength(1);
    expect(solve(split, DEFAULT_OPTIONS).flows[0]).toBeCloseTo(before.flows[0], 6);
  });
  it('rejects invalid transactions and keeps existing data intact', () => {
    const design = newDesign();
    const snapshot = JSON.stringify(design);
    expect(() => drawAirway(design, 'surface', 'surface')).toThrow();
    expect(() => moveJunction(design, 'surface', { x: NaN, y: 0, z: 0 })).toThrow();
    expect(() => removeAirway(design, 'shaft-1')).toThrow();
    expect(JSON.stringify(design)).toBe(snapshot);
  });
  it('preserves operating and closure inputs while materializing branch changes', () => {
    const result = materializeOverrides(newDesign(), { speed: 0.8, resistanceScale: 1.5, overrides: { 'shaft-1': { resistance: 0.4, area: 15, closed: true } } });
    expect(result.network.edges[0].resistance).toBe(0.4);
    expect(result.options.resistanceScale).toBe(1.5);
    expect(result.options.overrides['shaft-1']).toEqual({ closed: true });
  });
});
