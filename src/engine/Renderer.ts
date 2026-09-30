import * as THREE from 'three';

export class MVRenderer {
  readonly three: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;

  constructor(container: HTMLElement, readonly width: number, readonly height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mv-canvas';
    container.appendChild(this.canvas);
    this.three = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!this.three.capabilities.isWebGL2) throw new Error('WebGL2 is required');
    this.three.setClearColor(0x000000, 1);
    this.three.setPixelRatio(1);
    this.three.setSize(width, height, false);
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.NoToneMapping;
  }

  dispose(): void { this.three.dispose(); }
}
