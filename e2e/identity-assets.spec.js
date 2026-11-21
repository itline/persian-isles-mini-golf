import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/?qa';
test('identity is one-line with a small slogan and settings has no audition link',async({page})=>{
 await page.goto(url);await expect(page.locator('.brand-name')).toHaveText('Persian Isles Mini Golf');
 await expect(page.locator('.brand-slogan')).toHaveText('A little golf. A world away.');
 const brand=await page.locator('.brand-name').boundingBox();const slogan=await page.locator('.brand-slogan').boundingBox();
 expect(brand.y+brand.height).toBeLessThanOrEqual(slogan.y);
 await page.locator('#menuSound').click();await expect(page.locator('#musicAuditions')).toHaveCount(0);
 await page.locator('#audioClose').click();await page.locator('#creditsOpen').click();
 await expect(page.locator('#credits')).toContainText('Version 0.1.2');
 await expect(page.locator('#credits')).toContainText('Persian Isles Mini Golf');
 await expect(page.locator('#credits')).toContainText('Created by');
});
test('brand icon and tiny favicon are served as actual SVGs without loading marketing into game',async({page,request})=>{
 const marketing=[];page.on('request',r=>{if(r.url().includes('/marketing/')||r.url().includes('/covers/'))marketing.push(r.url());});
 await page.goto(url);
 for(const file of ['favicon.svg','icon.svg']){const r=await request.get('http://127.0.0.1:4181/'+file);expect(r.status()).toBe(200);expect(r.headers()['content-type']).toContain('image/svg+xml');expect(await r.text()).toContain('<svg');}
 await expect(page.locator('.brand-icon')).toHaveAttribute('src','/icon.svg');expect(marketing).toEqual([]);
});
