import type { Bilingual } from "./primitives";
export const regimeDefinitions = [
  {
    id: "nominal",
    name: ["Design speed", "Velocidad de diseño"] as Bilingual,
    recipe: [
      "s = 1; original resistance.",
      "s = 1; resistencia original.",
    ] as Bilingual,
    purpose: [
      "Establish the common comparison.",
      "Establecer comparación común.",
    ] as Bilingual,
  },
  {
    id: "turndown",
    name: ["Fan turndown", "Reducción de velocidad"] as Bilingual,
    recipe: [
      "s = 0.65; original resistance.",
      "s = 0,65; resistencia original.",
    ] as Bilingual,
    purpose: [
      "Compare reduced delivery and cubic power response.",
      "Comparar entrega reducida y respuesta cúbica de potencia.",
    ] as Bilingual,
  },
  {
    id: "boost",
    name: ["Fan boost", "Aumento de velocidad"] as Bilingual,
    recipe: [
      "s = 1.25; original resistance.",
      "s = 1,25; resistencia original.",
    ] as Bilingual,
    purpose: [
      "Measure extra flow against additional demand.",
      "Medir caudal extra frente a demanda adicional.",
    ] as Bilingual,
  },
  {
    id: "working-restriction",
    name: ["Restricted workings", "Labores restringidas"] as Bilingual,
    recipe: [
      "s = 1; working-airway R × 3.",
      "s = 1; R de labores × 3.",
    ] as Bilingual,
    purpose: [
      "Expose redistribution around a local production restriction.",
      "Exponer redistribución por restricción de producción.",
    ] as Bilingual,
  },
  {
    id: "return-restriction",
    name: ["Restricted returns", "Retornos restringidos"] as Bilingual,
    recipe: [
      "s = 1; return-airway R × 3.",
      "s = 1; R de retornos × 3.",
    ] as Bilingual,
    purpose: [
      "Identify shared downstream pressure loss.",
      "Identificar pérdida compartida aguas abajo.",
    ] as Bilingual,
  },
  {
    id: "roughness",
    name: ["Distributed resistance", "Resistencia distribuida"] as Bilingual,
    recipe: [
      "s = 1; all airway R × 1.5.",
      "s = 1; toda R de galería × 1,5.",
    ] as Bilingual,
    purpose: [
      "Compare distributed resistance with a fixed fan curve.",
      "Comparar resistencia distribuida con curva fija.",
    ] as Bilingual,
  },
];
export const caseQuestions: Record<
  string,
  { question: Bilingual; design: Bilingual; interpretation: Bilingual }
