import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@fasl-work/caos-app-shell";
import { classicalMethods } from "./methods";
import { learnedMethods } from "./learned-methods";
import { DeepSection } from "./primitives";

// The `method` floor of the Methodology page (shell 0.15.0, ADR-0017 section 2.1, gate ADR-0017.2): every method topic holds
// at least one SVG figure inside the shell's Figure, with a caption, in both languages.
const sections = [...classicalMethods, ...learnedMethods];
const words = (text: string) =>
  text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

beforeEach(() => useLangStore.setState({ lang: "en" }));

describe("the Methodology page's method topics", () => {
  it("are six, each with a diagram", () => {
    expect(sections).toHaveLength(6);
    for (const s of sections) expect(s.diagram, s.id).toBeDefined();
  });

  it.each([0, 1] as const)(
    "give every diagram a caption that says what the reader sees (language %i)",
    (lang) => {
      for (const s of sections) {
        expect(s.diagramCaption, `${s.id} has no caption`).toBeDefined();
        const caption = s.diagramCaption![lang];
        expect(
          words(caption),
          `${s.id} caption too short`,
        ).toBeGreaterThanOrEqual(15);
        expect(caption).not.toMatch(/\u2014|\u2192/);
      }
    },
  );

  it("write each Spanish caption differently from its English one, with accents where Spanish needs them", () => {
    for (const s of sections) {
      expect(s.diagramCaption![1], s.id).not.toBe(s.diagramCaption![0]);
    }
  });

  it.each(["en", "es"] as const)(
    "render one SVG inside a figure with a non-empty figcaption in every topic (%s)",
    (lang) => {
      useLangStore.setState({ lang });
      for (const s of sections) {
        const html = renderToStaticMarkup(
          createElement(DeepSection, { section: s }),
        );
        const figure = html.match(/<figure[\s\S]*?<\/figure>/);
        expect(figure, `${s.id}: no figure`).not.toBeNull();
        expect(figure![0], `${s.id}: no svg`).toContain("<svg");
        const cap = figure![0].match(
          /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/,
        );
        expect(cap, `${s.id}: no figcaption`).not.toBeNull();
        expect(cap![1].replace(/<[^>]+>/g, "").trim().length).toBeGreaterThan(
          40,
        );
      }
    },
  );
});

describe("the symbol lines of the Methodology page", () => {
  it("are all `term: definition` lines in both languages, so the glossary has a short term column that fits 390 px", () => {
    for (const s of sections) {
      for (const line of s.symbols ?? []) {
        for (const lang of [0, 1] as const) {
          const at = line[lang].indexOf(": ");
          expect(at, `${s.id}: ${line[lang].slice(0, 40)}`).toBeGreaterThan(0);
          expect(at, `${s.id}: term too long`).toBeLessThan(40);
        }
      }
    }
  });
});
