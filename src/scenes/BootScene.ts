import * as THREE from 'three';
import vertexShader from '../shaders/line.vert?raw';
import fragmentShader from '../shaders/line.frag?raw';
import type { SceneContext } from '../engine/types';
import { SceneBase } from './SceneBase';
import { clamp, lerp, phase } from '../utils/math';
import { easeInOutCubic, easeOutCubic, smoothstep } from '../utils/easing';

type Vec3 = readonly [number, number, number];

class LineBuffer {
  readonly geometry = new THREE.BufferGeometry();
  readonly object: THREE.LineSegments;
  private readonly positions = new Float32Array(30000 * 3);
  private readonly colors = new Float32Array(30000 * 4);
  private count = 0;

  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('lineColor', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, glslVersion: THREE.GLSL3,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.object = new THREE.LineSegments(this.geometry, material);
    this.object.frustumCulled = false;
  }

  clear(): void { this.count = 0; }

  segment(a: Vec3, b: Vec3, alpha: number, tint = 0): void {
    if (alpha <= 0 || this.count + 2 > this.positions.length / 3) return;
    const rgb = tint === 1 ? [0.62, 0.74, 0.88] : [0.91, 0.94, 0.98];
    for (const point of [a, b]) {
      const p = this.count * 3;
      const c = this.count * 4;
      this.positions.set(point, p);
      this.colors.set([rgb[0], rgb[1], rgb[2], alpha], c);
      this.count++;
    }
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

const setText = (el: HTMLElement, value: string, alpha: number): void => {
  el.textContent = value;
  el.style.opacity = String(clamp(alpha, 0, 1));
};

export class BootScene extends SceneBase {
  readonly id = 'BOOT';
  private readonly world = new THREE.Scene();
  private readonly lines = new LineBuffer();
  private readonly camera = new THREE.Camera();
  private readonly ortho = new THREE.OrthographicCamera();
  private readonly perspective = new THREE.PerspectiveCamera();
  private readonly projection = new THREE.Matrix4();
  private readonly projected = new THREE.Vector3();
  private readonly labels: Record<string, HTMLDivElement> = {};
  private width = 1920;
  private height = 1080;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly overlay: HTMLElement,
  ) { super(); }

  init(): void {
    this.world.add(this.lines.object);
    for (const id of ['terminal', 'origin', 'plane', 'domains', 'formula', 'param', 'zformula', 'dimension', 'complete', 'circle0', 'circle1', 'circle2', 'circle3']) {
      const el = document.createElement('div');
      el.className = `annotation annotation-${id}`;
      this.overlay.appendChild(el);
      this.labels[id] = el;
    }
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
    this.perspective.fov = 2 * Math.atan(4.2 / 18) * 180 / Math.PI;
    this.perspective.aspect = aspect;
    this.perspective.near = 0.1;
    this.perspective.far = 100;
    this.perspective.updateProjectionMatrix();
  }

  private positionLabel(el: HTMLElement, point: Vec3, dx = 0, dy = 0): void {
    this.projected.set(...point).project(this.camera);
    el.style.left = `${(this.projected.x * 0.5 + 0.5) * 1920 + dx}px`;
    el.style.top = `${(-this.projected.y * 0.5 + 0.5) * 1080 + dy}px`;
  }

  private setCamera(t: number): void {
    const turn = easeInOutCubic(phase(t, 8.6, 10.3));
    const push = easeInOutCubic(phase(t, 11.6, 12));
    this.camera.position.set(
      lerp(0, 7.0, turn) * (1 - 0.91 * push),
      lerp(0, -5.3, turn) * (1 - 0.91 * push),
      lerp(18, 15.5, turn) - 15.8 * push,
    );
    const lookZ = lerp(0, -2.1, turn) - 10.5 * push;
    this.camera.lookAt(0, 0, lookZ);
    this.camera.updateMatrixWorld();
    this.projection.copy(this.ortho.projectionMatrix);
    const oa = this.projection.elements;
    const pa = this.perspective.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) oa[i] = lerp(oa[i], pa[i], turn);
    this.camera.projectionMatrix.copy(this.projection);
    this.camera.projectionMatrixInverse.copy(this.projection).invert();
  }