> = {
  "hard-rock": {
    question: [
      "How do production levels share one pressure source?",
      "¿Cómo comparten niveles una fuente de presión?",
    ],
    design: [
      "Three levels connect through shared intake and return shafts. Different path lengths and resistances create competition for the available pressure. Use this case as the reference for interventions whose consequences extend beyond the edited airway.",
      "Tres niveles se conectan por piques compartidos. Longitudes y resistencias distintas generan competencia por presión. Sirve como referencia para intervenciones que afectan más que la galería editada.",
    ],
    interpretation: [
      "Select an upper working branch, then a lower one. Compare their forward-target deficits before and after restricting the common return; total intake alone cannot identify the limiting level.",
      "Seleccione labor superior y luego inferior. Compare déficits antes y después de restringir retorno común; admisión total sola no identifica nivel limitante.",
    ],
  },
  "deep-five-level": {
    question: [
      "Which deep horizons become pressure-limited?",
      "¿Qué horizontes profundos quedan limitados por presión?",
    ],
    design: [
      "Five levels extend the shared-shaft problem. The additional depth is represented by topology and supplied resistance, not by a compressible thermodynamic model. This isolates resistance distribution from effects the solver does not include.",
      "Cinco niveles extienden el problema compartido. Profundidad se representa mediante topología y resistencia, no termodinámica compresible. Así se aísla distribución de resistencia de efectos excluidos.",
    ],
    interpretation: [
      "Inspect lower-level delivery and compare common-speed boost with a return intervention. Increased geometric depth alone is not a modeled natural ventilation pressure.",
      "Inspeccione entrega inferior y compare aumento común con intervención de retorno. Profundidad geométrica no es presión natural modelada.",
    ],
  },
  "room-pillar": {
    question: [
      "Which cross-passages bypass the intended working route?",
      "¿Qué pasos desvían el aire de la ruta de trabajo?",
    ],
    design: [
      "A gridded district has many alternate paths rather than one series circuit. Crosscuts can redistribute or bypass flow, making a local modification visible throughout the graph. The case tests why nearest geometric distance is not the same as nominal airflow transit.",
      "Un distrito reticulado tiene rutas alternativas. Cruceros redistribuyen o desvían caudal, haciendo visible una modificación en todo el grafo. Prueba por qué distancia geométrica mínima difiere de tránsito nominal.",
    ],
    interpretation: [
      "Compare a directed airflow path with the concentration history after a passive pulse. Mixing splits mass across routes; one highlighted path is not the full tracer distribution.",
      "Compare ruta dirigida con historia tras pulso. Mezcla reparte masa entre rutas; un camino destacado no es toda la distribución.",
    ],
  },
  "twin-district": {
    question: [
      "How do unequal districts compete for shared pressure?",
      "¿Cómo compiten distritos desiguales por presión?",
    ],
    design: [
      "Two districts deliberately have different resistance patterns. This creates an interpretable asymmetric reference for regulation: the easiest path need not be the path with the highest entered production need.",
      "Dos distritos tienen patrones de resistencia diferentes. Crean referencia asimétrica para regular: el camino más fácil no necesariamente tiene mayor necesidad ingresada.",
    ],
    interpretation: [
      "Save the nominal state, increase resistance in the easier district and inspect both districts. A benefit at one working area may require extra fan pressure or reduce delivery elsewhere.",
      "Guarde nominal, aumente resistencia del distrito fácil y revise ambos. Beneficiar una labor puede exigir presión extra o reducir entrega en otra.",
    ],
  },
  "leakage-open": {
    question: [
      "How much air bypasses production through open leakage routes?",
      "¿Cuánto aire evita producción mediante fugas abiertas?",
    ],
    design: [
      "Additional low-resistance cross-connections represent authored leakage paths. Their role is explicitly topological and resistive; the displayed geometry does not establish an observed door condition or measured leakage coefficient.",
      "Conexiones de baja resistencia representan fugas creadas. Su papel es topológico y resistivo; geometría no establece puerta observada ni coeficiente medido.",
    ],
    interpretation: [
      "Select the bypass and a working branch together through successive comparisons. Observe which receives the flow when the bypass resistance rises, and compare with the paired sealed case.",
      "Seleccione desvío y labor en comparaciones sucesivas. Observe reparto al aumentar resistencia y compare caso pareado sellado.",
    ],
  },
  "leakage-sealed": {
    question: [
      "What changes when leakage resistance is increased?",
      "¿Qué cambia al aumentar resistencia de fugas?",
    ],
    design: [
      "The paired sealing intervention preserves unaffected inputs from the open-leakage reference. The causal comparison is the modeled resistance intervention. It is not a measured before-and-after sealing campaign.",
      "Intervención pareada conserva entradas no afectadas. La comparación causal es el cambio de resistencia modelado. No es campaña medida antes/después.",
    ],
    interpretation: [
      "Compare useful working delivery and electrical demand at the same speed before searching for a new speed. Separating these steps distinguishes redistribution from a speed-control change.",
      "Compare entrega útil y demanda a igual velocidad antes de buscar velocidad nueva. Separar distingue redistribución de cambio de control.",
    ],
  },
  "district-regulation": {
    question: [
      "Can the easier district be regulated to help the harder one?",
      "¿Se puede regular distrito fácil para ayudar al difícil?",
    ],
    design: [
      "A regulation intervention changes the pressure distribution between asymmetric districts. It demonstrates that a resistance increase can improve a different branch even while restricting its own path.",
      "Regular cambia distribución entre distritos asimétricos. Muestra que aumentar resistencia puede mejorar otra rama al restringir la propia.",
    ],
    interpretation: [
      "Use the sensitivity ranking to identify a candidate, then test the actual proposed change. A five-percent local finite difference is not a guarantee for a large regulator movement.",
      "Use sensibilidad para candidato y luego pruebe cambio real. Diferencia local de cinco por ciento no garantiza movimiento grande.",
    ],
  },
  "development-headings": {
    question: [
      "What delivery reaches a long development and duct circuit?",
      "¿Qué caudal alcanza circuito largo de desarrollo y ducto?",
    ],
    design: [
      "Long and narrow auxiliary routes create a distinct resistance and transport-volume problem. The network representation assumes established connections; it does not resolve a free jet leaving a duct or a recirculating face cavity.",
      "Rutas auxiliares largas y estrechas crean problema distinto de resistencia y volumen. Red supone conexiones; no resuelve chorro libre de ducto ni cavidad recirculante de frente.",
    ],
    interpretation: [
      "Inspect velocity separately from volume flow. A narrow area can show high velocity with low useful flow; transport delay depends on both represented length and area.",
      "Revise velocidad separada de caudal. Área estrecha puede mostrar velocidad alta y poco caudal; retardo depende de longitud y área.",
    ],
  },
  "return-restriction": {
    question: [
      "How does maintenance in the shared return affect all workings?",
      "¿Cómo afecta mantenimiento del retorno a todas las labores?",
    ],
    design: [
      "A common return restriction is a downstream intervention shared by production districts. It tests whether local-looking maintenance consequences propagate through the entire pressure network.",
      "Restricción común de retorno es intervención compartida aguas abajo. Prueba propagación del mantenimiento por toda la red de presión.",
    ],
    interpretation: [
      "Compare target deficits by district and the solved fan operating point. Do not conclude that a higher delivered fan pressure means more useful air reaches the faces.",
      "Compare déficits por distrito y punto operativo. Presión mayor no significa que más aire útil llegue a frentes.",
    ],
  },
  "deep-booster": {
    question: [
      "What does a series booster change in a deep district?",
      "¿Qué cambia un ventilador en serie en distrito profundo?",
    ],
    design: [
      "An additional fan source changes the distribution in the deep network. The supported model combines quadratic fan curves with the same common speed ratio; it does not provide independent fan-speed optimization.",
      "Fuente adicional cambia distribución profunda. Modelo combina curvas cuadráticas con velocidad común; no optimiza velocidades independientes.",
    ],
    interpretation: [
      "Inspect each fan and total electrical demand. Multiple-device behavior must not be collapsed into an unexplained single equivalent system curve.",
      "Revise cada ventilador y demanda total. Varios equipos no se reducen a curva equivalente única sin explicación.",
    ],
  },
  "split-intake": {
    question: [
      "How does a separate lower intake alter district supply?",
      "¿Cómo altera suministro una admisión inferior separada?",
    ],
    design: [
      "A second fresh-air route changes topology and the available pressure pathways. Comparing it with the shared-shaft reference separates a connectivity intervention from simply increasing fan speed.",
      "Segunda ruta fresca cambia topología y caminos de presión. Compararla con referencia separa conectar de aumentar velocidad.",
    ],
    interpretation: [
      "Trace positive supply from each boundary and inspect the lower horizon. Boundary supply is summed by net outward flow, preventing internal galleries from being counted repeatedly as new fresh air.",
      "Siga suministro desde bordes y revise horizonte inferior. Se suma salida neta por borde, evitando contar galerías internas repetidamente como aire fresco.",
    ],
  },
  "narrow-incline": {
    question: [
      "How does inclined access and working resistance affect delivery?",
      "¿Cómo afectan acceso inclinado y resistencia la entrega?",
    ],
    design: [
      "An inclined narrow-vein layout provides a geometric and resistive contrast to vertical shared shafts. Elevation contributes to represented lengths but not to an automatically inferred buoyancy source.",
      "Disposición inclinada contrasta geométrica y resistivamente con piques. Cota contribuye a longitud, no a fuente de flotabilidad inferida.",
    ],
    interpretation: [
      "Compare resistance and geometric transit effects separately. Moving a junction changes path volume; a hydraulic change requires explicitly revising the corresponding resistance or equipment input.",
      "Compare resistencia y tránsito por separado. Mover unión cambia volumen; cambiar hidráulica requiere revisar resistencia o equipo.",
    ],
  },
};
