import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile,rm } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const list=resolve(root,'output/assemble-120.concat.txt');
await writeFile(list,"file 'opening-0-30-1080p60.mp4'\nduration 30\nfile 'continuation-30-120-1080p60.mp4'\nduration 90\n");
try{
 const child=spawn(ffmpeg,[
  // Concat can report a negative start from AAC priming. Preserve the video
  // PTS instead of shifting it by that unrelated audio packet duration.
  '-y','-hide_banner','-loglevel','error','-copyts','-f','concat','-safe','0','-i',list,
  '-i',resolve(root,'../media/soundtrack.m4a'),'-map','0:v:0','-map','1:a:0',
  '-t','120','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',
  resolve(root,'output/recreation-0-120-1080p60.mp4')
 ],{stdio:'inherit'});
 child.on('error',error=>{console.error(error);process.exitCode=1;});
 const [code]=await once(child,'close');if(code!==0)throw new Error(`FFmpeg exited ${code}`);
 console.log('Complete: output/recreation-0-120-1080p60.mp4');
}finally{await rm(list,{force:true});}
