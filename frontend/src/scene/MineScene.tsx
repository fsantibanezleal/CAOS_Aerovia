import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { Network, Result } from "../contracts";
import type { Position } from "../engine/editor";
import type { TransportFrame } from "../engine/transport";
import { edgeColor, type Metric } from "./field";

export type EditTool = "select" | "draw" | "connect" | "move";
export interface MineSceneProps {
  network: Network;
  result: Result | null;
  baseline: Result | null;
  metric: Metric | "tracer" | "path";
  theme: "light" | "dark";
  lang: "en" | "es";
  selected: string | null;
  selectedNode: string | null;
  tool: EditTool;
  onEdge: (id: string) => void;
  onNode: (id: string) => void;
  onDraw: (position: Position) => void;
  onMove: (id: string, position: Position) => void;
  editElevation: number;
  snap: number;
  separation: number;
  widthScale: number;
  level: number | null;
  view: "space" | "plan" | "section";
  reset: number;
  closed: Set<string>;
  path: string[];
  frame?: TransportFrame;
  concentrationMax?: number;
  labels: boolean;
  cut: number | null;
}
type Cell = {
  mesh: T.Mesh<T.ExtrudeGeometry, T.MeshStandardMaterial>;
  edge: number;
  cell: number;
};
type NodeLabel = { id: string; x: number; y: number; selected: boolean };
type Controller = {
  rebuild: () => void;
  paint: () => void;
  fit: () => void;
  dispose: () => void;
};

