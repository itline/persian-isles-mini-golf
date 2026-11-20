import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.GOLF_URL||'http://127.0.0.1:4181';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/music-audition/index.html');await page.locator('h1').waitFor();
 assert.equal(await page.locator('h1').innerText(),'Audio auditions');
 assert.equal(await page.locator('audio').count(),3);
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>a.paused&&!a.autoplay)),true);
 const metrics=await page.evaluate(async()=>{
  const ctx=new AudioContext(),result=[];
  for(const stem of ['coastal-pulse','sunlit-marimba','tide-and-bells'])for(const ext of ['mp3','wav']){
   const response=await fetch(stem+'.'+ext);if(!response.ok)throw Error('missing audio '+stem+'.'+ext);
   const buffer=await ctx.decodeAudioData(await response.arrayBuffer());let peak=0,sum=0,finite=true;
   for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c)){finite&&=Number.isFinite(v);peak=Math.max(peak,Math.abs(v));sum+=v*v;}
   result.push({file:stem+'.'+ext,duration:buffer.duration,channels:buffer.numberOfChannels,peak,rms:Math.sqrt(sum/(buffer.length*buffer.numberOfChannels)),finite});
  }await ctx.close();return result;
 });
 for(const m of metrics){assert.equal(m.finite,true);assert.equal(m.channels,2);assert.ok(Math.abs(m.duration-30)<.1);assert.ok(m.peak>0&&m.peak<1);assert.ok(m.rms>0);}
 await page.locator('[data-audio="coastal-audio"]').click();await page.waitForFunction(()=>document.querySelector('#coastal-audio').currentTime>.2);
 await page.locator('[data-audio="marimba-audio"]').click();await page.waitForFunction(()=>!document.querySelector('#marimba-audio').paused&&document.querySelector('#coastal-audio').paused);
 await page.locator('#pause-all').click();assert.equal(await page.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>a.paused)),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({metrics,exclusivePlayback:true,noAutoplay:true,mobileOverflow:false,pageErrors:errors}));
}finally{await browser.close();}
