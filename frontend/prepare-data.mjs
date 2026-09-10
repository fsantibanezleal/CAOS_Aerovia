import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const source = new URL("../data/artifacts/catalog.json", import.meta.url);
const bytes = await readFile(source);
const manifest = JSON.parse(
  await readFile(
    new URL("../data/artifacts/manifest.json", import.meta.url),
    "utf8",
  ),
);
const recorded = manifest.files?.["catalog.json"];
if (
  !recorded ||
  recorded.sha256 !== createHash("sha256").update(bytes).digest("hex") ||
  recorded.bytes !== bytes.length
)
  throw new Error("Catalog checksum mismatch");
const catalog = JSON.parse(bytes.toString("utf8"));
if (!Array.isArray(catalog.cases) || catalog.cases.length < 12)
  throw new Error("Complete validated case catalog required");
await mkdir(new URL("./public/data/", import.meta.url), { recursive: true });
await copyFile(source, new URL("./public/data/catalog.json", import.meta.url));
// Learned artifacts and the WASM runtime are first-party hosted. No runtime CDN requests.
const science = new URL("../data/artifacts/science.json", import.meta.url);
const scienceBytes = await readFile(science);
const scienceRecorded = manifest.files?.["science.json"];
if (
  !scienceRecorded ||
  scienceRecorded.bytes !== scienceBytes.length ||
  scienceRecorded.sha256 !==
    createHash("sha256").update(scienceBytes).digest("hex")
)
  throw new Error("Scientific evidence checksum mismatch");
await copyFile(science, new URL("./public/data/science.json", import.meta.url));
const modelRoot = new URL("../data/models/", import.meta.url);
const modelManifest = JSON.parse(
  await readFile(new URL("manifest.json", modelRoot), "utf8"),
);
if (
  !modelManifest.files ||
  Object.keys(modelManifest.files).filter((name) => name.endsWith(".onnx"))
    .length !== 24
)
  throw new Error("All 24 trained browser exports are required");
for (const [name, recorded] of Object.entries(modelManifest.files)) {
  if (
    name.includes("\\") ||
    name.split("/").some((part) => !part || part === ".." || part === ".") ||
    !/^[a-zA-Z0-9_./-]+$/.test(name)
  )
    throw new Error("Unsafe model artifact path");
  const source = new URL(name, modelRoot),
    bytes = await readFile(source);
  if (
    recorded.bytes !== bytes.length ||
    recorded.sha256 !== createHash("sha256").update(bytes).digest("hex")
  )
    throw new Error(`Model artifact checksum mismatch: ${name}`);
  if (name.endsWith(".pt")) continue;
  const destination = new URL(`./public/data/models/${name}`, import.meta.url);
  await mkdir(new URL(".", destination), { recursive: true });
  await copyFile(source, destination);
}
await copyFile(
  new URL("manifest.json", modelRoot),
  new URL("./public/data/models/manifest.json", import.meta.url),
);
await mkdir(new URL("./public/data/ort/", import.meta.url), {
  recursive: true,
});
for (const name of [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
]) {
  await copyFile(
    new URL(`./node_modules/onnxruntime-web/dist/${name}`, import.meta.url),
    new URL(`./public/data/ort/${name}`, import.meta.url),
  );
}
const version = (
  await readFile(new URL("../VERSION", import.meta.url), "utf8")
).trim();
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8",
}).trim();
const workingTreeDirty = Boolean(
  execFileSync("git", ["status", "--porcelain"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  }).trim(),
);
await writeFile(
  new URL("./public/release.json", import.meta.url),
  JSON.stringify(
    {
      version,
      commit,
      workingTreeDirty,
      catalogSha256: recorded.sha256,
      scienceSha256: scienceRecorded.sha256,
    },
    null,
    2,
  ) + "\n",
);
