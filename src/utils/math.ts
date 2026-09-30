export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

export const phase = (time: number, start: number, end: number): number =>
  clamp((time - start) / (end - start), 0, 1);

export const remap = (value: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number =>
  lerp(outStart, outEnd, (value - inStart) / (inEnd - inStart));

export const lerpVec3 = (a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