  private drawAxes(t: number): void {
    const x = easeOutCubic(phase(t, 3.2, 4.24)) * 6.75;
    const y = easeOutCubic(phase(t, 4.02, 4.75)) * 3.75;
    if (x > 0) {
      this.lines.segment([-x, 0, 0], [x, 0, 0], 0.68);
      this.lines.segment([x - 0.12, 0.055, 0], [x, 0, 0], 0.68);
      this.lines.segment([x - 0.12, -0.055, 0], [x, 0, 0], 0.68);
    }
    if (y > 0) {
      this.lines.segment([0, -y, 0], [0, y, 0], 0.62);
      this.lines.segment([0.055, y - 0.12, 0], [0, y, 0], 0.62);
      this.lines.segment([-0.055, y - 0.12, 0], [0, y, 0], 0.62);
    }
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      const appear = phase(t, 4.35 + (Math.abs(i) - 1) * 0.105, 4.51 + (Math.abs(i) - 1) * 0.105);
      if (appear > 0 && Math.abs(i) < x) this.lines.segment([i, -0.045 * appear, 0], [i, 0.045 * appear, 0], 0.55 * appear);
    }
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const appear = phase(t, 4.55 + (Math.abs(i) - 1) * 0.13, 4.7 + (Math.abs(i) - 1) * 0.13);
      if (appear > 0 && Math.abs(i) < y) this.lines.segment([-0.045 * appear, i, 0], [0.045 * appear, i, 0], 0.5 * appear);
    }
  }

  private gridExtent(t: number): number {
    if (t < 5.2) return 0;
    return 0.5
      + smoothstep(phase(t, 5.2, 5.63))
      + smoothstep(phase(t, 5.64, 6.07))
      + 2 * smoothstep(phase(t, 6.08, 7.0));
  }

  private drawGrid(t: number): void {
    const extent = this.gridExtent(t);
    if (extent <= 0.5) return;
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const edge = clamp((extent - Math.abs(i)) * 3, 0, 1);
      if (!edge) continue;
      this.lines.segment([i, -extent, 0], [i, extent, 0], 0.125 * edge, 1);
      this.lines.segment([-extent, i, 0], [extent, i, 0], 0.125 * edge, 1);
    }
    const e = extent;
    const mark = 0.14;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      this.lines.segment([sx * (e - mark), sy * e, 0], [sx * e, sy * e, 0], 0.18, 1);
      this.lines.segment([sx * e, sy * (e - mark), 0], [sx * e, sy * e, 0], 0.18, 1);
    }
  }

  private drawCircle(t: number): void {
    const amount = easeInOutCubic(phase(t, 7.28, 8.6));
    const segments = Math.ceil(192 * amount);
    for (let i = 0; i < segments; i++) {
      const a = 2 * Math.PI * amount * i / segments;
      const b = 2 * Math.PI * amount * (i + 1) / segments;
      this.lines.segment([Math.cos(a), Math.sin(a), 0], [Math.cos(b), Math.sin(b), 0], 0.88);
    }
    if (amount > 0 && amount < 1) {
      const a = amount * Math.PI * 2;
      const x = Math.cos(a), y = Math.sin(a);
      this.lines.segment([0, 0, 0], [x, y, 0], 0.22, 1);
      this.lines.segment([x - 0.06, y, 0], [x + 0.06, y, 0], 0.75);
      this.lines.segment([x, y - 0.06, 0], [x, y + 0.06, 0], 0.75);
    }
    // A short leader connects the equation to the actual geometry.
    const leader = phase(t, 7.1, 7.55);
    if (leader > 0) {
      this.lines.segment([1.2, 1.4, 0], [1.42, 1.7, 0], 0.22 * leader, 1);
      this.lines.segment([1.42, 1.7, 0], [2.05, 1.7, 0], 0.22 * leader, 1);
    }
  }

  private drawDepth(t: number): void {
    const axis = easeInOutCubic(phase(t, 9.08, 10.3));
    const extend = easeOutCubic(phase(t, 11.6, 12));
    if (axis > 0) this.lines.segment([0, 0, 0], [0, 0, -(7.9 + 9.6 * extend) * axis], 0.55, 1);
    for (let j = 0; j < 12; j++) {
      const appear = j === 0 ? 1 : j < 6
        ? phase(t, 10.3 + (j - 1) * 0.22, 10.5 + (j - 1) * 0.22)
        : phase(t, 11.6 + (j - 6) * 0.055, 11.69 + (j - 6) * 0.055);
      const z = -j * 1.5;
      if (appear <= 0) continue;
      const alpha = (j < 6 ? 0.68 : 0.35) * appear;
      const n = 96;
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * i / n;
        const b = 2 * Math.PI * (i + 1) / n;
        this.lines.segment([Math.cos(a), Math.sin(a), z], [Math.cos(b), Math.sin(b), z], alpha, j === 0 ? 0 : 1);
      }
      if (j > 0) {
        const prevZ = -(j - 1) * 1.5;
        for (let k = 0; k < 12; k++) {
          const a = 2 * Math.PI * k / 12;
          this.lines.segment([Math.cos(a), Math.sin(a), prevZ], [Math.cos(a), Math.sin(a), z], 0.22 * appear, 1);
        }
      }
    }
  }

  private updateLabels(t: number): void {
    const terminal = this.labels.terminal;
    const move = smoothstep(phase(t, 3.1, 4.0));
    terminal.style.left = `${lerp(765, 102, move)}px`;
    terminal.style.top = `${lerp(502, 102, move)}px`;
    terminal.style.opacity = String(1 - smoothstep(phase(t, 5.0, 5.7)));
    const cursor = Math.floor(t * 4) % 2 === 0 ? '_' : ' ';
    if (t < 1.6) {
      terminal.textContent = `> ${cursor}`;
    } else {
      const command = '> init world'.slice(0, Math.floor(phase(t, 1.6, 2.29) * 12));
      const lines = [
        ['coordinate system ........ OK', 2.30, 2.57],
        ['metric ................... EUCLIDEAN', 2.57, 2.87],
        ['dimension ................ 2', 2.87, 3.16],
      ] as const;
      terminal.textContent = command + (t < 2.30 && command.length < 12 ? cursor : '')
        + lines.map(([value, start, end]) => t >= start ? '\n' + value.slice(0, Math.floor(phase(t, start, end) * value.length)) : '').join('');
    }

    setText(this.labels.origin, 'O', phase(t, 3.16, 3.3) * (1 - smoothstep(phase(t, 10.3, 11.5))));
    this.positionLabel(this.labels.origin, [0, 0, 0], 10, 9);
    setText(this.labels.plane, 'ℝ²', phase(t, 5.72, 6.15) * (1 - phase(t, 9.0, 9.7)));
    setText(this.labels.domains, 'x ∈ ℝ\ny ∈ ℝ', phase(t, 6.0, 6.55) * (1 - phase(t, 9.0, 9.7)));
    setText(this.labels.formula, 'x² + y² = 1', phase(t, 7.0, 7.3) * (1 - phase(t, 10.6, 11.3)));
    setText(this.labels.param, 'x = cos θ\ny = sin θ', phase(t, 7.32, 7.66) * (1 - phase(t, 10.6, 11.3)));
    setText(this.labels.zformula, t < 9.38 ? 'z = 0' : 'z ∈ ℝ', phase(t, 8.6, 8.9) * (1 - phase(t, 10.5, 11.2)));
    setText(this.labels.dimension, 'dimension: 2 → 3', phase(t, 8.92, 9.42) * (1 - phase(t, 10.6, 11.3)));
    setText(this.labels.complete, 'WORLD INITIALIZED', phase(t, 10.62, 11.18) * (1 - 0.35 * phase(t, 11.6, 12)));

    for (let i = 0; i < 4; i++) {
      const el = this.labels[`circle${i}`];
      const visibility = phase(t, 10.4 + i * 0.2, 10.7 + i * 0.2) * (1 - phase(t, 11.5, 11.9));
      setText(el, `C${'₀₁₂₃'[i]}`, visibility);
      this.positionLabel(el, [1, 0, -i * 1.5], 10, -7);
    }
  }

  render(ctx: SceneContext): void {
    const t = ctx.localTime;
    this.setCamera(t);
    this.lines.clear();
    if (t >= 3.16) {
      const origin = phase(t, 3.16, 3.29);
      this.lines.segment([-0.016, 0, 0], [0.016, 0, 0], origin);
      this.lines.segment([0, -0.016, 0], [0, 0.016, 0], origin);
    }
    this.drawAxes(t);
    this.drawGrid(t);
    if (t >= 7) this.drawCircle(t);
    if (t >= 8.6) this.drawDepth(t);
    this.lines.flush();
    this.renderer.render(this.world, this.camera);
    this.updateLabels(t);
  }

  dispose(): void {
    this.lines.dispose();
    Object.values(this.labels).forEach(el => el.remove());
  }
}
