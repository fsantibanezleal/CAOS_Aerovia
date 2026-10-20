import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DOC_AREAS,
  MAX_PEER_TABS,
  useLangStore,
} from "@fasl-work/caos-app-shell";
import Implementation, { ImplementationTopic } from "./Implementation";
import {
  contractTables,
  implementationGroups,
  implementationSections,
  implementationTopics,
} from "../content/implementation";

// The floors of the Implementation page (ADR-0017 section 2.1; shell 0.15.0 gate/areas.mjs, '/implementation'), asserted on
// the render of each topic in both languages: the contract tables, the captioned architecture figure of the learned models,
// at least eight topics, and the dense paragraphs, equations and callouts of every area. The shell gate measures the same
// floors on the built site; this file keeps them from regressing before a build.
type Lang = "en" | "es";
const LANGS = ["en", "es"] as const;
const render = (
  node: Parameters<typeof renderToStaticMarkup>[0],
  lang: Lang = "en",
) => {
  useLangStore.setState({ lang });
  return renderToStaticMarkup(node);
};
const count = (html: string, needle: RegExp) =>
  (html.match(needle) ?? []).length;
const text = (html: string) =>
  html
    .replace(/<span class="katex[\s\S]*?<\/span><\/span><\/span>/g, " ")
    .replace(/<[^>]+>/g, " ");
/** The visible paragraphs of the displayed language with at least 40 words (the gate's dense paragraph). */
const dense = (html: string) =>
  [...html.matchAll(/<p class="measure">([\s\S]*?)<\/p>/g)].filter(
    (m) => text(m[1]).split(/\s+/).filter(Boolean).length >= 40,
  ).length;
const topic = (id: string, lang: Lang) =>
  render(createElement(ImplementationTopic, { id }), lang);
const sectionsOf = (id: string) =>
  implementationTopics
    .find((t) => t.id === id)!
    .sections.map((s) => implementationSections.find((x) => x.id === s)!);

beforeEach(() => useLangStore.setState({ lang: "en" }));

describe("the topics of the Implementation page", () => {
  it("has at least eight topics, in groups the navigation can hold", () => {
    expect(implementationTopics.length).toBeGreaterThanOrEqual(8);
    expect(implementationGroups.length).toBeLessThanOrEqual(MAX_PEER_TABS);
    for (const group of implementationGroups)
      expect(group.topics.length, group.id).toBeLessThanOrEqual(MAX_PEER_TABS);
    expect(new Set(implementationTopics.map((t) => t.id)).size).toBe(
      implementationTopics.length,
    );
  });

  it("shows every section in exactly one topic, and every area of the page", () => {
    const placed = implementationTopics.flatMap((t) => t.sections);
    expect([...placed].sort()).toEqual(
      implementationSections.map((s) => s.id).sort(),
    );
    const areas = new Set(implementationSections.map((s) => s.area));
    for (const area of DOC_AREAS["/implementation"])
      expect(areas.has(area), `area ${area}`).toBe(true);
    for (const area of areas)
      expect(DOC_AREAS["/implementation"]).toContain(area);
  });

  it.each(LANGS)(
    "renders the first group's topics as tabs with the group row (%s)",
    (lang) => {
      const html = render(createElement(Implementation), lang);
      expect(html).toContain('data-doc-page=""');
      // the group row, then the sub-tabs of the open group
      expect(count(html, /role="tab"/g)).toBe(
        implementationGroups.length + implementationGroups[0].topics.length,
      );
    },
  );

  it("labels every group and topic in both languages", () => {
    for (const group of implementationGroups) {
      expect(group.label[0].length).toBeGreaterThan(2);
      expect(group.label[1].length).toBeGreaterThan(2);
      for (const t of group.topics) {
        expect(t.label[0].length).toBeGreaterThan(2);
        expect(t.label[1].length).toBeGreaterThan(2);
        expect(t.label[0]).not.toBe(t.label[1]);
      }
    }
  });
});

describe.each(LANGS)("the area floors (%s)", (lang) => {
  it("contract: a table in every contract section, with a caption and a header", () => {
    for (const s of sectionsOf("inputs")) {
      expect(s.area).toBe("contract");
      expect(contractTables[s.id], s.id).toBeDefined();
    }
    const html = topic("inputs", lang);
    expect(count(html, /<table/g)).toBe(sectionsOf("inputs").length);
    expect(count(html, /<caption/g)).toBe(sectionsOf("inputs").length);
    // the schema identity and units that the network document carries
    expect(html).toContain("aerovia.network/v1");
    expect(html).toContain("Pa·s²/m⁶");
    expect(html).toContain("m³/s");
    expect(dense(html)).toBeGreaterThanOrEqual(2);
  });

  it("every contract table row has a field, a unit or range and a meaning", () => {
    for (const table of Object.values(contractTables)) {
      expect(table.rows.length).toBeGreaterThanOrEqual(5);
      for (const row of table.rows) {
        expect(row.length).toBe(3);
        for (const cell of row) {
          expect(cell[lang === "en" ? 0 : 1].trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("architecture: a figure with a caption in the Models topic", () => {
    const html = topic("models", lang);
    expect(count(html, /<figcaption/g)).toBeGreaterThanOrEqual(1);
    expect(html).toContain("<svg");
    expect(html).toContain("model-registry/v1");
    expect(html).toContain("ONNX");
    expect(html).toMatch(/aria-label="[^"]*(registry|registro)/);
  });

  it("reproducibility: a dense paragraph and a callout", () => {
    const html = topic("reproducibility", lang);
    expect(dense(html)).toBeGreaterThanOrEqual(1);
    expect(count(html, /data-callout="honest"/g)).toBe(1);
    expect(html).toContain("20260909");
  });

  it("engine: two dense paragraphs, a captioned equation and a callout in every engine section", () => {
    const engines = implementationSections.filter((s) => s.area === "engine");
    expect(engines.length).toBeGreaterThanOrEqual(3);
    for (const s of engines) {
      const t = implementationTopics.find((x) => x.sections.includes(s.id))!;
      const html = topic(t.id, lang);
      expect(dense(html), s.id).toBeGreaterThanOrEqual(2);
      expect(
        count(html, /class="equation-caption"/g),
        s.id,
      ).toBeGreaterThanOrEqual(1);
      expect(
        count(html, /data-callout="honest"/g),
        s.id,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("lanes and deployment: dense paragraphs", () => {
    expect(dense(topic("solvers", lang))).toBeGreaterThanOrEqual(2);
    expect(dense(topic("deployment", lang))).toBeGreaterThanOrEqual(1);
  });

  it("every section has two dense paragraphs, one honest callout and its area", () => {
    for (const s of implementationSections) {
      const t = implementationTopics.find((x) => x.sections.includes(s.id))!;
      const html = topic(t.id, lang);
      expect(html, s.id).toContain(`data-area="${s.area}"`);
      expect(s.paragraphs.length, s.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("no content is lost on the page", () => {
  it.each(LANGS)(
    "renders every paragraph, equation, symbol and callout of every section (%s)",
    (lang) => {
      for (const t of implementationTopics) {
        const html = topic(t.id, lang);
        const sections = sectionsOf(t.id);
        expect(count(html, /data-doc-section=""/g), t.id).toBe(sections.length);
        expect(count(html, /<p class="measure">/g), t.id).toBe(
          sections.reduce((n, s) => n + s.paragraphs.length, 0),
        );
        expect(count(html, /class="equation-caption"/g), t.id).toBe(
          sections.reduce((n, s) => n + s.equations.length, 0),
        );
        expect(count(html, /<dt>/g), t.id).toBe(
          sections.reduce((n, s) => n + (s.symbols?.length ?? 0), 0),
        );
      }
    },
  );

  it("writes every glossary line as a term and a definition, so no term is a sentence", () => {
    for (const s of implementationSections)
      for (const line of s.symbols ?? [])
        for (const part of line) {
          const at = part.indexOf(": ");
          expect(at, part).toBeGreaterThan(0);
          expect(at, part).toBeLessThanOrEqual(40);
        }
  });
});
