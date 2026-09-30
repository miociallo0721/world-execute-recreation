import * as THREE from 'three';
import vertexShader from '../shaders/line.vert?raw';
import fragmentShader from '../shaders/line.frag?raw';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { clamp, lerp, lerpVec3, phase } from '../utils/math';
import { easeInOutCubic, smoothstep } from '../utils/easing';

type V = readonly [number, number, number];
type Shape = { name: string; vertices: V[]; edges: [V, V][]; face: V[]; counts: [number, number, number] };

const A0: V = [-2.4, -0.7, 0];
const B0: V = [2.1, -0.7, 0];
const C0: V = [0.15, 1.75, 0];
const A1: V = [-2.35, -1.35, 0];
const B1: V = [2.25, -1.15, 0];
const C1: V = [0.05, 2.15, 0];
const BOOT_FOV = 2 * Math.atan(4.2 / 18) * 180 / Math.PI;

function circumcircle(a: V, b: V, c: V): { x: number; y: number; radius: number } {
  const [ax, ay] = a, [bx, by] = b, [cx, cy] = c;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const aa = ax * ax + ay * ay, bb = bx * bx + by * by, cc = cx * cx + cy * cy;
  const x = (aa * (by - cy) + bb * (cy - ay) + cc * (ay - by)) / d;
  const y = (aa * (cx - bx) + bb * (ax - cx) + cc * (bx - ax)) / d;
  return { x, y, radius: Math.hypot(ax - x, ay - y) };
}

const CIRCUM = circumcircle(A1, B1, C1);

class DraftLines {
  readonly geometry = new THREE.BufferGeometry();
  readonly object: THREE.LineSegments;
  private readonly positions = new Float32Array(40000 * 3);
  private readonly colors = new Float32Array(40000 * 4);
  private count = 0;

  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('lineColor', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    this.object = new THREE.LineSegments(this.geometry, new THREE.ShaderMaterial({
      vertexShader, fragmentShader, glslVersion: THREE.GLSL3,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    }));
    this.object.frustumCulled = false;
  }

  clear(): void { this.count = 0; }

  line(a: V, b: V, alpha: number, blue = false): void {
    if (alpha <= 0 || this.count + 2 > this.positions.length / 3) return;
    const rgb = blue ? [0.62, 0.74, 0.88] : [0.91, 0.94, 0.98];
    for (const point of [a, b]) {
      this.positions.set(point, this.count * 3);
      this.colors.set([rgb[0], rgb[1], rgb[2], clamp(alpha, 0, 1)], this.count * 4);
      this.count++;
    }
  }

  partial(a: V, b: V, amount: number, alpha: number, blue = false): void {
    if (amount > 0) this.line(a, lerpVec3(a, b, clamp(amount, 0, 1)), alpha, blue);
  }

  arc(center: V, radius: number, start: number, sweep: number, amount: number, alpha: number, blue = false, fullSegments = 128): void {
    const p = clamp(amount, 0, 1);
    const n = Math.ceil(fullSegments * Math.abs(sweep) / (2 * Math.PI) * p);
    for (let i = 0; i < n; i++) {
      const x = start + sweep * p * i / n;
      const y = start + sweep * p * (i + 1) / n;
      this.line([center[0] + radius * Math.cos(x), center[1] + radius * Math.sin(x), center[2]],
        [center[0] + radius * Math.cos(y), center[1] + radius * Math.sin(y), center[2]], alpha, blue);
    }
  }

  point(point: V, alpha: number, size = 0.035): void {
    this.line([point[0] - size, point[1], point[2]], [point[0] + size, point[1], point[2]], alpha);
    this.line([point[0], point[1] - size, point[2]], [point[0], point[1] + size, point[2]], alpha);
  }

  flush(): void {
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.lineColor.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
  }
}

