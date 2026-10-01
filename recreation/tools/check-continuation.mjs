import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const {duration}=JSON.parse(await readFile(new URL('../src/sequence.json',import.meta.url),'utf8'));
const times=process.env.CHECK_TIMES?JSON.parse(process.env.CHECK_TIMES):[30,30.4,31.1,31.8,32.9,34.8,35.8,38.3,39.7,40.5,41.9,43.2,44.1,46.4,48.5,50.5,52.6,54.8,56.5,58.5,60.9,62.2,63.5,65.9,66.9,67.8,68.7,69.8,70.5,71.4,72.2,73.6,74.5,75.8,76.1,78.9,80.8,82.7,83.5,84.4,85.5,87.5,88.4,90.8,91.8,94.5,95.5,97.5,98.9,100.5,101.2,102.8,104.5,106.5,107.8,108.9,110.5,113.5,116.1,116.9,118.7,119.9,120];
const output='output/continuation-checks';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5174'}/?render=1&t=30`);await page.waitForFunction(()=>window.__FRAME_READY__===true);
 const capture=async t=>Buffer.from(await page.evaluate(t=>{window.__RENDER_FRAME__(t);return document.querySelector('canvas').toDataURL('image/png').split(',')[1];},t),'base64');
 const results=[];
 for(const [i,t]of times.entries()){
  const first=await capture(t);await capture(i%2?18.5:3);const repeat=await capture(t);
  if(!first.equals(repeat))await writeFile(`${output}/first-${t}.png`,first);
  await writeFile(`${output}/${t}.png`,repeat);results.push({time:t,deterministic:first.equals(repeat),sha256:createHash('sha256').update(repeat).digest('hex')});
  if((i+1)%15===0)console.log(`${i+1}/${times.length} checked`);
 }
 const limit=await page.locator('#seek').getAttribute('max');assert.equal(limit,String(duration));
 await writeFile(`${output}/report.json`,JSON.stringify({errors,duration,frames:results},null,2)+'\n');
 assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.deterministic),`Non-deterministic: ${results.filter(r=>!r.deterministic).map(r=>r.time)}`);
 console.log(`PASS: ${times.length} timestamps, identical after unrelated scene redraws, no browser errors, ${duration} s seek range.`);
}finally{await browser.close();}
