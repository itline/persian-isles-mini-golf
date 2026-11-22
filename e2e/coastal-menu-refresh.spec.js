import {test,expect} from '@playwright/test';

test('menu has the selected slogan, two external destinations, help and unchanged credits',async({page})=>{
 await page.goto('http://127.0.0.1:4181/?qa');
 await expect(page.locator('.brand-slogan')).toHaveText('A little golf. A world away.');
 const footer=page.locator('.menu-footer');
 await expect(footer.locator('a,button')).toHaveText(['Feedback ↗','GitHub ↗','How to play','About']);
 await expect(footer.locator('a')).toHaveCount(2);
 for(const [name,href] of [['Feedback ↗','https://github.com/itline/persian-isles-mini-golf/issues'],['GitHub ↗','https://github.com/itline/persian-isles-mini-golf']]){
  const link=footer.getByRole('link',{name,exact:true});await expect(link).toHaveAttribute('href',href);await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel',/noopener/);
 }
 await footer.getByRole('button',{name:'How to play',exact:true}).click();
 await expect(page.locator('#helpPanel')).toBeVisible();
 await expect(page.locator('.help-steps li')).toHaveCount(4);
 await page.locator('#helpClose').click();await expect(page.locator('#helpFooter')).toBeFocused();
 await footer.getByRole('button',{name:'About',exact:true}).click();
 await expect(page.locator('#credits')).toContainText('Created by');
 await expect(page.locator('#credits')).toContainText('Mini Golf Mania');
 await expect(page.locator('#credits a[href="https://github.com/itline"]')).toHaveText('itline');
});

test('menu sound stays accessible without occupying a footer slot',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('persian-isles-golf.audio.v1',JSON.stringify({music:false,effects:false})));
 await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
 await expect(page.locator('.menu-footer #menuSound')).toHaveCount(0);
 await expect(page.locator('#menuSound')).toHaveAttribute('aria-label','Sound settings: music off, effects off');
 await expect(page.locator('#sound')).toHaveAttribute('aria-label','Sound settings: music off, effects off');
 await page.locator('#menuSound').click();await expect(page.locator('#audioPanel')).toBeVisible();
 expect(await page.evaluate(()=>window.__golf.state().audio)).toMatchObject({music:false,effects:false,unlocked:false,contextState:'locked'});
 for(const [toggle,checked,label,state] of [
  ['musicToggle',true,'Sound settings: music on, effects off','mixed'],
  ['effectsToggle',true,'Sound settings: music on, effects on','on'],
  ['musicToggle',false,'Sound settings: music off, effects on','mixed'],
  ['effectsToggle',false,'Sound settings: music off, effects off','off'],
 ]){
  await page.locator(`#${toggle}`).setChecked(checked);
  for(const selector of ['#menuSound','#sound']){
   await expect(page.locator(selector)).toHaveAttribute('aria-label',label);
   await expect(page.locator(selector)).toHaveAttribute('title',label);
   await expect(page.locator(selector)).toHaveAttribute('data-audio',state);
  }
 }
 await page.locator('#audioClose').click();await expect(page.locator('#menuSound')).toBeFocused();
});
