import type { EdgeOverride, LocalizedText, Network, SolveOptions } from '../contracts'

export const LIMITS = Object.freeze({ nodes: 120, edges: 240, fileBytes: 2 * 1024 * 1024, maxSpeed: 1.5 })
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)
function record(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${at} must be an object.`)
  return value as Record<string, unknown>
}
function text(value: unknown, at: string, limit = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${at} must be nonempty text, at most ${limit} characters.`)
  return value
}
function identifier(value: unknown, at: string): string {
  const id = text(value, at, 100)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error(`${at} contains unsupported identifier characters.`)
  return id
}
function numeric(value: unknown, at: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${at} must be a finite number from ${min} to ${max}.`)
  return value
}
function target(value: unknown, at: string): number {
  const result = numeric(value, at, 0, 1e4)
  if (result > 0 && result < 1e-6) throw new Error(`${at} must be zero (no target) or at least 0.000001 m³/s.`)
  return result
}
function localized(value: unknown, at: string, limit = 300): LocalizedText {
  const item = record(value, at)
  return { en: text(item.en, `${at}.en`, limit), es: text(item.es, `${at}.es`, limit) }
}

/** Validates and returns a clean copy; unknown properties are deliberately not propagated. */
export function validateNetwork(input: unknown): Network {
  const data = record(input, 'Network')
  if (data.schema !== 'aerovia.network/v1') throw new Error('Unsupported network schema. Expected aerovia.network/v1.')
  if (!Array.isArray(data.nodes) || data.nodes.length < 2 || data.nodes.length > LIMITS.nodes) throw new Error(`Network must contain 2–${LIMITS.nodes} nodes.`)
  if (!Array.isArray(data.edges) || data.edges.length < 1 || data.edges.length > LIMITS.edges) throw new Error(`Network must contain 1–${LIMITS.edges} edges.`)
  const nodes = data.nodes.map((value: unknown, i: number) => {
    const n = record(value, `nodes[${i}]`)
    return {
      id: identifier(n.id, `nodes[${i}].id`),
      x: numeric(n.x, `nodes[${i}].x`, -1e6, 1e6),
      y: numeric(n.y, `nodes[${i}].y`, -1e6, 1e6),
      z: numeric(n.z, `nodes[${i}].z`, -1e6, 1e6),
      ...(own(n, 'boundary') ? { boundary: numeric(n.boundary, `nodes[${i}].boundary`, -1e6, 1e6) } : {}),
    }
  })
  const ids = new Set(nodes.map(n => n.id))
  if (ids.size !== nodes.length) throw new Error('Node identifiers must be unique.')
  if (!nodes.some(n => n.boundary !== undefined)) throw new Error('At least one fixed-pressure boundary node is required.')
  const kinds = new Set(['intake', 'return', 'working', 'crosscut', 'fan'])
  const edges = data.edges.map((value: unknown, i: number) => {
    const e = record(value, `edges[${i}]`)
    const from = identifier(e.from, `edges[${i}].from`)
    const to = identifier(e.to, `edges[${i}].to`)
    if (!ids.has(from) || !ids.has(to)) throw new Error(`Edge ${String(e.id)} refers to an unknown node.`)
    if (from === to) throw new Error(`Edge ${String(e.id)} is a self-loop; connect distinct nodes.`)
    if (!kinds.has(e.kind as string)) throw new Error(`Edge ${String(e.id)} has an unsupported kind.`)
    const fan = own(e, 'fan') ? record(e.fan, `edges[${i}].fan`) : undefined
    if ((e.kind === 'fan') !== Boolean(fan)) throw new Error(`Edge ${String(e.id)} must have fan parameters exactly when kind is fan.`)
    return {
      id: identifier(e.id, `edges[${i}].id`), from, to,
      name: localized(e.name, `edges[${i}].name`), kind: e.kind as Network['edges'][number]['kind'],
      area: numeric(e.area, `edges[${i}].area`, 0.1, 1000),
      resistance: numeric(e.resistance, `edges[${i}].resistance`, 1e-6, 1e6),
      target: target(e.target, `edges[${i}].target`),
      level: numeric(e.level, `edges[${i}].level`, -100, 100),
      ...(fan ? { fan: {
        pressure: numeric(fan.pressure, `edges[${i}].fan.pressure`, 0, 1e5),
        coefficient: numeric(fan.coefficient, `edges[${i}].fan.coefficient`, 0, 1e4),
        efficiency: numeric(fan.efficiency, `edges[${i}].fan.efficiency`, 0.05, 1),
      } } : {}),
    }
  })
  if (new Set(edges.map(e => e.id)).size !== edges.length) throw new Error('Edge identifiers must be unique.')
  const provenance = record(data.provenance, 'provenance')
  if (provenance.kind !== 'authored' && provenance.kind !== 'imported') throw new Error('provenance.kind must be authored or imported.')
  const network: Network = {
    schema: 'aerovia.network/v1', id: identifier(data.id, 'id'),
    name: localized(data.name, 'name'), description: localized(data.description, 'description', 10000),
    provenance: { kind: provenance.kind, source: text(provenance.source, 'provenance.source', 3000), license: text(provenance.license, 'provenance.license', 300) },
    nodes, edges,
  }
  const floating = ungroundedNodes(network, new Set())
  if (floating.length) throw new Error(`Nodes have no path to a fixed-pressure boundary: ${floating.slice(0, 8).join(', ')}.`)
  return network
}

export function validateOptions(input: unknown, network: Network): SolveOptions {
  const data = record(input, 'Options')
  const raw = record(data.overrides, 'Options.overrides')
  const edges = new Set(network.edges.map(e => e.id))
  const overrides: Record<string, EdgeOverride> = Object.create(null) as Record<string, EdgeOverride>
  for (const [id, value] of Object.entries(raw)) {
    if (!edges.has(id)) throw new Error(`Override refers to unknown edge ${id}.`)
    const v = record(value, `Override ${id}`)
    for (const field of Object.keys(v)) if (!['resistance', 'area', 'target', 'closed'].includes(field)) throw new Error(`Unknown override ${id}.${field}.`)
    const override: EdgeOverride = {}
    if (own(v, 'resistance')) override.resistance = numeric(v.resistance, `${id}.resistance`, 1e-6, 1e6)
    if (own(v, 'area')) override.area = numeric(v.area, `${id}.area`, 0.1, 1000)
    if (own(v, 'target')) override.target = target(v.target, `${id}.target`)
    if (own(v, 'closed')) {
      if (typeof v.closed !== 'boolean') throw new Error(`${id}.closed must be boolean.`)
      override.closed = v.closed
    }
    overrides[id] = override
  }
  return { speed: numeric(data.speed, 'speed', 0, LIMITS.maxSpeed), resistanceScale: numeric(data.resistanceScale, 'resistanceScale', 0.05, 20), overrides }
}

export function ungroundedNodes(network: Network, closed: Set<string>): string[] {
  const adjacency = new Map(network.nodes.map(n => [n.id, [] as string[]]))
  for (const edge of network.edges) if (!closed.has(edge.id)) {
    adjacency.get(edge.from)!.push(edge.to)
    adjacency.get(edge.to)!.push(edge.from)
  }
  const queue = network.nodes.filter(n => n.boundary !== undefined).map(n => n.id)
  const visited = new Set(queue)
  for (let i = 0; i < queue.length; i++) for (const adjacent of adjacency.get(queue[i])!) if (!visited.has(adjacent)) { visited.add(adjacent); queue.push(adjacent) }
  return network.nodes.filter(n => !visited.has(n.id)).map(n => n.id)
}
