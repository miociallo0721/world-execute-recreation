import config from './world.timeline.json';

export interface MusicFrame {
  time: number;
  beatIndex: number;
  beatPhase: number;
  barIndex: number;
  beatInBar: number;
  previousBeat: number;
  nextBeat: number;
  beatPulse: number;
  section?: string;
  markers: Readonly<Record<string, number>>;
}

type MusicConfig = {
  bpm: number;
  offset: number;
  timeSignature: [number, number];
  sections: { id: string; bar?: number; time?: number }[];
  markers: { id: string; bar: number; beat: number }[];
};

export class MusicTimeline {
  readonly bpm: number;
  readonly offset: number;
  readonly beatsPerBar: number;
  readonly beatDuration: number;
  readonly barDuration: number;
  readonly markers: Readonly<Record<string, number>>;
  private readonly sections: readonly { id: string; time: number }[];

  constructor(data: MusicConfig = config as MusicConfig) {
    if (!(data.bpm > 0) || data.timeSignature[0] <= 0) throw new Error('Invalid music timeline');
    this.bpm = data.bpm;
    this.offset = data.offset;
    this.beatsPerBar = data.timeSignature[0];
    this.beatDuration = 60 / data.bpm;
    this.barDuration = this.beatDuration * this.beatsPerBar;
    this.markers = Object.freeze(Object.fromEntries(data.markers.map(marker => [
      marker.id, this.barTime(marker.bar) + marker.beat * this.beatDuration,
    ])));
    this.sections = data.sections.map(section => ({
      id: section.id,
      time: section.time ?? this.barTime(section.bar ?? 0),
    }));
  }

  barTime(bar: number): number { return this.offset + bar * this.barDuration; }
  beatTime(beat: number): number { return this.offset + beat * this.beatDuration; }

  markerTime(id: string): number {
    const time = this.markers[id];
    if (time === undefined) throw new Error(`Missing music marker: ${id}`);
    return time;
  }

  sectionTime(id: string): number {
    const section = this.sections.find(item => item.id === id);
    if (!section) throw new Error(`Missing music section: ${id}`);
    return section.time;
  }

  frameAt(time: number): MusicFrame {
    const beatFloat = (time - this.offset) / this.beatDuration;
    const beatIndex = Math.floor(beatFloat);
    const beatPhase = beatFloat - beatIndex;
    const barIndex = Math.floor(beatIndex / this.beatsPerBar);
    const beatInBar = ((beatIndex % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
    let section: string | undefined;
    for (const candidate of this.sections) if (time >= candidate.time) section = candidate.id;
    return {
      time, beatIndex, beatPhase, barIndex, beatInBar,
      previousBeat: this.beatTime(beatIndex),
      nextBeat: this.beatTime(beatIndex + 1),
      beatPulse: Math.exp(-9 * beatPhase),
      section, markers: this.markers,
    };
  }
}
