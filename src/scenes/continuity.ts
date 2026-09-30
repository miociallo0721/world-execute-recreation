import type { MusicFrame } from '../music/MusicTimeline';

// A spatial sample of one periodic signal. Both scene boundary renderers call this exact function.
export function carrier(x: number, music: MusicFrame): number {
  const cycle = (music.beatIndex + music.beatPhase) / 4;
  return 0.84 * Math.sin(1.55 * x - 2 * Math.PI * cycle);
}

export const graphNodes: readonly (readonly [number, number])[] = [
  [-2.7,0],[-0.9,1.65],[-0.55,0.2],[-0.9,-1.5],[1.25,2.05],[1.65,0.65],[1.55,-0.75],[1.0,-2.05],
];
export const graphEdges: readonly (readonly [number, number])[] = [
  [0,1],[0,2],[0,3],[1,4],[1,5],[2,5],[2,6],[3,6],[3,7],[4,5],[5,6],[6,7],[1,2],[2,3],
];
