import { describe, expect, it } from "vitest";
import { STANDARD_ROUTES } from "@fasl-work/caos-app-shell";
import { matchRoutes } from "react-router";
import { ROUTE_TABLE } from "./routes";

const matched = (path: string) =>
  matchRoutes(
    ROUTE_TABLE.map((r) => ({ path: r.path })),
    path,
  )?.[0].route.path;

describe("the route table (shell 0.15.0, ADR-0016)", () => {
  it("keeps the header order of the shell: App, Introduction, Methodology, Implementation, Experiments, Benchmark", () => {
    expect(STANDARD_ROUTES.map((r) => r.path)).toEqual([
      "/app",
      "/introduction",
      "/methodology",
      "/implementation",
      "/experiments",
      "/benchmark",
    ]);
  });

  it("gives every standard route its own entry, with the workbench at /app", () => {
    for (const r of STANDARD_ROUTES) expect(matched(r.path)).toBe(r.path);
    expect(ROUTE_TABLE.find((r) => r.path === "/app")?.page).toBe("app");
  });

  it("renders the landing at the root and at every unknown path", () => {
    expect(ROUTE_TABLE.find((r) => r.path === "/")?.page).toBe("landing");
    expect(ROUTE_TABLE.find((r) => r.path === "*")?.page).toBe("landing");
    expect(matched("/")).toBe("/");
    expect(matched("/nowhere")).toBe("*");
  });

  it("does not render the workbench at the root any more", () => {
    expect(ROUTE_TABLE.filter((r) => r.page === "app").map((r) => r.path)).toEqual(["/app"]);
  });
});
