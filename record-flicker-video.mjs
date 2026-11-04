#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const MENU_CLICKS = [
  { name: 'Torre-to-Monitor', from: '/', clickText: 'Monitor' },
  { name: 'Monitor-to-Viajes', from: '/monitor', clickText: 'Viajes' },
  { name: 'Viajes-to-Finanzas', from: '/agentes/viajes', clickText: 'Finanzas' },
  { name: 'Finanzas-to-Marketing', from: '/finanzas', clickText: 'Marketing' },
  { name: 'Marketing-to-Torre', from: '/marketing', clickText: 'Torre' }
];

async function recordClick(page, click, dir) {
  console.log(`\n🎬 ${click.name}: Navigating to ${click.from}`);
  
  await page.goto(LIVE_URL + click.from, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  
  // Start video recording
  console.log(`  🔴 Recording video...`);
  const videoPath = join(dir, `${click.name}.webm`);
  
  // Find and click the link
  const link = frame.locator(`a:has-text("${click.clickText}")`).first();
  const exists = await link.count() > 0;
  
  if (!exists) {
    console.log(`  ⚠️  Link "${click.clickText}" not found`);
    return;
  }
  
  console.log(`  👆 Clicking "${click.clickText}"...`);
  await link.click();
  
  // Wait to capture the flicker and navigation
  await page.waitForTimeout(2000);
  
  console.log(`  ✅ Click recorded`);
}

async function main() {
  console.log('🔍 Recording navigation flicker on LIVE site');
  
  const dir = join(__dirname, 'artifacts', 'flicker-evidence');
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
  console.log('✅ Logged in');
  
  // Record each click
  for (const click of MENU_CLICKS) {
    try {
      await recordClick(page, click, dir);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Close to save video
  await context.close();
  await browser.close();
  
  console.log('\n✅ Recording complete');
  console.log('📹 Video saved to:', dir);
}

main().catch(console.error);
