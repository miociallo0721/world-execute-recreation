export class PreviewClock {
  private anchorTime = 0;
  private anchorNow = 0;
  private playing = false;

  constructor(private readonly duration: number, initialTime = 0) {
    this.anchorTime = Math.max(0, Math.min(duration, initialTime));
  }

  get isPlaying(): boolean { return this.playing; }

  get time(): number {
    if (!this.playing) return this.anchorTime;
    return Math.min(this.duration, this.anchorTime + (performance.now() - this.anchorNow) / 1000);
  }

  play(): void {
    if (this.playing) return;
    if (this.anchorTime >= this.duration) this.anchorTime = 0;
    this.anchorNow = performance.now();
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.anchorTime = this.time;
    this.playing = false;
  }

  seek(time: number): void {
    this.anchorTime = Math.max(0, Math.min(this.duration, time));
    this.anchorNow = performance.now();
  }
}
