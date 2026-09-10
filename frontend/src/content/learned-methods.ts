import type { ScientificSection } from "./primitives";

/** Theory transcribed from the surrogate research dossier and executable model source. */
export const learnedMethods: ScientificSection[] = [
  {
    id: "topology-mlp",
    title: [
      "Calibrated multilayer airflow surrogate",
      "Modelo multicapa de caudal calibrado",
    ],
    paragraphs: [
      [
        "The multilayer model approximates repeated resistance-to-flow calculations on one known network topology. Its input is the complete ordered vector of logarithmic resistance ratios relative to the registered baseline. Its output is a correction to the nominal unit-speed flow on each airway. This definition makes the calibration cost explicit: a nominal SciPy solution is already available to both learned methods. The model is not inferring airflow from mine sensors, and it does not discover a network from geometry. It learns how the specified numerical model responds around a supplied calibrated topology. Unsupported connectivity or equipment changes require the exact solver or a separately trained model.",
        "El modelo multicapa aproxima cálculos repetidos de resistencia a caudal en una topología conocida. Recibe el vector ordenado completo de razones logarítmicas de resistencia respecto de referencia registrada. Entrega corrección al caudal nominal a velocidad unitaria de cada galería. La definición explicita costo de calibración: ambos métodos disponen de una solución nominal SciPy. No infiere caudal desde sensores de mina ni descubre red desde geometría. Aprende cómo responde el modelo numérico alrededor de una topología calibrada suministrada. Cambios de conectividad o equipos no soportados requieren solucionador exacto o modelo entrenado separadamente.",
      ],
      [
        "The implemented dense architecture maps E input features to two hidden layers of width 128 and then to E correction outputs, where E is the number of airways in that topology. Hidden layers use the SiLU activation. A per-edge flow scale is the larger of the nominal absolute flow and five cubic meters per second; the floor prevents a nearly stagnant calibration branch from producing an unstable normalized training target. The scale is derived from the one fixed nominal calibration rather than fitted using held-out responses. Different topologies have different ordered feature spaces, which is why a topology-specific model cannot accept arbitrary imported edge counts or reorder its inputs without identity mapping.",
        "La arquitectura densa implementada transforma E entradas en dos capas ocultas de ancho 128 y luego E correcciones, donde E es número de galerías. Las capas ocultas usan activación SiLU. La escala por rama es el máximo entre caudal nominal absoluto y cinco metros cúbicos por segundo; el piso evita objetivos normalizados inestables en ramas casi estancadas. La escala proviene de calibración nominal fija, no de respuestas reservadas. Topologías diferentes tienen espacios ordenados distintos; por eso el modelo específico no acepta cantidades arbitrarias de ramas importadas ni reordena entradas sin mapear identidad.",
      ],
      [
        "Raw predictions need not conserve flow at junctions. The implementation therefore exposes a deterministic linear projection onto the null space of internal incidence. This projection removes internal imbalance in exact arithmetic without running another nonlinear ventilation solve. It is deliberately visible: the artifact retains raw flows as well as projected flows, so one can measure whether the postprocessor helps or hides a poor unconstrained prediction. Internal pressures are then reconstructed by least squares from the predicted signed branch losses and fan forcing. This reconstruction minimizes inconsistency but cannot generally make every branch pressure equation exact. A physically small residual remains a measured property, not a guaranteed neural-network output.",
        "Las predicciones crudas pueden no conservar caudal. Se expone una proyección lineal determinista al espacio nulo de incidencia interna. Elimina desequilibrio en aritmética exacta sin ejecutar otro cálculo no lineal. Es visible deliberadamente: el artefacto conserva caudales crudos y proyectados para medir si ayuda o encubre mala predicción. Luego reconstruye presiones internas por mínimos cuadrados desde pérdidas predichas y forzamiento de ventiladores. La reconstrucción minimiza inconsistencia, pero en general no vuelve exactas todas las ecuaciones de rama. Un residuo pequeño sigue siendo propiedad medida, no garantía de la red neuronal.",
      ],
      [
        "The training objective combines normalized error of projected flows, a smaller raw-correction error and a normalized branch-physics penalty. In the executable default, the raw term has weight 0.1 and the physics term weight 0.02. These weights define this method; they are not universal ventilation constants. Training and validation select a checkpoint on numerical reference labels, while a separate calibration partition supports error diagnostics and a held-out partition measures generalization to new resistance vectors. All speed-scaled versions of one resistance vector remain in the same partition. Otherwise the exact fan homogeneity would create near-duplicate train and test examples and exaggerate learned performance.",
        "La función objetivo combina error normalizado de caudales proyectados, error menor de corrección cruda y penalización física de ramas. El valor predeterminado pondera término crudo por 0,1 y físico por 0,02. Definen este método; no son constantes universales. Entrenamiento y validación seleccionan checkpoint sobre etiquetas numéricas; calibración separada sostiene diagnóstico y prueba reservada mide nuevos vectores de resistencia. Todas las versiones de velocidad de un vector permanecen en la misma partición. De otro modo, la homogeneidad exacta produciría casi duplicados entre entrenamiento y prueba y exageraría desempeño.",
      ],
      [
        "Common fan speed is handled analytically for the registered zero-boundary networks. The model predicts unit-speed flow and pressure; nonnegative speed multiplies flow by s and pressure by s². Fan-off zero output is therefore an encoded physical boundary condition, not a learned achievement. Areas and targets are excluded from hydraulic features because they do not change the implemented pressure-flow equations. They still change derived velocities and target classifications after inference. Changes outside the registered resistance range, fan curves, boundary conditions or supported topology must receive an out-of-domain response. Clipping an unsupported user input to the training range would answer a different question.",
        "La velocidad común se maneja analíticamente en redes registradas de borde cero. El modelo predice caudal y presión a velocidad unitaria; velocidad no negativa multiplica por s y s². Salida cero al apagar es condición física codificada, no logro aprendido. Áreas y objetivos se excluyen porque no cambian las ecuaciones hidráulicas. Sí cambian velocidades derivadas y clasificaciones después de inferencia. Cambios fuera del intervalo registrado, curvas, bordes o topología soportada requieren respuesta fuera de dominio. Recortar entradas no soportadas al rango de entrenamiento contestaría otra pregunta.",
      ],
      [
        "Assess the model using the same held-out inputs as the exact numerical baseline. Inspect absolute flow errors, projected and raw residuals, pressure errors, power errors and false target-satisfaction classifications, especially near a delivery boundary. Relative percentage error alone is misleading near zero flow. Browser inference adds its own export and runtime checks: preprocessing, model evaluation and postprocessing must agree with the canonical computation on identical fixtures. A small model is not automatically faster than the existing small-network solver once loading and conversion costs are counted. The benchmark reports actual measurements when available and preserves missing or failed evidence explicitly instead of converting an architecture diagram into a performance claim.",
        "Evalúe con las mismas entradas reservadas que la referencia exacta. Inspeccione errores absolutos, residuos crudos y proyectados, presión, potencia y falsas clasificaciones de cumplimiento, especialmente cerca de un objetivo. Error relativo porcentual solo engaña cerca de caudal cero. Inferir en navegador agrega verificación de exportación: preprocesamiento, evaluación y posprocesamiento deben concordar con cómputo canónico en las mismas entradas. Un modelo pequeño no es automáticamente más rápido que el solucionador al contar carga y conversión. El benchmark muestra mediciones reales disponibles y conserva evidencia faltante o fallida sin convertir un diagrama en afirmación de desempeño.",
      ],
    ],
    equations: [
      {
        tex: String.raw`x_e=\log(R_e/R_{e,0}),\quad a_e=\max(|Q_{e,0}|,5),\quad \widetilde Q=Q_0+a\odot f_\theta(x)`,
        caption: [
          "x is dimensionless log resistance ratio; R₀ and Q₀ are nominal calibration values; a is a flow scale in m³/s; fθ is the trained correction map; Q̃ is raw predicted unit-speed flow.",
          "x es razón logarítmica adimensional; R₀ y Q₀ son calibración nominal; a es escala de caudal en m³/s; fθ es mapa entrenado de corrección; Q̃ es predicción cruda a velocidad unitaria.",
        ],
      },
      {
        tex: String.raw`P=I-B_I^T(B_IB_I^T)^{-1}B_I,\qquad \widehat Q=P\widetilde Q,\quad \widehat p_I=\arg\min_p\|B_I^Tp+H_0-(R+k)\odot\widehat Q|\widehat Q|\|_2^2`,
        caption: [
          "P is the fixed conservation projector for the registered topology; Q̂ is projected flow; p̂_I minimizes branch-pressure mismatch with zero boundary pressures. Projection does not enforce the full nonlinear pressure law.",
          "P es proyector conservativo fijo de topología registrada; Q̂ es caudal proyectado; p̂_I minimiza desajuste de presión con bordes cero. Proyectar no impone toda la ley no lineal de presión.",
        ],
      },
      {
        tex: String.raw`\mathcal L=\operatorname{mean}\left[((\widehat Q-Q^*)/a)^2\right]+0.1\operatorname{mean}\left[(f_\theta-y)^2\right]+0.02\operatorname{mean}\left[(r_p/p_*)^2\right]`,
        caption: [
          "Q* is numerical reference flow; y is its normalized correction target; r_p is branch equation residual and p* is the registered pressure scale. Coefficients are this implementation’s default training choices.",
          "Q* es referencia numérica; y su corrección normalizada; r_p es residuo de rama y p* escala registrada de presión. Los coeficientes son elecciones predeterminadas de esta implementación.",
        ],
      },
    ],
    assumption: [
      "Known calibrated topology, registered resistance domain and zero fixed boundary pressures. Training labels are numerical solutions on authored networks, not measured mine observations. Approximate output must never masquerade as an accepted exact hydraulic solve.",
      "Topología calibrada conocida, dominio registrado de resistencia y bordes cero. Las etiquetas son soluciones numéricas de redes creadas, no observaciones medidas de mina. La salida aproximada no puede presentarse como cálculo hidráulico exacto aceptado.",
    ],
    refs: ["sklearnleakage", "sklearnmetrics", "pytorchsolve", "onnxweb"],
    diagram: "mlp",
  },
  {
    id: "graph-surrogate",
    title: [
      "Shared message-passing airflow surrogate",
      "Modelo de caudal por mensajes compartidos",
    ],
    paragraphs: [
      [
        "The graph model asks whether one set of learned local rules can describe response across the registered network collection. Unlike a topology-specific dense vector, its computation attaches states to actual nodes and edges and exchanges information along their connections. Edge and node encoders create latent representations from the physical features. Repeated message updates combine each airway with its endpoint states; node updates aggregate incident airway information. This architecture makes relational structure explicit, but it does not by itself prove transfer to an unseen mine. Training on several related authored networks is still different from holding out an independent surveyed site.",
        "El modelo de grafo pregunta si un conjunto de reglas locales aprendidas describe respuesta en la colección registrada. A diferencia de un vector denso específico, adjunta estados a nodos y ramas e intercambia información por conexiones. Codificadores crean representaciones latentes desde rasgos físicos. Actualizaciones repetidas combinan cada galería y sus extremos; actualizaciones nodales agregan galerías incidentes. Explicita estructura relacional, pero no prueba por sí solo transferencia a mina desconocida. Entrenar en redes creadas relacionadas sigue siendo distinto de reservar un sitio levantado independiente.",
      ],
      [
        "The current executable network uses hidden width 32 and four message-passing steps. An edge encoder receives the changing logarithmic resistance ratio plus twelve static physical and role features. The node encoder receives four static features. Shared edge updates consume the current edge state and both endpoint states. Shared node updates consume the current node state and separate incoming and outgoing aggregates. Residual updates use a factor of 0.25. Finally the readout combines an edge with its endpoint states to predict a normalized unit-speed flow correction. Dense incidence products implement aggregation so the training path avoids nondeterministic scatter accumulation.",
        "La red ejecutable usa ancho oculto 32 y cuatro pasos de mensajes. El codificador de rama recibe razón logarítmica cambiante y doce rasgos físicos y de rol. El nodal recibe cuatro rasgos estáticos. La actualización compartida de rama consume estado actual y ambos extremos. La nodal consume estado actual y agregados entrantes y salientes separados. Actualizaciones residuales usan factor 0,25. La lectura combina rama y extremos para predecir corrección normalizada a velocidad unitaria. Productos densos de incidencia implementan agregación, evitando acumulación dispersa no determinista en entrenamiento.",
      ],
      [
        "The static feature construction reveals what prior knowledge the model receives. Edge features include a scaled logarithm of nominal resistance, nominal flow, flow scale, endpoint pressures, nominal fan forcing, scaled fan coefficient and one-hot airway role. Node features identify pressure boundaries, normalized nominal pressure and normalized directed degrees. Incoming and outgoing aggregates are degree-normalized in the implementation. Nominal flow and pressure are solver-derived calibration inputs and are disclosed as such; they are not target outputs from the held-out perturbation. Coordinates and targets are not smuggled into hydraulic prediction as if they caused a resistance-dependent flow change.",
        "La construcción revela conocimiento previo recibido. Rasgos de rama incluyen logaritmo escalado de resistencia nominal, caudal nominal, escala, presiones extremas, fuente nominal, coeficiente de ventilador escalado y rol codificado. Rasgos nodales identifican bordes, presión nominal normalizada y grados dirigidos normalizados. Agregados se normalizan por grado. Caudal y presión nominales provienen de calibración del solucionador y se declaran; no son respuestas objetivo de perturbación reservada. Coordenadas y objetivos no se introducen como si causaran cambios hidráulicos dependientes de resistencia.",
      ],
      [
        "The graph and dense models share the same deterministic postprocessor and comparison basis. Raw corrections are converted to physical flows, projected to conserve internal flow and used to reconstruct pressures. They also share the supervised and physical-residual objective, nominal calibration and exact common-speed scaling. This alignment makes an architecture comparison meaningful: differences are not caused by supplying one method an easier reference or silently solving the nonlinear equations after only one model. Raw versus projected errors remain separately inspectable. Conservation projection is an algebraic constraint, while pressure closure and prediction accuracy remain measured performance quantities.",
        "Grafo y modelo denso comparten posprocesamiento y base de comparación. Correcciones crudas pasan a caudal físico, proyección conservativa y reconstrucción de presión. Comparten objetivo supervisado y físico, calibración nominal y homogeneidad de velocidad. Alinear permite comparar arquitecturas: diferencias no provienen de dar referencia más fácil a un método ni resolver ecuaciones no lineales solo después de uno. Errores crudos y proyectados siguen inspeccionables. La conservación es restricción algebraica; cierre de presión y exactitud siguen siendo magnitudes medidas.",
      ],
      [
        "Permutation behavior is an important implementation check. Renumbering nodes or changing edge storage order while preserving connectivity and remapping all physical features should only reorder the corresponding predictions. It should not create a different mine response. This property tests whether an accidental row-position dependence entered feature construction, aggregation or export. It is weaker than topology generalization: equivariance on the same graph does not establish accuracy on a new graph. The deployed domain gate therefore uses supported physical identities and parameter ranges, and an imported or topologically edited network stays with the exact engine unless a registered model actually covers it.",
        "La permutación es prueba importante. Renumerar nodos o reordenar ramas conservando conexiones y remapeando rasgos solo debe reordenar predicciones. No debe crear respuesta de mina diferente. Prueba dependencia accidental de posición en rasgos, agregación o exportación. Es más débil que generalización topológica: equivariancia en el mismo grafo no establece exactitud en uno nuevo. Por eso el control de dominio usa identidades físicas soportadas e intervalos, y una red importada o editada topológicamente utiliza motor exacto salvo cobertura real de modelo registrado.",
      ],
      [
        "Evaluate graph behavior across physical regimes, not only an overall average. Shared-return restrictions, working restrictions and distributed resistance changes stress different communication pathways. Near-stagnant branches expose the weakness of relative error metrics; limited message depth can restrict how far a local intervention influences the learned representation. A separate held-out-family experiment is needed before claiming structural transfer, and related authored cases must not be treated as independent sites. Browser export adds a further numerical comparison against the canonical model. Published matrices should retain every eligible sample, failed prediction and unsupported cell, so a good-looking aggregate cannot erase the conditions in which the approximation degrades.",
        "Evalúe por regímenes, no solo promedio. Restricciones de retorno compartido, labores y resistencia distribuida estresan vías de información distintas. Ramas casi estancadas exponen debilidad del error relativo; profundidad limitada de mensajes restringe cuánto influye una intervención local. Se necesita experimento de familia completa reservada antes de afirmar transferencia estructural, y casos creados relacionados no son sitios independientes. Exportar al navegador agrega comparación con modelo canónico. Matrices deben conservar cada muestra elegible, fallo y celda no soportada, sin permitir que promedio atractivo borre degradaciones.",
      ],
    ],
    equations: [
      {
        tex: String.raw`h_e^{(\ell+1)}=h_e^{(\ell)}+0.25\,\phi_\theta(h_e^{(\ell)},h_u^{(\ell)},h_v^{(\ell)}),\quad h_v^{(\ell+1)}=h_v^{(\ell)}+0.25\,\psi_\theta(h_v^{(\ell)},\overline h_{\mathrm{in}},\overline h_{\mathrm{out}})`,
        caption: [
          "h_e and h_v are latent edge and node states; u,v are endpoints; φ and ψ are shared learned updates; incoming and outgoing bars are degree-normalized aggregates. The implementation uses four updates at hidden width 32.",
          "h_e y h_v son estados latentes de ramas y nodos; u,v son extremos; φ y ψ son actualizaciones compartidas; barras entrante y saliente son agregados normalizados por grado. Se usan cuatro actualizaciones de ancho 32.",
        ],
      },
      {
        tex: String.raw`\delta_e=\rho_\theta(h_e^{(4)},h_u^{(4)},h_v^{(4)}),\quad\widehat Q(s)=sP(Q_0+a\odot\delta),\quad\widehat p(s)=s^2\widehat p(1)`,
        caption: [
          "ρ is the learned edge readout; δ is normalized flow correction; Q₀,a and P are the disclosed nominal calibration, flow scale and conservation projector; s is supported common speed. Pressure is reconstructed at unit speed before scaling.",
          "ρ es lectura aprendida; δ corrección normalizada; Q₀,a y P son calibración, escala y proyector declarados; s es velocidad común soportada. Se reconstruye presión unitaria antes de escalar.",
        ],
      },
      {
        tex: String.raw`f_\theta(\Pi_VG\Pi_E^T,\Pi_Ex)=\Pi_E f_\theta(G,x)`,
        caption: [
          "Schematic permutation-equivariance condition: G denotes graph connectivity with all features consistently remapped; Π_V and Π_E reorder nodes and edges. Equivalent representations should produce equivalently reordered edge predictions.",
          "Condición esquemática de equivariancia: G denota conectividad con rasgos remapeados; Π_V y Π_E reordenan nodos y ramas. Representaciones equivalentes deben producir predicciones reordenadas equivalentemente.",
        ],
      },
    ],
    assumption: [
      "Shared graph weights do not establish cross-mine generalization. Registered topology support, calibrated nominal features, held-out error and physical residual checks are necessary. The method is a steady numerical surrogate, not a learned transient or CFD model.",
      "Pesos compartidos no establecen generalización entre minas. Son necesarios soporte topológico registrado, rasgos nominales calibrados, error reservado y residuos físicos. Es modelo numérico estacionario, no transiente aprendido ni CFD.",
    ],
    refs: ["gilmer2017", "battaglia2018", "ashraf2024", "sklearnleakage"],
    diagram: "graph",
  },
];
