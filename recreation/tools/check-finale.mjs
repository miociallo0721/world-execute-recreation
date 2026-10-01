import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const sequence=JSON.parse(await readFile(new URL('../src/sequence.json',import.meta.url),'utf8'));
const times=process.env.CHECK_TIMES?JSON.parse(process.env.CHECK_TIMES):sequence.scenes.filter(s=>s.start>=120).map(s=>(s.start+s.end)/2);
if(!process.env.CHECK_TIMES)times.push(119.99,120,134.5,135.1,208.549,208.551,216.482,216.484,228.494,228.496,234.500,234.502,236.402);
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5175'}/?render=1&t=120&width=960&height=540`);
 await page.waitForFunction(()=>window.__FRAME_READY__);
 assert.equal(await page.locator('#seek').getAttribute('max'),String(sequence.duration));
 for(const [i,t] of times.entries()){
  const pair=await page.evaluate(t=>{
   const png=()=>document.querySelector('canvas').toDataURL('image/png');
   window.__RENDER_FRAME__(t);const first=png();window.__RENDER_FRAME__(iUnusedTime(t));window.__RENDER_FRAME__(t);
   function iUnusedTime(t){return t%2<1?18.5:83.5;}
   return [first,png()];
  },t);
  const same=pair[0]===pair[1];
  if(!same){await mkdir('output/finale-checks',{recursive:true});for(const [k,png]of pair.entries())await writeFile(`output/finale-checks/difference-${t}-${k}.png`,Buffer.from(png.split(',')[1],'base64'));}
  checks.push({time:t,deterministic:same});
  if((i+1)%15===0)console.log(`${i+1}/${times.length} scene and cut checks`);
 }
 const finalBlack=await page.evaluate(()=>{
  window.__RENDER_FRAME__(234.501);
  const gl=document.querySelector('canvas').getContext('webgl2'),pixels=new Uint8Array(960*540*4);
  gl.readPixels(0,0,960,540,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]||pixels[i+1]||pixels[i+2])return false;
  return true;
 });
 assert.ok(finalBlack,'Final frame must be black');assert.deepEqual(errors,[]);
 assert.ok(checks.every(c=>c.deterministic),JSON.stringify(checks.filter(c=>!c.deterministic)));
 assert.ok(await page.locator('a[href="?t=213.8"]').count());
 await mkdir('output/finale-checks',{recursive:true});
 await writeFile('output/finale-checks/report.json',JSON.stringify({duration:sequence.duration,errors,finalBlack,checks},null,2)+'\n');
 console.log(`PASS: ${checks.length} finale scenes/cuts, random seeks deterministic, full seek range, final black.`);
}finally{await browser.close();}
