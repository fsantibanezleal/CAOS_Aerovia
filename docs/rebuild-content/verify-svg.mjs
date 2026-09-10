import { chromium } from "../../frontend/node_modules/playwright/index.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "build/local/content-svg-review");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 960, height: 780 },
  deviceScaleFactor: 1,
});
const failures = [];
const records = [];
for (const file of ["app", "lanes", "web", "science", "contracts"])
  for (const theme of ["light", "dark"])
    for (const lang of ["en", "es"]) {
      const svg = await readFile(
        path.join(root, `frontend/public/svg/tech/${file}.svg`),
        "utf8",
      );
      const colors =
        theme === "dark"
          ? [
              "#0c1118",
              "#131d29",
              "#1a2634",
              "#dbe6f2",
              "#a1b0c3",
              "#35475a",
              "#63d5be",
              "#67cf9b",
              "#e4b26a",
            ]
          : [
              "#f6f8fb",
              "#ffffff",
              "#eef3f8",
              "#142332",
              "#536578",
              "#bac8d5",
              "#087f70",
              "#1c885d",
              "#956100",
            ];
      const tokens = [
        "--color-bg",
        "--color-surface",
        "--color-surface-2",
        "--color-fg",
        "--color-fg-subtle",
        "--color-border",
        "--color-accent",
        "--color-good",
        "--color-warn",
      ];
      await page.setContent(
        `<html><head><style>:root{${tokens.map((token, i) => `${token}:${colors[i]}`).join(";")}}body{margin:24px;background:var(--color-bg)}[data-arch-lang="es"] .l-en{display:none}[data-arch-lang="es"] .l-es{display:inline}</style></head><body><main data-arch-lang="${lang}">${svg}</main></body></html>`,
      );
      const result = await page.evaluate(() => {
        const svg = document.querySelector("svg");
        const vb = svg.viewBox.baseVal;
        const rects = [...svg.querySelectorAll("rect.bx")].map((r) => ({
          x: +r.getAttribute("x"),
          y: +r.getAttribute("y"),
          width: +r.getAttribute("width"),
          height: +r.getAttribute("height"),
        }));
        return [...svg.querySelectorAll("text")]
          .filter((t) => getComputedStyle(t).display !== "none")
          .flatMap((t) => {
            const b = t.getBBox();
            const issues = [];
            if (
              b.x < 0 ||
              b.y < 0 ||
              b.x + b.width > vb.width + 0.1 ||
              b.y + b.height > vb.height + 0.1
            )
              issues.push("canvas");
            const box = rects.find(
              (r) =>
                b.x >= r.x &&
                b.x < r.x + r.width &&
                b.y >= r.y &&
                b.y < r.y + r.height,
            );
            if (box && b.x + b.width > box.x + box.width - 7)
              issues.push("box");
            return issues.length
              ? [
                  {
                    text: t.textContent,
                    issues,
                    bounds: {
                      x: b.x,
                      y: b.y,
                      width: b.width,
                      height: b.height,
                    },
                  },
                ]
              : [];
          });
      });
      const screenshot = `${file}-${theme}-${lang}.png`;
      await page.screenshot({ path: path.join(out, screenshot) });
      records.push({ file, theme, lang, screenshot, issues: result });
      if (result.length) failures.push({ file, theme, lang, issues: result });
    }
await writeFile(
  path.join(out, "review.json"),
  JSON.stringify({ records, failures }, null, 2) + "\n",
);
await browser.close();
console.log(
  JSON.stringify({ captures: records.length, failures, out }, null, 2),
);
if (failures.length) process.exitCode = 1;
