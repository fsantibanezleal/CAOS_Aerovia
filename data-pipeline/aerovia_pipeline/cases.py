"""Authored engineering inputs. No surveyed mine or private information."""
from copy import deepcopy


def label(en, es):
    return {"en": en, "es": es}


def network(identifier, en, es, description_en, description_es):
    return {"schema": "aerovia.network/v1", "id": identifier,
            "name": label(en, es), "description": label(description_en, description_es),
            "provenance": {"kind": "authored", "source": "Aerovia authored engineering case library; reproducible with scripts/pipeline.py create", "license": "Apache-2.0"},
            "nodes": [], "edges": []}


def node(n, identifier, x, y, z, boundary=None):
    item = {"id": identifier, "x": x, "y": y, "z": z}
    if boundary is not None:
        item["boundary"] = boundary
    n["nodes"].append(item)
    return identifier


def edge(n, identifier, start, end, kind, resistance, area=18, target=0, level=0, fan=None, en=None, es=None):
    item = {"id": identifier, "from": start, "to": end, "kind": kind,
            "name": label(en or identifier.replace("-", " ").title(), es or identifier.replace("-", " ").title()),
            "resistance": resistance, "area": area, "target": target, "level": level}
    if fan is not None:
        item["fan"] = fan
    n["edges"].append(item)
    return item


def levels(identifier="hard-rock", count=3, bays=4):
    n = network(identifier, "Three-level production", "Producción en tres niveles",
                "Three production levels share intake and return shafts. Inspect how deeper workings compete for pressure and how common fan speed changes every district.",
                "Tres niveles comparten piques de admisión y retorno. Analice la competencia por presión y cómo la velocidad del ventilador afecta cada distrito.")
    node(n, "atmosphere-in", -290, -180, 15, 0)
    node(n, "atmosphere-out", 290, -180, 30, 0)
    node(n, "fan-house", 290, -120, 0)
    edge(n, "main-fan", "fan-house", "atmosphere-out", "fan", .004, 30, fan={"pressure": 3600, "coefficient": .013, "efficiency": .82}, en="Main exhaust fan", es="Ventilador extractor principal")
    for lev in range(count):
        depth = -130 - 140 * lev
        inlet = node(n, f"intake-{lev}", -220, -30 + 30 * lev, depth)
        outlet = node(n, f"return-{lev}", 220, -30 + 30 * lev, depth)
        edge(n, f"intake-shaft-{lev}", "atmosphere-in" if lev == 0 else f"intake-{lev-1}", inlet, "intake", .012 + .004 * lev, 30, level=lev)
        edge(n, f"return-shaft-{lev}", outlet, "fan-house" if lev == 0 else f"return-{lev-1}", "return", .015 + .003 * lev, 28, level=lev)
        previous_i, previous_r = inlet, outlet
        for bay in range(bays):
            skew = (lev % 2) * 35 + bay * 10
            a = node(n, f"l{lev}-in-{bay}", -170 + skew, 160 + bay * 170, depth - 6 * bay)
            b = node(n, f"l{lev}-out-{bay}", 170 + skew, 170 + bay * 170, depth - 6 * bay)
            mid = node(n, f"l{lev}-stope-{bay}", 20 + skew, 205 + bay * 170, depth + 25)
            edge(n, f"l{lev}-supply-{bay}", previous_i, a, "intake", .025 + .008 * bay, 22, level=lev)
            edge(n, f"l{lev}-extract-{bay}", b, previous_r, "return", .03 + .007 * bay, 22, level=lev)
            edge(n, f"l{lev}-working-{bay}", a, mid, "working", .75 + .22 * lev + .19 * bay, 13 + bay, 15 + (bay % 2) * 3, lev,
                 en=f"Level {lev+1} · stope {bay+1}", es=f"Nivel {lev+1} · caserón {bay+1}")
            edge(n, f"l{lev}-stope-return-{bay}", mid, b, "return", .22 + .035 * bay, 15, level=lev)
            previous_i, previous_r = a, b
        if lev:
            edge(n, f"ramp-link-{lev}", f"l{lev-1}-in-{bays-1}", f"l{lev}-in-{bays-1}", "crosscut", .85, 16, level=lev)
    return n


