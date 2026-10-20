/**
 * The route table (shell 0.15.0, ADR-0016): the App at /app, the landing at / and at every unknown path, and the
 * five documentation routes. The header order is the shell's STANDARD_ROUTES (App, Introduction, Methodology,
 * Implementation, Experiments, Benchmark); this table only says which page each path renders, and main.tsx maps
 * each page name to its element.
 *
 * An old App link (the App was the root until 0.04.000: `/?case=B2#x`) reaches the landing, which forwards it to
 * `/app` with its query string and its hash kept.
 */

export type PageName =
  | "landing"
  | "app"
  | "introduction"
  | "methodology"
  | "implementation"
  | "experiments"
  | "benchmark";

export const ROUTE_TABLE: ReadonlyArray<{ path: string; page: PageName }> = [
  { path: "/", page: "landing" },
  { path: "/app", page: "app" },
  { path: "/introduction", page: "introduction" },
  { path: "/methodology", page: "methodology" },
  { path: "/implementation", page: "implementation" },
  { path: "/experiments", page: "experiments" },
  { path: "/benchmark", page: "benchmark" },
  { path: "*", page: "landing" },
];