function buildShape(name: string, geometry: THREE.BufferGeometry, counts: [number, number, number]): Shape {
  const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
  const positions = edgeGeometry.getAttribute('position');
  const vertices = new Map<string, V>();
  const edges: [V, V][] = [];
  const point = (i: number): V => {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const length = Math.hypot(x, y, z);
    const value: V = [x * 2.05 / length, y * 2.05 / length, z * 2.05 / length];
    const key = value.map(v => v.toFixed(4)).join(',');
    if (!vertices.has(key)) vertices.set(key, value);
    return vertices.get(key)!;
  };
  for (let i = 0; i < positions.count; i += 2) edges.push([point(i), point(i + 1)]);
  const face: V[] = [];
  const raw = geometry.getAttribute('position');
  for (let i = 0; i < Math.min(3, raw.count); i++) {
    const x = raw.getX(i), y = raw.getY(i), z = raw.getZ(i);
    const length = Math.hypot(x, y, z);
    face.push([x * 2.05 / length, y * 2.05 / length, z * 2.05 / length]);
  }
  edgeGeometry.dispose();
  geometry.dispose();
  if (vertices.size !== counts[0] || edges.length !== counts[1]) {
    throw new Error(`${name} topology does not match its Euler counts`);
  }
  return { name, vertices: [...vertices.values()], edges, face, counts };
}

