import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const font=resolve(root,'public/fonts/LiberationSans-Regular.ttf');
const panel=(index,label)=>`[${index}:v]fps=30,scale=960:540,setsar=1,pad=960:588:0:48:color=0x171717,drawtext=fontfile=${font}:text='${label}':fontcolor=white:fontsize=24:x=24:y=12[v${index}]`;
const filters=`${panel(0,'REFERENCE  14-30s')};${panel(1,'RECREATION  14-30s')};[v0][v1]hstack=inputs=2[v]`;
// The npm static binary omits drawtext; use a system FFmpeg with font support.
const child=spawn(process.env.FFMPEG_BIN||'ffmpeg',[
  '-y','-hide_banner','-loglevel','error',
  '-ss','14','-i',resolve(root,'../media/reference.mp4'),
  '-ss','14','-i',resolve(root,'output/opening-30s-refined.mp4'),
  '-ss','14','-i',resolve(root,'../media/soundtrack.m4a'),
  '-filter_complex',filters,'-map','[v]','-map','2:a:0','-t','16',
  '-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',
  '-c:a','aac','-b:a','256k','-movflags','+faststart',
  resolve(root,'output/opening-14-30-refined-comparison.mp4')
],{stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
const [code]=await once(child,'close');
if(code!==0)throw new Error(`FFmpeg exited ${code}`);
console.log('Complete: output/opening-14-30-refined-comparison.mp4');
