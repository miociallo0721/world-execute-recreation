# 全片视频复刻（236.402 秒）

独立实现 `../media/reference.mp4` 的 00:00–03:56.402，配乐使用 `../media/soundtrack.m4a`，起点继续按零偏移对齐。原来的 `../src` 没有改动。30–120 秒的场景表、校准依据与还原限制见 [记录](../docs/continuation-30-120.md)。50–120 秒已完成第二轮精修，见 [修正与对照结果](../docs/refinement-50-120.md)。

## 预览与导出

```sh
cd recreation
npm ci
npx playwright install chromium
npm run dev
```

打开 Vite 显示的地址，点击“播放”同时启动配乐与画面。拖动滑杆定位；`/?t=23` 可直接打开某个时刻。音频是预览主时钟，236.402 秒自动暂停；点击播放可从头重播。

```sh
npm run build
npm run render -- --fps 60 --out output/recreation-full-1080p60.mp4
```

默认逐帧输出 1920×1080、60 fps、14185 帧（完整时间轴），并混入授权本地配乐；音频不做变速。可用 `--start-frame 840 --frames 120` 导出第 14–16 秒片段，音频也从对应时间截取。`--width 1280 --height 720` 可输出较小版本。构建会将配乐复制到 dist，以便静态预览；源码不重复保存素材。

浏览器渲染接口：`/?render=1&frame=1140&fps=60`；`window.__RENDER_FRAME__(seconds)`；`window.__RENDER_FRAME_INDEX__(frame,fps)`。页面加载字体、完成绘制后才设置 `window.__FRAME_READY__`。

## 实现

- `src/opening.ts`：绝对时间驱动的开机 UI、保护盾牌、对象创建、参数传输、初始化、模拟立方体、逐字片名与 29 秒后的圆形入场。
- `src/main.ts`：程序绘制的 CanvasTexture 经过 Three.js / WebGL2 / GLSL 统一合成。这里的 Canvas 用于生成图形纹理，最终输出由 WebGL 绘制。
- `src/titleEffects.ts`、`src/titleShader.ts`：14–30 秒的参考时间点、灰白曝光、分段扫描带、水平撕裂、纵向 RGB 分离与边缘噪声；早于 14 秒保留原有着色分支。
- `tools/render.mjs`：Playwright 调用每个帧的绝对时间，读取 WebGL 画布，FFmpeg 编码 H.264 + AAC。通过 SwiftShader 在云端渲染，无需实体 GPU。
- 字体随项目保存：Liberation Sans 用于 UI，Roboto Light/Regular/Thin 用于片名及圆形场景，许可文件在 `public/fonts/`。

## 14–30 秒细调版

本轮按参考视频的实际帧时间重新校准，不使用原项目的暂定 BPM 推算切点。细调内容与时间表见 [说明](../docs/refinement-14-30.md)。

```sh
npm run build
npm run render -- --fps 30 --frames 900 --out output/opening-30s-refined.mp4
node tools/compare-refinement.mjs
```

新版完整预览为 `output/opening-30s-refined.mp4`；`output/opening-14-30-refined-comparison.mp4` 从原片第 14 秒开始，左侧参考、右侧复刻，配乐同步截取第 14–30 秒。

对照脚本使用带 `drawtext` 滤镜的系统 FFmpeg 添加左右标签；可通过 `FFMPEG_BIN` 指定路径。逐帧导出脚本使用 npm 自带的 FFmpeg。

运行开发服务器后，用 `node tools/check-refinement.mjs` 检查 21 个场景时刻的浏览器错误与乱序重绘一致性，并保存检查截图。服务器地址可通过 `PREVIEW_URL` 指定，默认 `http://127.0.0.1:5174`。

## 30–120 秒与 60 fps

```sh
npm run build
npm run render -- --fps 60 --start-frame 1800 --frames 5400 --out output/continuation-30-120-1080p60.mp4
node tools/compare-continuation.mjs
```

- `src/sequence.json`：30 秒至片尾各段场景的起止与总时长。
- `src/continuation.ts`、`src/drawing.ts`：数学、旅行、状态、情绪、对象、存在、配置、管理与删除段的图形和文字。
- `src/assets/reference-icons.json`、`wave-motion.json`、`continuation-motion.json`：图标与曲线的矢量路径，保留参考坐标。
- `src/continuationEffects.ts`、`scan-events.json`：扫描带采样和明确时间窗的故障。
- `tools/check-continuation.mjs`：63 个代表时刻及乱序重绘检查。
- `tools/check-playback.mjs`：配乐定位、跨越 120 秒的连续播放与 236.402 秒自动停止。
- `tools/check-frame-cache.mjs`：34 组逐帧复用与强制重绘的像素一致性对比。
- `tools/assemble-120.mjs`、`verify-exports.mjs`：拼接两段 60 fps 成片，核验最终帧数、零起点与音视频规格。
- `tools/verify-refined-frames.py`：把编码后的 8 个帧与浏览器截图对照，检查导出内容和方向。
- `tools/verify-audio.py`：对照成片与原配乐的 8 个采样窗口，检查音频偏移；使用 Python / numpy / scipy 和系统 FFmpeg。

原片约 29.97 fps，输出为 60 fps。动画按每个输出帧的绝对时间重新计算；离散源故障按原片帧时刻保持。配乐不变速。复刻覆盖完整 236.402 秒，复杂故障纹理、模糊和部分图形变形仍存在差异，不声明像素一致。详细依据与限制见 [校准记录](../docs/continuation-30-120.md)。

## 120 秒至完整片尾

本轮仅更新网页与源代码，没有导出新视频。公开站点：
https://world-execute-recreation-20260930.miociallo0721.chatgpt.site

- `src/finale.ts`：删除完成、错误、执行终端、恢复、搜索、密码、心形、退出、逐段重建、电源和全部片尾。
- `src/assets/finale-motion.json`：2655 个源 PTS 的独立前景矢量、网格遮罩与扫描条带参数；没有运行时视频或整帧图片。
- `tools/measure-finale.py`：开发时测量原片，需要 OpenCV、numpy 和系统 FFmpeg。
- `tools/check-finale.mjs`：覆盖每个新增段落及片尾切点的乱序重绘、完整时间范围和最后黑场检查。
- 完整分段、文本校准及差异说明见 [120–236.402 秒完成记录](../docs/completion-120-236.md)。

后半段已进行一轮精修，校正情绪擦除、stable 行阵、恢复页面、搜索与问号、彩色心形、人物进门及片尾故障样片。详细依据见 [120–236.402 秒精修记录](../docs/refinement-120-236.md)。新增 `src/assets/finale-refinement.json` 保存语义轮廓、排版和色彩统计；`tools/refine-finale-motion.py` 与 `tools/compare-finale-refinement.py` 仅用于开发测量和对照，不参与网页运行。

已有的前 120 秒导出文件对应此前版本；全片导出接口仍默认 60 fps，本轮未执行导出。

145–170 秒及播放器界面已进一步精修，尤其恢复红色乱码屏左上角的终端小字、调整 stable / 网格 / 时钟转场，并改善时间显示、章节跳转和手机画面比例。依据与验证见 [本轮记录](../docs/refinement-145-170-and-player.md)。
