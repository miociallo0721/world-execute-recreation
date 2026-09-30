import { MVRenderer } from './engine/Renderer';
import { PreviewClock } from './engine/Clock';
import { Timeline } from './engine/Timeline';
import { SceneManager } from './engine/SceneManager';
import { BootScene } from './scenes/BootScene';
import { GeometryScene } from './scenes/GeometryScene';
import { FunctionScene } from './scenes/FunctionScene';
import { SignalScene } from './scenes/SignalScene';
import { NetworkScene } from './scenes/NetworkScene';
import { ResonanceScene } from './scenes/ResonanceScene';
import { FragmentScene } from './scenes/FragmentScene';
import { InvalidArgumentScene } from './scenes/InvalidArgumentScene';
import { MusicTimeline } from './music/MusicTimeline';
import './style.css';

declare global {
  interface Window {
    __FRAME_READY__: boolean;
    __RENDER_FRAME__: (time: number) => void;
    __RENDER_FRAME_INDEX__: (frame: number, fps?: number) => void;
  }
}

const params = new URLSearchParams(location.search);
const renderMode = params.get('render') === '1';
const debugMode = params.get('debug') === '1';
const dimension = (name: string, fallback: number): number => {
  const value = Number(params.get(name));
  return Number.isInteger(value) && value > 0 && value <= 8192 ? value : fallback;
};
const width = dimension('width', 1920);
const height = dimension('height', 1080);
const music = new MusicTimeline();
const requestedFrame = params.get('frame');
const requestedFps = Number(params.get('fps') ?? 60);
const requestedTime = requestedFrame !== null && Number.isFinite(requestedFps) && requestedFps > 0
  ? Number(requestedFrame) / requestedFps : Number(params.get('t') ?? 0);

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');
const stage = document.createElement('div');
stage.id = 'stage';
stage.style.aspectRatio = `${width} / ${height}`;
const overlay = document.createElement('div');
overlay.id = 'overlay';
const bootOverlay = document.createElement('div');
bootOverlay.className = 'scene-overlay';
const geometryOverlay = document.createElement('div');
geometryOverlay.className = 'scene-overlay';
const functionOverlay = document.createElement('div');
functionOverlay.className = 'scene-overlay';
const signalOverlay = document.createElement('div');
signalOverlay.className = 'scene-overlay';
const networkOverlay = document.createElement('div');
networkOverlay.className = 'scene-overlay';
const resonanceOverlay = document.createElement('div');
resonanceOverlay.className = 'scene-overlay';
const fragmentOverlay = document.createElement('div');
fragmentOverlay.className = 'scene-overlay';
const invalidOverlay = document.createElement('div');
invalidOverlay.className = 'scene-overlay';
overlay.append(bootOverlay, geometryOverlay, functionOverlay, signalOverlay, networkOverlay,
  resonanceOverlay, fragmentOverlay, invalidOverlay);
stage.appendChild(overlay);
app.appendChild(stage);

const renderer = new MVRenderer(stage, width, height);
// The canvas is placed below every annotation in the same fixed design space.
stage.insertBefore(renderer.canvas, overlay);
const boot = new BootScene(renderer.three, bootOverlay);
const geometry = new GeometryScene(renderer.three, geometryOverlay);
const functionStart = music.sectionTime('FUNCTION');
const signalStart = music.sectionTime('SIGNAL');
const networkStart = music.sectionTime('NETWORK');
const resonanceStart = music.sectionTime('RESONANCE');
const fragmentStart = music.sectionTime('FRAGMENT');
const invalidStart = music.sectionTime('INVALID_ARGUMENT');
const functionScene = new FunctionScene(renderer.three, functionOverlay, functionStart);
const signalScene = new SignalScene(renderer.three, signalOverlay, signalStart);
const networkScene = new NetworkScene(renderer.three, networkOverlay, networkStart);
const resonanceScene = new ResonanceScene(renderer.three, resonanceOverlay, resonanceStart);
const fragmentScene = new FragmentScene(renderer.three, fragmentOverlay, fragmentStart);
const invalidScene = new InvalidArgumentScene(renderer.three, invalidOverlay, invalidStart);
const timeline = new Timeline([
  { id: 'BOOT', start: 0, end: 12, scene: boot },
  { id: 'GEOMETRY', start: 12, end: functionStart, scene: geometry },
  { id: 'FUNCTION', start: functionStart, end: signalStart, scene: functionScene },
  { id: 'SIGNAL', start: signalStart, end: networkStart, scene: signalScene },
  { id: 'NETWORK', start: networkStart, end: resonanceStart, scene: networkScene },
  { id: 'RESONANCE', start: resonanceStart, end: fragmentStart, scene: resonanceScene },
  { id: 'FRAGMENT', start: fragmentStart, end: invalidStart, scene: fragmentScene },
  { id: 'INVALID_ARGUMENT', start: invalidStart, end: music.sectionTime('END'), scene: invalidScene },
]);
const manager = new SceneManager(timeline, music);
const initialTime = Math.max(0, Math.min(timeline.duration, Number.isFinite(requestedTime) ? requestedTime : 0));
const clock = new PreviewClock(timeline.duration, initialTime);
const audio = new Audio();
audio.preload = 'auto';
let audioUrl: string | null = null;
let audioReady = false;
const audioPlaying = (): boolean => audioReady && !audio.paused;
const currentTime = (): number => audioReady ? audio.currentTime : clock.time;

