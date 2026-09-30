// Stateless integer hash: the same seed and index always produce the same value.
export function randomAt(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
