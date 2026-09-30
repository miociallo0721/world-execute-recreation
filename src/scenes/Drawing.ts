import * as THREE from 'three';
import vertexShader from '../shaders/line.vert?raw';
import fragmentShader from '../shaders/line.frag?raw';
import { clamp, lerp } from '../utils/math';

export type V = readonly [number, number, number];
const WHITE: V = [0.91, 0.94, 0.98];
const BLUE: V = [0.59, 0.71, 0.83];
const AMBER: V = [0.68, 0.43, 0.22];
const DIM_RED: V = [0.57, 0.29, 0.27];

export class Drawing {
  readonly geometry = new THREE.BufferGeometry();
  readonly object: THREE.LineSegments;
  private readonly positions = new Float32Array(90000 * 3);
  private readonly colors = new Float32Array(90000 * 4);
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

  line(a: V, b: V, alpha = 1, blue = false): void {
    this.coloredLine(a,b,alpha,blue?BLUE:WHITE);
  }

  warningLine(a: V, b: V, alpha = 1, red = false): void {
    this.coloredLine(a,b,alpha,red?DIM_RED:AMBER);
  }

  private coloredLine(a: V, b: V, alpha: number, color: V): void {
    if (alpha <= 0 || this.count + 2 > this.positions.length / 3) return;
    for (const point of [a, b]) {
      this.positions.set(point, this.count * 3);
      this.colors.set([color[0], color[1], color[2], clamp(alpha, 0, 1)], this.count * 4);
      this.count++;
    }
  }

  partial(a: V, b: V, p: number, alpha = 1, blue = false): void {
    if (p <= 0) return;
    const q = clamp(p, 0, 1);
    this.line(a, [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)], alpha, blue);
  }

  curve(fn: (u: number) => V, start: number, end: number, segments: number, alpha = 1, blue = false): void {
    if (alpha <= 0) return;
    for (let i = 0; i < segments; i++) {
      const a = start + (end - start) * i / segments;
      const b = start + (end - start) * (i + 1) / segments;
      this.line(fn(a), fn(b), alpha, blue);
    }
  }

  circle(cx: number, cy: number, r: number, alpha = 1, amount = 1, z = -14, blue = false): void {
    if (amount <= 0) return;
    this.curve(u => [cx + r * Math.cos(u), cy + r * Math.sin(u), z], 0, 2 * Math.PI * clamp(amount, 0, 1), Math.max(1, Math.ceil(96 * amount)), alpha, blue);
  }

  point(p: V, alpha = 1, size = 0.045, blue = false): void {
    this.line([p[0] - size, p[1], p[2]], [p[0] + size, p[1], p[2]], alpha, blue);
    this.line([p[0], p[1] - size, p[2]], [p[0], p[1] + size, p[2]], alpha, blue);
  }

  warningPoint(p: V, alpha = 1, size = 0.045, red = false): void {
    this.warningLine([p[0]-size,p[1],p[2]],[p[0]+size,p[1],p[2]],alpha,red);
    this.warningLine([p[0],p[1]-size,p[2]],[p[0],p[1]+size,p[2]],alpha,red);
  }

  rect(x0: number, y0: number, x1: number, y1: number, alpha = 1, z = -14, blue = false): void {
    this.line([x0,y0,z],[x1,y0,z],alpha,blue);
    this.line([x1,y0,z],[x1,y1,z],alpha,blue);
    this.line([x1,y1,z],[x0,y1,z],alpha,blue);
    this.line([x0,y1,z],[x0,y0,z],alpha,blue);
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

export class Annotations {
  private readonly items = new Map<string, HTMLDivElement>();
  constructor(private readonly root: HTMLElement) {}
  set(id: string, value: string, x: number, y: number, alpha: number, size = 16, blue = false): void {
    let el = this.items.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'annotation';
      this.root.appendChild(el);
      this.items.set(id, el);
    }
    el.textContent = value;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${size}px`;
    el.style.color = blue ? '#9baec1' : '#dce6f0';
    el.style.opacity = String(clamp(alpha, 0, 1));
  }
  warning(id: string, value: string, x: number, y: number, alpha: number, size = 15, red = false): void {
    this.set(id,value,x,y,alpha,size);
    this.items.get(id)!.style.color=red?'#a67873':'#bb946b';
  }
  clear(): void { for (const el of this.items.values()) el.style.opacity = '0'; }
  dispose(): void { for (const el of this.items.values()) el.remove(); this.items.clear(); }
}
