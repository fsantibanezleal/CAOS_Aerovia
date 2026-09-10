import { Color } from "three";
import type { Network, Result } from "../contracts";
export type Metric =
  "route" | "flow" | "velocity" | "pressure" | "target" | "change";
export const routeColors: Record<string, string> = {
  intake: "#45c6cb",
  return: "#efb46c",
  working: "#899fef",
  crosscut: "#bd8bcd",
  fan: "#e5cf90",
};
export function fieldValues(
  network: Network,
  result: Result | null,
  metric: Metric,
  baseline: Result | null,
): number[] {
  return network.edges.map((e, i) =>
    !result
      ? 0
      : metric === "pressure"
        ? (result.pressures[network.nodes.findIndex((n) => n.id === e.from)] +
            result.pressures[network.nodes.findIndex((n) => n.id === e.to)]) /
          2
        : metric === "velocity"
          ? result.velocities[i]
          : metric === "target"
            ? Math.max(0, e.target - result.flows[i])
            : metric === "change"
              ? baseline
                ? result.flows[i] - baseline.flows[i]
                : 0
              : result.flows[i],
  );
}
export function fieldScale(
  network: Network,
  result: Result | null,
  metric: Metric,
  baseline: Result | null,
) {
  const values = fieldValues(network, result, metric, baseline),
    min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = Math.max(Math.abs(min), Math.abs(max), 1e-9);
  return {
    values,
    min,
    max,
    span,
    unit: metric === "pressure" ? "Pa" : metric === "velocity" ? "m/s" : "m³/s",
  };
}
export function edgeColor(
  network: Network,
  result: Result | null,
  i: number,
  metric: Metric,
  baseline: Result | null,
) {
  const e = network.edges[i];
  if (!result || metric === "route") return routeColors[e.kind];
  if (metric === "target")
    return e.target <= 0
      ? "#667e93"
      : result.flows[i] >= e.target
        ? "#55c7ae"
        : "#ed8668";
  const { values, span } = fieldScale(network, result, metric, baseline),
    v = values[i];
  return new Color("#526b83")
    .lerp(
      new Color(v < 0 ? "#b69afa" : "#58d8ca"),
      Math.sqrt(Math.min(1, Math.abs(v) / span)),
    )
    .getStyle();
}
