import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const label=process.argv[2]||'before';
const output=`output/refinement-50-120/${label}`;
await mkdir(output,{recursive:true});
const times=process.env.CAPTURE_TIMES?JSON.parse(process.env.CAPTURE_TIMES):Array.from({length:280},(_,i)=>50+i/4);
const width=Number(process.env.CAPTURE_WIDTH||960),height=width*9/16;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5174'}/?render=1&t=50&width=${width}&height=${height}`);
  await page.waitForFunction(()=>window.__FRAME_READY__===true);
  for(const [i,t]of times.entries()){
    const data=await page.evaluate(t=>{window.__RENDER_FRAME__(t);return document.querySelector('canvas').toDataURL('image/png').split(',')[1];},t);
    await writeFile(`${output}/${t.toFixed(2)}.png`,Buffer.from(data,'base64'));
    if((i+1)%40===0)console.log(`${label}: ${i+1}/${times.length}`);
  }
  if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
