#!/usr/bin/env node
import { chromium } from 'playwright';

async function verifyLiveRevert() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';
  const results = [];

  try {
    console.log('Starting verification of live site after revert...\n');

    // Set longer timeout
    page.setDefaultTimeout(60000);

    // Login
    console.log('1. Logging in...');
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.fill('input[type="text"]', 'demo');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✓ Login successful\n');

    // Navigate to Finanzas and test Cobrar modal
    console.log('2. Testing Finanzas Cobrar modal...');
    await page.click('a[href="/agentes/finanzas"]');
    await page.waitForTimeout(2000);
    
    // Click Cobrar button
    const cobrarButton = page.locator('button:has-text("Cobrar")').first();
    if (await cobrarButton.count() > 0) {
      await cobrarButton.click();
      await page.waitForTimeout(500);
      
      // Check if modal opened
      const modal = page.locator('.modal-overlay, [role="dialog"], .dialog');
      if (await modal.count() > 0) {
        console.log('✓ Cobrar modal opens');
        results.push({ test: 'Finanzas Cobrar modal', status: 'PASS' });
        
        // Try to close it
        const cancelButton = page.locator('button:has-text("Cancelar")').first();
        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await page.waitForTimeout(300);
          console.log('✓ Modal closes with Cancelar');
        }
      } else {
        console.log('✗ Cobrar modal did not open');
        results.push({ test: 'Finanzas Cobrar modal', status: 'FAIL' });
      }
    } else {
      console.log('✗ Cobrar button not found');
      results.push({ test: 'Finanzas Cobrar button', status: 'FAIL' });
    }
    console.log();

    // Navigate to WhatsApp and test chat list
    console.log('3. Testing WhatsApp chat list...');
    await page.click('a[href="/contactos"]');
    await page.waitForTimeout(2000);
    
    // Check for chat list elements
    const chatItems = page.locator('.chat-item, .conversation, [class*="chat"]');
    if (await chatItems.count() > 0) {
      console.log(`✓ WhatsApp chat list loads (${await chatItems.count()} items)`);
      results.push({ test: 'WhatsApp chat list', status: 'PASS' });
    } else {
      console.log('✗ WhatsApp chat list did not load');
      results.push({ test: 'WhatsApp chat list', status: 'FAIL' });
    }
    console.log();

    // Navigate to Torre and test KPIs
    console.log('4. Testing Torre de Control KPIs...');
    await page.click('a[href="/"]');
    await page.waitForTimeout(2000);
    
    // Check for KPI cards
    const kpiCards = page.locator('.kpi-card, .metric-card, [class*="stat"]');
    if (await kpiCards.count() > 0) {
      console.log(`✓ Torre KPIs load (${await kpiCards.count()} cards)`);
      results.push({ test: 'Torre KPIs', status: 'PASS' });
    } else {
      console.log('✗ Torre KPIs did not load');
      results.push({ test: 'Torre KPIs', status: 'FAIL' });
    }
    console.log();

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : '✗';
      console.log(`${icon} ${r.test}: ${r.status}`);
    });
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const totalCount = results.length;
    console.log(`\nTotal: ${passCount}/${totalCount} tests passed`);
    
    if (passCount === totalCount) {
      console.log('\n✓ All functionality restored after revert!');
    } else {
      console.log('\n✗ Some functionality still broken - may need more time for deployment');
    }

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    await browser.close();
  }
}

verifyLiveRevert();
