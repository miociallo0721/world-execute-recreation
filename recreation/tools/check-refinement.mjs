import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5174'}/?render=1`);
  await page.waitForFunction(()=>window.__FRAME_READY__===true);
  const output='output/refined-checks';await mkdir(output,{recursive:true});
  const capture=async t=>Buffer.from(await page.evaluate(t=>{
    window.__RENDER_FRAME__(t);
    return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
  },t),'base64');
  // Revisit each effect after drawing an unrelated scene. This detects state leaks
  // that would cause seeking and sequential video exports to show different frames.
  const timestamps=[12,13.9,14.1,14.5,15.2,15.7,16.25,16.45,17.35,17.5,17.7,18.5,19.7,21.8,23.3,25.2,26.65,28.65,29.45,29.8,29.95];
  const results=[];
  for(const t of timestamps){
    const a=await capture(t);await capture(3);const b=await capture(t);
    const deterministic=a.equals(b);
    await writeFile(`${output}/${t}.png`,b);
    results.push({time:t,deterministic,sha256:createHash('sha256').update(b).digest('hex')});
  }
  await writeFile(`${output}/report.json`,JSON.stringify({errors,frames:results},null,2)+'\n');
  assert.deepEqual(errors,[],'Browser errors');
  assert.ok(results.every(r=>r.deterministic),`Non-deterministic timestamps: ${results.filter(r=>!r.deterministic).map(r=>r.time).join(', ')}`);
  console.log(`PASS: ${results.length} timestamps, identical after out-of-order seeking, no browser errors.`);
} finally {await browser.close();}