let controls: HTMLDivElement | null = null;
let playButton: HTMLButtonElement | null = null;
let scrubber: HTMLInputElement | null = null;
let timeReadout: HTMLSpanElement | null = null;
let debug: HTMLDivElement | null = null;
let debugBeat: HTMLDivElement | null = null;
let lastFrameNow = 0;
let fps = 0;
let renderGeneration = 0;

function fitOverlay(): void {
  const scale = stage.clientWidth / 1920;
  overlay.style.transform = `scale(${scale})`;
}

function draw(time: number): void {
  window.__FRAME_READY__ = false;
  const generation = ++renderGeneration;
  const ctx = manager.render(time, width, height, width / 1920);
  bootOverlay.style.display = manager.activeId === 'BOOT' ? 'block' : 'none';
  geometryOverlay.style.display = manager.activeId === 'GEOMETRY' ? 'block' : 'none';
  functionOverlay.style.display = manager.activeId === 'FUNCTION' ? 'block' : 'none';
  signalOverlay.style.display = manager.activeId === 'SIGNAL' ? 'block' : 'none';
  networkOverlay.style.display = manager.activeId === 'NETWORK' ? 'block' : 'none';
  resonanceOverlay.style.display = manager.activeId === 'RESONANCE' ? 'block' : 'none';
  fragmentOverlay.style.display = manager.activeId === 'FRAGMENT' ? 'block' : 'none';
  invalidOverlay.style.display = manager.activeId === 'INVALID_ARGUMENT' ? 'block' : 'none';
  if (scrubber) scrubber.value = time.toFixed(4);
  if (timeReadout) timeReadout.textContent = `${time.toFixed(3)} / ${timeline.duration.toFixed(3)} s`;
  if (playButton) playButton.textContent = (audioReady ? audioPlaying() : clock.isPlaying) ? 'PAUSE' : 'PLAY';
  if (debug) {
    const substage = manager.activeId === 'GEOMETRY' ? geometry.substageAt(ctx.localTime)
      : manager.activeId === 'FUNCTION' ? functionScene.substageAt(ctx.localTime)
      : manager.activeId === 'SIGNAL' ? signalScene.substageAt(ctx.localTime)
      : manager.activeId === 'NETWORK' ? networkScene.substageAt(ctx.localTime)
      : manager.activeId === 'RESONANCE' ? resonanceScene.substageAt(ctx.localTime)
      : manager.activeId === 'FRAGMENT' ? fragmentScene.substageAt(ctx.localTime)
      : manager.activeId === 'INVALID_ARGUMENT' ? invalidScene.substageAt(ctx.localTime) : 'BOOT';
    const nextMarker = Object.entries(ctx.music.markers).filter(([, value]) => value >= time).sort((a,b) => a[1]-b[1])[0];
    debug.firstChild!.textContent = `TIME       ${ctx.time.toFixed(3)}\nBAR        ${ctx.music.barIndex}\nBEAT       ${ctx.music.beatInBar + 1} / ${music.beatsPerBar}\nBEATPHASE  ${ctx.music.beatPhase.toFixed(2)}\nSCENE      ${manager.activeId}\nSUBSTAGE   ${substage}\nLOCAL      ${ctx.localTime.toFixed(3)}\nPROGRESS   ${ctx.progress.toFixed(3)}\nFPS        ${renderMode ? '—' : fps.toFixed(1)}\nRESOLUTION ${width} × ${height}\nNEXT       ${nextMarker?.[0] ?? '—'}`;
    if (debugBeat) debugBeat.textContent = Array.from({ length: music.beatsPerBar }, (_, i) => i === ctx.music.beatInBar ? '●' : '·').join(' ─ ');
  }
  if (renderMode) {
    renderer.three.getContext().finish();
    requestAnimationFrame(() => {
      if (generation === renderGeneration) window.__FRAME_READY__ = true;
    });
  } else window.__FRAME_READY__ = true;
}