def pillars():
    n = network("room-pillar", "Room-and-pillar district", "Distrito de cámaras y pilares",
                "An interconnected five-by-five roadway grid contains six regulated cross-passages. Low-resistance short circuits can starve the far production strip.",
                "Una malla de cinco por cinco galerías tiene seis cruces regulados. Los cortocircuitos de baja resistencia pueden reducir el caudal de la franja productiva lejana.")
    node(n, "atmosphere-in", -170, -140, 0, 0)
    node(n, "atmosphere-out", 850, 720, 0, 0)
    for row in range(5):
        for col in range(5):
            node(n, f"r{row}c{col}", col * 160, row * 145, -180 - 3 * row - 2 * col)
    edge(n, "decline-intake", "atmosphere-in", "r0c0", "intake", .045, 32)
    edge(n, "district-fan", "r4c4", "atmosphere-out", "fan", .03, 32, fan={"pressure": 2700, "coefficient": .012, "efficiency": .79})
    for row in range(5):
        for col in range(5):
            if col < 4:
                working = row in (2, 3, 4) and col == 3
                edge(n, f"east-{row}-{col}", f"r{row}c{col}", f"r{row}c{col+1}", "working" if working else "intake", .12 + .04 * row if not working else .9 + .2 * row, 18, 22 if working else 0)
            if row < 4:
                regulated = col in (1, 2) and row < 3
                edge(n, f"north-{row}-{col}", f"r{row}c{col}", f"r{row+1}c{col}", "crosscut" if regulated else "return", 9 if regulated else .16 + .025 * col, 15 if regulated else 20)
    return n


def districts():
    n = network("twin-district", "Asymmetric production districts", "Distritos productivos asimétricos",
                "A compact western district competes with a long eastern district. The same fan serves both; regulating the easy path redistributes supply.",
                "Un distrito occidental compacto compite con un distrito oriental largo. Ambos comparten ventilador; regular el trayecto fácil redistribuye el suministro.")
    node(n, "atmosphere-in", 0, -200, 0, 0)
    node(n, "atmosphere-out", 70, -200, 20, 0)
    node(n, "intake-hub", 0, 0, -240)
    node(n, "return-hub", 80, 0, -240)
    edge(n, "intake-decline", "atmosphere-in", "intake-hub", "intake", .018, 35)
    edge(n, "district-fan", "return-hub", "atmosphere-out", "fan", .02, 35, fan={"pressure": 3100, "coefficient": .011, "efficiency": .83})
    for district, sign, factor in (("west", -1, .7), ("east", 1, 1.7)):
        last_i, last_r = "intake-hub", "return-hub"
        for k in range(5):
            a = node(n, f"{district}-i{k}", sign*(170 + 160*k), 110 + 65*k, -230 - 13*k)
            b = node(n, f"{district}-r{k}", sign*(170 + 160*k), 310 + 65*k, -230 - 13*k)
            mid = node(n, f"{district}-face{k}", sign*(210+160*k), 220+65*k, -205-13*k)
            edge(n, f"{district}-supply-{k}", last_i, a, "intake", .04*factor, 24, level=0)
            edge(n, f"{district}-return-{k}", b, last_r, "return", .05*factor, 24)
            edge(n, f"{district}-production-{k}", a, mid, "working", (.9+.15*k)*factor, 14, 20, en=f"{district.title()} production {k+1}", es=f"Producción {district} {k+1}")
            edge(n, f"{district}-face-return-{k}", mid, b, "return", .3*factor, 16)
            last_i, last_r = a,b
    return n


def rename(n, identifier, en, es, den, des):
    n["id"], n["name"], n["description"] = identifier, label(en, es), label(den, des)
    return n


