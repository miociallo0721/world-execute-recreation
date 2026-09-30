# world.execute(mio);

Code-rendered MV built with TypeScript, Vite, Three.js, WebGL2 and GLSL. The current timeline ends at bar 80 (147.692 seconds at the provisional 130 BPM):

| Scene | Time at current BPM | Description |
| --- | --- | --- |
| BOOT | 0–12 s | The world initializes. |
| GEOMETRY | 12–27.692 s | Static geometry and lattice. |
| FUNCTION | 27.692–48 s | Continuous functions, harmonics, polar curves and surface. |
| SIGNAL | 48–68.308 s | AC, rectification, RC filtering, integration and feedback. |
| NETWORK | 68.308–88.615 s | Graph, matrix, transform, attention, ME and YOU. |
| RESONANCE | 88.615–108.923 s | Oscillators, Lissajous, phase lock, interference and synchronization. |
| FRAGMENT | 108.923–127.385 s | Graph density, memory blocks and a fractured mathematical plane. |
| INVALID_ARGUMENT | 127.385–147.692 s | Quantization, floating point limits, overflow and NaN propagation. |

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Preview

Open `http://127.0.0.1:5173/`. Play/Pause and the slider choose an absolute time. `/?t=56` opens paused at 56 seconds. Click **AUDIO** to load a local track, or use `/?audio=/your-track.wav`. Once loaded, `audio.currentTime` is the preview master clock, including after a seek. Without a track, `PreviewClock` derives a requested time from a fixed wall-clock anchor. Neither path accumulates scene state frame by frame.

`?debug=1` displays global and local time, scene and substage, bar, beat, phase, FPS, resolution and the next marker. The beat indicator appears only in debug mode.

## Exact frame rendering

Open `/?render=1&frame=2880&fps=60` for frame 2880 at exactly 48 seconds. `/?render=1&t=48` remains supported. The frame parameter takes precedence over `t`. Render mode does not start an audio element or animation loop. After drawing, `window.__FRAME_READY__` becomes `true` for browser automation. Use `window.__RENDER_FRAME_INDEX__(frame, fps)` or `window.__RENDER_FRAME__(seconds)` for random access within an open page.

The default canvas is 1920×1080. Add `&width=3840&height=2160` to render 4K. Match the browser viewport to the output size when taking screenshots.

To export a silent MP4 from exact frame times, run:

```bash
npm run build
node ./node_modules/playwright/cli.js install chromium
npm run render
```

`tools/render.mjs` captures each PNG at `frame / fps` and pipes it directly to FFmpeg (H.264, CRF 18, yuv420p). It writes `output/world-execute-mio-1920x1080-60fps.mp4` after encoding succeeds. The timeline currently ends at bar 80, yielding 8,862 frames at 60 fps. Use `npm run render -- --width 3840 --height 2160 --out output/world-4k.mp4` for 4K. Optional `--audio path/to/track.wav` muxes a local track; without one, the MP4 is silent. `--start-frame N --frames N` renders a short excerpt for inspection. The music markers remain provisional until the final audio is supplied.

## Music grid and scene lifecycle

`src/music/world.timeline.json` contains BPM, offset, 4/4 meter, section boundaries and named beat/bar markers. `MusicTimeline` evaluates beat index, phase, pulse, bar and marker times from any input `time`. Scene boundaries and key changes use those values; modifying BPM or offset moves them together. The supplied markers are provisional because a final audio file has not been provided.

`SceneManager` initializes each scene once, calculates its local time and progress from the global timeline, adds a `MusicFrame` to `SceneContext`, and calls `render(ctx)`. Each scene clears and refills preallocated line buffers and explicitly sets its overlay text on every draw. The same time can be rendered in any order with the same result. `dispose()` releases the GPU resources.

The FUNCTION → SIGNAL boundary uses the same analytic `carrier` waveform on both sides. The SIGNAL → NETWORK boundary shares fixed graph coordinates and edges. The NETWORK → RESONANCE → FRAGMENT handoff shares the ME/YOU graph and its connections. FRAGMENT → INVALID_ARGUMENT shares a precomputed Voronoi-like field. No per-frame force simulation, unseeded random values, CSS animation or frame accumulation drives the visuals.

The fragment field is clipped into convex cells once at initialization. A fixed seed gives every cell a stable offset. Precision loss uses `round(value / epsilon) * epsilon`; the floating point example uses `1e20 + 1 === 1e20`; the overflow example checks a non-finite exponential; and NaN begins with `0 / 0` while dependent geometry is explicitly omitted from the GPU buffers.

## Manual music calibration

After choosing the track, align `offset`, BPM and especially `function.sine`, `function.harmonic.*`, `signal.rectification`, `signal.filter`, `network.you`, `network.firstConnection`, `resonance.phaseLock`, `resonance.superposition`, `fragment.topology`, `invalid.infinity` and `invalid.originLost` in `world.timeline.json` to audible events. The supplied markers remain provisional until the final music file is available.
