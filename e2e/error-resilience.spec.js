import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181';

test('storage SecurityError does not prevent English startup',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage access denied','SecurityError');}});});
 await page.goto(url);await expect(page.locator('#play')).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 await expect(page.locator('#selectedIslandName')).toHaveText('Hormuz');await expect(page.locator('#play')).toBeEnabled();expect(errors).toEqual([]);
});

test('English load error survives a renderer failure',async({page})=>{
 await page.addInitScript(()=>{
  const nativeGetContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl'){window.__rendererLanguage={lang:document.documentElement.lang,dir:document.documentElement.dir};throw new Error('WebGL unavailable');}return nativeGetContext.call(this,type,...args);};
 });
 await page.goto(url);await expect(page.locator('#loadError')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 await expect(page.locator('#loadError')).toContainText('The island could not load');expect(await page.evaluate(()=>window.__rendererLanguage)).toEqual({lang:'en',dir:'ltr'});
 await expect(page.locator('#play')).toHaveText('Unable to load');await expect(page.locator('#play')).toBeDisabled();
});

test('audio-unavailable notice remains English',async({page})=>{
 await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;localStorage.setItem('persian-isles-golf.audio.v1',JSON.stringify({music:false,effects:false}));});
 await page.goto(url);await expect(page.locator('#play')).toBeEnabled();await page.locator('#menuSound').click();await page.locator('#musicToggle').check();
 await expect(page.locator('#audioNotice')).toContainText('Audio is unavailable in this browser');await expect(page.locator('#audioNotice')).not.toContainText(/[\u0600-\u06ff]/);
});