export class GeometryScene extends SceneBase {
  readonly id = 'GEOMETRY';
  private readonly world = new THREE.Scene();
  private readonly lines = new DraftLines();
  private readonly camera = new THREE.Camera();
  private readonly ortho = new THREE.OrthographicCamera();
  private readonly perspective = new THREE.PerspectiveCamera();
  private readonly projection = new THREE.Matrix4();
  private readonly projected = new THREE.Vector3();
  private readonly labels: Record<string, HTMLDivElement> = {};
  private readonly shapes: Shape[] = [];
  private width = 1920;
  private height = 1080;
  private depthOffset = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly overlay: HTMLElement) { super(); }

  substageAt(t: number): string {
    if (t < 2) return 'PLANE';
    if (t < 4) return 'SEGMENT';
    if (t < 6) return 'ANGLE';
    if (t < 8.2) return 'TRIANGLE';
    if (t < 10) return 'POLYGON';
    if (t < 12.2) return 'POLYHEDRON';
    if (t < 14.2) return 'EULER';
    return 'LATTICE';
  }

  private label(id: string, x: number, y: number, size = 14, blue = false): void {
    const el = document.createElement('div');
    el.className = 'annotation';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${size}px`;
    if (blue) el.style.color = '#9caec2';
    this.overlay.appendChild(el);
    this.labels[id] = el;
  }

  init(): void {
    this.world.add(this.lines.object);
    this.shapes.push(
      buildShape('TETRAHEDRON', new THREE.TetrahedronGeometry(1), [4, 6, 4]),
      buildShape('CUBE', new THREE.BoxGeometry(1.4, 1.4, 1.4), [8, 12, 6]),
      buildShape('OCTAHEDRON', new THREE.OctahedronGeometry(1), [6, 12, 8]),
      buildShape('DODECAHEDRON', new THREE.DodecahedronGeometry(1), [20, 30, 12]),
      buildShape('ICOSAHEDRON', new THREE.IcosahedronGeometry(1), [12, 30, 20]),
    );
    this.label('world', 112, 128, 17);
    this.labels.world.style.letterSpacing = '0.18em';
    this.label('transition', 1530, 144, 16, true);
    this.label('origin', 0, 0, 16);
    this.label('A', 0, 0, 15);
    this.label('B', 0, 0, 15);
    this.label('C', 0, 0, 15);
    this.label('G', 0, 0, 15);
    this.label('coordinates', 112, 170, 14, true);
    this.label('parameter', 112, 230, 15);
    this.label('vector', 112, 293, 13, true);
    this.label('angle', 112, 188, 17);
    this.label('bisector', 112, 236, 14, true);
    this.label('centroid', 112, 188, 15);
    this.label('circum', 112, 188, 14, true);
    this.label('polygon', 1500, 170, 16);
    this.label('polyname', 112, 155, 15);
    this.label('counts', 1410, 240, 16, true);
    this.label('euler', 1400, 360, 20);
    this.label('lattice', 112, 180, 14, true);
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.ortho.left = -4.2 * aspect;
    this.ortho.right = 4.2 * aspect;
    this.ortho.top = 4.2;
    this.ortho.bottom = -4.2;
    this.ortho.near = 0.1;
    this.ortho.far = 100;
    this.ortho.updateProjectionMatrix();
    this.perspective.aspect = aspect;
    this.perspective.near = 0.1;
    this.perspective.far = 100;
    this.perspective.updateProjectionMatrix();
  }

  private updateCamera(t: number): void {
    let perspectiveAmount: number;
    let x: number, y: number, z: number, lookZ: number;
    if (t < 2) {
      const p = easeInOutCubic(phase(t, 0, 2));
      perspectiveAmount = 1 - p;
      x = lerp(0.63, 0, p);
      y = lerp(-0.477, 0, p);
      z = lerp(-0.3, -2.8, p);
      lookZ = lerp(-12.6, -14, p);
    } else {
      const turn = easeInOutCubic(phase(t, 10, 10.7));
      const orbit = smoothstep(phase(t, 12.2, 14.2));
      const enter = smoothstep(phase(t, 14.2, 16));
      perspectiveAmount = turn;
      x = 4.2 * turn + 0.8 * orbit - 1.3 * enter;
      y = -2.5 * turn - 0.35 * orbit + 0.55 * enter;
      z = lerp(-2.8, 0.5, turn) - 2.0 * enter;
      lookZ = -14 - 0.8 * enter;
    }
    this.depthOffset = -14 * easeInOutCubic(phase(t, 0, 2));
    this.lines.object.position.z = this.depthOffset;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, lookZ);
    this.camera.updateMatrixWorld();
    this.perspective.fov = t < 2 ? BOOT_FOV : 38;
    this.perspective.updateProjectionMatrix();
    this.projection.copy(this.ortho.projectionMatrix);
    const o = this.projection.elements;
    const p = this.perspective.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) o[i] = lerp(o[i], p[i], perspectiveAmount);
    this.camera.projectionMatrix.copy(this.projection);
    this.camera.projectionMatrixInverse.copy(this.projection).invert();
  }

  private place(id: string, point: V, dx = 10, dy = -15): void {
    this.projected.set(point[0], point[1], point[2] + this.depthOffset).project(this.camera);
    this.labels[id].style.left = `${(this.projected.x * 0.5 + 0.5) * 1920 + dx}px`;
    this.labels[id].style.top = `${(-this.projected.y * 0.5 + 0.5) * 1080 + dy}px`;
  }

  private text(id: string, value: string, alpha: number): void {
    const el = this.labels[id];
    el.textContent = value;
    el.style.opacity = String(clamp(alpha, 0, 1));
  }

  private drawBootBase(alpha: number): void {
    if (alpha <= 0) return;
    const l = this.lines;
    l.line([-6.75, 0, 0], [6.75, 0, 0], 0.68 * alpha);
    l.line([6.63, 0.055, 0], [6.75, 0, 0], 0.68 * alpha);
    l.line([6.63, -0.055, 0], [6.75, 0, 0], 0.68 * alpha);
    l.line([0, -3.75, 0], [0, 3.75, 0], 0.62 * alpha);
    l.line([0.055, 3.63, 0], [0, 3.75, 0], 0.62 * alpha);
    l.line([-0.055, 3.63, 0], [0, 3.75, 0], 0.62 * alpha);
    for (let i = -6; i <= 6; i++) if (i) l.line([i, -0.045, 0], [i, 0.045, 0], 0.55 * alpha);
    for (let i = -3; i <= 3; i++) if (i) l.line([-0.045, i, 0], [0.045, i, 0], 0.5 * alpha);
    for (let i = -4; i <= 4; i++) if (i) {
      l.line([i, -4.5, 0], [i, 4.5, 0], 0.125 * alpha, true);
      l.line([-4.5, i, 0], [4.5, i, 0], 0.125 * alpha, true);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      l.line([sx * 4.36, sy * 4.5, 0], [sx * 4.5, sy * 4.5, 0], 0.18 * alpha, true);
      l.line([sx * 4.5, sy * 4.36, 0], [sx * 4.5, sy * 4.5, 0], 0.18 * alpha, true);
    }
    l.point([0, 0, 0], alpha, 0.016);
    l.line([1.2, 1.4, 0], [1.42, 1.7, 0], 0.22 * alpha, true);
    l.line([1.42, 1.7, 0], [2.05, 1.7, 0], 0.22 * alpha, true);
    l.arc([0, 0, 0], 1, 0, 2 * Math.PI, 1, 0.88 * alpha, false, 192);
  }

  private updateCylinderPlane(t: number): void {
    const p = easeInOutCubic(phase(t, 0, 2));
    const old = 1 - smoothstep(phase(t, 0.85, 1.9));
    this.drawBootBase(old);
    const l = this.lines;
    const depth = 1 - p;
    if (old > 0) l.line([0, 0, 0], [0, 0, -17.5 * depth], 0.55 * old, true);
    for (let j = 0; j < 12; j++) {
      const z = -1.5 * j * depth;
      const radius = 1 + j * 0.35 * p;
      const alpha = (j < 6 ? 0.68 : 0.35) * old;
      if (alpha <= 0) continue;
      l.arc([0, 0, z], radius, 0, 2 * Math.PI, 1, alpha, j !== 0, 96);
      if (j > 0) {
        const prevZ = -1.5 * (j - 1) * depth;
        const prevRadius = 1 + (j - 1) * 0.35 * p;
        for (let k = 0; k < 12; k++) {
          const a = 2 * Math.PI * k / 12;
          l.line([prevRadius * Math.cos(a), prevRadius * Math.sin(a), prevZ],
            [radius * Math.cos(a), radius * Math.sin(a), z], 0.22 * old, true);
        }
      }
    }
  }

  private updatePlane(t: number): void {
    const intro = smoothstep(phase(t, 1.0, 2.0));
    const exit = 1 - smoothstep(phase(t, 9.9, 10.7));
    const alpha = intro * exit;
    if (alpha <= 0) return;
    const l = this.lines;
    for (let i = -3; i <= 3; i++) {
      if (i) {
        l.line([i, -3.35, 0], [i, 3.35, 0], 0.08 * alpha, true);
        l.line([-5.7, i, 0], [5.7, i, 0], 0.08 * alpha, true);
      }
    }
    l.line([-5.7, 0, 0], [5.7, 0, 0], 0.3 * alpha);
    l.line([0, -3.35, 0], [0, 3.35, 0], 0.3 * alpha);
    l.point([0, 0, 0], 0.75 * alpha, 0.023);
    l.partial([-3.5, -2.2, 0], [3.5, 2.2, 0], phase(t, 1.6, 2), 0.13 * alpha, true);
  }

  private updateSegmentConstruction(t: number): void {
    const enter = smoothstep(phase(t, 2, 2.4));
    const leave = 1 - smoothstep(phase(t, 6, 6.5));
    const alpha = enter * leave;
    if (alpha <= 0) return;
    const l = this.lines;
    l.point(A0, alpha);
    l.point(B0, alpha);
    const segment = easeInOutCubic(phase(t, 2.82, 3.68));
    l.partial(A0, B0, segment, 0.88 * alpha);
    const offsetA: V = [A0[0], A0[1] - 0.42, 0];
    const offsetB: V = [B0[0], B0[1] - 0.42, 0];
    const vector = phase(t, 3.25, 3.8) * (1 - phase(t, 4.25, 5.0));
    l.partial(offsetA, offsetB, vector, 0.2 * alpha, true);
    if (vector > 0) {
      const tip = lerpVec3(offsetA, offsetB, vector);
      l.line([tip[0] - 0.12, tip[1] + 0.06, 0], tip, 0.2 * alpha, true);
      l.line([tip[0] - 0.12, tip[1] - 0.06, 0], tip, 0.2 * alpha, true);
    }
  }

  private updateAngleConstruction(t: number): void {
    const alpha = smoothstep(phase(t, 4, 4.35)) * (1 - smoothstep(phase(t, 6.0, 6.55)));
    if (alpha <= 0) return;
    const l = this.lines;
    l.point(C0, alpha);
    l.partial(B0, C0, easeInOutCubic(phase(t, 4.12, 4.52)), 0.87 * alpha);
    const angleC = Math.atan2(C0[1] - B0[1], C0[0] - B0[0]);
    const sweep = Math.PI - angleC;
    l.arc(B0, 1.08, angleC, sweep, phase(t, 4.5, 5.05), 0.33 * alpha, true);
    const q1: V = [B0[0] - 1.08, B0[1], 0];
    const q2: V = [B0[0] + 1.08 * Math.cos(angleC), B0[1] + 1.08 * Math.sin(angleC), 0];
    l.point(q1, phase(t, 4.8, 5.05) * alpha, 0.025);
    l.point(q2, phase(t, 4.8, 5.05) * alpha, 0.025);
    const bisector = (Math.PI + angleC) / 2;
    const p: V = [B0[0] + 2.25 * Math.cos(bisector), B0[1] + 2.25 * Math.sin(bisector), 0];
    const compassRadius = Math.hypot(p[0] - q1[0], p[1] - q1[1]);
    const towardP1 = Math.atan2(p[1] - q1[1], p[0] - q1[0]);
    const towardP2 = Math.atan2(p[1] - q2[1], p[0] - q2[0]);
    l.arc(q1, compassRadius, towardP1 - 0.27, 0.54, phase(t, 5.03, 5.34), 0.28 * alpha, true);
    l.arc(q2, compassRadius, towardP2 - 0.27, 0.54, phase(t, 5.12, 5.43), 0.28 * alpha, true);
    l.partial(B0, p, easeInOutCubic(phase(t, 5.38, 5.88)), 0.58 * alpha, true);
  }

  private trianglePoints(t: number): [V, V, V] {
    const p = easeInOutCubic(phase(t, 6.0, 6.62));
    return [lerpVec3(A0, A1, p), lerpVec3(B0, B1, p), lerpVec3(C0, C1, p)];
  }

  private updateTriangle(t: number): void {
    const enter = smoothstep(phase(t, 6, 6.25));
    const leave = 1 - smoothstep(phase(t, 8.75, 9.12));
    const alpha = enter * leave;
    if (alpha <= 0) return;
    const [a, b, c] = this.trianglePoints(t);
    const l = this.lines;
    l.point(a, alpha);
    l.point(b, alpha);
    l.point(c, alpha);
    l.line(a, b, 0.88 * alpha);
    l.line(b, c, 0.88 * alpha);
    l.partial(c, a, easeInOutCubic(phase(t, 6.42, 6.85)), 0.88 * alpha);
    const mid = (u: V, v: V): V => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, 0];
    const medians: [V, V, number, number][] = [
      [a, mid(b, c), 6.92, 7.24],
      [b, mid(a, c), 7.26, 7.58],
      [c, mid(a, b), 7.6, 7.92],
    ];
    for (const [start, end, from, to] of medians) {
      const p = easeInOutCubic(phase(t, from, to));
      l.partial(start, end, p, 0.38 * alpha, true);
    }
    const g: V = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, 0];
    l.point(g, phase(t, 7.94, 8.18) * alpha, 0.055);
  }

  private polygonVertices(n: number): V[] {
    return Array.from({ length: n }, (_, k) => {
      const theta = 2 * Math.PI * k / n;
      return [CIRCUM.x - CIRCUM.radius * Math.sin(theta), CIRCUM.y + CIRCUM.radius * Math.cos(theta), 0];
    });
  }

  private drawPolygon(n: number, alpha: number): void {
    if (alpha <= 0) return;
    const points = this.polygonVertices(n);
    for (let k = 0; k < n; k++) {
      this.lines.line(points[k], points[(k + 1) % n], 0.8 * alpha);
      this.lines.point(points[k], 0.65 * alpha, 0.025);
    }
  }

  private polygonState(t: number): { n: number; next: number | null; blend: number } {
    const states = [
      { start: 8.86, n: 3 },
      { start: 9.12, n: 4 },
      { start: 9.34, n: 5 },
      { start: 9.53, n: 6 },
      { start: 9.70, n: 8 },
      { start: 9.85, n: 12 },
    ];
    let index = 0;
    for (let i = 1; i < states.length; i++) if (t >= states[i].start) index = i;
    const next = states[index + 1];
    const blend = next ? smoothstep(phase(t, next.start - 0.13, next.start)) : 0;
    return { n: states[index].n, next: next?.n ?? null, blend };
  }

  private updatePolygon(t: number): void {
    const circle = smoothstep(phase(t, 8.2, 8.5)) * (1 - smoothstep(phase(t, 10, 10.4)));
    if (circle <= 0) return;
    this.lines.arc([CIRCUM.x, CIRCUM.y, 0], CIRCUM.radius, 0, 2 * Math.PI,
      easeInOutCubic(phase(t, 8.3, 8.92)), 0.48 * circle, true);
    const polyAlpha = smoothstep(phase(t, 8.82, 9.05)) * (1 - smoothstep(phase(t, 10, 10.35)));
    const state = this.polygonState(t);
    this.drawPolygon(state.n, polyAlpha * (1 - state.blend));
    if (state.next !== null) this.drawPolygon(state.next, polyAlpha * state.blend);
    // The angular rule is also used for every visible vertex above.
    if (t >= 8.86 && t < 10.3) this.text('polygon', `n = ${state.blend > 0.5 && state.next ? state.next : state.n}\nθₖ = 2πk/n`, polyAlpha);
  }

  private renderShape(shape: Shape, at: V, alpha: number, depth = 1, vertices = false): void {
    if (alpha <= 0) return;
    const move = (p: V): V => [p[0] + at[0], p[1] + at[1], p[2] * depth + at[2]];
    for (const [a, b] of shape.edges) this.lines.line(move(a), move(b), alpha, true);
    if (vertices) for (const p of shape.vertices) this.lines.point(move(p), 0.65 * alpha, 0.028);
  }

  private updatePolyhedron(t: number): void {
    if (t < 10 || t >= 14.25) return;
    const enter = smoothstep(phase(t, 10, 10.28));
    const depth = smoothstep(phase(t, 10, 10.62));
    const exit = 1 - smoothstep(phase(t, 14.1, 14.4));
    const morph = [10.2, 10.58, 10.98, 11.38, 11.78];
    let index = 0;
    for (let i = 1; i < morph.length; i++) if (t >= morph[i]) index = i;
    const next = morph[index + 1];
    const blend = next ? smoothstep(phase(t, next - 0.16, next)) : 0;
    this.renderShape(this.shapes[index], [0, 0, 0], 0.86 * enter * exit * (1 - blend), depth, t >= 12.4);
    if (next) this.renderShape(this.shapes[index + 1], [0, 0, 0], 0.86 * enter * exit * blend, depth);

    if (t >= 12.2) {
      const face = this.shapes[4].face;
      const highlight = phase(t, 13.12, 13.46) * (1 - phase(t, 13.72, 14.1));
      if (face.length === 3) for (let i = 0; i < 3; i++) {
        this.lines.line(face[i], face[(i + 1) % 3], 0.34 * highlight, true);
      }
    }
  }

  private updateEuler(t: number): void {
    if (t < 12.2 || t > 14.45) return;
    const vertices = phase(t, 12.45, 12.77) * (1 - phase(t, 13.2, 13.55));
    for (const p of this.shapes[4].vertices) this.lines.point(p, 0.75 * vertices, 0.045);
    const edgePulse = phase(t, 12.78, 13.1) * (1 - phase(t, 13.48, 13.78));
    this.renderShape(this.shapes[4], [0, 0, 0], 0.25 * edgePulse);
  }

  private updateLattice(t: number): void {
    if (t < 14.2) return;
    const first = smoothstep(phase(t, 14.35, 15.0));
    const second = smoothstep(phase(t, 15.02, 15.58));
    const simplify = smoothstep(phase(t, 15.6, 16));
    const spacing = 5.2;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const shell = Math.abs(i) + Math.abs(j) + Math.abs(k);
      // Eleven deliberate lattice sites remain legible when viewed in perspective.
      if (shell > 1 && !(k === 0 && Math.abs(i) === 1 && Math.abs(j) === 1)) continue;
      const reveal = shell === 0 ? 1 : shell === 1 ? first : second;
      if (reveal <= 0) continue;
      const at: V = [i * spacing, j * spacing, k * spacing];
      const base = shell === 0 ? 0.84 : shell === 1 ? 0.34 : shell === 2 ? 0.18 : 0.11;
      this.renderShape(this.shapes[4], at, base * reveal * (1 - 0.78 * simplify));
      if (simplify > 0) {
        for (const p of this.shapes[4].vertices) {
          const point: V = [p[0] + at[0], p[1] + at[1], p[2] + at[2]];
          this.lines.point(point, base * reveal * simplify, 0.022);
        }
      }
      if (shell === 1) this.lines.line([0, 0, 0], at, 0.13 * reveal * (0.5 + 0.5 * simplify), true);
    }
  }

  private updateLabels(t: number): void {
    this.text('world', 'WORLD INITIALIZED', 0.65 * (1 - smoothstep(phase(t, 0.0, 0.75))));
    this.text('transition', 'ℝ³ → ℝ²', phase(t, 0.42, 0.9) * (1 - phase(t, 1.5, 2.12)));
    this.text('origin', 'O', phase(t, 1.45, 1.85) * (1 - phase(t, 3.0, 3.5)));
    this.place('origin', [0, 0, 0], 10, 8);

    const pointAlpha = phase(t, 2.0, 2.32) * (1 - phase(t, 8.8, 9.2));
    const [a, b, c] = t < 6 ? [A0, B0, C0] : this.trianglePoints(t);
    this.text('A', 'A', pointAlpha);
    this.text('B', 'B', pointAlpha);
    this.text('C', 'C', phase(t, 4.02, 4.3) * (1 - phase(t, 8.8, 9.2)));
    this.place('A', a, -16, 4);
    this.place('B', b, 9, 4);
    this.place('C', c, 8, -22);
    const g: V = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, 0];
    this.text('G', 'G', phase(t, 7.94, 8.18) * (1 - phase(t, 8.8, 9.2)));
    this.place('G', g, 10, 4);

    this.text('coordinates', 'A(x₁, y₁)\nB(x₂, y₂)', phase(t, 2.15, 2.48) * (1 - phase(t, 3.6, 4.05)));
    this.text('parameter', 'P(t) = A + t(B - A)\nt: 0 → 1', phase(t, 2.75, 3.1) * (1 - phase(t, 4.0, 4.35)));
    this.text('vector', 'B - A', phase(t, 3.22, 3.6) * (1 - phase(t, 4.25, 4.65)));
    this.text('angle', '∠ABC', phase(t, 4.1, 4.45) * (1 - phase(t, 5.8, 6.2)));
    this.text('bisector', '∠ABP = ∠PBC', phase(t, 5.28, 5.65) * (1 - phase(t, 6.05, 6.4)));
    this.text('centroid', 'G = (A + B + C) / 3', phase(t, 7.78, 8.12) * (1 - phase(t, 8.2, 8.55)));
    this.text('circum', '(x - a)² + (y - b)² = r²', phase(t, 8.26, 8.62) * (1 - phase(t, 9.85, 10.25)));
    if (t < 8.86 || t >= 10.3) this.text('polygon', '', 0);

    const names = ['TETRAHEDRON', 'CUBE', 'OCTAHEDRON', 'DODECAHEDRON', 'ICOSAHEDRON'];
    const starts = [10.2, 10.58, 10.98, 11.38, 11.78];
    let index = 0;
    for (let i = 1; i < starts.length; i++) if (t >= starts[i]) index = i;
    const polyLabel = t >= 12.2 ? 'ICOSAHEDRON' : names[index];
    this.text('polyname', polyLabel, phase(t, 10.12, 10.37) * (1 - phase(t, 14.2, 14.45)));

    const v = phase(t, 12.45, 12.75);
    const e = phase(t, 12.8, 13.1);
    const f = phase(t, 13.15, 13.45);
    const [vertexCount, edgeCount, faceCount] = this.shapes[4].counts;
    this.text('counts', `${v > 0 ? `V = ${vertexCount}` : 'V'}\n${e > 0 ? `E = ${edgeCount}` : 'E'}\n${f > 0 ? `F = ${faceCount}` : 'F'}`,
      phase(t, 12.32, 12.55) * (1 - phase(t, 14.2, 14.45)));
    const expression = t < 13.26 ? 'V - E + F' : t < 13.67
      ? `${vertexCount} - ${edgeCount} + ${faceCount}`
      : `V - E + F = ${vertexCount - edgeCount + faceCount}`;
    this.text('euler', expression, phase(t, 12.55, 12.9) * (1 - phase(t, 14.55, 14.9)));
    this.text('lattice', 'p = i·a + j·b + k·c\ni,j,k ∈ ℤ', phase(t, 14.3, 14.65));
  }

  render(ctx: SceneContext): void {
    const t = ctx.localTime;
    this.updateCamera(t);
    this.lines.clear();
    if (t < 2) this.updateCylinderPlane(t);
    this.updatePlane(t);
    if (t >= 2 && t < 6.55) this.updateSegmentConstruction(t);
    if (t >= 4 && t < 6.55) this.updateAngleConstruction(t);
    if (t >= 6 && t < 9.12) this.updateTriangle(t);
    if (t >= 8.2 && t < 10.4) this.updatePolygon(t);
    this.updatePolyhedron(t);
    this.updateEuler(t);
    this.updateLattice(t);
    this.lines.flush();
    this.renderer.render(this.world, this.camera);
    this.updateLabels(t);
  }

  dispose(): void {
    this.lines.dispose();
    Object.values(this.labels).forEach(el => el.remove());
  }
}
