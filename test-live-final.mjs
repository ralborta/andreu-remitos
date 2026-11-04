#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const ALL_NAV_TESTS = [
  { from: '/', clickText: 'Monitor', name: 'Torre→Monitor' },
  { from: '/monitor', clickText: 'Viajes', name: 'Monitor→Viajes' },
  { from: '/agentes/viajes', clickText: 'WhatsApp', name: 'Viajes→WhatsApp' },
  { from: '/contactos', clickText: 'Finanzas', name: 'WhatsApp→Finanzas' },
  { from: '/finanzas', clickText: 'Marketing', name: 'Finanzas→Marketing' },
  { from: '/marketing', clickText: 'Métricas', name: 'Marketing→Métricas' },
  { from: '/backoffice', clickText: 'Torre', name: 'Métricas→Torre' }
];

async function captureNavigationFrames(page, nav, dir) {
  console.log(`\n📹 ${nav.name}`);
  
  await page.goto(LIVE_URL + nav.from, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  
  // Start capturing screenshots rapidly
  const frames = [];
  let capturing = true;
  
  const captureLoop = async () => {
    while (capturing) {
      try {
        const screenshot = await page.screenshot({ type: 'png' });
        frames.push({ 
          timestamp: Date.now(), 
          data: screenshot 
        });
      } catch (e) {
        // Ignore errors during capture
      }
      await page.waitForTimeout(50); // 20fps
    }
  };
  
  // Start capturing
  const capturePromise = captureLoop();
  
  // Click link
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  const link = frame.locator(`a:has-text("${nav.clickText}")`).first();
  
  if (await link.count() === 0) {
    console.log(`  ⚠️  Link not found`);
    capturing = false;
    return { success: false, reason: 'Link not found' };
  }
  
  console.log(`  👆 Clicking...`);
  await link.click();
  await page.waitForTimeout(2000);
  
  // Stop capturing
  capturing = false;
  await capturePromise;
  
  // Save frames
  const navDir = join(dir, nav.name.replace('→', '-to-'));
  mkdirSync(navDir, { recursive: true });
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = join(navDir, `frame-${String(i).padStart(3, '0')}.png`);
    writeFileSync(framePath, frames[i].data);
  }
  
  console.log(`  ✅ ${frames.length} frames saved`);
  return { success: true, frames: frames.length };
}

async function checkForIconText(page) {
  // Check if any Material Symbol icons are showing as text
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  const icons = frame.locator('.material-symbols-outlined');
  const count = await icons.count();
  
  if (count === 0) return { hasIconText: false };
  
  // Sample first few icons
  for (let i = 0; i < Math.min(5, count); i++) {
    const icon = icons.nth(i);
    const text = await icon.textContent();
    // Icon text would be words like 'search', 'notifications'
    if (text && text.length > 3 && /^[a-z_]+$/.test(text)) {
      return { hasIconText: true, example: text };
    }
  }
  
  return { hasIconText: false };
}

async function main() {
  console.log('🧪 FINAL LIVE VERIFICATION - Fast Frame Capture');
  console.log('URL:', LIVE_URL);
  console.log('\n⚠️  CRITICAL CHECKS:');
  console.log('  1. NO tab reload spinner');
  console.log('  2. NO blank white frame');
  console.log('  3. NO icon text');
  console.log('  4. Smooth navigation\n');
  
  const dir = join(__dirname, 'artifacts', 'final-live-test');
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
  
  // Test each navigation with frame capture
  const results = [];
  
  for (const nav of ALL_NAV_TESTS) {
    try {
      const result = await captureNavigationFrames(page, nav, dir);
      results.push({ nav: nav.name, ...result });
      
      // Check for icon text after navigation
      const iconCheck = await checkForIconText(page);
      if (iconCheck.hasIconText) {
        console.log(`  ❌ ICON TEXT DETECTED: "${iconCheck.example}"`);
        results[results.length - 1].iconTextDetected = iconCheck.example;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ nav: nav.name, success: false, reason: error.message });
    }
  }
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;
  let iconIssues = 0;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const detail = result.reason || `${result.frames} frames`;
    const iconWarn = result.iconTextDetected ? ` ⚠️ ICON TEXT: ${result.iconTextDetected}` : '';
    console.log(`${status} ${result.nav.padEnd(25)} ${detail}${iconWarn}`);
    
    if (result.success) passed++;
    else failed++;
    
    if (result.iconTextDetected) iconIssues++;
  }
  
  console.log(`\n📸 Fast frames saved: ${dir}/`);
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⚠️  Icon text issues: ${iconIssues}`);
  
  console.log('\n🔬 MANUAL REVIEW REQUIRED:');
  console.log('   Review frame sequences for:');
  console.log('   - White/blank frames (flicker)');
  console.log('   - Smooth transitions');
  console.log('   - No browser spinner (check frame-000.png through frame-020.png)');
  
  if (failed > 0 || iconIssues > 0) {
    console.log('\n❌ ISSUES DETECTED - REVERT MAY BE NEEDED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL AUTOMATED CHECKS PASSED');
  }
}

main().catch(console.error);
