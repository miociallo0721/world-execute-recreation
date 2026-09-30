import { clamp } from '../utils/math';
import { Timeline } from './Timeline';
import type { MVScene, SceneContext } from './types';
import { MusicTimeline } from '../music/MusicTimeline';

export class SceneManager {
  private active: MVScene | null = null;

  constructor(private readonly timeline: Timeline, private readonly music: MusicTimeline) {}

  async init(): Promise<void> {
    await Promise.all(this.timeline.entries.map(entry => entry.scene.init()));
  }

  render(time: number, width: number, height: number, pixelRatio: number): SceneContext {
    const entry = this.timeline.at(time);
    this.active = entry.scene;
    const ctx: SceneContext = {
      time,
      localTime: time - entry.start,
      progress: clamp((time - entry.start) / (entry.end - entry.start), 0, 1),
      width,
      height,
      pixelRatio,
      music: this.music.frameAt(time),
    };
    entry.scene.render(ctx);
    return ctx;
  }

  get activeId(): string { return this.active?.id ?? '—'; }

  resize(width: number, height: number): void {
    for (const entry of this.timeline.entries) entry.scene.resize(width, height);
  }

  dispose(): void {
    for (const entry of this.timeline.entries) entry.scene.dispose();
  }
}
