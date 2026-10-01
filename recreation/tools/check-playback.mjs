import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const {duration}=JSON.parse(await readFile(new URL('../src/sequence.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});
 await page.addInitScript(()=>{const Original=window.Audio;window.Audio=function(...args){const audio=new Original(...args);window.__TEST_AUDIO__=audio;return audio;};});
 await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5174'}/?t=119.8&width=960&height=540`);
 await page.waitForFunction(()=>window.__FRAME_READY__===true);
 await page.locator('#play').click();
 await page.waitForFunction(()=>window.__TEST_AUDIO__.currentTime>120.1);
 const audio=await page.evaluate(()=>({time:window.__TEST_AUDIO__.currentTime,duration:window.__TEST_AUDIO__.duration,paused:window.__TEST_AUDIO__.paused}));
 assert.ok(audio.time<123&&audio.duration>236&&!audio.paused);
 await page.locator('#play').click();
 await page.locator('#seek').evaluate((el,end)=>{el.value=String(end-.20);el.dispatchEvent(new Event('input',{bubbles:true}));},duration);
 await page.locator('#play').click();
 await page.waitForFunction(end=>window.__TEST_AUDIO__.paused&&Number(document.querySelector('#seek').value)===end,duration,{timeout:15000});
 assert.equal(await page.locator('#play').textContent(),'播放');
 console.log(`PASS: audio starts at selected time, original duration preserved, playback stops at ${duration} s.`);
}finally{await browser.close();}
