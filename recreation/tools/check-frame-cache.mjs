import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5174'}/?render=1&t=90`);await page.waitForFunction(()=>window.__FRAME_READY__);
 const checks=await page.evaluate(()=>{
  const image=()=>document.querySelector('canvas').toDataURL('image/png');
  return [2.6,12,18.5,30.4,35.8,48.5,52.6,60.9,67.8,69.2,71.4,83.5,90.8,94.5,98.9,108.9,116.9,119.9,120,124.1,126.5,132.5,151.7,164.8,165.349,166.399,167.639,168.179,178.9,183.5,186.5,191.5,199.5,208.549,213.8,224.1,230,236.402].map(t=>{
   window.__RENDER_FRAME__(t);const firstRevision=window.__FRAME_REVISION__;
   window.__RENDER_FRAME__(t+.001);const reused=window.__FRAME_REVISION__===firstRevision,cached=image();
   window.__RENDER_FRAME__(3);window.__RENDER_FRAME__(t+.001);const direct=image();
   return {time:t,reused,identical:cached===direct};
  });
 });
 assert.ok(checks.every(c=>c.identical),JSON.stringify(checks.filter(c=>!c.identical)));
 assert.ok(checks.some(c=>c.reused),'No identical frame was reused');
 console.log(`PASS: ${checks.length} cache/direct comparisons; ${checks.filter(c=>c.reused).length} unchanged frames reused without pixel changes.`);
}finally{await browser.close();}
