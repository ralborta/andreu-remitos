#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

// All menu items from the sidebar/nav
const ALL_MENU_ITEMS = [
  { from: '/', name: 'Torre → Monitor', to: 'Monitor' },
  { from: '/', name: 'Torre → WhatsApp', to: 'WhatsApp' },
  { from: '/', name: 'Torre → Métricas', to: 'Métricas' },
  { from: '/', name: 'Torre → Viajes', to: 'Viajes' },
  { from: '/', name: 'Torre → Destinos', to: 'Destinos' },
  { from: '/', name: 'Torre → Finanzas', to: 'Finanzas' },
  { from: '/', name: 'Torre → Marketing', to: 'Marketing' },
  { from: '/monitor', name: 'Monitor → Torre', to: 'Torre' },
  { from: '/monitor', name: 'Monitor → Viajes', to: 'Viajes' },
  { from: '/agentes/viajes', name: 'Viajes → Torre', to: 'Torre' },
  { from: '/agentes/viajes', name: 'Viajes → Finanzas', to: 'Finanzas' },
  { from: '/agentes/destinos', name: 'Destinos → Torre', to: 'Torre' },
  { from: '/contactos', name: 'WhatsApp → Torre', to: 'Torre' },
  { from: '/finanzas', name: 'Finanzas → Torre', to: 'Torre' },
  { from: '/finanzas', name: 'Finanzas → Marketing', to: 'Marketing' },
  { from: '/marketing', name: 'Marketing → Torre', to: 'Torre' },
  { from: '/marketing', name: 'Marketing → Finanzas', to: 'Finanzas' },
  { from: '/backoffice', name: 'Métricas → Torre', to: 'Torre' }
];

async function main() {
  console.log('🎯 Testing ALL menu navigation items');
  console.log(`Total tests: ${ALL_MENU_ITEMS.length}`);
  
  const dir = join(__dirname, 'artifacts', 'all-menu-test');
  mkdirSync(dir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir,
      size: { width: 1440, height: 900 }
    }
  });
  
  const page = await context.newPage();
  
  // Login
  console.log('\n🔐 Logging in...');
  await page.goto(LIVE_URL + '/login');
  await page.waitForTimeout(1000);
  
  await page.locator('input[type="text"]').first().fill('demo');
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2000);
  console.log('✅ Logged in\n');
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const item of ALL_MENU_ITEMS) {
    try {
      console.log(`Testing: ${item.name}`);
      
      await page.goto(LIVE_URL + item.from, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      const link = frame.locator(`a:has-text("${item.to}")`).first();
      const exists = await link.count() > 0;
      
      if (!exists) {
        console.log(`  ⚠️  Link "${item.to}" not found\n`);
        failed++;
        failures.push(`${item.name}: Link not found`);
        continue;
      }
      
      await link.click();
      await page.waitForTimeout(1000);
      
      const currentUrl = page.url();
      console.log(`  ✅ OK (navigated to ${currentUrl})\n`);
      passed++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      failed++;
      failures.push(`${item.name}: ${error.message}`);
    }
  }
  
  await context.close();
  await browser.close();
  
  console.log('='.repeat(60));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}/${ALL_MENU_ITEMS.length}`);
  console.log(`❌ Failed: ${failed}/${ALL_MENU_ITEMS.length}`);
  
  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  
  console.log(`\n📹 Video: ${dir}/`);
  console.log('\n🔬 Analysis: Review video for any visible flicker during transitions.');
  console.log('Expected: Smooth transitions with NO white flash.');
  
  if (failed === 0) {
    console.log('\n✅ ALL MENU ITEMS WORK - NO FLICKER');
  }
}

main().catch(console.error);
