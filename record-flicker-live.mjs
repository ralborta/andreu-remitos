#!/usr/bin/env node
/**
 * Record navigation flicker on LIVE site
 * Captures fast frames during menu clicks to analyze the flash
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const MENU_ITEMS = [
  { name: 'Torre', from: '/agentes/viajes', to: '/' },
  { name: 'Monitor', from: '/', to: '/monitor' },
  { name: 'Viajes', from: '/monitor', to: '/agentes/viajes' },
  { name: 'Finanzas', from: '/agentes/viajes', to: '/finanzas' },
  { name: 'Marketing', from: '/finanzas', to: '/marketing' }
];

async function captureFlicker(page, menuItem, dir) {
  console.log(`\n🎬 Recording: ${menuItem.name} (${menuItem.from} → ${menuItem.to})`);
  
  // Navigate to starting page
  await page.goto(LIVE_URL + menuItem.from, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  
  // Find the link to click
  const link = frame.locator(`a[href="${menuItem.to}"]`).first();
  const linkExists = await link.count() > 0;
  
  if (!linkExists) {
    console.log(`  ⚠️  Link to ${menuItem.to} not found`);
    return;
  }
  
  // Start capturing frames rapidly
  const frames = [];
  let capturing = true;
  
  // Capture frames every 100ms for 2 seconds
  const captureInterval = setInterval(async () => {
    if (!capturing) return;
    const screenshot = await page.screenshot({ type: 'png' });
    frames.push({ timestamp: Date.now(), data: screenshot });
  }, 100);
  
  // Wait a bit, then click
  await page.waitForTimeout(500);
  console.log(`  👆 Clicking ${menuItem.name}...`);
  
  await link.click();
  
  // Continue capturing for 2 seconds after click
  await page.waitForTimeout(2000);
  capturing = false;
  clearInterval(captureInterval);
  
  // Save frames
  console.log(`  💾 Saving ${frames.length} frames...`);
  const itemDir = join(dir, `flicker-${menuItem.name.toLowerCase()}`);
  mkdirSync(itemDir, { recursive: true });
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = join(itemDir, `frame-${String(i).padStart(3, '0')}.png`);
    await require('fs').promises.writeFile(framePath, frames[i].data);
  }
  
  console.log(`  ✅ Saved to ${itemDir}/`);
}

async function main() {
  console.log('🔍 Recording navigation flicker on LIVE site');
  console.log('URL:', LIVE_URL);
  
  const dir = join(__dirname, 'artifacts', 'flicker-recordings');
  mkdirSync(dir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Login first
  console.log('\n🔐 Logging in...');
  await page.goto(LIVE_URL + '/login');
  await page.waitForTimeout(1000);
  
  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await usernameInput.fill('demo');
  await passwordInput.fill('demo123');
  
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(2000);
  
  console.log('✅ Logged in');
  
  // Record each menu item click
  for (const menuItem of MENU_ITEMS) {
    try {
      await captureFlicker(page, menuItem, dir);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log('\n✅ Recording complete. Frames in:', dir);
}

main().catch(console.error);
