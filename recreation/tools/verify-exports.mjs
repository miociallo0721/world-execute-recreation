import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const run=promisify(execFile),results=[];
for(const [file,duration,width,height] of [
 ['output/continuation-30-120-1080p60.mp4',90,1920,1080],
 ['output/recreation-0-120-1080p60.mp4',120,1920,1080],
 ['output/continuation-30-120-comparison-60fps.mp4',90,1920,588],
]){
 const {stdout}=await run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]);
 const data=JSON.parse(stdout),video=data.streams.find(s=>s.codec_type==='video'),audio=data.streams.find(s=>s.codec_type==='audio');
 assert.equal(video.width,width);assert.equal(video.height,height);
 assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');
 assert.equal(video.avg_frame_rate,'60/1');assert.equal(Number(video.nb_read_frames),duration*60);
 assert.ok(Math.abs(Number(video.start_time))<1/44100,`Video starts late: ${video.start_time}`);
 assert.ok(Math.abs(Number(video.duration)-duration)<1/60);
 assert.equal(audio.codec_name,'aac');assert.equal(audio.sample_rate,'44100');assert.equal(audio.channels,2);
 assert.ok(Math.abs(Number(audio.start_time))<1/44100,`Audio starts late: ${audio.start_time}`);
 assert.ok(Math.abs(Number(audio.duration)-duration)<.05);
 const result={file,width,height,fps:60,frames:Number(video.nb_read_frames),videoStartTime:Number(video.start_time),audioStartTime:Number(audio.start_time),videoDuration:Number(video.duration),audioDuration:Number(audio.duration),audio:'AAC 44100 Hz stereo',bytes:Number(data.format.size)};
 results.push(result);console.log(`PASS: ${file} — ${result.frames} frames, ${duration} s, 60 fps, AAC stereo`);
}
await writeFile('output/export-verification.json',JSON.stringify(results,null,2)+'\n');
