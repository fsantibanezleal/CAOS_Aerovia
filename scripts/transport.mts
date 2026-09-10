/** Reproduce the browser's conservative transport engine as a local ESM batch process. */
import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  simulateTransport,
  type TransportOptions,
} from "../frontend/src/engine/transport";
import { analyzeRoutes } from "../frontend/src/engine/routing";
import {
  validateNetwork,
  validateOptions,
} from "../frontend/src/engine/validation";
import { DEFAULT_OPTIONS } from "../frontend/src/engine/solver";
import type { Network } from "../frontend/src/contracts";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    case: { type: "string" },
    request: { type: "string" },
    output: { type: "string" },
    source: { type: "string" },
    duration: { type: "string", default: "300" },
    mass: { type: "string", default: "10000" },
    routeSource: { type: "string" },
    routeTarget: { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help || !values.input) {
  console.log(
    "Usage: npm --prefix frontend run transport -- --input <project.json|cases.json> [--case id] [--request timeline.json] [--source airway-id --duration seconds --mass mg] --output <result.json>",
  );
  console.log(
    "Optional directed route: --routeSource junction-id --routeTarget junction-id. JSON requests support all release/schedule/length/loss options documented in docs/methods/transport.md.",
  );
  process.exit(values.help ? 0 : 2);
}
try {
  const bytes = await readFile(resolve(values.input));
  if (bytes.length > 5 * 1024 * 1024)
    throw new Error("Local input exceeds 5 MiB.");
  const raw = JSON.parse(bytes.toString("utf8"));
  const cases = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.cases)
      ? raw.cases
      : null;
  const item = cases
    ? values.case
      ? cases.find(
          (row: Network | { network: Network }) =>
            ("network" in row ? row.network.id : row.id) === values.case,
        )
      : cases[0]
    : raw;
  if (!item) throw new Error("Requested case was not found.");
  const network = validateNetwork(item.network ?? item),
    options = validateOptions(item.options ?? DEFAULT_OPTIONS, network);
  let request: TransportOptions;
  if (values.request) {
    const bytes = await readFile(resolve(values.request));
    if (bytes.length > 1024 * 1024) throw new Error("Timeline exceeds 1 MiB.");
    request = JSON.parse(bytes.toString("utf8"));
  } else
    request = {
      durationSeconds: Number(values.duration),
      frameCount: 151,
      cellsPerEdge: 8,
      releases: [
        {
          kind: "pulse",
          edgeId:
            values.source ??
            network.edges.find((e) => e.kind === "working")?.id ??
            network.edges[0].id,
          startSeconds: 0,
          massMg: Number(values.mass),
        },
      ],
    };
  const result = simulateTransport(network, options, request);
  if (!result.completed)
    throw new Error(
      result.message ??
        "Transport did not complete. Prior output was preserved.",
    );
  const routing = values.routeSource
    ? analyzeRoutes(network, options, {
        sourceNodeId: values.routeSource,
        targetNodeId: values.routeTarget,
        edgeLengths: request.edgeLengths,
      })
    : undefined;
  if (routing && !routing.converged)
    throw new Error(routing.message ?? "Routing did not complete.");
  const output = resolve(
    values.output ?? `build/local/${network.id}-transport.json`,
  );
  const artifact = {
    schema: "aerovia.transport-batch/v1",
    createdAt: new Date().toISOString(),
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    network,
    options,
    request,
    result,
    routing,
  };
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  await rename(temporary, output);
  console.log(
    JSON.stringify({
      completed: true,
      case: network.id,
      frames: result.frames.length,
      steps: result.steps,
      maxMassBalanceErrorMg: Math.max(
        ...result.frames.map((f) => Math.abs(f.massBalanceErrorMg)),
      ),
      output,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
