import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = new URL("./dist/", import.meta.url);
// Pages serves these entry files directly, including refreshes and shared deep links.
// Asset URLs are absolute; BrowserRouter resolves the same route with a trailing slash.
const entry = await readFile(new URL("index.html", base));
for (const route of ["introduction", "methodology", "implementation", "experiments", "benchmark"]) {
  await mkdir(new URL(`${route}/`, base), { recursive: true });
  await writeFile(new URL(`${route}/index.html`, base), entry);
}
const files = {};
async function visit(relative = "") {
  for (const entry of await readdir(new URL(relative, base), {
    withFileTypes: true,
  })) {
    const path = `${relative}${entry.name}`;
    if (entry.isDirectory()) await visit(`${path}/`);
    else if (
      entry.isFile() &&
      !["asset-manifest.json", "CNAME"].includes(path)
    ) {
      const data = await readFile(new URL(path, base));
      files[path] = {
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      };
    }
  }
}
await visit();
const release = JSON.parse(
  await readFile(new URL("release.json", base), "utf8"),
);
await writeFile(
  new URL("asset-manifest.json", base),
  JSON.stringify(
    { schema: "aerovia.static-release/v1", ...release, files },
    null,
    2,
  ) + "\n",
);
console.log(
  `Static manifest: ${Object.keys(files).length} files, ${Object.values(files).reduce((sum, file) => sum + file.bytes, 0)} bytes.`,
);
