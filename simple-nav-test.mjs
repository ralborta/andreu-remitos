#!/usr/bin/env node
import { chromium } from 'playwright';

async function main() {
  console.log('🔍 Simple navigation test');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Loading /login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);
  
  await page.locator('input[type="text"]').first().fill('demo');
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  
  console.log('Waiting for dashboard...');
  await page.waitForTimeout(3000);
  
  console.log('Checking iframe...');
  const iframe = page.locator('iframe[src*="/stitch/redesign/"]').first();
  const iframeExists = await iframe.count() > 0;
  console.log('Iframe exists:', iframeExists);
  
  if (iframeExists) {
    const src = await iframe.getAttribute('src');
    console.log('Iframe src:', src);
    
    const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
    const links = frame.locator('a');
    const linkCount = await links.count();
    console.log('Link count in iframe:', linkCount);
    
    if (linkCount > 0) {
      for (let i = 0; i < Math.min(5, linkCount); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        console.log(`  Link ${i}: "${text}" -> ${href}`);
      }
    }
  }
  
  console.log('\nManual test: Browser will stay open for 30 seconds.');
  console.log('Click around the menu to test navigation...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  console.log('Done');
}

main().catch(console.error);
