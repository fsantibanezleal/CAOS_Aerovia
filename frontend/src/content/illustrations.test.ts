import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The contract test of the three executive illustrations (shell 0.15.0, ADR-0017 section 2.1, ADR-0058):
// inline-ready SVG, theme tokens only, bilingual labels at size 22 or more, and an animated pain scene with its reduced-motion frame.
const NAMES = ["pain", "situation", "proposal"] as const;
const read = (p: URL) => readFileSync(p, "utf8");
const file = (n: string) => read(new URL(`../../public/executive/${n}.svg`, import.meta.url));
const shellCss = read(new URL("../../node_modules/@fasl-work/caos-app-shell/styles.css", import.meta.url));
const defined = new Set([...shellCss.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const texts = (svg: string) =>
  [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({ attrs: m[1], body: m[2] }));
const attr = (attrs: string, name: string) => new RegExp(String.raw`(?:^|\s)` + name + String.raw`="([^"]*)"`).exec(attrs)?.[1];

describe.each(NAMES)("the %s illustration", (name) => {
  const svg = file(name);

  it("parses and has an 800 by 480 viewBox, a role, a label and an English title", () => {
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(/<svg\b[^>]*viewBox="0 0 800 480"/.test(svg)).toBe(true);
    expect(/<svg\b[^>]*role="img"/.test(svg)).toBe(true);
    expect(/<svg\b[^>]*aria-label="[^"]{20,}"/.test(svg)).toBe(true);
    expect(/<title>[^<]{10,}<\/title>/.test(svg)).toBe(true);
    // balanced tags: every opening g closes
    expect((svg.match(/<g\b/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
  });

  it("colours only with theme tokens, none or currentColor", () => {
    const values = [
      ...[...svg.matchAll(/\b(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)].map((m) => m[1]),
      ...[...svg.matchAll(/\b(?:fill|stroke|color|background)\s*:\s*([^;}"]+)/g)].map((m) => m[1].trim()),
    ];
    expect(values.length).toBeGreaterThan(20);
    for (const v of values) expect(v, `colour "${v}"`).toMatch(/^(none|currentColor|var\(--color-[a-z0-9-]+\))$/);
    expect(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(svg.replace(/<title>[\s\S]*?<\/title>/, ""))).toBe(false);
  });

  it("uses only tokens the installed shell defines", () => {
    const used = new Set([...svg.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(5);
    for (const t of used) expect(defined.has(t), `token ${t}`).toBe(true);
  });

  it("marks every text en or es, with the same count per language, no font family, size 22 or more", () => {
    const all = texts(svg);
    expect(all.length).toBeGreaterThan(10);
    const count = { en: 0, es: 0 };
    for (const t of all) {
      const lang = attr(t.attrs, "data-lang");
      expect(["en", "es"], `text "${t.body}"`).toContain(lang);
      count[lang as "en" | "es"] += 1;
      expect(Number(attr(t.attrs, "font-size")), `size of "${t.body}"`).toBeGreaterThanOrEqual(22);
      expect(/font-family/.test(t.attrs), `font-family on "${t.body}"`).toBe(false);
      expect(/\bstyle="[^"]*font/.test(t.attrs), `style font on "${t.body}"`).toBe(false);
    }
    expect(count.en).toBe(count.es);
  });

  it("holds no font family, chart, image, link or event attribute", () => {
    expect(/font-family/.test(svg)).toBe(false);
    expect(/data-chart/.test(svg)).toBe(false);
    expect(/<image\b/.test(svg)).toBe(false);
    expect(/\bhref=|xlink:href/.test(svg)).toBe(false);
    expect(/\son[a-z]+\s*=/.test(svg)).toBe(false);
    expect(/<script\b|<foreignObject\b/.test(svg)).toBe(false);
  });

  it("writes no em-dash, arrow or emoji and stays under 40 KB", () => {
    expect(/[\u2014\u2013\u2190-\u21FF\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(svg)).toBe(false);
    expect(Buffer.byteLength(svg, "utf8")).toBeLessThan(40 * 1024);
  });
});

describe("the pain illustration is animated within the shell's limits", () => {
  const svg = file("pain");
  it("has keyframes, a reduced-motion block that stops them, and one loop of at most ten seconds", () => {
    expect(/@keyframes\s/.test(svg)).toBe(true);
    const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(svg);
    expect(reduced, "a prefers-reduced-motion block").not.toBeNull();
    expect(/animation\s*:\s*none/.test(reduced![1])).toBe(true);
    const seconds = [...svg.matchAll(/animation-duration\s*:\s*([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(seconds.length).toBeGreaterThan(0);
    for (const s of seconds) expect(s).toBeLessThanOrEqual(10);
  });
});

describe("the situation and proposal illustrations", () => {
  it("the proposal shares the pain layout: the same drawn ground, drifts, shafts and buildings", () => {
    const base = (n: string) => (/<g data-slot="base">[\s\S]*?<\/g><!--base-end-->/.exec(file(n)) ?? [""])[0];
    expect(base("pain").length).toBeGreaterThan(500);
    expect(base("proposal")).toBe(base("pain"));
    expect(base("situation")).toBe(base("pain"));
  });
});
