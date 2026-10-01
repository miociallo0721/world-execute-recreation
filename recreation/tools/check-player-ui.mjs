import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output='output/player-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(`${process.env.PREVIEW_URL||'http://127.0.0.1:5175'}/?width=960&height=540`);
 await page.waitForFunction(()=>window.__FRAME_READY__===true);
 const originalNavigation=await page.evaluate(()=>performance.timeOrigin);
 await page.locator('a[href="?t=150"]').click();
 assert.equal(await page.evaluate(()=>performance.timeOrigin),originalNavigation);
 assert.equal(await page.locator('#seek').inputValue(),'150');
 assert.equal(await page.locator('#time').textContent(),'02:30.000 / 03:56.402');
 assert.equal(await page.locator('#current-chapter').textContent(),'执行');
 assert.equal(await page.locator('[aria-current="true"]').count(),1);
 await page.locator('a[href="?t=150"]').evaluate(el=>el.blur());
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#seek').inputValue(),'155');
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#seek').inputValue(),'150');
 await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='true');
 await page.keyboard.press('Space');assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');
 // Native input retains its own keyboard behavior and does not trigger page seeking.
 await page.locator('#seek').focus();const before=Number(await page.locator('#seek').inputValue());
 await page.keyboard.press('ArrowRight');assert.ok(Math.abs(Number(await page.locator('#seek').inputValue())-before)<.01);
 await page.locator('a[href="?t=18.5"]').click();
 for(const [width,height]of [[1440,1000],[768,1024],[390,844],[320,740]]){
   await page.setViewportSize({width,height});
   const box=await page.locator('#stage').boundingBox();assert.ok(Math.abs(box.width/box.height-16/9)<.01,`Video aspect ratio at ${width}`);
   const dims=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(dims.document<=dims.viewport,`No horizontal overflow at ${width}`);
   assert.ok((await page.locator('#play').boundingBox()).height>=40);
   await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: chapter jumps preserve the page, formatted time and active chapter, play/pause, keyboard and native range input; 4 responsive widths with 16:9 video and no horizontal overflow.');
}finally{await browser.close();}
