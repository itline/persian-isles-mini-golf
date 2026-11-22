import {test,expect} from '@playwright/test';

for(const viewport of [{width:1024,height:600},{width:1024,height:768}]){
 test(`intermediate landscape scenery clears the panel and actual menu controls at ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:4181/?qa');
  const measurements=[];
  for(const id of ['hormuz','qeshm','kish','khark','hengam']){
   await page.locator(`[data-island="${id}"]`).click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);await page.waitForTimeout(450);
   const state=await page.evaluate(()=>window.__golf.fleet());
   expect(state.visible).toBe(true);expect(state.boats).toHaveLength(2);expect(state.details).toHaveLength(id==='hormuz'?0:2);
   const controls=await page.locator('.hero-copy, #menuSound, .brand, .menu-footer a, .menu-footer button').evaluateAll(elements=>elements.map(element=>{
    const {x,y,width,height}=element.getBoundingClientRect();return{name:element.id||element.className||element.textContent.trim(),x,y,width,height};
   }));
   // Brand, folio, sound, and all four approved footer destinations.
   expect(controls).toHaveLength(7);
   expect(controls.some(control=>control.name==='helpFooter')).toBe(true);
   measurements.push({island:id,...state,controls});
   for(const [index,box] of [...state.boats,...state.details].entries()){
    const label=`${id} ${box.kind||`rock ${index-state.boats.length+1}`} at ${viewport.width}x${viewport.height}`;
    expect.soft(box.x,label).toBeGreaterThan(0);expect.soft(box.x+box.width,label).toBeLessThan(viewport.width);
    expect.soft(box.y,label).toBeGreaterThan(65);expect.soft(box.y+box.height,label).toBeLessThan(viewport.height);
    for(const control of controls){
     const overlaps=box.x<control.x+control.width&&box.x+box.width>control.x&&box.y<control.y+control.height&&box.y+box.height>control.y;
     expect.soft(overlaps,`${label} overlaps ${control.name}: ${JSON.stringify({box,control})}`).toBe(false);
    }
   }
  }
  await testInfo.attach('scenery-and-menu-bounds',{body:JSON.stringify({viewport,measurements},null,2),contentType:'application/json'});
 });
}
test('five distinct sparse fleets and low distant rocklets survive switching and vanish for play',async({page})=>{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4181/?qa');await page.emulateMedia({reducedMotion:'reduce'});
  const layouts=[];
  for(const id of ['hormuz','qeshm','kish','khark','hengam']){
   await page.locator(`[data-island="${id}"]`).click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);await page.waitForTimeout(450);
   const state=await page.evaluate(()=>window.__golf.fleet());
   expect(state.boats.length).toBe(2);expect(state.visible).toBe(true);expect(state.details.length).toBe(id==='hormuz'?0:2);
   expect(state.boats.map(b=>b.kind).sort()).toEqual({hormuz:['cargo','lenj'],qeshm:['cargo','lenj'],kish:['fishing','passenger'],khark:['cargo','tanker'],hengam:['fishing','lenj']}[id]);
   const centers=state.boats.map(b=>b.x+b.width/2);expect(Math.abs(centers[0]-centers[1])).toBeGreaterThan(viewport.width*.35);
   layouts.push(state.boats.map(b=>[Math.round(b.x),Math.round(b.y),b.kind]));const panel=await page.locator('.hero-copy').boundingBox();
   for(const box of [...state.boats,...state.details]){
    expect(box.x).toBeGreaterThan(0);expect(box.x+box.width).toBeLessThan(viewport.width);expect(box.y).toBeGreaterThan(65);expect(box.y+box.height).toBeLessThan(viewport.height);expect(box.width).toBeLessThan(46);
    expect(box.x<panel.x+panel.width&&box.x+box.width>panel.x&&box.y<panel.y+panel.height&&box.y+box.height>panel.y).toBe(false);
   }
  }
  expect(new Set(layouts.map(JSON.stringify)).size).toBe(5);
  await page.locator('[data-island="hormuz"]').click();await page.locator('#play').click();await expect.poll(()=>page.evaluate(()=>window.__golf.fleet().visible)).toBe(false);
 }
});
