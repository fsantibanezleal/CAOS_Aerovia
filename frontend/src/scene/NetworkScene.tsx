import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Network, Result } from "../contracts";

export type Metric =
  "route" | "flow" | "velocity" | "pressure" | "target" | "change";
export const routeColors: Record<string, string> = {
  intake: "#48c8bd",
  return: "#efb76e",
  working: "#96baf5",
  crosscut: "#aa9ccd",
  fan: "#e5ded0",
};
export function edgeColor(
  network: Network,
  result: Result | null,
  i: number,
  metric: Metric,
  baseline: Result | null,
) {
  const e = network.edges[i];
  if (!result || metric === "route") return routeColors[e.kind] || "#97b4bd";
  if (metric === "target")
    return e.target <= 0
      ? "#67777a"
      : result.flows[i] >= e.target
        ? "#47ceaf"
        : "#f27c64";
  if (metric === "change")
    return baseline
      ? result.flows[i] - baseline.flows[i] >= 0
        ? "#48d4b6"
        : "#f47e70"
      : "#70878c";
  const v =
    metric === "velocity"
      ? Math.abs(result.velocities[i])
      : metric === "pressure"
        ? Math.abs(
            result.pressures[network.nodes.findIndex((n) => n.id === e.from)],
          )
        : Math.abs(result.flows[i]);
  const max =
    metric === "velocity"
      ? Math.max(1, ...result.velocities.map(Math.abs))
      : metric === "pressure"
        ? Math.max(1, ...result.pressures.map(Math.abs))
        : Math.max(1, ...result.flows.map(Math.abs));
  return new THREE.Color("#436e9d")
    .lerp(new THREE.Color("#60e0b0"), Math.min(1, v / max))
    .getStyle();
}
interface Props {
  network: Network;
  result: Result | null;
  baseline: Result | null;
  metric: Metric;
  selected: string | null;
  onSelect: (id: string) => void;
  separation: number;
  level: number | null;
  view: "space" | "plan";
  paused: boolean;
  theme: "dark" | "light";
  reset: number;
  lang: "en" | "es";
  closed: Set<string>;
  envelope: boolean;
  cut: number;
}
export default function NetworkScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  const runtime = useRef<{ update: () => void; reset: () => void } | null>(
    null,
  );
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute(
      "aria-label",
      props.lang === "en"
        ? "Interactive mine network. Use the airway list for keyboard selection."
        : "Red de mina interactiva. Use la lista de galerías para seleccionar con teclado.",
    );
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 1000);
    camera.position.set(112, 85, 135);
    camera.lookAt(0, 0, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 25;
    controls.maxDistance = 650;
    controls.maxPolarAngle = Math.PI * 0.93;
    scene.add(new THREE.AmbientLight("#d8eeee", 2.1));
    const key = new THREE.DirectionalLight("#e9fbff", 3.5);
    key.position.set(20, 90, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#98b0ff", 2);
    fill.position.set(-40, 0, -60);
    scene.add(fill);
    let group = new THREE.Group();
    scene.add(group);
    let picks: THREE.Object3D[] = [];
    let framingPoints: THREE.Vector3[] = [];
    let geometryKey = "";
    let particles: {
      mesh: THREE.Points;
      start: THREE.Vector3;
      end: THREE.Vector3;
      speed: number;
      count: number;
      phase: number;
    }[] = [];
    let labels: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
    const tooltip = document.createElement("div");
    tooltip.className = "scene-tooltip";
    tooltip.hidden = true;
    container.append(tooltip);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    let selectedHit: string | null = null;
    function disposeGroup() {
      group.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.LineSegments ||
          o instanceof THREE.Points
        ) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      scene.remove(group);
      group = new THREE.Group();
      scene.add(group);
      labels.forEach((l) => l.el.remove());
      labels = [];
      particles = [];
      picks = [];
    }
    function label(text: string, pos: THREE.Vector3, style = "level-label") {
      const el = document.createElement("div");
      el.className = style;
      el.textContent = text;
      container.append(el);
      labels.push({ el, pos });
    }
    function update() {
      disposeGroup();
      const p = latest.current;
      renderer.domElement.setAttribute(
        "aria-label",
        p.lang === "en"
          ? "Interactive mine network. Use the airway list for keyboard selection."
          : "Red de mina interactiva. Use la lista de galerías para seleccionar con teclado.",
      );
      const ns = p.network.nodes;
      const min = new THREE.Vector3(
        Math.min(...ns.map((n) => n.x)),
        Math.min(...ns.map((n) => n.z)),
        Math.min(...ns.map((n) => n.y)),
      );
      const max = new THREE.Vector3(
        Math.max(...ns.map((n) => n.x)),
        Math.max(...ns.map((n) => n.z)),
        Math.max(...ns.map((n) => n.y)),
      );
      const center = min.clone().add(max).multiplyScalar(0.5);
      const span = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1);
      const scale = 100 / span;
      const map = new Map(
        ns.map((n) => [
          n.id,
          new THREE.Vector3(
            (n.x - center.x) * scale,
            (n.z - center.y) * scale * (1 + p.separation),
            (n.y - center.z) * scale,
          ),
        ]),
      );
      framingPoints = [...map.values()];
      const nextGeometryKey = `${p.network.id}:${min.toArray()}:${max.toArray()}:${p.separation}`;
      const geometryChanged = geometryKey !== nextGeometryKey;
      geometryKey = nextGeometryKey;
      if (p.envelope) {
        const low = (min.y - center.y) * scale * (1 + p.separation) - 5;
        const top =
          ((max.y - center.y) * scale * (1 + p.separation) + 3) * (1 - p.cut) +
          low * p.cut;
        const box = new THREE.BoxGeometry(
          (max.x - min.x) * scale + 18,
          Math.max(0.3, top - low),
          (max.z - min.z) * scale + 18,
        );
        const rock = new THREE.Mesh(
          box,
          new THREE.MeshStandardMaterial({
            color: p.theme === "dark" ? "#9caa9c" : "#758b7a",
            transparent: true,
            opacity: 0.14,
            roughness: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        rock.position.set(0, (top + low) / 2, 0);
        group.add(rock);
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(box),
          new THREE.LineBasicMaterial({
            color: p.theme === "dark" ? "#8d9f88" : "#71907d",
            transparent: true,
            opacity: 0.3,
          }),
        );
        outline.position.copy(rock.position);
        group.add(outline);
        label(
          p.lang === "en"
            ? "ILLUSTRATIVE CONTEXT ENVELOPE"
            : "ENVOLVENTE CONTEXTUAL ILUSTRATIVA",
          new THREE.Vector3(0, low - 4, ((max.z - min.z) * scale) / 2 + 9),
        );
      }
      const levels = [
        ...new Set(
          p.network.edges
            .filter((e) => e.kind === "working")
            .map((e) => e.level),
        ),
      ].sort((a, b) => a - b);
      levels.forEach((level) => {
        const edges = p.network.edges.filter(
          (e) => e.level === level && e.kind === "working",
        );
        const points = edges.flatMap((e) => [map.get(e.from)!, map.get(e.to)!]);
        if (!points.length) return;
        const y = points.reduce((s, v) => s + v.y, 0) / points.length - 2.8;
        const xmin = Math.min(...points.map((v) => v.x)) - 12,
          xmax = Math.max(...points.map((v) => v.x)) + 12,
          zmin = Math.min(...points.map((v) => v.z)) - 12,
          zmax = Math.max(...points.map((v) => v.z)) + 12;
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(xmax - xmin, zmax - zmin),
          new THREE.MeshBasicMaterial({
            color: p.theme === "dark" ? "#6da49b" : "#608b88",
            transparent: true,
            opacity: p.level === null || p.level === level ? 0.045 : 0.012,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.set((xmin + xmax) / 2, y, (zmin + zmax) / 2);
        group.add(plane);
        const grid = new THREE.GridHelper(
          Math.max(xmax - xmin, zmax - zmin),
          12,
          p.theme === "dark" ? "#52756f" : "#9db8b2",
          p.theme === "dark" ? "#30474a" : "#a8bcbb",
        );
        grid.position.set((xmin + xmax) / 2, y, (zmin + zmax) / 2);
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.2;
        group.add(grid);
        if (p.level === null || p.level === level)
          label(
            `${p.lang === "en" ? "LEVEL" : "NIVEL"} ${level + 1}`,
            new THREE.Vector3(xmin, y, zmax + 4),
          );
      });
      p.network.edges.forEach((e, i) => {
        const start = map.get(e.from)!,
          end = map.get(e.to)!;
        const delta = end.clone().sub(start);
        const length = delta.length();
        if (length < 0.001) return;
        const hidden =
          p.level !== null &&
          e.level !== p.level &&
          e.kind !== "intake" &&
          e.kind !== "return" &&
          e.kind !== "fan";
        const closed = p.closed.has(e.id);
        const selected = e.id === p.selected;
        const color = closed
          ? "#626d74"
          : edgeColor(p.network, p.result, i, p.metric, p.baseline);
        const radius = Math.max(0.48, Math.min(1.5, Math.sqrt(e.area) * 0.2));
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, length, 12, 1, false),
          new THREE.MeshStandardMaterial({
            color:
              p.theme === "light"
                ? new THREE.Color(color).multiplyScalar(0.45)
                : color,
            roughness: 0.52,
            metalness: 0.22,
            transparent: true,
            opacity: hidden ? 0.07 : closed ? 0.27 : 0.88,
            emissive: color,
            emissiveIntensity: selected ? 0.35 : p.theme === "light" ? 0 : 0.08,
          }),
        );
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          delta.clone().normalize(),
        );
        mesh.userData = { edgeId: e.id, index: i };
        group.add(mesh);
        if (!hidden) picks.push(mesh);
        if (selected) {
          const halo = new THREE.Mesh(
            new THREE.CylinderGeometry(
              radius * 1.75,
              radius * 1.75,
              length,
              12,
              1,
              true,
            ),
            new THREE.MeshBasicMaterial({
              color: "#d7faf0",
              transparent: true,
              opacity: 0.16,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          halo.position.copy(mesh.position);
          halo.quaternion.copy(mesh.quaternion);
          group.add(halo);
          label(
            e.name[p.lang],
            mesh.position.clone().add(new THREE.Vector3(0, 4, 0)),
            "selection-label",
          );
        }
        if (e.fan) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 2.4, 0.35, 8, 24),
            new THREE.MeshStandardMaterial({
              color: "#f3e5c8",
              emissive: "#a79c6d",
              emissiveIntensity: 0.2,
            }),
          );
          ring.position.copy(mesh.position);
          ring.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            delta.clone().normalize(),
          );
          group.add(ring);
        }
        if (!hidden && !closed && p.result?.converged) {
          const q = p.result.flows[i];
          if (Math.abs(q) < 0.0001) return;
          const count = Math.max(2, Math.min(24, Math.ceil(length / 4)));
          const positions = new Float32Array(count * 3);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
          );
          const dots = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
              color: p.theme === "dark" ? "#f0fff7" : "#073f40",
              size: selected ? 1.1 : 0.8,
              transparent: true,
              opacity: 0.95,
              depthWrite: false,
              sizeAttenuation: true,
            }),
          );
          group.add(dots);
          particles.push({
            mesh: dots,
            start,
            end,
            speed:
              Math.sign(q) *
              Math.min(
                0.22,
                Math.max(
                  0.015,
                  (Math.abs(q) / Math.max(e.area, 1) / Math.max(length, 1)) *
                    0.9,
                ),
              ),
            count,
            phase: i * 0.17,
          });
        }
      });
      ns.forEach((n) => {
        const point = map.get(n.id)!;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(
            n.boundary !== undefined ? 1.45 : 0.58,
            12,
            8,
          ),
          new THREE.MeshStandardMaterial({
            color:
              n.boundary !== undefined
                ? "#eee8d8"
                : p.theme === "dark"
                  ? "#64767d"
                  : "#66817e",
            roughness: 0.5,
          }),
        );
        mesh.position.copy(point);
        group.add(mesh);
        if (n.boundary !== undefined)
          label(
            n.id,
            point.clone().add(new THREE.Vector3(0, 4, 0)),
            "boundary-label",
          );
      });
      controls.enableRotate = p.view === "space";
      if (geometryChanged) fitGeometry();
    }
    function fitGeometry() {
      for (let attempt = 0; attempt < 8; attempt++) {
        camera.updateMatrixWorld();
        const projected = framingPoints.map((point) =>
          point.clone().project(camera),
        );
        const overflow = Math.max(
          1,
          ...projected.map((point) =>
            Math.max(Math.abs(point.x) / 0.82, Math.abs(point.y) / 0.81),
          ),
        );
        if (overflow <= 1.001) break;
        camera.position
          .sub(controls.target)
          .multiplyScalar(overflow * 1.025)
          .add(controls.target);
      }
      controls.update();
    }
    function reset() {
      const plan = latest.current.view === "plan";
      camera.position.set(plan ? 0 : 112, plan ? 165 : 85, plan ? 0.001 : 135);
      camera.position.multiplyScalar(
        Math.max(1, 0.9 / Math.max(camera.aspect, 0.25)),
      );
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      fitGeometry();
      controls.update();
    }
    function resize() {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      const previousFit = Math.max(1, 0.9 / Math.max(camera.aspect, 0.25));
      camera.aspect = w / Math.max(h, 1);
      const nextFit = Math.max(1, 0.9 / Math.max(camera.aspect, 0.25));
      camera.position
        .sub(controls.target)
        .multiplyScalar(nextFit / previousFit)
        .add(controls.target);
      camera.updateProjectionMatrix();
      fitGeometry();
    }
    function hit(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(picks)[0];
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const found = hit(e);
      if (found) latest.current.onSelect(found.object.userData.edgeId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) {
        tooltip.hidden = true;
        return;
      }
      const found = hit(e);
      selectedHit = found ? found.object.userData.edgeId : null;
      renderer.domElement.style.cursor = found ? "pointer" : "grab";
      tooltip.hidden = !found;
      if (found) {
        const p = latest.current;
        const i = found.object.userData.index;
        const edge = p.network.edges[i];
        const q = p.result?.flows[i];
        tooltip.textContent = `${edge.name[p.lang]}${q !== undefined ? ` · ${q.toFixed(2)} m³/s` : ""}`;
        tooltip.style.left = `${Math.min(e.offsetX + 14, container.clientWidth - 230)}px`;
        tooltip.style.top = `${e.offsetY + 20}px`;
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      setFailed(true);
    });
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    runtime.current = { update, reset };
    resize();
    update();
    reset();
    let frame = 0,
      last = performance.now(),
      time = 0;
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!latest.current.paused) time += dt;
      particles.forEach((p) => {
        const attr = p.mesh.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        for (let j = 0; j < p.count; j++) {
          const u = (((j / p.count + time * p.speed + p.phase) % 1) + 1) % 1;
          attr.setXYZ(
            j,
            p.start.x + (p.end.x - p.start.x) * u,
            p.start.y + (p.end.y - p.start.y) * u,
            p.start.z + (p.end.z - p.start.z) * u,
          );
        }
        attr.needsUpdate = true;
      });
      controls.update();
      labels.forEach((l) => {
        const pos = l.pos.clone().project(camera);
        const halfWidth = l.el.offsetWidth / 2 + 8;
        const x = Math.min(
          container.clientWidth - halfWidth,
          Math.max(halfWidth, (pos.x * 0.5 + 0.5) * container.clientWidth),
        );
        l.el.style.transform = `translate(-50%,-50%) translate(${x}px,${(-pos.y * 0.5 + 0.5) * container.clientHeight}px)`;
        l.el.style.display = pos.z > 1 ? "none" : "";
      });
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      runtime.current = null;
      controls.dispose();
      disposeGroup();
      renderer.dispose();
      renderer.domElement.remove();
      tooltip.remove();
    };
  }, []);
  useEffect(
    () => runtime.current?.update(),
    [
      props.network,
      props.result,
      props.metric,
      props.baseline,
      props.selected,
      props.separation,
      props.level,
      props.view,
      props.theme,
      props.lang,
      props.closed,
      props.envelope,
      props.cut,
    ],
  );
  useEffect(
    () => runtime.current?.reset(),
    [props.reset, props.view, props.network.id],
  );
  return (
    <div className="scene" ref={host}>
      {failed && (
        <div className="scene-fallback">
          {props.lang === "en"
            ? "3D is unavailable. The network table and every analytical tool remain available."
            : "3D no está disponible. La tabla de red y todas las herramientas analíticas siguen disponibles."}
        </div>
      )}
    </div>
  );
}
