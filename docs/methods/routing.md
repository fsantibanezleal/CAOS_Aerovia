# Directed airflow paths / Rutas dirigidas de aire

## English: the operation

`frontend/src/engine/routing.ts` analyses the directed graph produced by the actual steady airflow solution. It answers which nodes a parcel can reach from a selected source, identifies a path with the smallest sum of nominal airway transit times, and reports internal directed recirculation components. Changing a resistance, fan operating state or closure can change the graph, path and transit weights.

This is an air-network operation. It does not describe pedestrian access, an evacuation route, an approved ventilation plan or the earliest detectable tracer arrival. The transport tool calculates a separate dispersive concentration history; this route tool calculates a graph metric.

## Directed edges and dimensional meaning

For each solved branch:

```text
Q > 0: declared from -> to
Q < 0: declared to   -> from
Q = 0 or closed: no active directed edge

velocity = abs(Q) / A                    [m/s]
length   = explicit L or endpoint norm   [m]
tau      = A*L / abs(Q) = L/velocity      [s]
```

Area A includes the current override. Length uses the same validated geometry convention as transport. An explicit `edgeLengths` value is useful for a bent physical airway represented by two graph endpoints. Coincident coordinates require an override. Lengths below 10⁻⁶ m are rejected; explicit overrides cannot exceed 10⁷ m. Changing displayed camera perspective never changes L.

The edge result's `flow` is an absolute magnitude; its `upstreamNodeId` and `downstreamNodeId` carry direction. The embedded `flow:Result` retains the original signed network edge array. The `nominalTransitSeconds` field is null for inactive edges, never an invented large duration. Exactly zero flow is the inactive criterion; small nonzero solved flows remain active and may have very large nominal transit times. Their presence must not be presented as strong ventilation.

`outgoingFraction` is `abs(Q_e)/sum_out(abs(Q))` at the upstream node. It describes the share of outgoing airflow assigned to that branch, not the probability that a person chooses it or the fraction of a whole tracer pulse eventually observed there. At an internal junction, the transport model uses this same instantaneous allocation for arriving tracer mass flux.

## Shortest nominal transit and boundary semantics

Dijkstra's algorithm minimises the sum of nonnegative `tau` over directed edges. The bounded implementation scans at most 120 nodes, with adjacency lists for at most 240 edges. It uses no graph-library runtime dependency. The algorithm choice follows the ordinary nonnegative weighted shortest-path contract. [NetworkX shortest-path algorithm documentation](https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html)

Starting from the selected node, the algorithm relaxes outgoing directed branches and records each reached node's minimum accumulated weight and predecessor edge. A pressure boundary terminates further traversal, except when it is the selected source. This matches transport's clean external reservoir: an air parcel arriving outside has left the model and does not pass into an unrelated branch sharing that external reference.

For a requested destination, predecessor reconstruction yields ordered node and edge identifiers. The path returns summed physical length, summed nominal transit, and the minimum edge flow magnitude along that selected path. `minimumFlow` is a path summary; it is not a maximum-flow network capacity calculation.

An unreachable destination produces `path:null` and `reachable:false` with null distance. If source equals destination, the path contains that node, no edges, zero length, zero transit and zero minimum flow. The result uses finite numbers or explicit nulls, so JSON export does not convert hidden infinities into ambiguous values.

## Internal recirculation

Tarjan's strongly connected component algorithm runs on active directed edges after excluding all pressure-boundary nodes. A component with more than one node is reported with its internal edge IDs. Within such a component, directed paths exist between all member nodes. A fan can create a circulation loop even when its net exchange through an external connection is zero.

This is a topological finding. It does not quantify exchange efficiency, contaminant trapping, a complete residence-time distribution or a safety category. The transport calculation can then test a chosen source and operating schedule on that component. Boundary-to-boundary loops are excluded because the clean-reservoir model does not recycle material through the external atmosphere.

## API and UI contract

```ts
import { analyzeRoutes } from './engine/routing'

const result = analyzeRoutes(network, options, {
  sourceNodeId,
  targetNodeId,
  // Optional physical lengths in metres:
  // edgeLengths: { 'curved-return': 425 },
})
if (!result.converged) throw new Error(result.message)

const highlightEdges = result.path?.edgeIds ?? []
const unreachable = result.nodes.filter(node => !node.reachable)
const seconds = result.path?.nominalTransitSeconds ?? null
```

Omit `targetNodeId` to inspect connectivity from the source without requesting one path. The schema is `aerovia.routing/v1`. The result contains:

- `flow`: the independently recomputed validated equilibrium result;
- `edges`: physical direction, magnitude, velocity, length, transit and outward share, in network edge order;
- `nodes`: reachability, minimum transit and predecessor, in network node order;
- `path`: ordered route summary, or null;
- `recirculation`: internal strongly connected components;
- `converged` and an optional failure `message`.

The scene should highlight the returned edge IDs and preserve their actual directions. A linked table can show cumulative time alongside individual airway volume/flow, so users can see why a longer physical route may have a lower nominal time. The selected source and destination must remain visible in the control state. Changing options invalidates the old result until recalculation; a previously highlighted path must not be presented as current.

