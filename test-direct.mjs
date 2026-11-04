#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_URL = 'http://localhost:3456/stitch/redesign';

const TEST_PAGES = [
  { name: 'Torre', file: 'torre.html' },
  { name: 'Viajes', file: 'viajes.html' },
  { name: 'Finanzas', file: 'finanzas.html' }
];

const results = { pass: [], fail: [] };

async function testPage(page, pageInfo, screenshotDir) {
  console.log(`\n  📄 ${pageInfo.name}`);
  
  try {
    await page.goto(BASE_URL + '/' + pageInfo.file, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    const sidebarCount = await page.locator('[data-sol-sidebar]').count();
    const linkCount = await page.locator('[data-sol-sidebar] a[href]').count();
    const pillText = await page.locator('[data-sol-system-status]').first().textContent();
    
    console.log(`    Sidebar: ${sidebarCount > 0 ? '✅' : '❌'}, Links: ${linkCount}, Pill: "${pillText?.trim()}"`);
    
    const screenshot = join(screenshotDir, `desktop-${pageInfo.name.toLowerCase()}.png`);
    await page.screenshot({ path: screenshot });
    console.log(`    📸 ${screenshot}`);
    
    if (sidebarCount > 0 && linkCount > 0) {
      results.pass.push(pageInfo.name);
    } else {
      results.fail.push(pageInfo.name);
    }
    
  } catch (error) {
    console.log(`    ❌ ${error.message}`);
    results.fail.push(pageInfo.name);
  }
}

const screenshotDir = join(__dirname, 'artifacts', 'screenshots-local');
mkdirSync(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const pageInfo of TEST_PAGES) {
  await testPage(page, pageInfo, screenshotDir);
}

await browser.close();

console.log(`\n✅ PASS: ${results.pass.length}, ❌ FAIL: ${results.fail.length}`);
process.exit(results.fail.length > 0 ? 1 : 0);
