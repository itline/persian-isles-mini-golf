import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
const result=await page.evaluate(async()=>{
 const {createCoastalAudio}=await import('/src/audio.js');
 const offline=new OfflineAudioContext(2,44100*12,44100);
 class Context{constructor(){return new Proxy(offline,{get(target,key){if(key==='state')return 'running';if(key==='close')return ()=>Promise.resolve();const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}}
 const audio=createCoastalAudio({storage:{getItem:()=>null,setItem(){}},AudioContextClass:Context});
 audio.setMusic(true);await audio.unlock();audio.setEffects(true);audio.effect(440,.15);
 const rendered=await offline.startRendering();const samples=rendered.getChannelData(0);
 let sum=0,peak=0,finite=true;for(const n of samples){sum+=n*n;peak=Math.max(peak,Math.abs(n));finite&&=Number.isFinite(n);}
 audio.dispose();return {rms:Math.sqrt(sum/samples.length),peak,finite,samples:samples.length};
});
assert.ok(result.finite);assert.ok(result.rms>.00001,'soundtrack must produce real audible samples');assert.ok(result.peak<1,'audio must not clip');console.log(JSON.stringify(result));await browser.close();
