# Table import and authoring transactions / Importación y edición transaccional

## English: import two independent tables

`frontend/src/engine/tableImport.ts` parses a junction CSV and an airway CSV, validates their column mappings, converts explicitly selected geometry units, constructs a complete candidate and validates the network before returning it. Parsing or conversion never updates the current design. The host commits the returned network only after success; `ProjectDialog` follows this order and keeps the dialog open with an error after failure.

`parseTable` supports quoted fields, escaped quotes, embedded line breaks, CRLF and a UTF-8 BOM. It removes surrounding whitespace from column headings. Labels preserve their original meaningful text, including Unicode and quoted whitespace; identifiers and numeric fields are trimmed. Duplicate/empty/reserved headings, inconsistent row widths and malformed quotes are errors. Files are bounded to 2,000,000 UTF-8 bytes, 64 columns and 1000 parsed rows. A constructed network is further limited to 120 junctions and 240 airways.

Mapping suggestions use explicit aliases such as `Easting→x`, `Northing→y`, `Elevation→z`, `Start→from`, `End→to` and `pressure_pa→boundary`. If more than one source heading matches a field, that field stays unmapped for a deliberate selection. A mapping must reference an existing column. Two semantic fields cannot consume the same column. Extra unrelated source columns can remain unmapped.

## Field contract

| Table | Required columns after mapping | Optional columns |
|---|---|---|
| Junctions | `id`, `x`, `y`, `z` | `boundary` |
| Airways | `id`, `from`, `to`, `area`, `resistance` | `name`, `nameEn`, `nameEs`, `kind`, `target`, `level`, fan fields |
| Fan airway | All airway requirements plus `kind=fan`, `fanPressure`, `fanCoefficient`, `fanEfficiency` | Same label/target fields |

IDs use the existing network contract: start with an ASCII letter or digit, then letters, digits, underscore, dot, colon or hyphen; they are unique within their table. A comma can appear in a quoted label, but quoting does not make it valid inside an identifier. Connections must refer to existing junctions and cannot be self-loops. Every connected component must reach at least one explicitly supplied fixed-pressure boundary.

Blank `boundary` means an internal junction. Numeric zero means a real zero-pressure boundary. The importer never creates a boundary automatically. Blank `kind` means `working`; blank `target` and `level` mean zero. Allowed kinds are `intake`, `return`, `working`, `crosscut` and `fan`.

For labels, English uses `nameEn`, otherwise `name`, otherwise `nameEs`, otherwise the ID. Spanish uses `nameEs`, otherwise `name`, otherwise `nameEn`, otherwise the ID. Export writes both `nameEn` and `nameEs`, preserving bilingual names. A shared fallback copies text; it does not invent a translation.

Every fan requires all three curve/equipment values. A missing coefficient or efficiency is an error; the importer does not supply assumed equipment data. A non-fan row with mapped fan values is also an error, including an explicitly supplied zero. The user must select the correct kind or remove the contradictory values.

Numeric fields accept decimal/scientific notation such as `-305`, `0.2` or `+2e-1`. Blank required values, NaN, infinity, hexadecimal notation, spreadsheet formulas, grouping commas and embedded unit text are rejected. The final network validator applies physical bounds and finite-value checks after conversion.

## Units and round-trip boundary

| Input | `m` selection | `ft` selection | Stored contract |
|---|---|---|---|
| x, y, z | unchanged | ×0.3048 | m |
| area | unchanged | ×0.3048² | m² |
| boundary, fanPressure | unchanged | unchanged | Pa |
| resistance, fanCoefficient | unchanged | unchanged | Pa·s²/m⁶ |
| target | unchanged | unchanged | m³/s |
| fanEfficiency | unchanged | unchanged | fraction 0.05–1 |

The selector applies to geometry only. Hydraulic values always use the documented SI units. Unknown unit selections are rejected. Resistance is an independent hydraulic input; the importer does not derive it from coordinates or area. A length override for a curved physical airway belongs to transport/routing requests and is not a column in this network contract.

`networkTables(network)` exports the validated network argument in SI. It preserves junctions, airway properties, fan equipment and both label languages. It does not encode global speed, resistance scale, closures, baselines or source metadata. Use project JSON for an exact operating-state round trip. The application may deliberately pass an effective network with already materialized property changes; those then become base values in the CSV, while closures and global controls still require project JSON.

The imported network receives explicit imported provenance and a user-defined license marker. The parsing API does not accept source file paths, publish files or contact an external service. Source filenames are not copied into exported provenance. User-provided model content remains user-provided content.

## Example

Junctions:

```csv
id,x,y,z,boundary
surface-in,0,0,0,0
working,100,0,-40,
surface-out,200,0,0,0
```

Airways:

```csv
id,from,to,nameEn,nameEs,kind,area,resistance,target,level,fanPressure,fanCoefficient,fanEfficiency
intake,surface-in,working,Main fan,Ventilador principal,fan,12,0.1,0,0,1200,0.01,0.8
return,working,surface-out,Return,Retorno,return,12,0.2,30,0,,,
```

