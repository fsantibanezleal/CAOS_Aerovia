# Direct spatial workspace

Aerovia composes the published CAOS AppShell, CaseSelector, Tabs, language and theme stores. The instrument is a full-width workbench inside the shared container. A single contextual control region contains the current engineering operation. Focus mode hides it until requested. Document routes use the shared content primitives and a dedicated scroll owner.

## Geometry and interaction

The authoring model stores horizontal X/Y and elevation Z in metres. The renderer maps those coordinates to Three.js X/Z and vertical Y, keeping a stable center and scale for a project until the user requests a camera fit. Camera rotation and zoom are navigation. They do not alter the network. The Move operation uses the official TransformControls translation gizmo to commit a junction coordinate transaction when the pointer is released. Draw intersects the pointer ray with an explicit elevation plane. Snap is applied in physical metres; a crossing does not create a junction implicitly. Connect and split operations create explicit incidence relationships.

The tunnel cross-section uses a flat floor and semicircular roof, extruded along each branch using Three.js ExtrudeGeometry. Its apparent width can be exaggerated for legibility. This is a display factor and does not change hydraulic area. Vertical separation similarly changes the display, never the stored elevation or transport volume. Scientific volumes use actual centerline length times the configured area. The shape is schematic, not a reconstructed excavation survey.

Transport recolors individual finite-volume cells from the selected computed time frame. A fixed scale across a run prevents a low-concentration late frame from appearing as strong as the source pulse. Raycasting reports physical values at the selected branch/cell. Direction arrows follow the signed numerical airflow; they do not constitute a transient model. Paused transport playback uses the shared visualization lifecycle and suspends frame requests when the document is hidden. An idle scene renders only after a camera, geometry or scalar-field change.

## Numerical and authoring boundaries

Geometry edits preserve existing explicit hydraulic resistances. Moving a junction therefore changes distance and transport storage but does not silently apply an uncalibrated friction law. Area changes affect velocity and transport volume; resistance remains a separate input. Fan equipment has one location and is retained once when a branch is split. Closed-branch state is copied to both resulting segments. All modifications pass the same network/options validation as imported projects before replacing the current design. Undo stores complete network/options transactions.

Sources: [Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html), [Three.js ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html), [Ventsim manual](https://www.ventsim.com/files/VentsimManual.pdf). The interfaces motivate direct manipulation; Aerovia's physical results are produced by its own documented network and transport engines.

## Espacio de trabajo espacial

Aerovia utiliza AppShell, CaseSelector, Tabs y los estados de idioma y tema publicados por CAOS. El instrumento ocupa el ancho del contenedor compartido. Una única región de controles contiene la operación actual; el modo enfocado la oculta hasta que se solicita. Las páginas documentales conservan los componentes comunes y su propio contenedor de desplazamiento.

El modelo guarda X/Y horizontales y elevación Z en metros. La vista mantiene un centro y escala estables por proyecto hasta solicitar un ajuste de cámara. Mover utiliza el manipulador de traslación TransformControls y confirma una transacción al soltar el puntero. Dibujar intersecta el rayo del puntero con un plano de elevación explícito. El ajuste a cuadrícula se aplica en metros. Un cruce no constituye una unión implícita: Conectar y Dividir crean relaciones de incidencia explícitas.

La galería tiene piso plano y techo semicircular, extruidos por cada rama. La exageración de ancho y la separación vertical son factores visuales: no cambian el área hidráulica, las coordenadas guardadas ni el volumen físico. El volumen del transporte es longitud central real por área configurada. La forma visual es esquemática y no representa un levantamiento de excavación.

El transporte colorea cada celda de volumen finito según el instante calculado seleccionado. Una escala fija durante toda la simulación permite comparar la emisión con concentraciones tardías. La selección espacial informa valores y unidades. Las flechas siguen el signo del caudal estacionario; no constituyen un modelo transitorio. La reproducción comienza pausada y se suspende cuando el documento queda oculto. La escena inactiva se dibuja solo al cambiar cámara, geometría o resultados.

Mover una unión modifica distancia y almacenamiento del transporte, conservando la resistencia hidráulica explícita: no se inventa una ley de fricción calibrada. Cambiar el área modifica velocidad y volumen, pero la resistencia sigue siendo independiente. Al dividir una rama, el ventilador aparece una sola vez y el cierre se conserva en ambos segmentos. La validación común precede cualquier reemplazo del diseño. Deshacer conserva transacciones completas de red y opciones.
