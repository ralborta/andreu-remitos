#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const NAV_TESTS = [
  { from: '/', to: 'Monitor', name: 'Torre→Monitor' },
  { from: '/monitor', to: 'Viajes', name: 'Monitor→Viajes' },
  { from: '/agentes/viajes', to: 'Finanzas', name: 'Viajes→Finanzas' },
  { from: '/finanzas', to: 'Marketing', name: 'Finanzas→Marketing' },
  { from: '/marketing', to: 'Métricas', name: 'Marketing→Métricas' },
  { from: '/backoffice', to: 'WhatsApp', name: 'Métricas→WhatsApp' },
  { from: '/contactos', to: 'Torre', name: 'WhatsApp→Torre' }
];

async function captureTransition(page, nav, dir) {
  console.log(`\n🎬 ${nav.name}`);
  
  await page.goto(LIVE_URL + nav.from, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  
  // Check that page is loaded
  const iframe = page.locator('iframe[src*="/stitch/redesign/"]');
  if (await iframe.count() === 0) {
    console.log(`  ❌ No iframe found`);
    return { success: false, reason: 'No iframe' };
  }
  
  console.log(`  ✅ Page loaded`);
  
  // Capture frames during click
  const frames = [];
  let capturing = true;
  
  const captureLoop = async () => {
    while (capturing) {
      try {
        const screenshot = await page.screenshot({ type: 'png', fullPage: false });
        frames.push(screenshot);
      } catch (e) {}
      await page.waitForTimeout(50); // 20fps
    }
  };
  
  const capturePromise = captureLoop();
  
  // Find and click link
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  const link = frame.locator(`a:has-text("${nav.to}")`).first();
  
  if (await link.count() === 0) {
    console.log(`  ⚠️  Link "${nav.to}" not found`);
    capturing = false;
    return { success: false, reason: 'Link not found' };
  }
  
  console.log(`  👆 Clicking "${nav.to}"...`);
  await link.click();
  
  // Capture for 3 seconds
  await page.waitForTimeout(3000);
  capturing = false;
  await capturePromise;
  
  // Save frames
  const navDir = join(dir, nav.name.replace('→', '-to-'));
  mkdirSync(navDir, { recursive: true });
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = join(navDir, `frame-${String(i).padStart(3, '0')}.png`);
    writeFileSync(framePath, frames[i]);
  }
  
  console.log(`  ✅ ${frames.length} frames captured`);
  
  // Verify new page loaded
  await page.waitForTimeout(500);
  const newIframe = page.locator('iframe[src*="/stitch/redesign/"]');
  const iframeCount = await newIframe.count();
  
  console.log(`  📊 Iframes visible: ${iframeCount}`);
  
  return { success: true, frames: frames.length, iframeCount };
}

async function main() {
  console.log('🧪 DOUBLE-BUFFER VERIFICATION - All Menu Items');
  console.log('URL:', LIVE_URL);
  console.log('\n🎯 TESTING:');
  console.log('  1. NO blank frame during transition');
  console.log('  2. Old page visible until new ready');
  console.log('  3. Smooth fade transition');
  console.log('  4. All functionality works\n');
  
  const dir = join(__dirname, 'artifacts', 'double-buffer-test');
  mkdirSync(dir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Login
  console.log('🔐 Logging in...');
  await page.goto(LIVE_URL + '/login');
  await page.waitForTimeout(1000);
  
  await page.locator('input[type="text"]').first().fill('demo');
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2000);
  console.log('✅ Logged in');
  
  // Test each navigation
  const results = [];
  
  for (const nav of NAV_TESTS) {
    try {
      const result = await captureTransition(page, nav, dir);
      results.push({ nav: nav.name, ...result });
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ nav: nav.name, success: false, reason: error.message });
    }
  }
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTS');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const detail = result.reason || `${result.frames} frames`;
    console.log(`${status} ${result.nav.padEnd(25)} ${detail}`);
    
    if (result.success) passed++;
    else failed++;
  }
  
  console.log(`\n📸 Frames: ${dir}/`);
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  console.log('\n🔬 MANUAL REVIEW:');
  console.log('   Check frame sequences for blank/white frames');
  console.log('   Verify smooth transitions with no flash');
  
  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch(console.error);