/** Direct design surface. Geometry is rebuilt only when geometry changes; scalar fields recolor cells. */
export default function MineScene(props: MineSceneProps) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    controller = useRef<Controller | null>(null);
  latest.current = props;
  const [labels, setLabels] = useState<NodeLabel[]>([]),
    [hover, setHover] = useState(""),
    [failure, setFailure] = useState("");
  const [horizonLabels, setHorizonLabels] = useState<
    { id: string; x: number; y: number; text: string }[]
  >([]);
  useEffect(() => {
    const element = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setFailure(
        "WebGL could not initialize. The coordinate and airway tables remain available.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    renderer.domElement.setAttribute(
      "aria-label",
      props.lang === "en" ? "Editable mine network" : "Red minera editable",
    );
    renderer.domElement.tabIndex = 0;
    element.prepend(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(38, 1, 0.1, 2000);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = false;
    orbit.minDistance = 2;
    orbit.maxDistance = 600;
    const gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.8);
    scene.add(gizmo.getHelper());
    scene.add(new T.HemisphereLight(0xe5f4ff, 0x526370, 2.4));
    const sun = new T.DirectionalLight(0xffffff, 2.2);
    sun.position.set(50, 100, 70);
    scene.add(sun);
    const fill = new T.DirectionalLight(0x5eacff, 1);
    fill.position.set(-70, -15, -70);
    scene.add(fill);
    const geometry = new T.Group();
    scene.add(geometry);
    const ray = new T.Raycaster(),
      pointer = new T.Vector2(),
      scratch = new T.Vector3();
    let cells: Cell[] = [],
      edges: T.Object3D[] = [],
      nodes: T.Mesh[] = [],
      grid: T.GridHelper | null = null;
    let center = new T.Vector3(),
      scale = 1,
      boundsKey = "",
      dragging = false,
      movedGizmo = false;
    let down = { x: 0, y: 0 },
      edgeGlyphs: Array<{ object: T.ArrowHelper; edge: number }> = [];
    let horizons: { id: string; position: T.Vector3; elevation: number }[] = [];
    const previewGeometry = new T.BufferGeometry(),
      preview = new T.LineSegments(
        previewGeometry,
        new T.LineDashedMaterial({
          color: 0xf2b650,
          dashSize: 1,
          gapSize: 0.6,
        }),
      );
    scene.add(preview);
    const map = (p: Position) =>
      new T.Vector3(
        (p.x - center.x) * scale,
        (p.z - center.z) * scale * (1 + latest.current.separation),
        (p.y - center.y) * scale,
      );
    const unmap = (v: T.Vector3): Position => ({
      x: v.x / scale + center.x,
      y: v.z / scale + center.y,
      z: v.y / (scale * (1 + latest.current.separation)) + center.z,
    });
    const snapped = (p: Position): Position => {
      const step = latest.current.snap;
      return step > 0
        ? {
            x: Math.round(p.x / step) * step,
            y: Math.round(p.y / step) * step,
            z: Math.round(p.z / step) * step,
          }
        : p;
    };
    function drawLabels() {
      const p = latest.current;
      setHorizonLabels(
        horizons
          .filter((h) => p.cut === null || h.elevation <= p.cut)
          .map((h) => {
            const v = h.position.clone().project(camera);
            return {
              id: h.id,
              x: (v.x * 0.5 + 0.5) * element.clientWidth,
              y: (-v.y * 0.5 + 0.5) * element.clientHeight,
              text: `Z ${h.elevation.toFixed(0)} m`,
            };
          })
          .filter(
            (h) =>
              h.x > 0 &&
              h.x < element.clientWidth &&
              h.y > 0 &&
              h.y < element.clientHeight,
          ),
      );
      if (!p.labels && !["draw", "connect", "move"].includes(p.tool)) {
        setLabels([]);
        return;
      }
      setLabels(
        nodes
          .filter(
            (n) =>
              n.visible &&
              (p.network.nodes.length <= 45 ||
                n.userData.id === p.selectedNode ||
                n.userData.boundary),
          )
          .map((n) => {
            const v = n.position.clone().project(camera);
            return {
              id: n.userData.id as string,
              x: (v.x * 0.5 + 0.5) * element.clientWidth,
              y: (-v.y * 0.5 + 0.5) * element.clientHeight,
              selected: n.userData.id === p.selectedNode,
              depth: v.z,
            };
          })
          .filter(
            (n) =>
              n.depth < 1 &&
              n.depth > -1 &&
              n.x > 2 &&
              n.x < element.clientWidth - 2 &&
              n.y > 2 &&
              n.y < element.clientHeight - 2,
          ),
      );
    }
    function render() {
      renderer.render(scene, camera);
      drawLabels();
    }
    function disposeGroup() {
      gizmo.detach();
      geometry.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((a) =>
            a.dispose(),
          );
      });
      geometry.clear();
      cells = [];
      nodes = [];
      edges = [];
      edgeGlyphs = [];
      horizons = [];
    }
    function fit() {
      const p = latest.current;
      const points = p.network.nodes.map(map);
      const box = new T.Box3().setFromPoints(points);
      orbit.target.copy(box.getCenter(new T.Vector3()));
      camera.aspect =
        Math.max(1, element.clientWidth) / Math.max(1, element.clientHeight);
      camera.updateProjectionMatrix();
      const direction =
        p.view === "plan"
          ? new T.Vector3(0, 1, 0.00001)
          : p.view === "section"
            ? new T.Vector3(0, 0, 1)
            : new T.Vector3(1, 0.62, 1.05).normalize();
      let distance = Math.max(20, box.getSize(new T.Vector3()).length() * 2);
      // Fit engineering geometry, excluding the construction grid and gizmos.
      for (let pass = 0; pass < 6; pass++) {
        camera.position.copy(orbit.target).addScaledVector(direction, distance);
        camera.lookAt(orbit.target);
        camera.updateMatrixWorld();
        const projected = points.map((p) => p.clone().project(camera));
        const extent = Math.max(
          ...projected.map((p) =>
            Math.max(Math.abs(p.x) / 0.82, Math.abs(p.y) / 0.78),
          ),
        );
        if (!Number.isFinite(extent) || extent <= 0) break;
        distance *= Math.max(0.5, Math.min(2, extent));
      }
      camera.position.copy(orbit.target).addScaledVector(direction, distance);
      camera.lookAt(orbit.target);
      camera.updateMatrixWorld();
      orbit.update();
      render();
    }
    function rebuild() {
      const p = latest.current;
      const key = `${p.network.id}:${p.reset}`;
      const changedBounds = key !== boundsKey;
      if (changedBounds) {
        const box = new T.Box3().setFromPoints(
          p.network.nodes.map((n) => new T.Vector3(n.x, n.y, n.z)),
        );
        center = box.getCenter(new T.Vector3());
        scale = 100 / Math.max(50, ...box.getSize(new T.Vector3()).toArray());
        boundsKey = key;
      }
      disposeGroup();
      const byId = new Map(p.network.nodes.map((n) => [n.id, n]));
      for (const level of new Set(
        p.network.edges.filter((e) => e.kind === "working").map((e) => e.level),
      )) {
        const branches = p.network.edges.filter(
          (e) => e.kind === "working" && e.level === level,
        );
        const levelNodes = [
          ...new Set(branches.flatMap((e) => [e.from, e.to])),
        ].map((id) => byId.get(id)!);
        if (levelNodes.length < 3) continue;
        const box = new T.Box3().setFromPoints(levelNodes.map(map)),
          size = box.getSize(new T.Vector3()),
          middle = box.getCenter(new T.Vector3());
        const elevation =
          levelNodes.reduce((sum, n) => sum + n.z, 0) / levelNodes.length;
        const floor = new T.Mesh(
          new T.PlaneGeometry(Math.max(3, size.x + 5), Math.max(3, size.z + 5)),
          new T.MeshBasicMaterial({
            color: 0x598eaf,
            transparent: true,
            opacity: p.theme === "dark" ? 0.055 : 0.035,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.copy(middle);
        floor.position.y -= 0.7;
        floor.userData.horizon = true;
        geometry.add(floor);
        const border = new T.LineSegments(
          new T.EdgesGeometry(floor.geometry),
          new T.LineBasicMaterial({
            color: 0x6895b5,
            transparent: true,
            opacity: 0.19,
          }),
        );
        border.position.copy(floor.position);
        border.rotation.copy(floor.rotation);
        border.userData.horizon = true;
        geometry.add(border);
        horizons.push({
          id: String(level),
          position: new T.Vector3(box.min.x - 2, middle.y, box.max.z + 2),
          elevation,
        });
      }
      const cellCount = p.frame?.cellConcentrations[0]?.length ?? 8;
      p.network.edges.forEach((edge, i) => {
        const start = map(byId.get(edge.from)!),
          end = map(byId.get(edge.to)!);
        const vector = end.clone().sub(start),
          length = vector.length();
        if (length < 1e-8) return;
        const direction = vector.clone().normalize();
        const radius = Math.max(
          0.18,
          Math.sqrt(edge.area / (1 + Math.PI / 2)) * scale * p.widthScale,
        );
        // Flat floor and arched roof. Radius exaggeration is a visible display control, never hydraulic area.
        const shape = new T.Shape();
        shape.moveTo(-radius, -radius * 0.5);
        shape.lineTo(radius, -radius * 0.5);
        shape.lineTo(radius, 0);
        shape.absarc(0, 0, radius, 0, Math.PI, false);
        shape.closePath();
        const quaternion = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 0, 1),
          direction,
        );
        for (let c = 0; c < cellCount; c++) {
          const mesh = new T.Mesh(
            new T.ExtrudeGeometry(shape, {
              depth: (length / cellCount) * 0.998,
              bevelEnabled: false,
              curveSegments: 6,
            }),
            new T.MeshStandardMaterial({ metalness: 0.12, roughness: 0.45 }),
          );
          mesh.position.copy(start).addScaledVector(vector, c / cellCount);
          mesh.quaternion.copy(quaternion);
          mesh.userData = { edge: i, cell: c };
          geometry.add(mesh);
          edges.push(mesh);
          cells.push({ mesh, edge: i, cell: c });
        }
        const flowDirection = direction
          .clone()
          .multiplyScalar((p.result?.flows[i] ?? 1) < 0 ? -1 : 1);
        const arrow = new T.ArrowHelper(
          flowDirection,
          start
            .clone()
            .lerp(end, 0.55)
            .add(new T.Vector3(0, radius * 1.6, 0)),
          Math.max(1.5, Math.min(length * 0.28, 4)),
          0xffffff,
          0.85,
          0.55,
        );
        arrow.userData.edge = i;
        geometry.add(arrow);
        edgeGlyphs.push({ object: arrow, edge: i });
        if (edge.fan) {
          const fan = new T.Group();
          fan.position.copy(start).lerp(end, 0.12);
          fan.quaternion.copy(quaternion);
          const ring = new T.Mesh(
            new T.TorusGeometry(radius * 1.7, radius * 0.22, 6, 20),
            new T.MeshStandardMaterial({
              color: 0xf5d681,
              metalness: 0.65,
              roughness: 0.3,
            }),
          );
          fan.add(ring);
          for (let blade = 0; blade < 4; blade++) {
            const fin = new T.Mesh(
              new T.BoxGeometry(radius * 0.42, radius * 2.5, radius * 0.17),
              new T.MeshStandardMaterial({
                color: 0xe4c176,
                metalness: 0.6,
                roughness: 0.35,
              }),
            );
            fin.rotation.z = (blade * Math.PI) / 4;
            fan.add(fin);
          }
          fan.traverse((o) => (o.userData.edge = i));
          geometry.add(fan);
          edges.push(...fan.children);
        }
      });
      p.network.nodes.forEach((n) => {
        const mesh = new T.Mesh(
          new T.IcosahedronGeometry(n.boundary !== undefined ? 0.85 : 0.52, 1),
          new T.MeshStandardMaterial({
            color: 0xdcecf1,
            metalness: 0.2,
            roughness: 0.5,
          }),
        );
        mesh.position.copy(map(n));
        mesh.userData = { id: n.id, boundary: n.boundary !== undefined };
        nodes.push(mesh);
        geometry.add(mesh);
      });
      grid = new T.GridHelper(145, 20, 0x598197, 0x466176);
      grid.position.y = map({ x: center.x, y: center.y, z: p.editElevation }).y;
      (grid.material as T.Material).transparent = true;
      (grid.material as T.Material).opacity = 0.18;
      geometry.add(grid);
      paint();
      if (changedBounds) fit();
    }
    function paint() {
      const p = latest.current,
        dark = p.theme === "dark";
      scene.background = new T.Color(dark ? "#071422" : "#edf3f8");
      const byId = new Map(p.network.nodes.map((n) => [n.id, n]));
      const path = new Set(p.path);
      for (const { mesh, edge: i, cell } of cells) {
        const edge = p.network.edges[i];
        if (!edge) continue;
        let color: T.Color;
        if (p.metric === "tracer") {
          const c = p.frame?.cellConcentrations[i]?.[cell] ?? 0;
          const t =
            Math.log1p((100 * c) / Math.max(1e-12, p.concentrationMax ?? 1)) /
            Math.log(101);
          color = new T.Color().setHSL(
            0.6 - Math.min(1, t) * 0.6,
            c > 1e-10 ? 0.92 : 0.2,
            dark ? 0.22 + Math.min(1, t) * 0.34 : 0.67 - Math.min(1, t) * 0.23,
          );
        } else if (p.metric === "path")
          color = new T.Color(
            path.has(edge.id) ? "#ffd073" : dark ? "#31516b" : "#adbdcb",
          );
        else
          color = new T.Color(
            edgeColor(p.network, p.result, i, p.metric, p.baseline),
          );
        mesh.material.color.copy(color);
        const selected = edge.id === p.selected;
        mesh.material.emissive.copy(color);
        mesh.material.emissiveIntensity = selected ? 0.45 : 0.055;
        mesh.material.transparent = p.closed.has(edge.id);
        mesh.material.opacity = p.closed.has(edge.id) ? 0.18 : 1;
        mesh.material.clippingPlanes =
          p.cut === null
            ? []
            : [
                new T.Plane(
                  new T.Vector3(0, -1, 0),
                  map({ x: center.x, y: center.y, z: p.cut }).y,
                ),
              ];
        mesh.visible =
          p.level === null || edge.kind !== "working" || edge.level === p.level;
      }
      for (const { object, edge: i } of edgeGlyphs) {
        const edge = p.network.edges[i];
        object.visible =
          !!p.result?.converged &&
          Math.abs(p.result.flows[i]) > 1e-8 &&
          !p.closed.has(edge.id) &&
          (p.level === null ||
            edge.kind !== "working" ||
            edge.level === p.level) &&
          p.metric !== "tracer";
        if (object.visible)
          object.setDirection(
            map(byId.get(edge.to)!)
              .sub(map(byId.get(edge.from)!))
              .normalize()
              .multiplyScalar(p.result!.flows[i] < 0 ? -1 : 1),
          );
        object.setColor(dark ? 0xe7f4fa : 0x162f49);
      }
      for (const node of nodes) {
        const selected = node.userData.id === p.selectedNode;
        (node.material as T.MeshStandardMaterial).color.set(
          selected ? "#ffce66" : dark ? "#bbd4e6" : "#466785",
        );
        node.scale.setScalar(selected ? 1.7 : 1);
        const original = byId.get(node.userData.id)!;
        node.visible = p.cut === null || original.z <= p.cut;
      }
      geometry.traverse((object) => {
        if (object.userData.edge === undefined && !object.userData.horizon)
          return;
        const mesh = object as T.Mesh;
        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const material of materials)
            material.clippingPlanes =
              p.cut === null
                ? []
                : [
                    new T.Plane(
                      new T.Vector3(0, -1, 0),
                      map({ x: center.x, y: center.y, z: p.cut }).y,
                    ),
                  ];
        }
      });
      const selectedNode = nodes.find((n) => n.userData.id === p.selectedNode);
      if (p.tool === "move" && selectedNode && !dragging)
        gizmo.attach(selectedNode);
      else if (!dragging) gizmo.detach();
      gizmo.setTranslationSnap(p.snap > 0 ? p.snap * scale : null);
      if (grid) {
        grid.visible = ["draw", "connect", "move"].includes(p.tool);
        grid.position.y = map({
          x: center.x,
          y: center.y,
          z: p.editElevation,
        }).y;
      }
      render();
    }
    function hit(event: PointerEvent) {
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        (-(event.clientY - box.top) / box.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const visibleHit = (hit: T.Intersection) =>
        latest.current.cut === null ||
        hit.point.y <=
          map({ x: center.x, y: center.y, z: latest.current.cut }).y;
      const node = ray
        .intersectObjects(
          nodes.filter((n) => n.visible),
          false,
        )
        .find(visibleHit);
      const edge = ray
        .intersectObjects(
          edges.filter((n) => n.visible),
          false,
        )
        .find(visibleHit);
      return { node, edge };
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      movedGizmo = false;
    };
    const onUp = (e: PointerEvent) => {
      if (
        dragging ||
        movedGizmo ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 ||
        e.button !== 0
      )
        return;
      const p = latest.current,
        h = hit(e);
      if (h.node) p.onNode(h.node.object.userData.id);
      else if (p.tool === "draw" && p.selectedNode) {
        const plane = new T.Plane(
          new T.Vector3(0, 1, 0),
          -map({ x: center.x, y: center.y, z: p.editElevation }).y,
        );
        if (ray.ray.intersectPlane(plane, scratch))
          p.onDraw(snapped(unmap(scratch)));
      } else if (h.edge)
        p.onEdge(p.network.edges[h.edge.object.userData.edge].id);
    };
    const onPointer = (e: PointerEvent) => {
      if (dragging) return;
      const p = latest.current,
        h = hit(e);
      if (h.node) {
        const nodeId = h.node.object.userData.id;
        const n = p.network.nodes.find((n) => n.id === nodeId)!;
        setHover(
          `${n.id} · X ${n.x.toFixed(1)} · Y ${n.y.toFixed(1)} · Z ${n.z.toFixed(1)} m`,
        );
      } else if (h.edge) {
        const i = h.edge.object.userData.edge as number,
          edge = p.network.edges[i],
          c = h.edge.object.userData.cell ?? 0;
        setHover(
          `${edge.name[p.lang]} · ${p.result ? p.result.flows[i].toFixed(2) + " m³/s · " + p.result.velocities[i].toFixed(2) + " m/s" : "--"}${p.frame ? " · " + (p.frame.cellConcentrations[i]?.[c] ?? 0).toPrecision(3) + " mg/m³" : ""}`,
        );
      } else setHover("");
    };
    gizmo.addEventListener("dragging-changed", (event) => {
      dragging = !!event.value;
      orbit.enabled = !dragging;
      if (dragging) movedGizmo = true;
    });
    gizmo.addEventListener("change", render);
    gizmo.addEventListener("objectChange", () => {
      if (!gizmo.object) return;
      movedGizmo = true;
      const p = latest.current,
        id = gizmo.object.userData.id;
      const points: number[] = [];
      for (const edge of p.network.edges.filter(
        (e) => e.from === id || e.to === id,
      )) {
        const other = p.network.nodes.find(
          (n) => n.id === (edge.from === id ? edge.to : edge.from),
        )!;
        points.push(
          ...map(other).toArray(),
          ...gizmo.object.position.toArray(),
        );
      }
      previewGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(points, 3),
      );
      preview.computeLineDistances();
      const pos = unmap(gizmo.object.position);
      setHover(
        `X ${pos.x.toFixed(1)} · Y ${pos.y.toFixed(1)} · Z ${pos.z.toFixed(1)} m`,
      );
      render();
    });
    gizmo.addEventListener("mouseUp", () => {
      if (gizmo.object && movedGizmo)
        latest.current.onMove(
          gizmo.object.userData.id,
          snapped(unmap(gizmo.object.position)),
        );
      previewGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute([], 3),
      );
    });
    orbit.addEventListener("change", render);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onPointer);
    const resize = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = element;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(element);
    const dispose = () => {
      resize.disconnect();
      orbit.dispose();
      gizmo.dispose();
      disposeGroup();
      renderer.dispose();
      previewGeometry.dispose();
      (preview.material as T.Material).dispose();
      renderer.domElement.remove();
    };
    controller.current = { rebuild, paint, fit, dispose };
    rebuild();
    return () => {
      controller.current = null;
      dispose();
    };
  }, []);
  useEffect(() => {
    controller.current?.rebuild();
  }, [
    props.network,
    props.separation,
    props.widthScale,
    props.reset,
    props.frame?.cellConcentrations[0]?.length,
  ]);
  useEffect(() => {
    controller.current?.paint();
  }, [
    props.result,
    props.baseline,
    props.metric,
    props.theme,
    props.selected,
    props.selectedNode,
    props.tool,
    props.editElevation,
    props.snap,
    props.level,
    props.closed,
    props.path,
    props.frame,
    props.labels,
    props.cut,
  ]);
  useEffect(() => {
    controller.current?.fit();
  }, [props.view]);
  return (
    <div className="av-mine-scene" ref={host} data-testid="mine-scene">
      <div className="av-horizon-labels">
        {horizonLabels.map((h) => (
          <span key={h.id} style={{ left: h.x, top: h.y }}>
            {h.text}
          </span>
        ))}
      </div>
      {failure && (
        <p role="alert">
          {props.lang === "es"
            ? "WebGL no pudo iniciarse. Las tablas de coordenadas y galerías siguen disponibles."
            : failure}
        </p>
      )}
      <div className="av-node-labels">
        {labels.map((n) => (
          <button
            key={n.id}
            className={n.selected ? "selected" : ""}
            style={{ left: n.x, top: n.y }}
            onClick={() => props.onNode(n.id)}
            aria-label={`${props.lang === "en" ? "Junction" : "Unión"} ${n.id}`}
          >
            {n.id}
          </button>
        ))}
      </div>
      {hover && <output className="av-scene-hover">{hover}</output>}
      <div className="av-orientation" aria-hidden="true">
        <span>Z ↑</span>
        <span>X → · Y ↗</span>
      </div>
    </div>
  );
}
