import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{channel:'chrome',headless:true,viewport:{width:1440,height:900}},timeout:30000,reporter:'list'});
