import type { MusicFrame } from '../music/MusicTimeline';

export interface SceneContext {
  time: number;
  localTime: number;
  progress: number;
  width: number;
  height: number;
  pixelRatio: number;
  music: MusicFrame;
}

export interface MVScene {
  readonly id: string;
  init(): Promise<void> | void;
  render(ctx: SceneContext): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface TimelineEntry {
  id: string;
  start: number;
  end: number;
  scene: MVScene;
}
