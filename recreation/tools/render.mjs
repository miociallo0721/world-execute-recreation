import { createServer } from 'node:http';
import { readFile, rename, mkdir, stat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(project, 'dist');

const options = { width: 1920, height: 1080, fps: 60, startFrame: 0, frames: null, audio: '../media/soundtrack.m4a', out: null, capture: 'png' };
const names = new Map([
  ['--width', 'width'], ['--height', 'height'], ['--fps', 'fps'],
  ['--start-frame', 'startFrame'], ['--frames', 'frames'],
  ['--audio', 'audio'], ['--out', 'out'], ['--capture', 'capture'],
]);
for (let index = 2; index < process.argv.length; index += 2) {
  const key = names.get(process.argv[index]);
  if (!key || !process.argv[index + 1]) throw new Error(`Unknown or incomplete option: ${process.argv[index]}`);
  options[key] = ['audio','out','capture'].includes(key) ? process.argv[index + 1] : Number(process.argv[index + 1]);
}
for (const key of ['width', 'height', 'fps']) {
  if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`Invalid ${key}`);
}
if (options.width > 8192 || options.height > 8192) throw new Error('Dimensions exceed the renderer limit');
if (!['png','raw'].includes(options.capture)) throw new Error('Capture must be png or raw');
if (!Number.isInteger(options.startFrame) || options.startFrame < 0) throw new Error('Invalid start frame');
if (options.frames !== null && (!Number.isInteger(options.frames) || options.frames < 1)) throw new Error('Invalid frame count');

const duration = JSON.parse(await readFile(resolve(project,'src/sequence.json'),'utf8')).duration;
const totalFrames = Math.ceil(duration * options.fps);
if (options.startFrame >= totalFrames) throw new Error('Start frame is past the timeline end');
const frameCount = Math.min(options.frames ?? totalFrames, totalFrames - options.startFrame);
const out = resolve(project, options.out ?? `output/opening-recreation-${options.width}x${options.height}-${options.fps}fps.mp4`);
const partial = `${out}.partial.mp4`;
await stat(resolve(dist, 'index.html')).catch(() => { throw new Error('Build the project first: npm run build'); });
if (!ffmpegPath) throw new Error('ffmpeg-static did not provide an FFmpeg executable');
await mkdir(dirname(out), { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/frame' && request.method === 'POST') {
      if (!encoder || encoderError) throw encoderError ?? new Error('Encoder is not ready');
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (!encoder.stdin.write(chunk)) await once(encoder.stdin, 'drain');
      }
      if (size !== options.width * options.height * 4) throw new Error(`Invalid RGBA frame: ${size} bytes`);
      response.writeHead(200).end('ok');
      return;
    }
    const file = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (file !== dist && !file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});

