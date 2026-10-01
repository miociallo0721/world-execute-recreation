// Reuse the unchanged 30–49.4 s 60 fps export; render the refined remainder.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ffmpeg from 'ffmpeg-static';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const list=resolve(root,'output/assemble-refinement.concat.txt');
await writeFile(list,"file 'continuation-30-49.4-1080p60.mp4'\nduration 19.4\nfile 'refined-49.4-120-1080p60.mp4'\nduration 70.6\n");
try{
 const p=spawn(ffmpeg,['-y','-v','error','-f','concat','-safe','0','-i',list,'-ss','30','-i',resolve(root,'../media/soundtrack.m4a'),'-map','0:v:0','-map','1:a:0','-t','90','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',resolve(root,'output/continuation-30-120-1080p60.mp4')],{stdio:'inherit'});
 const[c]=await once(p,'close');if(c!==0)throw Error(`FFmpeg exited ${c}`);
 console.log('Complete: output/continuation-30-120-1080p60.mp4');
}finally{await rm(list,{force:true});}
