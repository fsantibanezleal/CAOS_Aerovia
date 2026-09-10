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
    { version, commit, workingTreeDirty, catalogSha256: recorded.sha256 },
    null,
    2,
  ) + "\n",
);
