/**
 * The structure of the App (plan decision 1, amended 2026-10-20): five question groups, each with the sub-views the
 * old modes' tool pages became. With the shell's Context view they are six peers (ADR-0071 rule 5); a group holds at
 * most six sub-views. `OLD_PAGES` is the mapping table of the migration: every tool page of the six modes of
 * Aerovia 0.03.000 lands in exactly one sub-view.
 */

export type GroupId =
  | "design"
  | "airflow"
  | "transport"
  | "uncertainty"
  | "models";

/** The modes of Aerovia 0.03.000, which `OLD_PAGES` keeps the names of. */
export type OldMode =
  | "design"
  | "flow"
  | "transport"
  | "operations"
  | "risk"
  | "models";

export interface SubViewDef {
  id: string;
  en: string;
  es: string;
}

export interface GroupDef {
  id: GroupId;
  en: string;
  es: string;
  /** The title of the tool pane in the group (what the group is for). */
  title: { en: string; es: string };
  subs: readonly SubViewDef[];
}

export const MAX_SUBVIEWS = 6;

const view: SubViewDef = { id: "view", en: "Display", es: "Vista" };
const result: SubViewDef = { id: "inspect", en: "Result", es: "Resultado" };
const conditions: SubViewDef = {
  id: "conditions",
  en: "Conditions",
  es: "Condiciones",
};
const equipment: SubViewDef = { id: "equipment", en: "Equipment", es: "Equipo" };

export const GROUPS: readonly GroupDef[] = [
  {
    id: "design",
    en: "Design",
    es: "Diseño",
    title: { en: "Build the mine", es: "Construir la mina" },
    subs: [
      { id: "primary", en: "Draw and move", es: "Dibujar y mover" },
      { id: "node", en: "Junction", es: "Unión" },
      { id: "airway", en: "Airway", es: "Galería" },
      result,
      view,
    ],
  },
  {
    id: "airflow",
    en: "Airflow",
    es: "Flujo de aire",
    title: { en: "Trace the airflow", es: "Seguir el flujo" },
    subs: [
      { id: "primary", en: "Flow and paths", es: "Flujo y rutas" },
      { id: "duty", en: "Fan duty", es: "Ventilador" },
      conditions,
      equipment,
      result,
      view,
    ],
  },
  {
    id: "transport",
    en: "Transport",
    es: "Transporte",
    title: { en: "Release and response", es: "Emisión y respuesta" },
    subs: [
      { id: "primary", en: "Release", es: "Emisión" },
      { id: "schedule", en: "Change", es: "Cambio" },
      { id: "monitor", en: "Monitor", es: "Monitor" },
      { id: "ledger", en: "Balance", es: "Balance" },
      view,
    ],
  },
  {
    id: "uncertainty",
    en: "Uncertainty",
    es: "Incertidumbre",
    title: { en: "Test the margin", es: "Evaluar el margen" },
    subs: [
      { id: "primary", en: "Ensemble", es: "Conjunto" },
      conditions,
      equipment,
      result,
      view,
    ],
  },
  {
    id: "models",
    en: "Learned models",
    es: "Modelos aprendidos",
    title: { en: "Compare learned models", es: "Comparar modelos aprendidos" },
    subs: [
      { id: "primary", en: "Learned", es: "Aprendidos" },
      conditions,
      equipment,
      result,
      view,
    ],
  },
];

export const groupById = (id: string): GroupDef | undefined =>
  GROUPS.find((g) => g.id === id);

export interface OldPage {
  mode: OldMode;
  page: string;
  group: GroupId;
  sub: string;
}

const page = (
  mode: OldMode,
  pageId: string,
  group: GroupId,
  sub: string,
): OldPage => ({ mode, page: pageId, group, sub });

/** Where each tool page of today's six modes went, in the order the old modes listed them. */
export const OLD_PAGES: readonly OldPage[] = [
  page("design", "primary", "design", "primary"),
  page("design", "node", "design", "node"),
  page("design", "airway", "design", "airway"),
  page("design", "inspect", "design", "inspect"),
  page("design", "view", "design", "view"),
  page("flow", "primary", "airflow", "primary"),
  page("flow", "conditions", "airflow", "conditions"),
  page("flow", "equipment", "airflow", "equipment"),
  page("flow", "inspect", "airflow", "inspect"),
  page("flow", "view", "airflow", "view"),
  page("transport", "primary", "transport", "primary"),
  page("transport", "schedule", "transport", "schedule"),
  page("transport", "monitor", "transport", "monitor"),
  page("transport", "ledger", "transport", "ledger"),
  page("transport", "view", "transport", "view"),
  // The operations mode merged into the airflow group: its operating question and its energy summary share the
  // fan-duty sub-view; its operating inputs, result and display are the group's own.
  page("operations", "primary", "airflow", "duty"),
  page("operations", "conditions", "airflow", "conditions"),
  page("operations", "equipment", "airflow", "equipment"),
  page("operations", "energy", "airflow", "duty"),
  page("operations", "inspect", "airflow", "inspect"),
  page("operations", "view", "airflow", "view"),
  page("risk", "primary", "uncertainty", "primary"),
  page("risk", "conditions", "uncertainty", "conditions"),
  page("risk", "equipment", "uncertainty", "equipment"),
  page("risk", "inspect", "uncertainty", "inspect"),
  page("risk", "view", "uncertainty", "view"),
  page("models", "primary", "models", "primary"),
  page("models", "conditions", "models", "conditions"),
  page("models", "equipment", "models", "equipment"),
  page("models", "inspect", "models", "inspect"),
  page("models", "view", "models", "view"),
];

/** The group and sub-view that an old mode's tool page became, or undefined for a page that never existed. */
export function subViewOf(
  mode: string,
  pageId: string,
): { group: GroupId; sub: string } | undefined {
  const hit = OLD_PAGES.find((p) => p.mode === mode && p.page === pageId);
  return hit && { group: hit.group, sub: hit.sub };
}
