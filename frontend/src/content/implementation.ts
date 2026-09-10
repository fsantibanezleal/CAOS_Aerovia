import type { ScientificSection } from "./primitives";

export const implementationSections: ScientificSection[] = [
  {
    id: "ingestion",
    title: [
      "Ingestion and project boundaries",
      "Ingreso y límites del proyecto",
    ],
    paragraphs: [
      [
        "A network import is accepted as a complete physical object before it replaces the current design. Validation checks schema identity, finite values, unique identifiers, endpoint references, allowable airway roles, positive resistance and area, fan parameters and pressure anchoring. The active graph must have an open path from every node to a fixed-pressure boundary. An imported project additionally carries operating controls and comparison state. Any saved comparison is recomputed from its inputs rather than trusting supplied numerical arrays. This prevents a malformed or stale project from attaching a convincing result to a different network. Names and source notes remain descriptive metadata; they are never executed as markup or code.",
        "Una importación se acepta como objeto físico completo antes de reemplazar diseño. Se verifican esquema, valores finitos, identificadores únicos, extremos, roles permitidos, resistencia y área positivas, parámetros de ventilador y anclaje de presión. Cada nodo debe tener camino abierto a presión fija. Un proyecto agrega controles y comparación; esta última se recalcula desde entradas, sin confiar en arreglos numéricos suministrados. Así se evita adjuntar resultado convincente a una red diferente. Nombres y notas son metadatos, nunca se ejecutan como marcado o código.",
      ],
      [
        "The scientific pipeline uses the same SI network meaning as the browser. Its ingestion stage records the source identity; preprocessing derives incidence matrices and calibration arrays; later stages consume those identities rather than guessing compatibility from a filename. A published result joins the network, options, method and numerical outputs. The browser receives compact verified artifacts but treats new user data as local input. Invalid imports preserve the previous valid state and give a specific error. A large or unsupported network receives an explicit admission failure; silently dropping edges, changing units or installing an arbitrary pressure boundary would alter the question the user asked.",
        "La cadena científica conserva significado SI del navegador. Ingreso registra identidad; preprocesamiento deriva incidencias y calibración; etapas posteriores consumen identidades y no adivinan compatibilidad por nombre. Un resultado publicado reúne red, opciones, método y salidas. El navegador recibe artefactos verificados compactos y trata nuevos datos como entrada local. Importaciones inválidas preservan estado válido y muestran error específico. Red grande o no soportada recibe rechazo explícito; eliminar ramas, cambiar unidades o instalar presión arbitraria alteraría la pregunta.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\operatorname{accept}(G)=\operatorname{schema}(G)\land\operatorname{finite}(G)\land\operatorname{unique}(G)\land\operatorname{anchored}(G)`,
        caption: [
          "G is the complete network. Acceptance combines structural, numeric, identifier and active-pressure-connectivity checks; no single check substitutes for the others.",
          "G es red completa. Aceptar combina estructura, números, identificadores y conectividad activa de presión; ningún control sustituye los demás.",
        ],
      },
    ],
    symbols: [
      [
        "A source identity binds the actual bytes or canonical structured input to an artifact.",
        "Una identidad vincula bytes reales o entrada estructurada canónica al artefacto.",
      ],
      [
        "An option identity includes speed, resistance scaling and individual overrides.",
        "La identidad de opciones incluye velocidad, escalamiento y cambios individuales.",
      ],
    ],
    assumption: [
      "Input validation establishes well-formed model data. It cannot establish survey accuracy, legal targets or calibrated resistance.",
      "Validar establece datos bien formados. No establece exactitud de levantamiento, objetivos legales ni resistencia calibrada.",
    ],
    refs: ["mcpherson1993", "mdnworkers"],
  },
  {
    id: "geometry",
    title: [
      "Geometry, editing and physical semantics",
      "Geometría, edición y significado físico",
    ],
    paragraphs: [
      [
        "Network geometry is stored in meters as x, y and elevation z. An airway connects two junction identifiers; moving either junction changes the represented centerline and the corresponding geometric length. A drawing edit is deliberately distinguished from aerodynamic recalibration. Entered resistance remains the resistance unless the user changes it. Area controls mean velocity and transport volume. A measured length can override the straight-line distance for transport when a real airway follows a longer route. These independent inputs are visible because a geometrically plausible design does not uniquely determine roughness, local losses or the effective fan-system efficiency.",
        "La geometría se almacena en metros como x, y y cota z. Una galería conecta identificadores; mover un extremo cambia eje y longitud representada. Editar dibujo se distingue de recalibrar aerodinámica. La resistencia ingresada permanece salvo cambio explícito. Área controla velocidad media y volumen de transporte. Una longitud medida sustituye distancia recta cuando la galería real recorre más. Son entradas independientes visibles porque un diseño plausible no determina rugosidad, pérdidas locales ni eficiencia efectiva.",
      ],
      [
        "The editor must preserve graph identity while changing topology. Connecting junctions introduces a real branch with physical parameters; deleting or closing one changes connectivity and may invalidate pressure anchoring. Undo and saved comparisons preserve complete states rather than only coordinates. Display operations such as level separation or camera orientation do not change physical coordinates, resistance or results. Conversely, physical geometry edits must invalidate geometric transit and transport results. A linked airway selection should identify the same object in the scene and numerical outputs, even after the view rotates or the network changes. The meaningful visualization is the coordinated model state, not camera motion alone.",
        "Editar debe preservar identidad al cambiar topología. Conectar introduce rama con parámetros; eliminar o cerrar modifica conectividad y puede invalidar anclaje. Deshacer y comparar conservan estados completos, no solo coordenadas. Separación visual de niveles y cámara no modifican coordenadas físicas, resistencia ni resultados. En cambio, editar geometría física invalida tránsito y transporte geométrico. Selección vinculada identifica mismo objeto en escena y números pese a rotación o cambio de red. La visualización significativa es el estado coordinado, no solo movimiento de cámara.",
      ],
    ],
    equations: [
      {
        tex: String.raw`L_e=\sqrt{(x_v-x_u)^2+(y_v-y_u)^2+(z_v-z_u)^2},\qquad V_e=A_eL_e,\qquad u_e=Q_e/A_e`,
        caption: [
          "L_e is straight-line represented length (m), endpoints u,v have coordinates x,y,z (m), A_e is area (m²), V_e is volume (m³), Q_e is signed flow (m³/s) and u_e is signed mean velocity (m/s). A measured length may replace L_e for transport.",
          "L_e es longitud recta representada (m), u,v tienen coordenadas x,y,z (m), A_e es área (m²), V_e volumen (m³), Q_e caudal (m³/s) y u_e velocidad media con signo (m/s). Longitud medida puede sustituir L_e para transporte.",
        ],
      },
    ],
    assumption: [
      "Coordinates are not a mine survey unless the imported source establishes that provenance. Visual level separation is display-only. Resistance never follows a geometry edit by an undisclosed rule.",
      "Coordenadas no son levantamiento salvo procedencia que lo establezca. Separación visual es solo presentación. Resistencia nunca cambia por regla oculta al editar geometría.",
    ],
    refs: ["mcpherson1993", "nistcontam"],
    diagram: "network",
  },
  {
    id: "browser-engine",
    title: [
      "Browser solve and result synchronization",
      "Cálculo de navegador y sincronización",
    ],
    paragraphs: [
      [
        "The live engine validates a complete network and options snapshot, assembles signed branches, checks open pressure connectivity and normalizes the problem before Newton iteration. Pressure continuation uses seven smoothing levels ending in the original law. Dense pivoted linear solves provide each nodal update; thirty-two possible half-step backtracks and a two-hundred-and-forty-update total cap bound work. Final quantities are calculated from the accepted unsmoothed state. Worker requests carry identities so an older calculation cannot overwrite newer input. Heavy sweeps use the same immutable snapshot and return method-specific results; geometry and control state must not become detached from the numerical arrays they display.",
        "El motor valida instantánea completa, ensambla ramas, verifica conectividad y normaliza antes de Newton. Usa siete niveles de suavizado terminando en ley original. Soluciones densas con pivoteo dan actualización; treinta y dos retrocesos y límite total de doscientas cuarenta actualizaciones acotan trabajo. Magnitudes finales usan estado aceptado sin suavizar. Solicitudes del trabajador tienen identidad para que cálculo viejo no reemplace entrada nueva. Barridos usan instantánea inmutable y devuelven resultados propios; geometría y controles no pueden desvincularse de arreglos mostrados.",
      ],
      [
        "A result has both a numerical state and a usability state. While a new request is pending, the interface must not imply that old flow values belong to the new network. A rejected solve should explain disconnected boundaries, numerical conditioning or unsupported fan operation and suppress dependent scientific views. Local computation does not imply unlimited size: admission bounds protect both memory and responsiveness. Accessible tabular output remains important when WebGL is unavailable. Performance must be measured after loading, across actual parameter changes and supported devices; using a worker is an architectural isolation measure, not proof that a particular interaction is fast.",
        "Un resultado tiene estado numérico y de uso. Mientras se calcula, la interfaz no debe implicar que valores viejos pertenecen a red nueva. Rechazar debe explicar desconexión, condicionamiento o ventilador no soportado y suprimir vistas dependientes. Cálculo local no implica tamaño ilimitado: admisión protege memoria y respuesta. Salida tabular accesible importa sin WebGL. Se mide rendimiento después de cargar y durante cambios reales; usar trabajador aísla ejecución, no prueba rapidez.",
      ],
    ],
    equations: [
      {
        tex: String.raw`r_m\le10^{-6}\ \mathrm{m^3/s},\quad r_p\le10^{-5}\ \mathrm{Pa},\quad \mathrm{visible\ result\ identity}=\mathrm{active\ input\ identity}`,
        caption: [
          "r_m and r_p are maximum absolute physical residuals. A displayed current result must match the active input snapshot in addition to meeting numerical acceptance.",
          "r_m y r_p son residuos físicos absolutos máximos. Un resultado actual mostrado debe coincidir con entrada activa y cumplir aceptación numérica.",
        ],
      },
    ],
    assumption: [
      "The browser solves the bounded steady model. Worker isolation does not provide field calibration, unlimited graph size or deterministic wall-clock latency.",
      "El navegador resuelve modelo estacionario acotado. Aislar trabajador no da calibración de terreno, tamaño ilimitado ni latencia determinista.",
    ],
    refs: ["mdnworkers", "scipytrf"],
  },
  {
    id: "reference-engine",
    title: [
      "Independent nonlinear reference",
      "Referencia no lineal independiente",
    ],
    paragraphs: [
      [
        "The canonical CPU reference formulates a mixed vector of normalized branch flows and internal pressures and calls SciPy trust-region reflective least squares with an analytical Jacobian. Its residual concatenates internal flow balance and signed branch pressure closure. Pressure scale is at least one hundred pascals; flow scale is at least ten cubic meters per second and reflects representative effective resistance. A linear resistance approximation initializes the nonlinear solve. Function, parameter and gradient stopping tolerances are 10⁻¹³, with at most 1,500 function evaluations. Those are reference implementation settings, distinct from the browser continuation settings and the final physical acceptance thresholds.",
        "La referencia CPU forma vector mixto normalizado de caudales y presiones y llama mínimos cuadrados de región de confianza SciPy con jacobiano analítico. Residuo concatena balance interno y cierre de presión con signo. Escala de presión es al menos cien pascales y de caudal al menos diez metros cúbicos por segundo, considerando resistencia representativa. Aproximación lineal inicializa. Tolerancias de función, parámetros y gradiente son 10⁻¹³; máximo 1.500 evaluaciones. Son decisiones de referencia, distintas del navegador y umbrales físicos finales.",
      ],
      [
        "The reference is useful because it can run independently of the application. It accepts authored or imported SI networks, produces complete result arrays and exports evidence that another implementation can check. Analytic fixtures test series/parallel behavior, fan affinity, pressure-offset invariance and passive orientation reversal. A separate verifier recomputes physical residuals from the exported arrays. Numerical optimizer success does not override a failed physical check. Comparisons to browser, CUDA and learned methods use identical network inputs and distinguish absolute errors from normalization choices. This makes the reference a reproducibility anchor without presenting it as observed mine truth.",
        "La referencia sirve independientemente de la aplicación. Acepta redes SI creadas o importadas, produce arreglos completos y exporta evidencia comprobable. Casos analíticos prueban serie/paralelo, afinidad, invariancia e inversión pasiva. Un verificador recalcula residuos desde salidas. Éxito del optimizador no invalida fallo físico. Comparaciones con navegador, CUDA y métodos aprendidos usan entradas idénticas y separan error absoluto y normalización. Es ancla reproducible sin presentarse como verdad observada de mina.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\min_{q,p}\frac12\left\|\begin{bmatrix}B_Iq/Q_*\\ [B^Tp+H-(R+k)q|q|]/P_*\end{bmatrix}\right\|_2^2`,
        caption: [
          "q,p are flow and pressure unknowns; Q*,P* are normalization scales; B_I and B encode internal/full incidence. Physical residuals are recomputed without normalization after solving.",
          "q,p son incógnitas; Q*,P* son escalas; B_I y B representan incidencia interna/completa. Se recalculan residuos físicos sin normalización al terminar.",
        ],
      },
    ],
    assumption: [
      "A small least-squares objective is not sufficient acceptance. Both SI residuals and supported fan operation must pass; agreement with another solver is numerical verification.",
      "Objetivo pequeño no basta. Ambos residuos SI y operación soportada deben pasar; concordancia entre motores es verificación numérica.",
    ],
    refs: ["scipytrf", "mcpherson1993"],
  },
  {
    id: "cuda-ensemble",
    title: [
      "CUDA batches and evidence export",
      "Lotes CUDA y exportación de evidencia",
    ],
    paragraphs: [
      [
        "The ensemble stage creates seeded float64 lognormal resistance arrays and passes identical arrays to either NumPy CPU or PyTorch CUDA batches. Chunking limits each dense nonlinear solve batch to at most 256 realizations. Every sample records convergence and exact SI residuals; failed indices remain visible and canonical publication rejects an incomplete accepted ensemble. Eight saved resistance draws per authored case are independently solved by SciPy in the nominal verification bake. The export records device, hardware, software, sample count, seed, spread, dtype and elapsed measurements. A new run may choose another supported sample count without changing the meaning of the input distribution.",
        "La etapa crea arreglos lognormales float64 con semilla y pasa los mismos a NumPy CPU o PyTorch CUDA. Procesa hasta 256 realizaciones por lote denso. Cada muestra registra convergencia y residuos SI; índices fallidos permanecen visibles y publicación canónica rechaza conjuntos incompletos. Ocho realizaciones guardadas por caso se resuelven SciPy independientemente en verificación nominal. Se registra dispositivo, hardware, software, cantidad, semilla, dispersión, precisión y tiempos. Otra corrida puede elegir cantidad soportada distinta sin cambiar significado de distribución.",
      ],
      [
        "Output publication is transactional. A candidate directory is written and verified before it replaces the prior canonical artifacts, so interruption does not turn a partially generated catalog into the public truth. Hashes bind payload bytes, input identity and implementation source. The website build copies those committed outputs; it does not rerun randomness or training during deployment. Conditional intervals remain attached to the exact network and options of the bake. A change in any relevant input requires a new local computation, and a CPU fallback is labeled CPU rather than being counted as GPU execution.",
        "Publicar salidas es transaccional. Se escribe y verifica candidato antes de reemplazar artefactos anteriores, evitando que interrupción convierta catálogo parcial en verdad pública. Hashes vinculan bytes, identidad y código. Construir sitio copia salidas registradas, sin repetir azar ni entrenamiento durante despliegue. Intervalos siguen vinculados a red y opciones exactas. Cambiar entrada relevante requiere nuevo cálculo; alternativa CPU se etiqueta CPU, sin contarla como GPU.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\mathrm{candidate}\xrightarrow{\mathrm{schema+hash+physics}}\mathrm{verified}\xrightarrow{\mathrm{atomic\ publish}}\mathrm{canonical}`,
        caption: [
          "The publication gate verifies structure, byte identity and physical equations before a candidate becomes canonical evidence.",
          "El control de publicación verifica estructura, identidad de bytes y ecuaciones antes de convertir candidato en evidencia canónica.",
        ],
      },
    ],
    assumption: [
      "GPU timing includes the recorded operation and device only. It is not a browser frame-rate measurement or evidence of a universal acceleration ratio.",
      "Tiempo GPU corresponde solo a operación y dispositivo registrados. No mide cuadros del navegador ni demuestra aceleración universal.",
    ],
    refs: ["pytorchsolve", "numpylognormal"],
    diagram: "uncertainty",
  },
  {
    id: "learned-pipeline",
    title: [
      "Training, exports and domain checks",
      "Entrenamiento, exportación y dominio",
    ],
    paragraphs: [
      [
        "The learned pipeline separates ingestion, preprocessing, dataset partitioning, feature construction, training, inference, evaluation, export and validation. A topology-specific MLP and a shared graph model consume identical nominal calibration and numerical labels. The first uses two hidden layers of width 128; the second uses width 32 with four message steps. Both return raw and conservation-projected flows and least-squares reconstructed pressures. Checkpoints must retain the selected model state and enough optimizer and random state to resume training. The registered export records feature order, physical topology identity, parameter bounds, calibration identity, source version and actual model bytes.",
        "La cadena separa ingreso, preprocesamiento, partición, rasgos, entrenamiento, inferencia, evaluación, exportación y validación. MLP específico y grafo compartido consumen calibración y etiquetas idénticas. El primero usa dos capas de ancho 128; el segundo ancho 32 y cuatro pasos. Ambos entregan caudales crudos/proyectados y presiones reconstruidas. Checkpoints retienen estado elegido y suficiente estado de optimización y azar para reanudar. Registro de exportación conserva orden de rasgos, topología física, límites, calibración, versión y bytes reales.",
      ],
      [
        "Live inference is accepted only for a registered compatible physical network and supported resistance factors and speed. Output status distinguishes unavailable assets, out-of-domain input and runtime failure from an approximate prediction that was computed successfully. The exact solver’s convergence flag cannot be repurposed as a generic model-availability flag: a learned prediction may be finite and informative while failing exact pressure closure. Export parity compares canonical PyTorch, independent postprocessing and the actual browser runtime on the same fixtures. Learned accuracy, loading cost and inference latency are taken from their own evidence records; a successful file conversion alone establishes none of them.",
        "Inferencia en vivo se acepta solo para red física compatible registrada y factores y velocidad soportados. Estado distingue activos ausentes, fuera de dominio y fallo de predicción aproximada calculada. Convergencia exacta no se reutiliza como disponibilidad: una predicción finita puede informar y fallar cierre exacto. Concordancia compara PyTorch canónico, posprocesamiento independiente y navegador real en mismas entradas. Exactitud, carga y latencia provienen de evidencia propia; convertir archivo no establece ninguna.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\mathrm{eligible}=\mathrm{registered\ topology}\land\mathrm{supported\ physics}\land\mathrm{bounded\ parameters}\land\mathrm{verified\ export}`,
        caption: [
          "Eligibility is a conjunction of model identity, physical assumptions, parameter bounds and an actual verified export. A matching case name alone is insufficient.",
          "Elegibilidad exige identidad, supuestos, límites y exportación real verificada. Coincidir en nombre no basta.",
        ],
      },
    ],
    assumption: [
      "Model code describes an executable method; only a trained checkpoint, complete evaluation and runtime parity justify a delivered learned tool. Authored numerical labels do not confer field validation.",
      "Código describe método ejecutable; solo checkpoint entrenado, evaluación completa y concordancia justifican herramienta entregada. Etiquetas numéricas creadas no dan validación de terreno.",
    ],
    refs: ["gilmer2017", "sklearnleakage", "onnxweb"],
    diagram: "graph",
  },
  {
    id: "transport-engine",
    title: [
      "Transport integration and admission limits",
      "Integración de transporte y límites",
    ],
    paragraphs: [
      [
        "Transport prepares fixed airway volumes, source locations, sorted operating events and requested output frames. Each flow state is solved before integration begins; unsupported hydraulics stop the run. Six cells per airway and 121 frames are defaults, with supported ranges of one to sixteen cells and at most 301 frames. Up to thirty-two releases and twenty-four scheduled changes are accepted. Duration is bounded at 86,400 seconds. The integrator estimates segmented work before stepping and rejects more than 200,000 time steps or 40 million cell steps. It never silently coarsens a user’s discretization to make the workload fit.",
        "Transporte prepara volúmenes fijos, fuentes, eventos ordenados y cuadros. Resuelve cada estado antes; hidráulica no soportada detiene. Predeterminados son seis celdas y 121 cuadros, rango una a dieciséis celdas y hasta 301 cuadros. Acepta hasta treinta y dos fuentes y veinticuatro cambios. Duración máxima 86.400 segundos. Estima trabajo segmentado y rechaza más de 200.000 pasos o cuarenta millones de pasos de celda. Nunca reduce silenciosamente discretización para ajustar carga.",
      ],
      [
        "Every requested frame exposes concentration arrays and an independent mass ledger. Integration aligns with source and schedule events, maintains mass inside closed branches and uses clean external reservoirs at pressure boundaries. The stability bound is 0.45 and an optional smaller maximum time step supports convergence checks. Area changes during a schedule are rejected because they would change storage volumes. Route analysis uses positive solved flow directions and nominal volume-over-flow weights, with explicit unreachable states and recirculation components. Its time weights are descriptive airflow quantities, separate from the concentration integration and from any human movement model.",
        "Cada cuadro expone concentraciones y registro independiente de masa. Integración coincide con eventos, mantiene masa en ramas cerradas y usa reservorios limpios. Límite de estabilidad es 0,45; paso máximo menor permite convergencia. Cambiar área durante programa se rechaza porque cambia almacenamiento. Rutas usan sentido real, pesos volumen/caudal, inaccesibilidad y recirculación explícitas. Tiempos describen aire, separados de integración de concentración y movimiento humano.",
      ],
    ],
    equations: [
      {
        tex: String.raw`m^{(1)}=m^n+\Delta t F(m^n),\qquad m^{n+1}=\tfrac12m^n+\tfrac12[m^{(1)}+\Delta t F(m^{(1)})]`,
        caption: [
          "m is the cell-mass vector (mg), F is conservative flux plus source/loss (mg/s), and Δt is the admitted step (s). Both stages contribute consistently to escaped and removed mass.",
          "m es vector de masa (mg), F es flujo conservativo y fuentes/pérdidas (mg/s), Δt es paso admitido (s). Ambas etapas contribuyen coherentemente a masa escapada y removida.",
        ],
      },
    ],
    assumption: [
      "Explicit fixed-volume passive transport. The work bound is a responsiveness contract; rejected runs need a deliberate duration or resolution change, not an undisclosed numerical shortcut.",
      "Transporte pasivo explícito de volumen fijo. Límite de trabajo protege respuesta; rechazar requiere cambiar duración o resolución deliberadamente, sin atajo oculto.",
    ],
    refs: ["nistcontam", "clawpackadvection", "networkxpaths"],
    diagram: "transport",
  },
  {
    id: "release-runtime",
    title: [
      "Reproducible deployment and runtime evidence",
      "Despliegue reproducible y evidencia de ejecución",
    ],
    paragraphs: [
      [
        "The first application is a static public deployment because its interactive numerical lane runs in the browser and heavy computation is prepared locally. GitHub Pages serves the versioned application, compact scientific outputs and compatible model assets at the configured custom domain. No server process is required to solve a visitor’s network. Build and publication are separate from scientific baking: a deployment copies reviewed committed artifacts and checks their identities. The release record binds application version and source commit to the catalog identity, while a runtime asset manifest records each served file’s byte count and SHA-256 digest.",
        "La primera aplicación es estática pública porque cálculo interactivo corre en navegador y cómputo pesado se prepara localmente. GitHub Pages sirve aplicación versionada, salidas compactas y modelos compatibles en dominio propio. No se requiere proceso servidor para resolver red del visitante. Construir y publicar es distinto de recalcular ciencia: copia artefactos revisados y comprueba identidad. Registro vincula versión y commit con catálogo; manifiesto registra tamaño y SHA-256 de cada archivo servido.",
      ],
      [
        "Deployment verification fetches the real HTTPS surface and checks every manifested runtime file against the expected source identity, not only the landing page’s status code. Browser journeys then exercise user-visible operations, both languages, themes and responsive layouts. The canonical numerical artifacts are checked for unintended changes during CI. A scheduled monitor repeats live integrity and interaction checks after release. This establishes what was actually served and exercised, while local performance evidence remains scoped to its recorded machine and browser. User project data is local to the client unless the user explicitly exports it through the provided file workflow.",
        "La verificación obtiene HTTPS real y comprueba cada archivo frente a identidad esperada, no solo estado de portada. Recorridos ejercitan operaciones visibles, idiomas, temas y tamaños. CI comprueba que artefactos canónicos no cambien accidentalmente. Un monitor programado repite integridad e interacción. Establece qué se sirvió y ejercitó; rendimiento local sigue limitado a máquina y navegador registrados. Datos de proyecto permanecen en cliente salvo exportación explícita mediante archivos.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\forall f\in\mathcal A:\quad\mathrm{SHA256}(f_{\mathrm{HTTPS}})=\mathrm{SHA256}(f_{\mathrm{release}}),\quad |f_{\mathrm{HTTPS}}|=|f_{\mathrm{release}}|`,
        caption: [
          "𝒜 is the runtime asset set, f is a served file and |f| is byte length. Integrity checks bind actual HTTPS content to the verified release, not just a successful build badge.",
          "𝒜 es conjunto de activos, f es archivo servido y |f| es tamaño en bytes. Integridad vincula HTTPS real con versión verificada, no solo insignia de construcción exitosa.",
        ],
      },
    ],
    assumption: [
      "Static hosting serves the application and committed evidence. It does not provide online CUDA, shared project storage or a remotely operated mine-control service.",
      "Alojamiento estático sirve aplicación y evidencia. No ofrece CUDA en línea, almacenamiento compartido ni control remoto de mina.",
    ],
    refs: ["githubpages", "mdnworkers", "onnxweb"],
    diagram: "pipeline",
  },
];
