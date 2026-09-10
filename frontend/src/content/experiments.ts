import type { ScientificSection } from "./primitives";

export const experimentSections: ScientificSection[] = [
  {
    id: "datasets",
    title: ["Data provenance and coverage", "Procedencia y cobertura de datos"],
    paragraphs: [
      [
        "The primary dataset is the authored engineering network library. Its topology, coordinates, resistances, fan curves and targets are original explicit assumptions released with the product. Each case has a scientific reason for inclusion: shared shafts, unequal districts, crosscut bypass, sealing, development supply, common return restriction or an additional fan source. These cases support reproducible numerical experiments without exposing an operating mine’s private design. Their transparency is useful, but the label “authored” must follow every benchmark row that uses them. A visually recognizable mining arrangement is not evidence of survey provenance.",
        "El conjunto principal es la biblioteca creada. Topología, coordenadas, resistencias, curvas y objetivos son supuestos originales explícitos publicados. Cada caso tiene razón: piques compartidos, asimetría, desvíos, sellado, desarrollo, retorno restringido o fuente adicional. Permiten experimentos reproducibles sin exponer diseño privado. Su transparencia sirve, pero etiqueta “creado” acompaña cada resultado. Forma minera reconocible no prueba levantamiento.",
      ],
      [
        "Reference labels are computed by the declared numerical engine, and their source identity and physical residuals accompany them. For large learned datasets, batched CUDA labels and independently sampled SciPy checks have different roles and are named separately. External textbooks and papers support method definitions but are linked rather than mirrored without a redistribution license. Imported user networks are computationally supported input, not automatically part of the public benchmark. A real-site evaluation would need its own permission, units, calibration protocol and held-out observations; no synthetic row is relabeled as that missing evidence.",
        "Etiquetas se calculan por motor declarado y acompañan identidad y residuos. En conjuntos grandes, etiquetas CUDA y comprobaciones SciPy tienen roles distintos. Textos y artículos respaldan métodos pero se enlazan sin copiar sin licencia. Redes importadas son entradas computables, no automáticamente benchmark público. Evaluación real requiere permiso, unidades, calibración y observaciones reservadas; ninguna fila sintética se reetiqueta como esa evidencia.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\mathrm{coverage}=\{\mathrm{case},\mathrm{physical\ regime},\mathrm{method},\mathrm{source\ kind},\mathrm{lane}\}`,
        caption: [
          "Coverage identifies the scientific case, physical intervention, method, source provenance and execution lane. A case count alone does not establish independent-site coverage.",
          "Cobertura identifica caso, intervención, método, procedencia y vía. Contar casos no establece sitios independientes.",
        ],
      },
    ],
    assumption: [
      "All bundled mine networks are authored. External publications are references, not redistributed field datasets, and the public benchmark does not claim measured-mine calibration.",
      "Todas las redes incluidas son creadas. Publicaciones son referencias, no conjuntos de terreno redistribuidos; benchmark no afirma calibración medida.",
    ],
    refs: ["mcpherson1993", "sklearnleakage"],
  },
  {
    id: "regime-design",
    title: [
      "Physical regimes and controlled interventions",
      "Regímenes físicos e intervenciones controladas",
    ],
    paragraphs: [
      [
        "The six-regime matrix changes quantities that actually affect the network equations. Nominal speed is the reference. Reduced and increased common speed test homogeneity and electrical demand. Restricting every working airway or every return airway by the same resistance factor produces two distinct network interventions: local production distribution and shared downstream loss. Multiplying every airway resistance by one and a half tests distributed degradation while leaving the fan curve unchanged. The matrix is defined by complete operating options, not by a name, camera position or seed. Every case supports the relevant airway categories.",
        "La matriz cambia magnitudes que afectan ecuaciones. Velocidad nominal es referencia; reducción y aumento prueban homogeneidad y demanda. Restringir todas las labores o retornos por mismo factor da intervenciones diferentes: distribución productiva y pérdida compartida. Multiplicar resistencias por uno y medio prueba degradación distribuida con curva fija. La matriz se define por opciones completas, no nombre, cámara ni semilla. Cada caso soporta categorías pertinentes.",
      ],
      [
        "Exact replay regimes are audit points, not a sufficient learning dataset. Additional resistance vectors include independent edge perturbations and correlated group perturbations inside declared bounds. All speed-scaled forms of one vector remain in its assigned split. Fan-off is a separate negative control whose zero response follows from encoded physics; increasing targets is a derived decision stress that must not be credited as a hydraulic input. Case-specific leakage interventions remain meaningful only where actual bypass connections exist. The experiment keeps those distinctions rather than manufacturing universal leakage variants for graphs that lack them.",
        "Regímenes exactos son puntos de auditoría, no conjunto suficiente para aprender. Vectores adicionales incluyen perturbación individual y correlación por grupo dentro de límites. Versiones de velocidad de un vector permanecen en su partición. Apagado es control negativo de física codificada; aumentar objetivos estresa decisión y no es entrada hidráulica. Fugas específicas tienen sentido donde existen desvíos. Se conservan distinciones sin fabricar fugas universales.",
      ],
    ],
    equations: [
      {
        tex: String.raw`Q(0.65)=0.65Q(1),\quad Q(1.25)=1.25Q(1),\quad P_{\mathrm{el}}(s)=s^3P_{\mathrm{el}}(1)`,
        caption: [
          "With unchanged quadratic coefficients, equal boundary pressures and constant efficiency, Q is signed flow, s common speed and P_el electrical demand. These are physical control identities, not learned-performance claims.",
          "Con coeficientes fijos, bordes iguales y eficiencia constante, Q es caudal, s velocidad y P_el demanda. Son identidades físicas, no desempeño aprendido.",
        ],
      },
    ],
    assumption: [
      "The six regimes are defined interventions. Actual matrix completeness and errors must come from exported results; a definition table does not prove that every calculation completed.",
      "Los seis regímenes son intervenciones definidas. Completitud y errores provienen de resultados exportados; definir tabla no prueba ejecución.",
    ],
    refs: ["mcpherson1993"],
    diagram: "fans",
  },
  {
    id: "numerical-verification",
    title: [
      "Independent numerical verification",
      "Verificación numérica independiente",
    ],
    paragraphs: [
      [
        "The hydraulic verification strategy combines known analytic answers with independent implementations. Series and parallel fixtures check the square-law network relation. Passive orientation reversal checks sign handling. Fixed-pressure translation checks gauge invariance. Zero forcing, closures and disconnected active components test boundary behavior. A complete authored-case sweep checks the practical range of graph arrangements. These tests detect different defects: a single small residual on one graph cannot replace the family of invariants, and cross-language agreement cannot prove an input’s field accuracy.",
        "La verificación combina soluciones analíticas e implementaciones independientes. Serie y paralelo prueban ley; invertir orientación prueba signos; trasladar presión prueba referencia. Forzamiento cero, cierres y desconexiones prueban bordes. Barrido completo revisa disposiciones prácticas. Detectan defectos diferentes: un residuo pequeño no sustituye invariancias y concordancia entre lenguajes no prueba exactitud de terreno.",
      ],
      [
        "For a comparison, the same network and operating options are supplied to both methods. Maximum absolute flow disagreement is measured across every corresponding edge, with pressure disagreement across node identities. Exact mass and pressure residuals are recomputed in physical units. CUDA versus CPU checks use saved identical resistance draws, preventing random draw differences from being mistaken for numerical disagreement. Timing reports identify the measured operation, device and scope. A result can be accurate to the numerical reference and still physically uncalibrated; the benchmark presents that distinction next to its evidence rather than hiding it in a distant disclaimer.",
        "En comparación se entregan red y opciones iguales. Desacuerdo absoluto de caudal recorre ramas correspondientes y presión recorre nodos. Se recalculan residuos físicos. CUDA y CPU usan resistencias idénticas guardadas, evitando confundir azar con desacuerdo. Tiempos identifican operación, dispositivo y alcance. Un resultado puede concordar numéricamente y carecer de calibración física; benchmark pone distinción junto a evidencia.",
      ],
    ],
    equations: [
      {
        tex: String.raw`d_Q=\max_e|\widehat Q_e-Q_e^*|,\qquad d_p=\max_i|\widehat p_i-p_i^*|`,
        caption: [
          "Q̂,p̂ are compared outputs and Q*,p* are the same-input reference. d_Q is in m³/s and d_p in Pa; node and edge identities must match.",
          "Q̂,p̂ son salidas comparadas y Q*,p* referencia de misma entrada. d_Q en m³/s y d_p en Pa; identidades deben coincidir.",
        ],
      },
      {
        tex: String.raw`r_m=\max_i|(B_IQ)_i|,\qquad r_p=\max_e|p_u-p_v+H_e-R_eQ_e|Q_e||`,
        caption: [
          "r_m is absolute internal flow imbalance (m³/s); r_p is signed airway-pressure mismatch (Pa). They are numerical verification metrics, not percentages of mine accuracy.",
          "r_m es desequilibrio (m³/s); r_p es desajuste de presión (Pa). Son métricas numéricas, no porcentajes de exactitud minera.",
        ],
      },
    ],
    assumption: [
      "Same equations with different implementations establish consistency. Independent measured observations are required for field validation.",
      "Mismas ecuaciones e implementaciones distintas establecen coherencia. Validación requiere observaciones medidas independientes.",
    ],
    refs: ["scipytrf", "pytorchsolve", "mcpherson1993"],
  },
  {
    id: "transport-verification",
    title: [
      "Transport conservation and refinement",
      "Conservación y refinamiento de transporte",
    ],
    paragraphs: [
      [
        "An analytical mixed-volume fixture tests pulse decay and continuous injection with a known exponential solution. A chain of equal cells has an independently derived Erlang storage expression, which checks transit through several cells without copying the numerical integrator into the test. Split-and-merge cases verify that junction mixing neither creates nor duplicates tracer. Reversing an airway and mapping source position must preserve the physical history under reversed cell ordering. These are stronger checks than observing that an animation moves downstream.",
        "Un volumen mezclado analítico prueba decaimiento y fuente continua exponenciales. Una cadena de celdas iguales tiene expresión Erlang independiente, verificando tránsito sin copiar integrador. Bifurcar y unir verifica no crear ni duplicar trazador. Invertir rama y mapear fuente conserva historia al invertir orden. Son controles más fuertes que observar animación aguas abajo.",
      ],
      [
        "Scheduled closure tests mass retention: closing a branch stops advective exchange but does not erase its stored mass. Reopening can move that mass again. Boundary tests ensure escaped tracer is not recycled into another branch. Step refinement measures time error, while cell refinement changes spatial mixing; these must be investigated separately. A first-order spatial scheme will broaden a pulse even with small time steps. Every run exposes injected, stored, escaped and removed mass in the same units, and the balance residual is examined throughout the timeline. User concentration markers remain numeric analysis settings, not occupational exposure limits.",
        "Cerrar programadamente prueba retención: detiene intercambio, no elimina masa. Reabrir vuelve a moverla. Bordes prueban no reciclar lo escapado. Refinar paso mide error temporal; refinar celdas cambia mezcla espacial, por separado. Esquema espacial de primer orden ensancha pulso aun con pasos pequeños. Cada corrida expone masas en mismas unidades y balance a lo largo de tiempo. Marcadores de concentración son ajustes numéricos, no límites ocupacionales.",
      ],
    ],
    equations: [
      {
        tex: String.raw`M(t)=M_0\exp[-(Q/V+\lambda)t],\qquad C(t)=\frac{M(t)}{V}`,
        caption: [
          "For one perfectly mixed volume V (m³), initial pulse M₀ (mg), constant outflow Q (m³/s) and first-order loss λ (s⁻¹), M is stored mass and C is concentration (mg/m³).",
          "Para volumen mezclado V (m³), pulso M₀ (mg), salida Q (m³/s) y pérdida λ (s⁻¹), M es masa almacenada y C concentración (mg/m³).",
        ],
      },
      {
        tex: String.raw`\frac{M_{\mathrm{stored}}(t)}{M_0}=e^{-at}\sum_{j=0}^{N-1}\frac{(at)^j}{j!},\qquad a=Q/V_{\mathrm{cell}}`,
        caption: [
          "For N equal serial mixed cells with no loss and a pulse initially in the first cell, the Erlang expression gives total storage. a is the cell turnover rate (s⁻¹).",
          "Para N celdas iguales en serie, sin pérdida y pulso inicial en primera, Erlang da almacenamiento total. a es tasa de renovación (s⁻¹).",
        ],
      },
    ],
    assumption: [
      "These analytical fixtures validate the compartment transport implementation, not a mine fire plume. Grid refinement exposes numerical dispersion rather than removing it by assertion.",
      "Casos analíticos validan implementación compartimental, no pluma de incendio. Refinamiento expone dispersión numérica, no la elimina por afirmación.",
    ],
    refs: ["clawpackadvection", "nistcontam", "jong2016"],
    diagram: "transport",
  },
  {
    id: "learning-protocol",
    title: [
      "Leakage-safe learning and held-out questions",
      "Aprendizaje sin filtración y preguntas reservadas",
    ],
    paragraphs: [
      [
        "Partition resistance vectors before fitting, normalization or speed augmentation. Training updates weights; validation selects model settings and checkpoint; calibration defines diagnostic bounds; held-out test estimates performance after those choices are fixed. The nominal calibration is disclosed and shared by both architectures. Generator identities and seeds are recorded, and the exact replay matrix is identified separately. A held-out parameter vector on a known topology tests interpolation under the declared generator. It is not an independent mine, and a related authored case is not automatically an independent site simply because it has a different identifier.",
        "Separe vectores antes de ajustar, normalizar o ampliar velocidad. Entrenamiento actualiza pesos; validación selecciona; calibración define límites; prueba estima después de fijar decisiones. Calibración nominal se declara y comparte. Identidades y semillas se registran; matriz exacta se distingue. Vector reservado en topología conocida prueba interpolación según generador. No es mina independiente; caso relacionado no se convierte en sitio distinto por identificador.",
      ],
      [
        "Both learned methods and the classical baseline receive the same eligible inputs. Report raw and projected flow errors, pressure error, physical residuals, power error and target-status confusion. No failed method-by-case cell is silently removed from the denominator. A structural generalization experiment must reserve a complete topology family and state which methods can support it; a topology-specific MLP cannot be assigned fabricated results for an unseen edge space. Export parity is another independent gate, comparing browser and canonical inference on identical held-out fixtures. Reusing test outcomes to adjust weights, thresholds or the chosen checkpoint invalidates the reported held-out question.",
        "Ambos métodos y referencia reciben entradas elegibles iguales. Se reportan errores crudos/proyectados, presión, residuos, potencia y confusión. Ninguna celda fallida desaparece del denominador. Generalizar estructura exige reservar familia completa y declarar soporte; MLP específico no recibe resultados fabricados en espacio desconocido. Concordancia de exportación compara navegador y canónico en mismas entradas. Reutilizar prueba para pesos, umbrales o checkpoint invalida pregunta reservada.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\operatorname{MAE}_Q=\frac1{NE}\sum_{n=1}^N\sum_{e=1}^E|\widehat Q_{ne}-Q^*_{ne}|,\quad\operatorname{RMSE}_Q=\sqrt{\frac1{NE}\sum_{n,e}(\widehat Q_{ne}-Q^*_{ne})^2}`,
        caption: [
          "N is the evaluated scenario count and E the airway count for one topology. MAE and RMSE are in m³/s. Cross-topology aggregation must state whether samples, edges or cases receive equal weight.",
          "N es cantidad de escenarios y E de ramas para topología. MAE y RMSE en m³/s. Agregar topologías exige indicar ponderación por muestra, rama o caso.",
        ],
      },
    ],
    assumption: [
      "Authored numerical held-out data support simulator-approximation claims only. Training-set accuracy, field transfer and browser parity are different questions with different evidence.",
      "Datos numéricos creados reservados solo respaldan aproximación del simulador. Exactitud de entrenamiento, transferencia y concordancia de navegador son preguntas distintas.",
    ],
    refs: ["sklearnleakage", "sklearnmetrics", "gilmer2017"],
    diagram: "split",
  },
  {
    id: "robustness-runtime",
    title: [
      "Degradation, target errors and runtime quality",
      "Degradación, error de objetivos y calidad de ejecución",
    ],
    paragraphs: [
      [
        "An overall average can conceal the conditions where a learned approximation becomes least useful. Resistance stress should be plotted against absolute error and physical residuals, retaining near-zero flows rather than dividing by tiny denominators. Target classification compares a predicted forward flow with the same entered target used for the reference. A false “meets target” is distinct from a false deficit. The confusion matrix therefore includes class support and recall, with undefined recall shown explicitly when no reference examples belong to a class. Thresholds are design inputs and must not be relabeled as regulated safety categories.",
        "Un promedio oculta condiciones menos útiles. Esfuerzo de resistencia se grafica frente a error absoluto y residuos, conservando caudales casi cero sin dividir por denominadores mínimos. Clasificación compara predicción con mismo objetivo. Falso cumplimiento difiere de falso déficit. Matriz incluye soporte y sensibilidad, mostrando indefinición sin ejemplos de clase. Umbrales son diseño y no categorías de seguridad normadas.",
      ],
      [
        "Runtime quality is measured through actual user operations. The scene must change because numerical or design state changes, not merely because a camera moves. Select an airway, alter a physical control, compare a baseline, change a transport source or schedule, scrub calculated time and inspect linked values. Measure the viewport allocation, interaction latency, network traffic and supported failure states. On small networks, classical solves may be competitive with or faster than a learned runtime after preprocessing and loading; report that outcome if measured. Browser and offline timings have different scopes, and a GPU batch number is not a guarantee for a mobile device.",
        "Calidad se mide usando operaciones reales. La escena cambia por estado numérico o diseño, no solo cámara. Seleccione, modifique control, compare, cambie fuente o programa, recorra tiempo e inspeccione valores. Mida espacio, latencia, tráfico y fallos. En redes pequeñas el cálculo clásico puede competir o superar inferencia después de cargar y preparar; se reporta si se mide. Tiempos locales y navegador tienen alcances distintos; lote GPU no garantiza móvil.",
      ],
    ],
    equations: [
      {
        tex: String.raw`y=\mathbf1[Q\ge t],\qquad\operatorname{recall}_c=\frac{n_{cc}}{\sum_j n_{cj}}`,
        caption: [
          "Q is forward flow and t its entered target; y is the target-status class. n_cj counts reference class c predicted as j. Recall is undefined when a reference class has zero support.",
          "Q es caudal y t objetivo; y clase de cumplimiento. n_cj cuenta clase real c predicha j. Sensibilidad es indefinida con soporte cero.",
        ],
      },
    ],
    assumption: [
      "A target-status confusion matrix is an engineering approximation diagnostic, not a mine safety classifier. Performance claims remain scoped to their recorded device, workload and timing boundaries.",
      "Confusión de objetivos diagnostica aproximación, no seguridad minera. Rendimiento queda limitado a dispositivo, carga y límites temporales registrados.",
    ],
    refs: ["sklearnmetrics", "mdnworkers", "onnxweb"],
  },
];