def create_cases():
    base = levels()
    deep = rename(levels("deep-five-level", 5, 3), "deep-five-level", "Five-level deep mine", "Mina profunda de cinco niveles", "Five stacked production horizons share long shafts and inter-level ramps. The deepest districts have additional series resistance and compete for available fan pressure.", "Cinco horizontes apilados comparten piques largos y rampas. Los distritos profundos suman resistencia y compiten por la presión del ventilador.")
    twin = districts()
    leak = rename(deepcopy(base), "leakage-open", "Open leakage paths", "Rutas de fuga abiertas", "Three low-resistance connections bypass the production workings. Compare their stolen airflow and electrical demand with the sealed-leakage case.", "Tres conexiones de baja resistencia evitan las labores productivas. Compare el desvío de aire y la demanda eléctrica con el caso de fugas selladas.")
    for lev in range(3):
        edge(leak, f"leakage-{lev}", f"intake-{lev}", f"return-{lev}", "crosscut", .09 + .02*lev, 12, level=lev, en=f"Level {lev+1} leakage connection", es=f"Conexión de fuga nivel {lev+1}")
    sealed = rename(deepcopy(leak), "leakage-sealed", "Sealed leakage intervention", "Intervención de sellado de fugas", "The same three leakage paths have resistance raised to 18 Pa·s²/m⁶. Compare forward production flow and fan power against the open-leakage network at the same speed.", "Las mismas tres fugas aumentan su resistencia a 18 Pa·s²/m⁶. Compare el caudal productivo y la potencia con la red de fugas abiertas a igual velocidad.")
    for e in sealed["edges"]:
        if e["id"].startswith("leakage-"):
            e["resistance"] = 18
    regulated = rename(deepcopy(twin), "district-regulation", "Western district regulation", "Regulación del distrito occidental", "A regulator raises the western entrance resistance from 0.028 to 0.24 Pa·s²/m⁶. This paired intervention tests redistribution toward the more demanding eastern workings.", "Un regulador aumenta la resistencia de entrada occidental de 0,028 a 0,24 Pa·s²/m⁶. Esta intervención evalúa la redistribución hacia las labores orientales más exigentes.")
    next(e for e in regulated["edges"] if e["id"] == "west-supply-0")["resistance"] = .24
    heading = rename(levels("development-headings", 2, 3), "development-headings", "Development and auxiliary ducts", "Desarrollo y ductos auxiliares", "Two long development headings add separate duct-to-face and return-drive circuits to a two-level production network. The thin ducts have explicit high resistance and low target flow.", "Dos frentes largos añaden circuitos de ducto al frente y galería de retorno a una red productiva de dos niveles. Los ductos tienen resistencia alta y caudal objetivo bajo.")
    for lev in range(2):
        last = f"l{lev}-in-2"
        for k in range(3):
            dest = node(heading, f"duct-{lev}-{k}", -200-70*k, 700+150*k, -130-140*lev-10*k)
            edge(heading, f"aux-duct-{lev}-{k}", last, dest, "intake", 2.5+.8*k, 2.2, level=lev)
            last = dest
        face = node(heading, f"heading-face-{lev}", -260, 1190, -170-140*lev)
        ret = node(heading, f"heading-return-{lev}", 90, 1030, -155-140*lev)
        edge(heading, f"heading-work-{lev}", last, face, "working", 1.4, 12, 8, lev)
        edge(heading, f"heading-return-a-{lev}", face, ret, "return", .18, 18, level=lev)
        edge(heading, f"heading-return-b-{lev}", ret, f"l{lev}-out-2", "return", .2, 18, level=lev)
    maintenance = rename(deepcopy(base), "return-restriction", "Return-shaft maintenance", "Mantenimiento del pique de retorno", "A temporary return-shaft restriction raises the upper return resistance by eight times. Workings retain their targets; the model exposes redistribution and common-speed feasibility.", "Una restricción temporal multiplica por ocho la resistencia del retorno superior. Las labores mantienen sus objetivos; el modelo muestra redistribución y factibilidad de velocidad común.")
    next(e for e in maintenance["edges"] if e["id"]=="return-shaft-0")["resistance"] *= 8
    booster = rename(deepcopy(deep), "deep-booster", "Deep district booster", "Ventilador auxiliar profundo", "A 900 Pa series booster assists the deepest intake segment. Both fan curves follow the same speed control; compare changed district distribution and combined electrical demand.", "Un ventilador en serie de 900 Pa ayuda al segmento de admisión más profundo. Ambas curvas siguen el mismo control de velocidad; compare distribución y demanda eléctrica conjunta.")
    e = next(e for e in booster["edges"] if e["id"] == "intake-shaft-4")
    e["kind"],e["fan"] = "fan", {"pressure":900,"coefficient":.04,"efficiency":.76}
    e["name"] = label("Deep intake booster", "Ventilador auxiliar de admisión profunda")
    split = rename(levels("split-intake", 3, 4), "split-intake", "Independent lower intake", "Admisión inferior independiente", "A second surface intake and inclined fresh-air raise feed the lowest horizon directly. Compare pressure sharing and deep-level supply against the original three-level mine.", "Una segunda admisión superficial y una chimenea inclinada alimentan directamente el horizonte inferior. Compare presiones y suministro profundo con la mina original de tres niveles.")
    node(split, "second-atmosphere", -800, 300, 20, 0)
    node(split, "intake-raise-mid", -500, 430, -220)
    edge(split, "independent-intake-upper", "second-atmosphere", "intake-raise-mid", "intake", .12, 26, level=1)
    edge(split, "independent-intake-lower", "intake-raise-mid", "l2-in-2", "intake", .16, 26, level=2)
    incline = rename(levels("narrow-incline", 3, 3), "narrow-incline", "Narrow-vein inclined mine", "Mina inclinada de veta angosta", "Oblique, shrinking working drives create higher resistance toward the deepest horizon. Coordinates depict an inclined orebody; resistance is authored explicitly and is not inferred from the drawing.", "Galerías oblicuas y estrechas generan más resistencia hacia el horizonte profundo. Las coordenadas representan un cuerpo inclinado; la resistencia es explícita y no se infiere del dibujo.")
    for v in incline["nodes"]:
        if "boundary" not in v:
            v["x"] += round(-v["z"]*.8)
            v["y"] += round(-v["z"]*.22)
    for e in incline["edges"]:
        if e["kind"]=="working":
            e["resistance"] *= 2.4+e["level"]
            e["area"] = 8-e["level"]
            e["target"] = 12
    return [base, deep, pillars(), twin, leak, sealed, regulated, heading, maintenance, booster, split, incline]
