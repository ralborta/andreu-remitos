#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

async function recordSession(cacheName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎥 RECORDING: ${cacheName.toUpperCase()} CACHE`);
  console.log('='.repeat(70));
  
  const dir = join(__dirname, 'artifacts', `real-browser-${cacheName}`);
  mkdirSync(dir, { recursive: true });
  
  const browser = await chromium.launch({ 
    headless: false,  // HEADED to see real behavior
    slowMo: 100 // Slow down to see clearly
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir,
      size: { width: 1440, height: 900 }
    }
  });
  
  const page = await context.newPage();
  
  // Inject console logger to see if double-buffer runs
  await page.addInitScript(() => {
    const originalLog = console.log;
    window.testLogs = [];
    console.log = (...args) => {
      window.testLogs.push(args.join(' '));
      originalLog(...args);
    };
  });
  
  console.log('\n🔐 Logging in...');
  await page.goto(LIVE_URL + '/login');
  await page.waitForTimeout(2000);
  
  await page.locator('input[type="text"]').first().fill('demo');
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  console.log('✅ Logged in\n');
  
  // Test navigation sequence
  const navSequence = [
    { from: '/', to: 'Monitor', wait: 'Monitor' },
    { from: '/monitor', to: 'Viajes', wait: 'Viajes' },
    { from: '/agentes/viajes', to: 'Finanzas', wait: 'Finanzas' },
    { from: '/finanzas', to: 'Torre', wait: 'Torre' }
  ];
  
  for (const nav of navSequence) {
    console.log(`📍 Navigating: ${nav.from} → ${nav.to}`);
    
    // Ensure we're on the starting page
    await page.goto(LIVE_URL + nav.from);
    await page.waitForTimeout(2000);
    
    // Check page state before click
    console.log('   Before click:');
    const urlBefore = page.url();
    console.log(`   - URL: ${urlBefore}`);
    
    const iframesBefore = await page.locator('iframe[src*="/stitch/redesign/"]').count();
    console.log(`   - Iframes: ${iframesBefore}`);
    
    // Click the link
    const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
    const link = frame.locator(`a:has-text("${nav.to}")`).first();
    
    if (await link.count() === 0) {
      console.log(`   ⚠️  Link not found\n`);
      continue;
    }
    
    console.log(`   👆 Clicking "${nav.to}"...`);
    await link.click();
    
    // Wait and observe
    await page.waitForTimeout(4000);
    
    // Check page state after click
    console.log('   After click:');
    const urlAfter = page.url();
    console.log(`   - URL: ${urlAfter}`);
    
    const iframesAfter = await page.locator('iframe[src*="/stitch/redesign/"]').count();
    console.log(`   - Iframes: ${iframesAfter}`);
    
    // Check if top page navigated
    if (urlBefore !== urlAfter) {
      console.log(`   ⚠️  TOP PAGE NAVIGATED (this causes reload)`);
    }
    
    // Get console logs from page
    const logs = await page.evaluate(() => window.testLogs || []);
    if (logs.length > 0) {
      console.log(`   📋 Console logs: ${logs.slice(-5).join(', ')}`);
    }
    
    console.log('');
  }
  
  console.log('⏳ Keeping browser open for 10 seconds to save video...');
  await page.waitForTimeout(10000);
  
  await context.close();
  await browser.close();
  
  console.log(`✅ Video saved to: ${dir}/\n`);
  return dir;
}

async function main() {
  console.log('🎬 HONEST REPRODUCTION - Real Browser Recording');
  console.log('Testing on:', LIVE_URL);
  console.log('\nThis will open real browser windows and record video.');
  console.log('Watch carefully for any white flashes.\n');
  
  // Test with cold cache (first time load)
  console.log('🧊 COLD CACHE TEST (clearing storage)...');
  const coldDir = await recordSession('cold');
  
  console.log('\n⏳ Waiting 5 seconds before warm cache test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test with warm cache (resources cached)
  console.log('🔥 WARM CACHE TEST (resources cached)...');
  const warmDir = await recordSession('warm');
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RECORDING COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📹 Cold cache video: ${coldDir}/`);
  console.log(`📹 Warm cache video: ${warmDir}/`);
  console.log('\n🔬 NEXT STEPS:');
  console.log('   1. Watch both videos frame-by-frame');
  console.log('   2. Look for white/light frames during navigation');
  console.log('   3. Check console output above for issues');
  console.log('   4. Identify root cause');
}

main().catch(console.error);
