import { describe, expect, it } from "vitest";
import { DOC_AREAS, type BiText } from "@fasl-work/caos-app-shell";
import { introductionSections, introductionSteps } from "./introduction";
import { classicalMethods } from "./methods";
import { learnedMethods } from "./learned-methods";
import { implementationSections } from "./implementation";
import { experimentSections } from "./experiments";
import { glossaryEntries, type ScientificSection } from "./primitives";

// The contract of the documentation framework (shell 0.15.0, ADR-0017 section 2.1, gate check ADR-0017.2): every section of
// every page declares an area of its page's vocabulary (the shell's DOC_AREAS, the table the gate reads), a method also a kind,
// and the Introduction's technical view reaches its floors from the content, in both languages.
const PAGES: Record<
  string,
  { route: keyof typeof DOC_AREAS; sections: ScientificSection[] }
> = {
  introduction: { route: "/introduction", sections: introductionSections },
  methodology: {
    route: "/methodology",
    sections: [...classicalMethods, ...learnedMethods],
  },
  implementation: {
    route: "/implementation",
    sections: implementationSections,
  },
  experiments: { route: "/experiments", sections: experimentSections },
};
const words = (text: string) =>
  text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const DENSE = 40;
const dense = (section: ScientificSection, lang: 0 | 1) =>
  section.paragraphs.filter((p) => words(p[lang]) >= DENSE).length;

describe.each(Object.entries(PAGES))(
  "%s sections",
  (_name, { route, sections }) => {
    it("declares an area of the page's vocabulary on every section", () => {
      for (const section of sections) {
        expect(typeof section.area, `${section.id} has no area`).toBe("string");
        expect(
          DOC_AREAS[route] as readonly string[],
          `${section.id}: area ${section.area}`,
        ).toContain(section.area);
      }
    });

    it("has unique section ids", () => {
      const ids = sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  },
);

describe("the kind of a method", () => {
  it("is classical or learned on every Methodology section, and nowhere else", () => {
    for (const section of PAGES.methodology.sections) {
      expect(["classical", "learned"], `${section.id} kind`).toContain(
        section.kind,
      );
    }
    for (const name of ["introduction", "implementation", "experiments"]) {
      for (const section of PAGES[name].sections)
        expect(section.kind, `${name}/${section.id}`).toBeUndefined();
    }
  });

  it("keeps the shell's floors: at least 6 method topics, at least 2 learned", () => {
    const sections = PAGES.methodology.sections;
    expect(sections.length).toBeGreaterThanOrEqual(6);
    expect(
      sections.filter((s) => s.kind === "learned").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      sections.filter((s) => s.kind === "classical").map((s) => s.id),
    ).toEqual(classicalMethods.map((s) => s.id));
    expect(
      sections.filter((s) => s.kind === "learned").map((s) => s.id),
    ).toEqual(learnedMethods.map((s) => s.id));
  });
});

describe("the Introduction's technical view", () => {
  const byArea = (area: string) =>
    introductionSections.filter((s) => s.area === area);

  it("has the five areas of the page, once each, in the shell's order", () => {
    expect(introductionSections.map((s) => s.area)).toEqual(
      DOC_AREAS["/introduction"],
    );
  });

  it.each([0, 1] as const)(
    "reaches every floor in language %i (0 English, 1 Spanish)",
    (lang) => {
      expect(dense(byArea("problem")[0], lang)).toBeGreaterThanOrEqual(2);
      expect(dense(byArea("principles")[0], lang)).toBeGreaterThanOrEqual(2);
      const math = byArea("math")[0];
      expect(math.equations.length).toBeGreaterThanOrEqual(1);
      for (const equation of math.equations)
        expect(words(equation.caption[lang])).toBeGreaterThan(5);
      const glossary = glossaryEntries(math.symbols ?? []);
      expect(glossary.length).toBeGreaterThanOrEqual(10);
      const lang2 = lang === 0 ? "en" : "es";
      const text = (b: BiText) => (typeof b === "string" ? b : b[lang2]);
      for (const entry of glossary) {
        expect(
          /[\p{L}\p{N}]/u.test(text(entry.term)),
          `term ${text(entry.term)}`,
        ).toBe(true);
        expect(
          /[\p{L}\p{N}]/u.test(text(entry.definition)),
          `definition of ${text(entry.term)}`,
        ).toBe(true);
      }
      expect(introductionSteps.length).toBeGreaterThanOrEqual(4);
      for (const step of introductionSteps)
        expect(words(step[lang])).toBeGreaterThan(3);
      expect(dense(byArea("honesty")[0], lang)).toBeGreaterThanOrEqual(1);
      expect(words(byArea("honesty")[0].assumption[lang])).toBeGreaterThan(5);
    },
  );

  it("holds at least 3 captioned equations and at least 1 captioned overview figure", () => {
    const equations = introductionSections.flatMap((s) => s.equations);
    expect(equations.length).toBeGreaterThanOrEqual(3);
    const figures = introductionSections.filter(
      (s) => s.diagram && s.diagramCaption,
    );
    expect(figures.length).toBeGreaterThanOrEqual(1);
  });

  it("gives the end-to-end diagram a caption, so the pipeline area shows its figure", () => {
    expect(byArea("pipeline")[0].diagram).toBe("pipeline");
    expect(byArea("pipeline")[0].diagramCaption).toBeDefined();
  });

  it("writes every Spanish string differently from its English one", () => {
    for (const section of introductionSections) {
      for (const [en, es] of [
        section.title,
        section.assumption,
        ...section.paragraphs,
        ...(section.symbols ?? []),
      ]) {
        expect(es, `${section.id}: ${en.slice(0, 40)}`).not.toBe(en);
      }
    }
    for (const [en, es] of introductionSteps) expect(es).not.toBe(en);
  });
});

describe("glossaryEntries", () => {
  it("splits a symbol line at its first colon, in both languages", () => {
    expect(
      glossaryEntries([
        [
          "u=|Q|/A: mean speed magnitude, m/s.",
          "u=|Q|/A: magnitud de velocidad media, m/s.",
        ],
      ]),
    ).toEqual([
      {
        term: { en: "u=|Q|/A", es: "u=|Q|/A" },
        definition: {
          en: "mean speed magnitude, m/s.",
          es: "magnitud de velocidad media, m/s.",
        },
      },
    ]);
  });
});
