#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';
const PAGES = ['/', '/agentes/viajes', '/agentes/destinos', '/contactos', '/finanzas', '/marketing/ofertas', '/monitor'];
const results = { pass: 0, fail: 0 };

const browser = await chromium.launch({ headless: true });
const dir = join(__dirname, 'artifacts', 'screenshots-live-v2');
mkdirSync(dir, { recursive: true });

for (const width of [1440, 390]) {
  console.log(`\n📱 ${width}px`);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  
  for (const path of PAGES) {
    const name = path === '/' ? 'torre' : path.split('/').pop();
    console.log(`  ${name}...`, { end: '' });
    
    try {
      await page.goto(LIVE_URL + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      const linkCount = await frame.locator('[data-sol-sidebar] a[href]').count();
      const pill = await frame.locator('[data-sol-system-status]').first().textContent();
      
      console.log(` ✅ (${linkCount} links, "${pill?.trim()}")`);
      await page.screenshot({ path: join(dir, `${width}px-${name}.png`) });
      results.pass++;
    } catch (error) {
      console.log(` ❌ ${error.message}`);
      results.fail++;
    }
  }
  
  await page.close();
}

await browser.close();
console.log(`\n📊 ✅ ${results.pass} PASS, ❌ ${results.fail} FAIL`);
process.exit(results.fail > 0 ? 1 : 0);
