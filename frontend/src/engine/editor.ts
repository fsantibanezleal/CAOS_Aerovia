import type {
  EdgeKind,
  Network,
  NetworkEdge,
  NetworkNode,
  Options,
} from "../contracts";
import { validateNetwork, validateOptions } from "./validation";

/** Product-specific edit transactions. A failed edit never mutates its input. */
export type Position = Pick<NetworkNode, "x" | "y" | "z">;
export const MIN_DRAW_LENGTH = 0.01;
function coordinates(position: Position): Position {
  if (!position || typeof position !== "object" || Array.isArray(position))
    throw new Error("Supply junction x, y and z coordinates.");
  // Callers may pass a full node. A coordinate edit never copies its identity,
  // boundary condition or any other property into the destination node.
  return { x: position.x, y: position.y, z: position.z };
}
function validateLengths(network: Network, edges: NetworkEdge[]): void {
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const from = nodes.get(edge.from)!,
      to = nodes.get(edge.to)!;
    if (
      Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z) < MIN_DRAW_LENGTH
    )
      throw new Error(
        `Airway ${edge.id} needs at least ${MIN_DRAW_LENGTH} m of geometric length. Move its junctions farther apart.`,
      );
  }
}
export function nextIdentifier(
  prefix: string,
  existing: Iterable<string>,
): string {
  const used = new Set(existing);
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}
export function newDesign(name = "Untitled ventilation design"): Network {
  return validateNetwork({
    schema: "aerovia.network/v1",
    id: "user-design",
    name: { en: name, es: name },
    description: {
      en: "User-authored design. Define geometry, resistance, equipment and planning targets.",
      es: "Diseño creado por el usuario. Defina geometría, resistencia, equipos y objetivos.",
    },
    provenance: {
      kind: "authored",
      source: "Created interactively in this browser",
      license: "User-defined",
    },
    nodes: [
      { id: "surface", x: 0, y: 0, z: 0, boundary: 0 },
      { id: "junction-1", x: 0, y: 0, z: -30 },
    ],
    edges: [
      {
        id: "shaft-1",
        from: "surface",
        to: "junction-1",
        name: { en: "Initial shaft", es: "Pique inicial" },
        kind: "intake",
        area: 12,
        resistance: 0.1,
        target: 0,
        level: 0,
      },
    ],
  });
}
export function moveJunction(
  network: Network,
  nodeId: string,
  position: Position,
): Network {
  if (!network.nodes.some((n) => n.id === nodeId))
    throw new Error("Select an existing junction.");
  const next = structuredClone(network);
  Object.assign(
    next.nodes.find((n) => n.id === nodeId)!,
    coordinates(position),
  );
  const clean = validateNetwork(next);
  validateLengths(
    clean,
    clean.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId),
  );
  return clean;
}
export function setBoundary(
  network: Network,
  nodeId: string,
  pressure: number | null,
): Network {
  const next = structuredClone(network);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error("Select an existing junction.");
  if (pressure === null) delete node.boundary;
  else node.boundary = pressure;
  return validateNetwork(next);
}
export interface AirwayDefaults {
  area: number;
  resistance: number;
  target: number;
  level: number;
  kind: EdgeKind;
}
export const DRAW_DEFAULTS: AirwayDefaults = {
  area: 12,
  resistance: 0.1,
  target: 0,
  level: 0,
  kind: "working",
};
export function drawAirway(
  network: Network,
  fromId: string,
  destination: string | Position,
  defaults: AirwayDefaults = DRAW_DEFAULTS,
): { network: Network; nodeId: string; edgeId: string } {
  if (!network.nodes.some((n) => n.id === fromId))
    throw new Error("Start the airway at an existing junction.");
  if (
    !defaults ||
    typeof defaults !== "object" ||
    Array.isArray(defaults) ||
    Object.keys(defaults).some(
      (key) => !["area", "resistance", "target", "level", "kind"].includes(key),
    )
  )
    throw new Error(
      "Airway defaults may contain only area, resistance, target, level and kind.",
    );
  const next = structuredClone(network);
  let toId: string;
  if (typeof destination === "string") {
    toId = destination;
    if (!next.nodes.some((n) => n.id === toId))
      throw new Error("The destination junction does not exist.");
  } else {
    toId = nextIdentifier(
      "junction",
      next.nodes.map((n) => n.id),
    );
    next.nodes.push({ id: toId, ...coordinates(destination) });
  }
  if (fromId === toId) throw new Error("Connect two distinct junctions.");
  if (
    next.edges.some(
      (e) =>
        (e.from === fromId && e.to === toId) ||
        (e.from === toId && e.to === fromId),
    )
  )
    throw new Error(
      "These junctions are already connected. Split or edit the existing airway.",
    );
  const a = next.nodes.find((n) => n.id === fromId)!,
    b = next.nodes.find((n) => n.id === toId)!;
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < MIN_DRAW_LENGTH)
    throw new Error(
      `An airway needs at least ${MIN_DRAW_LENGTH} m of geometric length.`,
    );
  const id = nextIdentifier(
    "airway",
    next.edges.map((e) => e.id),
  );
  next.edges.push({
    id,
    from: fromId,
    to: toId,
    name: {
      en: `Airway ${id.split("-").at(-1)}`,
      es: `Galería ${id.split("-").at(-1)}`,
    },
    ...defaults,
    ...(defaults.kind === "fan"
      ? { fan: { pressure: 1200, coefficient: 0.01, efficiency: 0.8 } }
      : {}),
  });
  return { network: validateNetwork(next), nodeId: toId, edgeId: id };
}
export function splitAirway(
  network: Network,
  edgeId: string,
  fraction = 0.5,
): { network: Network; nodeId: string } {
  if (!Number.isFinite(fraction) || fraction <= 0.001 || fraction >= 0.999)
    throw new Error("Split position must lie inside the airway.");
  const next = structuredClone(network);
  const edge = next.edges.find((e) => e.id === edgeId);
  if (!edge) throw new Error("Select an existing airway.");
  const a = next.nodes.find((n) => n.id === edge.from)!,
    b = next.nodes.find((n) => n.id === edge.to)!;
  const id = nextIdentifier(
    "junction",
    next.nodes.map((n) => n.id),
  );
  const tailId = nextIdentifier(
    "airway",
    next.edges.map((e) => e.id),
  );
  next.nodes.push({
    id,
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    z: a.z + (b.z - a.z) * fraction,
  });
  const tail: NetworkEdge = {
    ...structuredClone(edge),
    id: tailId,
    from: id,
    resistance: edge.resistance * (1 - fraction),
  };
  // The fan is one physical item, retained on the original segment only.
  if (tail.fan) {
    delete tail.fan;
    tail.kind = "crosscut";
  }
  edge.to = id;
  edge.resistance *= fraction;
  edge.target = 0; // One downstream design target, not two copies of the same demand.
  next.edges.push(tail);
  const clean = validateNetwork(next);
  validateLengths(
    clean,
    clean.edges.filter(
      (candidate) => candidate.id === edgeId || candidate.id === tailId,
    ),
  );
  return { network: clean, nodeId: id };
}
export function removeAirway(network: Network, edgeId: string): Network {
  const next = structuredClone(network);
  const index = next.edges.findIndex((e) => e.id === edgeId);
  if (index < 0) throw new Error("Select an existing airway.");
  next.edges.splice(index, 1);
  const referenced = new Set(next.edges.flatMap((e) => [e.from, e.to]));
  next.nodes = next.nodes.filter((n) => referenced.has(n.id));
  return validateNetwork(next);
}
export type AirwayEdits = Partial<Omit<NetworkEdge, "id" | "from" | "to">>;
export function editAirway(
  network: Network,
  edgeId: string,
  values: AirwayEdits,
): Network {
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw new Error("Airway edits must be an object.");
  for (const key of Object.keys(values))
    if (
      ![
        "name",
        "kind",
        "area",
        "resistance",
        "target",
        "level",
        "fan",
      ].includes(key)
    )
      throw new Error(
        `Airway ${key} cannot be changed by a property edit. Identity and endpoints are preserved.`,
      );
  const next = structuredClone(network);
  const edge = next.edges.find((e) => e.id === edgeId);
  if (!edge) throw new Error("Select an existing airway.");
  if (values.fan !== undefined && (values.kind ?? edge.kind) !== "fan")
    throw new Error("Fan equipment requires airway kind=fan.");
  Object.assign(edge, values);
  if (edge.kind !== "fan") delete edge.fan;
  else edge.fan ??= { pressure: 1200, coefficient: 0.01, efficiency: 0.8 };
  return validateNetwork(next);
}
/** Commit effective branch edits before topology changes; retain global operating factors. */
export function materializeOverrides(
  network: Network,
  options: Options,
): { network: Network; options: Options } {
  const clean = validateOptions(options, network);
  const next = structuredClone(network);
  const overrides: Options["overrides"] = Object.create(null);
  for (const edge of next.edges) {
    const override = clean.overrides[edge.id];
    if (!override) continue;
    for (const key of ["area", "resistance", "target"] as const)
      if (override[key] !== undefined) edge[key] = override[key]!;
    if (override.closed) overrides[edge.id] = { closed: true };
  }
  return { network: validateNetwork(next), options: { ...clean, overrides } };
}
