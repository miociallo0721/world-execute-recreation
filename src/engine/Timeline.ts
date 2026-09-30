import type { TimelineEntry } from './types';

export class Timeline {
  readonly duration: number;

  constructor(readonly entries: readonly TimelineEntry[]) {
    if (entries.length === 0) throw new Error('Timeline needs at least one scene');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.end <= entry.start || (i > 0 && entry.start < entries[i - 1].end)) {
        throw new Error(`Invalid timeline entry: ${entry.id}`);
      }
    }
    this.duration = entries[entries.length - 1].end;
  }

  at(time: number): TimelineEntry {
    // The final endpoint is intentionally owned by the last scene.
    return this.entries.find(entry => time >= entry.start && time < entry.end)
      ?? (time >= this.duration ? this.entries[this.entries.length - 1] : this.entries[0]);
  }
}
