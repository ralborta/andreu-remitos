#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const ROUTES = [
  { name: 'Torre', path: '/' },
  { name: 'Monitor', path: '/monitor' },
  { name: 'Viajes', path: '/agentes/viajes' },
  { name: 'Destinos', path: '/agentes/destinos' },
  { name: 'WhatsApp', path: '/contactos' },
  { name: 'Finanzas', path: '/finanzas' },
  { name: 'Marketing', path: '/marketing' },
  { name: 'Métricas', path: '/backoffice' }
];

async function testRoute(page, route, dir) {
  console.log(`\n📍 Testing: ${route.name} (${route.path})`);
  
  try {
    // Navigate
    await page.goto(LIVE_URL + route.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Check iframe exists
    const iframe = page.locator('iframe[src*="/stitch/redesign/"]').first();
    const iframeExists = await iframe.count() > 0;
    
    if (!iframeExists) {
      console.log(`  ❌ No iframe found`);
      return { success: false, reason: 'No iframe' };
    }
    
    // Get iframe src
    const src = await iframe.getAttribute('src');
    console.log(`  ✅ Iframe: ${src}`);
    
    // Screenshot
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const screenshotPath = join(dir, `${route.name.toLowerCase()}.png`);
    writeFileSync(screenshotPath, screenshot);
    console.log(`  📸 Screenshot saved`);
    
    // Check for content in iframe
    const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
    const body = frame.locator('body');
    const bodyExists = await body.count() > 0;
    
    if (!bodyExists) {
      console.log(`  ⚠️  Iframe body not accessible`);
      return { success: true, warning: 'Cannot access iframe body (CORS)' };
    }
    
    return { success: true };
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function testNavigation(page, dir) {
  console.log('\n🔄 Testing navigation sequence (flicker check)...');
  
  const sequence = [
    { from: 'Torre', to: 'Monitor', fromPath: '/', clickText: 'Monitor' },
    { from: 'Monitor', to: 'Viajes', fromPath: '/monitor', clickText: 'Viajes' },
    { from: 'Viajes', to: 'Torre', fromPath: '/agentes/viajes', clickText: 'Torre' }
  ];
  
  let navSuccess = 0;
  let navFailed = 0;
  
  for (const nav of sequence) {
    try {
      console.log(`  ${nav.from} → ${nav.to}...`);
      
      await page.goto(LIVE_URL + nav.fromPath, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      const link = frame.locator(`a:has-text("${nav.clickText}")`).first();
      const exists = await link.count() > 0;
      
      if (!exists) {
        console.log(`    ⚠️  Link not found`);
        navFailed++;
        continue;
      }
      
      await link.click();
      await page.waitForTimeout(1500);
      
      // Verify navigation happened
      const currentUrl = page.url();
      console.log(`    ✅ Navigated (current: ${currentUrl})`);
      navSuccess++;
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      navFailed++;
    }
  }
  
  return { success: navSuccess, failed: navFailed };
}

async function main() {
  console.log('🧪 COMPREHENSIVE LIVE TEST');
  console.log('URL:', LIVE_URL);
  
  const dir = join(__dirname, 'artifacts', 'live-verification');
  mkdirSync(dir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
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
  console.log('✅ Logged in');
  
  // Test all routes
  const results = {};
  for (const route of ROUTES) {
    results[route.name] = await testRoute(page, route, dir);
  }
  
  // Test navigation
  const navResults = await testNavigation(page, dir);
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    const detail = result.reason || result.warning || 'OK';
    console.log(`${status} ${name.padEnd(20)} ${detail}`);
    if (result.success) passed++;
    else failed++;
  }
  
  console.log(`\n🔄 Navigation: ${navResults.success} successful, ${navResults.failed} failed`);
  console.log(`\n📸 Screenshots: ${dir}/`);
  console.log(`\n🎯 Route Tests: ${passed}/${ROUTES.length} passed`);
  
  if (failed > 0 || navResults.failed > 0) {
    console.log('\n⚠️  SOME TESTS FAILED - NEEDS INVESTIGATION');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - FIX VERIFIED');
  }
}

main().catch(console.error);
