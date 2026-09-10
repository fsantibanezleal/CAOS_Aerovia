import { describe, expect, it } from 'vitest';
import catalog from '../../../data/artifacts/catalog.json';
import { DEFAULT_OPTIONS, solveNetwork } from '../engine';
import { checkDomain } from './domain';
import { resultFromArrays } from './index';
import type { ModelEntry, Network } from './types';

const network = catalog.cases[0].network as Network;
const signature = {
  nodeIds: network.nodes.map(n=>n.id), boundaries: network.nodes.map(n=>n.boundary??null),
  edgeIds: network.edges.map(e=>e.id), from: network.edges.map(e=>e.from), to: network.edges.map(e=>e.to), kinds: network.edges.map(e=>e.kind),
  fanPressure: network.edges.map(e=>e.fan?.pressure??0), fanCoefficient: network.edges.map(e=>e.fan?.coefficient??0), fanEfficiency: network.edges.map(e=>e.fan?.efficiency??1),
};
const entry = {signature,baseResistances:network.edges.map(e=>e.resistance),factorBounds:[.35,5.8],speedBounds:[0,1.5]} as ModelEntry;
describe('learned calibration boundaries',()=>{
  it('all factors and common speed have their actual declared roles',()=>{
    const base=checkDomain(network,DEFAULT_OPTIONS,entry);
    const scaled=checkDomain(network,{...DEFAULT_OPTIONS,resistanceScale:1.4},entry);
    expect(base.supported).toBe(true);
    expect(Array.from(base.features!)).toEqual(network.edges.map(()=>0));
    expect(Array.from(scaled.features!)).toEqual(network.edges.map(()=>Math.fround(Math.log(1.4))));
    expect(checkDomain(network,{...DEFAULT_OPTIONS,speed:0},entry).supported).toBe(true);
  });
  it('area and target edits do not become invented hydraulic inputs',()=>{
    const options={...DEFAULT_OPTIONS,overrides:{[network.edges[1].id]:{area:14,target:24}}};
    expect(checkDomain(network,options,entry).features).toEqual(checkDomain(network,DEFAULT_OPTIONS,entry).features);
  });
  it('rejects unknown topology, closure, curve edit and extrapolation explicitly',()=>{
    expect(checkDomain(network,DEFAULT_OPTIONS,undefined).code).toBe('unknown-topology');
    expect(checkDomain(network,{...DEFAULT_OPTIONS,overrides:{[network.edges[1].id]:{closed:true}}},entry).code).toBe('closure');
    const altered=structuredClone(network);
    altered.edges[0].fan!.pressure+=1;
    expect(checkDomain(altered,DEFAULT_OPTIONS,entry).supported).toBe(false);
    expect(checkDomain(network,{...DEFAULT_OPTIONS,resistanceScale:10},entry).code).toBe('resistance');
  });
  it('does not present a perturbed output as a converged physical solution',()=>{
    const exact=solveNetwork(network,DEFAULT_OPTIONS);
    const derived=resultFromArrays(network,DEFAULT_OPTIONS,exact.flows,exact.pressures,0);
    expect(derived.converged).toBe(true);
    expect(derived.fanPowerKW).toBeCloseTo(exact.fanPowerKW,8);
    const altered=exact.flows.slice();
    altered[4]+=1;
    const prediction=resultFromArrays(network,DEFAULT_OPTIONS,altered,exact.pressures,0);
    expect(prediction.converged).toBe(false);
    expect(prediction.massResidual).toBeGreaterThan(.99);
    expect(prediction.flows).toEqual(altered);
  });
  it('zero-speed arrays have zero flow, pressure and power without fabricated inference',()=>{
    const result=resultFromArrays(network,{...DEFAULT_OPTIONS,speed:0},network.edges.map(()=>0),network.nodes.map(()=>0),0);
    expect(result.converged).toBe(true);
    expect(result.fanPowerKW).toBe(0);
    expect(result.totalIntake).toBe(0);
  });
});