## Independent fixtures and failure handling

For a single branch with A=10 m², L=10 m, R=1 N s²/m⁸ and fixed pressure difference 100 Pa, the existing square-law solver gives Q=10 m³/s. Nominal time is therefore 10 s. Reversing the branch declaration changes signed Q to −10 while preserving the physical a→b route and its time.

A two-path fixture has a geometrically short 10 m route with branch resistances 1+1 and a longer `2*sqrt(125)` m route with resistances 0.01+0.01, both driven by 100 Pa. Their flows are `sqrt(50)` and `sqrt(5000)` m³/s. The algorithm correctly selects the longer, faster route. This guards against implementing geometric shortest path under a residence-time label.

Further tests cover closed/stagnant branches, unreachable destinations, source=destination, external-boundary termination, explicit geometry/area changes, an analytically driven internal circulation loop, unsupported disconnected flow, serializable output, and predecessor validity on all twelve authored catalog networks. Run:

```sh
npm test -- src/engine/routing.test.ts src/engine/transport.test.ts
```

The initial implementation passes 58 combined numerical tests. Invalid source/destination IDs and invalid lengths throw descriptive errors. A valid network with an unsupported operating equilibrium returns `converged:false`, its airflow evidence, no route graph and a message. It does not fabricate reachability from input topology while ignoring the failed airflow solve.

## Español: alcance y magnitudes

La herramienta analiza el grafo dirigido del caudal calculado. Identifica nudos alcanzables desde un origen, una ruta con la menor suma de tiempos nominales y componentes internas de recirculación. Modificar resistencia, velocidad o cierre puede cambiar tanto las direcciones como la ruta resultante.

La dirección depende del signo de Q, no de cómo se declaró o dibujó la rama. Para cada labor activa, `velocidad=abs(Q)/A` en m/s y `tiempo_nominal=A*L/abs(Q)` en segundos. A considera la modificación vigente; L corresponde a una longitud física explícita o a la distancia entre extremos. Una labor cerrada o con Q exactamente cero no tiene tiempo finito ni conexión activa. Caudales positivos muy pequeños pueden dar tiempos muy grandes; no representan una ventilación intensa.

La longitud mínima admitida es 10⁻⁶ m y la máxima explícita es 10⁷ m. Extremos coincidentes requieren una longitud. Una labor curva puede aportar su longitud medida. Girar o acercar la cámara no cambia esa magnitud física.

`outgoingFraction` es la participación del caudal de una rama entre todas las salidas de su nudo. No es probabilidad de tránsito humano ni la proporción final de una inyección recuperada. `minimumFlow` es el menor caudal entre las ramas de la ruta elegida; no resuelve un problema de capacidad máxima de red.

## Español: algoritmo y fronteras

El algoritmo de Dijkstra minimiza pesos no negativos y registra predecesores para reconstruir la ruta. Una frontera de presión termina el recorrido, salvo cuando es el origen. Esto coincide con el reservorio exterior limpio del transporte: el material que llega allí abandona el modelo. [Referencia del algoritmo de caminos ponderados](https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html)

Un destino no alcanzable devuelve `path:null`, `reachable:false` y distancia nula. Si origen y destino coinciden, devuelve una ruta vacía con tiempo y longitud cero. No se exportan infinitos encubiertos como tiempos. Las ramas de la salida mantienen el orden original del contrato, mientras que sus identificadores aguas arriba/abajo contienen la dirección física.

El algoritmo de Tarjan identifica componentes fuertemente conexas internas, excluyendo fronteras. Cada componente reportada tiene más de un nudo y caminos dirigidos entre todos sus miembros. Describe recirculación topológica; no clasifica automáticamente peligro, atrapamiento ni eficiencia de intercambio. El transporte permite estudiar después una fuente y un programa de operación sobre esa estructura.

## Español: interpretación y pruebas

La ruta corresponde a conectividad del aire y suma de tiempos nominales de volumen/caudal. No representa acceso peatonal, evacuación, aprobación de un plan ni llegada más temprana de un trazador detectable. El modelo de concentración tiene dispersión y produce una historia temporal distinta de este único indicador.

La interfaz puede destacar `path.edgeIds` y mostrar tiempo acumulado junto a volumen y caudal de cada labor. Debe conservar el origen y destino seleccionados y recalcular al modificar opciones. El caso analítico de dos rutas verifica que una ruta más larga puede tener un tiempo menor cuando conduce suficiente caudal. El caso de una sola rama verifica Q=10 m³/s y tiempo=10 s, incluyendo inversión de su declaración.

Las pruebas también cubren cierres, estancamiento, destinos no alcanzables, origen igual a destino, fronteras exteriores, longitudes/áreas explícitas, una recirculación impulsada por ventilador, fallo por desconexión y los doce escenarios de autoría explícita. Las 58 pruebas conjuntas verifican algoritmos; no certifican una mina real. Entradas inválidas producen errores descriptivos. Un equilibrio no soportado devuelve `converged:false` con evidencia y sin una ruta inventada.
