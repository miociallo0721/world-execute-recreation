import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const font=resolve(root,'public/fonts/LiberationSans-Regular.ttf');
const panel=(index,label)=>`[${index}:v]setpts=PTS-STARTPTS,fps=60:start_time=0,scale=960:540,setsar=1,pad=960:588:0:48:color=0x171717,drawtext=fontfile=${font}:text='${label}':fontcolor=white:fontsize=24:x=24:y=12[v${index}]`;
const filters=`${panel(0,'REFERENCE  30-120s')};${panel(1,'RECREATION  30-120s  60fps')};[v0][v1]hstack=inputs=2[v]`;
const child=spawn(process.env.FFMPEG_BIN||'ffmpeg',[
 '-y','-hide_banner','-loglevel','error',
 // Source frame 899 is at 29.9966 s, the closest reference to output t=30.
 '-ss','29.99','-i',resolve(root,'../media/reference.mp4'),
 '-i',resolve(root,'output/continuation-30-120-1080p60.mp4'),
 '-ss','30','-i',resolve(root,'../media/soundtrack.m4a'),
 '-filter_complex',filters,'-map','[v]','-map','2:a:0','-t','90',
 '-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','256k','-movflags','+faststart',
 resolve(root,'output/continuation-30-120-comparison-60fps.mp4')
],{stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
const [code]=await once(child,'close');
if(code!==0)throw new Error(`FFmpeg exited ${code}`);
console.log('Complete: output/continuation-30-120-comparison-60fps.mp4');
