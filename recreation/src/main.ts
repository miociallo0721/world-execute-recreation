import * as THREE from 'three';
import { Opening, DURATION, clamp } from './opening';
import { fragmentShader, continuationShader, cleanContinuationShader } from './titleShader';
import './style.css';

declare global { interface Window {
  __FRAME_READY__: boolean;
  __FRAME_REVISION__: number;
  __RENDER_FRAME__: (t:number)=>void;
  __RENDER_FRAME_INDEX__: (frame:number,fps?:number)=>void;
} }
const params=new URLSearchParams(location.search), renderMode=params.get('render')==='1';
if(renderMode) document.body.classList.add('render');
const width=Number(params.get('width')||1920),height=Number(params.get('height')||1080);
const stage=document.querySelector<HTMLDivElement>('#stage')!;
const opening=new Opening();
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
stage.appendChild(renderer.domElement);
const texture=new THREE.CanvasTexture(opening.canvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
const rasterBytes=new Uint8Array(1920*4);
for(let x=0;x<1920;x++){
 const value=Math.round(127.5+127.5*Math.cos((x+.5-3)*1.2566370614));
 rasterBytes.set([value,value,value,255],x*4);
}
const rasterTexture=new THREE.DataTexture(rasterBytes,1920,1);rasterTexture.needsUpdate=true;
const uniforms={source:{value:texture},raster:{value:rasterTexture},time:{value:0},tear:{value:0},rgb:{value:0},bands:{value:0},flash:{value:0},
 rgbY:{value:0},band1:{value:new THREE.Vector2(-2,-1)},band2:{value:new THREE.Vector2(-2,-1)},band3:{value:new THREE.Vector2(-2,-1)},
 chunks:{value:0},black:{value:0},tint:{value:0},split:{value:0},border:{value:0},noise:{value:0},bandLevel:{value:.535}};
const material=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader});
const continuationMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:material.vertexShader,fragmentShader:continuationShader});
const cleanContinuationMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:material.vertexShader,fragmentShader:cleanContinuationShader});
const scene=new THREE.Scene(),plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(plane);
const camera=new THREE.Camera();const audio=new Audio('/soundtrack.m4a');audio.preload='auto';
const seek=document.querySelector<HTMLInputElement>('#seek')!,out=document.querySelector<HTMLOutputElement>('#time')!,play=document.querySelector<HTMLButtonElement>('#play')!;
const chapterLinks=[...document.querySelectorAll<HTMLAnchorElement>('.chapter-grid a')];
const chapters=chapterLinks.map(link=>({link,time:Number(new URL(link.href).searchParams.get('t')),title:link.querySelector('span:not(.chapter-number)')!.textContent!}));
const chapterLabel=document.querySelector<HTMLElement>('#current-chapter')!,status=document.querySelector<HTMLElement>('#player-status')!;
const formatTime=(t:number)=>{const ms=Math.round(t*1000),minutes=Math.floor(ms/60000),seconds=Math.floor(ms/1000)%60;return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
let activeChapter=-1;
function updateTransport(){play.textContent=playing?'暂停':'播放';play.setAttribute('aria-pressed',String(playing));document.body.classList.toggle('playing',playing);}
let position=clamp(Number(params.get('t')||0),0,DURATION),playing=false;
let cleanPixels:Uint32Array|undefined,cleanProfile='',frameRevision=0;
function draw(t:number){
 window.__FRAME_READY__=false;position=clamp(t,0,DURATION);const effect=opening.render(position);
 uniforms.time.value=position;
 for(const k of ['tear','rgb','rgbY','bands','flash','chunks','black','tint','split','border','noise','bandLevel'] as const)uniforms[k].value=effect[k];
 for(const k of ['band1','band2','band3'] as const)uniforms[k].value.set(...effect[k]);
 const clean=effect.tear===0&&effect.rgb===0&&effect.rgbY===0&&effect.bands===0&&effect.noise===0&&effect.border===0;
 plane.material=position>=30?(clean?cleanContinuationMaterial:continuationMaterial):material;
 let unchanged=false;
 if(renderMode){
   const image=opening.canvas.getContext('2d')!.getImageData(0,0,1920,1080);
   const pixels=new Uint32Array(image.data.buffer);
   const rasterProfile=`${position>=47.947&&position<51.252}:${position>=71.004&&position<72.005}:${position>=120}:${position>=208.55}`;
   // Every stochastic shader uses a discrete source frame. A legacy moving
   // scan uses exact time as well. Compare all source pixels before reuse.
   const profile=position>=30&&clean?`clean:${rasterProfile}:${effect.flash}`:
     JSON.stringify([position<14?'legacy':position<30?'title':'continuation',
       Math.floor(position*29.97003+(position>=30?.5:0)),rasterProfile,
       position>=36&&position<37,position<14&&effect.bands>.5?position:null,effect]);
   if(cleanPixels&&profile===cleanProfile){
     unchanged=true;for(let i=0;i<pixels.length;i++)if(pixels[i]!==cleanPixels[i]){unchanged=false;break;}
   }
   cleanPixels=pixels;cleanProfile=profile;
 }else cleanPixels=undefined;
 if(!unchanged){texture.needsUpdate=true;renderer.render(scene,camera);renderer.getContext().finish();frameRevision++;}
 window.__FRAME_REVISION__=frameRevision;
 seek.max=String(DURATION);seek.value=String(position);out.value=`${formatTime(position)} / ${formatTime(DURATION)}`;
 seek.style.setProperty('--progress',`${position/DURATION*100}%`);seek.setAttribute('aria-valuetext',formatTime(position));
 const index=chapters.reduce((current,ch,i)=>position>=ch.time?i:current,0);
 if(index!==activeChapter){activeChapter=index;chapterLabel.textContent=chapters[index].title;for(const [i,ch]of chapters.entries()){if(i===index)ch.link.setAttribute('aria-current','true');else ch.link.removeAttribute('aria-current');}}
 window.__FRAME_READY__=true;
}
window.__RENDER_FRAME__=draw;window.__RENDER_FRAME_INDEX__=(f,fps=60)=>draw(f/fps);
function jumpTo(time:number){const t=clamp(time,0,DURATION);if(audio.readyState>=1)audio.currentTime=t;draw(t);}
seek.oninput=()=>jumpTo(Number(seek.value));
for(const ch of chapters)ch.link.onclick=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();jumpTo(ch.time);const url=new URL(location.href);url.searchParams.set('t',String(ch.time));history.replaceState(null,'',url);};
document.addEventListener('keydown',event=>{
 if(renderMode||event.altKey||event.ctrlKey||event.metaKey||event.target instanceof HTMLElement&&event.target.closest('input,button,a,textarea,select,[contenteditable]'))return;
 if(event.code==='Space'){event.preventDefault();if(!play.disabled)play.click();}
 if(event.code==='ArrowLeft'||event.code==='ArrowRight'){event.preventDefault();jumpTo(position+(event.code==='ArrowRight'?5:-5));}
});
play.onclick=async()=>{
 if(playing){audio.pause();playing=false;}
 else{
   play.disabled=true;status.hidden=true;
   try{
     // Seeking before metadata exists can be discarded when Chrome starts playback.
     if(audio.readyState<1) await new Promise<void>((resolve,reject)=>{
       const loaded=()=>{cleanup();resolve();};const failed=()=>{cleanup();reject(new Error('无法读取配乐'));};
       const cleanup=()=>{audio.removeEventListener('loadedmetadata',loaded);audio.removeEventListener('error',failed);};
       audio.addEventListener('loadedmetadata',loaded);audio.addEventListener('error',failed);audio.load();
     });
     if(position>=DURATION)position=0;audio.currentTime=position;await audio.play();playing=true;
   }catch(error){status.hidden=false;status.textContent=`音频加载失败：${String(error)}`;}
   finally{play.disabled=false;}
 }updateTransport();
};
audio.onended=()=>{playing=false;updateTransport();};
function stopAtEnd(){if(playing&&audio.currentTime>=DURATION){audio.pause();playing=false;audio.currentTime=DURATION;updateTransport();draw(DURATION);}}
audio.ontimeupdate=stopAtEnd;
function tick(){if(playing){draw(audio.currentTime);stopAtEnd();}requestAnimationFrame(tick);}
async function start(){
 for(const [name,file] of [['ReferenceSans','LiberationSans-Regular.ttf'],['TitleLight','Roboto-Light.ttf'],['TitleThin','Roboto-Thin.ttf'],['TitleRegular','Roboto-Regular.ttf']]){
   const font=new FontFace(name,`url(/fonts/${file})`);await font.load();document.fonts.add(font);
 }await document.fonts.ready;
 const frame=params.get('frame');draw(frame!==null?Number(frame)/Number(params.get('fps')||60):position);
 if(!renderMode)tick();
}
void start().catch(error=>{document.body.textContent=String(error);console.error(error);});