function addControls(): void {
  controls = document.createElement('div');
  controls.id = 'controls';
  playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = 'PLAY';
  playButton.addEventListener('click', async () => {
    if (audioReady) {
      if (audioPlaying()) audio.pause();
      else {
        if (audio.currentTime >= timeline.duration - 0.001) audio.currentTime = 0;
        try { await audio.play(); } catch (error) { console.warn('Audio playback unavailable', error); }
      }
    } else if (clock.isPlaying) clock.pause(); else clock.play();
    draw(currentTime());
  });
  scrubber = document.createElement('input');
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(timeline.duration);
  scrubber.step = '0.0001';
  scrubber.value = String(initialTime);
  scrubber.setAttribute('aria-label', 'Timeline position');
  scrubber.addEventListener('input', () => {
    const time = Number(scrubber!.value);
    clock.seek(time);
    if (audioReady) audio.currentTime = time;
    draw(time);
  });
  timeReadout = document.createElement('span');
  timeReadout.className = 'time-readout';
  const loadButton = document.createElement('button');
  loadButton.textContent = 'AUDIO';
  loadButton.title = 'Load an audio file for preview master clock';
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'audio/*'; fileInput.hidden = true;
  loadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;
    audio.load();
    loadButton.textContent = 'AUDIO ✓';
  });
  controls.append(playButton, scrubber, timeReadout, loadButton, fileInput);
  app!.appendChild(controls);
}

async function start(): Promise<void> {
  window.__FRAME_READY__ = false;
  await manager.init();
  manager.resize(width, height);
  if (!renderMode) addControls();
  if (debugMode) {
    debug = document.createElement('div');
    debug.id = 'debug';
    debug.appendChild(document.createElement('pre'));
    debugBeat = document.createElement('div');
    debugBeat.className = 'debug-beats';
    debug.appendChild(debugBeat);
    app!.appendChild(debug);
  }
  audio.addEventListener('loadedmetadata', () => {
    const wasPlaying = clock.isPlaying;
    const time = clock.time;
    clock.pause();
    audio.currentTime = Math.min(time, audio.duration || time);
    audioReady = true;
    if (wasPlaying) void audio.play().catch(error => console.warn('Audio playback unavailable', error));
    draw(currentTime());
  });
  audio.addEventListener('ended', () => draw(Math.min(audio.currentTime, timeline.duration)));
  if (!renderMode && params.get('audio')) audio.src = params.get('audio')!;
  fitOverlay();
  new ResizeObserver(fitOverlay).observe(stage);
  window.__RENDER_FRAME__ = (time: number) => {
    if (!Number.isFinite(time)) throw new Error('Frame time must be finite');
    draw(Math.max(0, Math.min(timeline.duration, time)));
  };
  window.__RENDER_FRAME_INDEX__ = (frame: number, frameRate = 60) => {
    if (!Number.isInteger(frame) || frame < 0 || !Number.isFinite(frameRate) || frameRate <= 0) throw new Error('Invalid frame or fps');
    window.__RENDER_FRAME__(frame / frameRate);
  };
  draw(initialTime);
  if (renderMode) return;
  if (!params.has('t') && !params.has('frame')) clock.play();
  const animate = (now: number): void => {
    if (lastFrameNow > 0) fps = 1000 / Math.max(1, now - lastFrameNow);
    lastFrameNow = now;
    if (audioPlaying() || clock.isPlaying) {
      const time = currentTime();
      if (time >= timeline.duration) { audio.pause(); clock.pause(); }
      draw(Math.min(time, timeline.duration));
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

start().catch(error => {
  console.error(error);
  const message = document.createElement('pre');
  message.className = 'fatal-error';
  message.textContent = `RENDER ERROR\n${String(error)}`;
  app.appendChild(message);
});

window.addEventListener('pagehide', () => {
  manager.dispose();
  renderer.dispose();
  audio.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
});
