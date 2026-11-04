#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_URL = 'http://localhost:3456/stitch/redesign';

const PAGES = [
  'torre.html', 'viajes.html', 'destinos.html', 'whatsapp.html',
  'finanzas.html', 'marketing-ofertas.html', 'monitor.html'
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const results = { pass: 0, fail: 0, details: [] };

async function testPage(page, file, viewport) {
  const name = file.replace('.html', '');
  console.log(`\n  📄 ${name} (${viewport.name})`);
  
  try {
    await page.goto(`${BASE_URL}/${file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Check sidebar
    const sidebar = page.locator('[data-sol-sidebar]');
    const sidebarExists = await sidebar.count() > 0;
    const linkCount = await page.locator('[data-sol-sidebar] a[href]').count();
    
    // Check no icon text leak (icons should be in material-symbols-outlined spans)
    const iconLeaks = await page.locator('body :not(.material-symbols-outlined):has-text("dashboard")').count();
    
    // Check pill
    const pill = page.locator('[data-sol-system-status]').first();
    const pillText = await pill.textContent().catch(() => '');
    const hasMultipleStates = (pillText.match(/activos|desconectado|degradado/gi) || []).length > 1;
    
    // Check visibility
    let visibilityOk = true;
    if (viewport.name === 'desktop') {
      visibilityOk = await sidebar.isVisible({ timeout: 1000 }).catch(() => false);
    } else {
      const hasHidden = await sidebar.evaluate(el => el.classList.contains('-translate-x-full')).catch(() => true);
      visibilityOk = hasHidden;
    }
    
    const passed = sidebarExists && linkCount > 0 && iconLeaks === 0 && !hasMultipleStates && visibilityOk;
    
    console.log(`    ${passed ? '✅' : '❌'} Sidebar: ${sidebarExists}, Links: ${linkCount}, IconLeaks: ${iconLeaks}, Pill: "${pillText.trim()}", Vis: ${visibilityOk}`);
    
    // Screenshot
    const dir = join(__dirname, 'artifacts', 'screenshots-local');
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${viewport.name}-${name}.png`) });
    
    if (passed) results.pass++;
    else results.fail++;
    
    results.details.push({ file, viewport: viewport.name, passed, linkCount, iconLeaks, pillText: pillText.trim() });
    
  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.fail++;
  }
}

const browser = await chromium.launch({ headless: true });

for (const viewport of VIEWPORTS) {
  console.log(`\n📱 ${viewport.name} (${viewport.width}x${viewport.height})`);
  const page = await browser.newPage({ viewport });
  
  for (const file of PAGES) {
    await testPage(page, file, viewport);
  }
  
  await page.close();
}

await browser.close();

console.log('\n' + '='.repeat(60));
console.log(`📊 TOTAL: ✅ ${results.pass} PASS, ❌ ${results.fail} FAIL`);
console.log('='.repeat(60));

if (results.fail > 0) {
  console.log('\n❌ Failed tests:');
  results.details.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.file} (${r.viewport}): links=${r.linkCount}, iconLeaks=${r.iconLeaks}`);
  });
}

process.exit(results.fail > 0 ? 1 : 0);
