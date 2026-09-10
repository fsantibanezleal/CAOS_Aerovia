import { createHash } from "node:crypto";

const base = new URL(process.argv[2] || "https://aerovia.fasl-work.com/");
const expected = process.argv[3];
if (
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw new Error("Public verification requires HTTPS.");
if (
  base.username ||
  base.password ||
  base.search ||
  base.hash ||
  !base.pathname.endsWith("/")
)
  throw new Error("Use an uncredentialed base URL ending in /.");
if (expected && !/^[a-f0-9]{40}$/.test(expected))
  throw new Error("Expected commit must be a full Git SHA.");
async function bytes(path, maximum) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!response.ok || !response.body)
    throw new Error(`HTTP ${response.status}: ${path}`);
  if (new URL(response.url).origin !== base.origin)
    throw new Error(`Unexpected origin redirect: ${path}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maximum)
      throw new Error(`Response exceeds expected size: ${path}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const manifest = JSON.parse(
  (await bytes("asset-manifest.json", 1_000_000)).toString("utf8"),
);
if (
  manifest.schema !== "aerovia.static-release/v1" ||
  !/^[a-f0-9]{40}$/.test(manifest.commit) ||
  !manifest.files ||
  typeof manifest.files !== "object"
)
  throw new Error("Invalid static release manifest.");
if (expected && manifest.commit !== expected)
  throw new Error("Deployed source commit differs from the expected revision.");
if (manifest.workingTreeDirty)
  throw new Error("Release was built from a modified checkout.");
const files = Object.entries(manifest.files);
if (!files.length || files.length > 200)
  throw new Error("Invalid release file count.");
let total = 0;
for (const [path, record] of files) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(path) ||
    path.startsWith("/") ||
    path.includes("..") ||
    !record ||
    !Number.isSafeInteger(record.bytes) ||
    record.bytes < 0 ||
    record.bytes > 25_000_000 ||
    !/^[a-f0-9]{64}$/.test(record.sha256)
  )
    throw new Error("Invalid release file entry.");
  total += record.bytes;
}
if (total > 25_000_000)
  throw new Error("Release exceeds the documented 25 MB budget.");
for (let index = 0; index < files.length; index += 4) {
  await Promise.all(
    files.slice(index, index + 4).map(async ([path, record]) => {
      const data = await bytes(path, record.bytes);
      if (
        data.length !== record.bytes ||
        createHash("sha256").update(data).digest("hex") !== record.sha256
      )
        throw new Error(`Release identity mismatch: ${path}`);
    }),
  );
}
console.log(
  JSON.stringify(
    {
      url: base.href,
      version: manifest.version,
      commit: manifest.commit,
      verifiedFiles: files.length,
      verifiedBytes: total,
      catalogSha256: manifest.catalogSha256,
    },
    null,
    2,
  ),
);