```ts
const nodes = parseTable(junctionText)
const edges = parseTable(airwayText)
const candidate = networkFromTables(
  nodes, edges,
  suggestMapping(nodes, NODE_FIELDS), suggestMapping(edges, EDGE_FIELDS),
  'm', 'Imported design',
)
// Only after this call returns does the host replace its current network.
commitNetwork(candidate)
```

## Direct authoring invariants

`frontend/src/engine/editor.ts` also uses clone-then-validate transactions. Failed moves, draws, splits, property edits and boundary changes preserve the original network. Moves copy only x/y/z even if a caller passes a full node, preventing accidental identity or boundary mutation. Every airway incident to the moved node must retain at least 0.01 m of geometric length, consistent with drawing. Splits must retain this minimum on both resulting segments and stay within the network's resistance bounds.

Property edits cannot alter an airway's `id`, `from` or `to`; identity and connectivity require topology operations. Drawing defaults cannot inject identity/endpoints. A destination position supplies only coordinates; a generated junction never inherits an unrelated supplied ID or pressure boundary.

Splitting preserves total series resistance, keeps one physical fan on the original segment and moves the single target to the downstream segment. A fan selected interactively starts with visible authored defaults (1200 Pa, coefficient 0.01, efficiency 0.8), which the user can edit. These deliberate authoring defaults are distinct from importing supposedly supplied equipment data, where missing values are rejected. Changing a fan to a passive kind removes that equipment; supplying fan parameters while retaining a passive kind is an error.

## Verification

Run `npm test -- src/engine/tableImport.test.ts src/engine/editor.test.ts`. The implementation passes 61 focused tests: bilingual/quoted round trips, explicit unit conversion, ambiguous and invalid mappings, malformed CSV, UTF-8 byte limits, decimal/nonfinite values, fan completeness, orphan connections, duplicate IDs, pressure-boundary requirements, and failed-import atomicity. Authoring tests cover incident zero-length geometry, identity injection, deeply frozen inputs, equipment transitions, splits and boundary removal. These tests validate domain transactions; full browser interaction and deployment verification remain separate gates.

## Español

La importación utiliza dos CSV independientes: uniones y galerías. Primero analiza ambos archivos, valida las asignaciones de columnas, convierte las unidades geométricas seleccionadas y construye una red candidata completa. Solo después de validar se reemplaza la red actual. Un error conserva el diseño anterior y permite corregir los archivos o asignaciones.

Las columnas obligatorias de uniones son `id`, `x`, `y`, `z`; `boundary` es opcional. En galerías se requieren `id`, `from`, `to`, `area`, `resistance`. Se admiten `name`, `nameEn`, `nameEs`, `kind`, `target`, `level` y los campos del ventilador. Las etiquetas pueden contener tildes, comas, comillas y saltos de línea correctamente citados. Los identificadores mantienen la sintaxis del contrato; las comillas CSV no autorizan comas dentro de un ID.

Las sugerencias de asignación dejan vacíos los campos ambiguos. Se rechazan columnas inexistentes, asignaciones dobles, encabezados duplicados o vacíos, filas con distinta cantidad de campos y comillas mal cerradas. Los límites son 2.000.000 bytes UTF-8, 64 columnas, 1000 filas analizadas y finalmente 120 uniones/240 galerías por red.

`nameEn` y `nameEs` preservan ambos idiomas al exportar. Si falta una etiqueta se utiliza `name`, luego el otro idioma y finalmente el ID. Copiar una etiqueta de respaldo no significa traducirla. Una frontera vacía es un nudo interno; cero es una frontera real de presión cero. Debe existir una frontera explícita accesible desde cada componente. No se inventan conexiones ni fronteras.

Seleccionar pies convierte coordenadas por 0,3048 y áreas por 0,3048². Presión, resistencia, coeficiente del ventilador y caudal conservan sus unidades SI indicadas en la tabla. Una unidad desconocida se rechaza. La resistencia no se deduce de la geometría. Los números aceptan notación decimal/científica y rechazan infinitos, fórmulas, hexadecimal, separadores de miles y texto de unidades.

Una fila `kind=fan` debe aportar presión, coeficiente y eficiencia completos. No se completan parámetros faltantes con supuestos. Una fila pasiva con datos de ventilador también se rechaza para no descartarlos ocultamente. Tipo vacío significa `working`; objetivo y nivel vacíos significan cero.

El CSV conserva geometría, propiedades base, equipos y etiquetas; no incluye velocidad global, factor global de resistencia, cierres ni referencias de comparación. Para reproducir el estado operativo completo se utiliza JSON de proyecto. El API no recibe rutas locales, no publica archivos y no copia nombres de archivo a la procedencia.

La edición directa es transaccional. Mover un nudo solo modifica coordenadas y conserva al menos 0,01 m en todas las galerías incidentes. Editar propiedades no puede cambiar ID ni extremos. Dividir mantiene la resistencia total en serie, un solo ventilador y un solo objetivo aguas abajo. Los valores iniciales del ventilador creado por el usuario son supuestos visibles de autoría; no se aplican como datos implícitos durante una importación.

Las 61 pruebas enfocadas verifican esos contratos, incluyendo entradas malformadas, duplicados, huérfanos, equipos incompletos, conversión de unidades, conservación del diseño ante errores, longitudes nulas e inyección de identidad. La validación de interfaz y despliegue se realiza por separado.