let browser;
let encoder;
let encoderError = null;
let complete = false;
const begun = performance.now();
try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: options.width, height: options.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  const address = `http://127.0.0.1:${server.address().port}/?render=1&frame=${options.startFrame}&fps=${options.fps}&width=${options.width}&height=${options.height}`;
  await page.goto(address, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__FRAME_READY__ === true && typeof window.__RENDER_FRAME_INDEX__ === 'function', null, { timeout: 30000 });
  if (browserErrors.length) throw new Error(`Browser error: ${browserErrors.join('\n')}`);
  const stage = page.locator('#stage');
  const bounds = await stage.boundingBox();
  if (!bounds || Math.round(bounds.width) !== options.width || Math.round(bounds.height) !== options.height) {
    throw new Error(`Stage size differs from output: ${JSON.stringify(bounds)}`);
  }

  const input = options.capture === 'raw'
    ? ['-f','rawvideo','-pixel_format','rgba','-video_size',`${options.width}x${options.height}`]
    : ['-f','image2pipe','-vcodec','png'];
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...input, '-framerate', String(options.fps), '-probesize', '32', '-analyzeduration', '0', '-i', 'pipe:0'];
  if (options.audio) {
    const audioPath = resolve(project, options.audio);
    await stat(audioPath);
    args.push('-ss', String(options.startFrame / options.fps), '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  } else args.push('-an');
  if (options.capture === 'raw') args.push('-vf','vflip');
  args.push('-t', String(frameCount / options.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', partial);
  encoder = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let encoderLog = '';
  encoder.stderr.on('data', chunk => { encoderLog = (encoderLog + chunk.toString()).slice(-12000); });
  encoder.on('error', error => { encoderError = error; });
  encoder.stdin.on('error', error => { encoderError = error; });
  console.log(`Rendering ${frameCount} frames at ${options.width}x${options.height}, ${options.fps} fps, ${duration.toFixed(3)} s timeline`);
  console.log(`Output: ${out}${options.audio ? ` (audio: ${options.audio})` : ' (silent)'}`);

  let lastRevision = -1, lastPng;
  for (let n = 0; n < frameCount; n++) {
    const frame = options.startFrame + n;
    if (n > 0) {
      await page.evaluate(async ({ frame, fps }) => {
        window.__RENDER_FRAME_INDEX__(frame, fps);
        await new Promise((resolveReady, rejectReady) => {
          const timeout = setTimeout(() => rejectReady(new Error('Frame readiness timed out')), 30000);
          const poll = () => {
            if (window.__FRAME_READY__) { clearTimeout(timeout); resolveReady(); }
            else requestAnimationFrame(poll);
          };
          poll();
        });
      }, { frame, fps: options.fps });
    }
    if (browserErrors.length) throw new Error(`Browser error at frame ${frame}: ${browserErrors.join('\n')}`);
    // Transfer lossless RGBA directly to the local encoder. WebGL rows are
    // bottom-up; FFmpeg flips them once. Every timeline frame is still rendered.
    if (options.capture === 'raw') await page.evaluate(async ({ width, height }) => {
      const canvas = document.querySelector('canvas');
      if (canvas.width !== width || canvas.height !== height) throw new Error('Wrong framebuffer dimensions');
      const gl = canvas.getContext('webgl2');
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const response = await fetch('/frame', { method: 'POST', body: pixels });
      if (!response.ok) throw new Error('Frame transfer failed');
    }, { width: options.width, height: options.height });
    else {
      const capture = await page.evaluate(revision => ({
        revision: window.__FRAME_REVISION__,
        png: window.__FRAME_REVISION__ === revision ? null : document.querySelector('canvas').toDataURL('image/png').split(',')[1],
      }), lastRevision);
      if (capture.png !== null) lastPng = Buffer.from(capture.png,'base64');
      lastRevision = capture.revision;
      const png = lastPng;
      if (png.readUInt32BE(16) !== options.width || png.readUInt32BE(20) !== options.height) throw new Error(`Wrong PNG dimensions at frame ${frame}`);
      if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    }
    if (encoderError) throw encoderError;
    if ((n + 1) % 120 === 0 || n + 1 === frameCount) {
      const elapsed = (performance.now() - begun) / 1000;
      const rate = (n + 1) / elapsed;
      const remaining = (frameCount - n - 1) / rate;
      console.log(`${n + 1}/${frameCount} frames | ${(100 * (n + 1) / frameCount).toFixed(1)}% | ${rate.toFixed(1)} fps render | ETA ${(remaining / 60).toFixed(1)} min`);
    }
  }
  encoder.stdin.end();
  const [exitCode] = await once(encoder, 'close');
  if (exitCode !== 0) throw new Error(`FFmpeg exited ${exitCode}: ${encoderLog}`);
  await rename(partial, out);
  complete = true;
  console.log(`Complete: ${out} (${((performance.now() - begun) / 1000).toFixed(1)} s)`);
} finally {
  if (!complete) {
    encoder?.kill();
    await rm(partial, { force: true }).catch(() => {});
  }
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
