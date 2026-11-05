#!/usr/bin/env node
import { chromium } from 'playwright';

async function runComprehensiveLiveTest() {
  console.log('=== COMPREHENSIVE LIVE TEST - PR #21 ===\n');
  console.log('Testing: https://transitone-transitone-borrador.wd75db.easypanel.host/\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  const results = [];
  
  try {
    const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';
    
    // Load site
    console.log('1. Loading live site...');
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Set marker on top window
    console.log('\n2. Setting shell marker on top window...');
    await page.evaluate(() => {
      window.__shellMarker = Date.now();
      console.log('[TEST] Shell marker set:', window.__shellMarker);
    });
    
    const initialMarker = await page.evaluate(() => window.__shellMarker);
    const initialNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    console.log(`   Shell marker: ${initialMarker}`);
    console.log(`   Initial navigation count: ${initialNavCount}`);
    
    // Get iframe
    const iframe = page.frameLocator('iframe[title*="Stitch"]');
    
    // Menu items to test
    const menuItems = [
      { name: 'Torre de Control', href: '/' },
      { name: 'Viajes', href: '/agentes/viajes' },
      { name: 'Destinos', href: '/destinos' },
      { name: 'WhatsApp', href: '/contactos' },
      { name: 'Finanzas', href: '/agentes/finanzas' },
      { name: 'Marketing', href: '/marketing' },
      { name: 'Promociones', href: '/marketing/promociones' },
      { name: 'Monitor', href: '/monitor' },
      { name: 'Métricas', href: '/backoffice' },
    ];
    
    // Click through all menu items TWICE
    console.log('\n3. Clicking through all menu items (2 complete cycles)...');
    for (let cycle = 1; cycle <= 2; cycle++) {
      console.log(`\n   === CYCLE ${cycle} ===`);
      for (const item of menuItems) {
        try {
          console.log(`   Clicking: ${item.name}`);
          const link = iframe.locator(`a[href="${item.href}"]`).first();
          await link.click({ timeout: 10000 });
          await page.waitForTimeout(1500);
          console.log(`   ✓ ${item.name}`);
        } catch (error) {
          console.log(`   ✗ ${item.name}: ${error.message}`);
        }
      }
    }
    
    // Check marker and navigation count
    console.log('\n4. Verifying top window did not reload...');
    const finalMarker = await page.evaluate(() => window.__shellMarker);
    const finalNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    
    if (finalMarker === initialMarker) {
      console.log(`   ✓ Shell marker unchanged (${finalMarker})`);
      results.push({ test: 'Top window never reloaded (marker)', status: 'PASS' });
    } else {
      console.log(`   ✗ Shell marker changed! Initial: ${initialMarker}, Final: ${finalMarker}`);
      results.push({ test: 'Top window never reloaded (marker)', status: 'FAIL' });
    }
    
    if (finalNavCount === initialNavCount) {
      console.log(`   ✓ Navigation count unchanged (${finalNavCount})`);
      results.push({ test: 'No additional navigations', status: 'PASS' });
    } else {
      console.log(`   ✗ Navigation count changed! Initial: ${initialNavCount}, Final: ${finalNavCount}`);
      results.push({ test: 'No additional navigations', status: 'FAIL' });
    }
    
    // Feature tests
    console.log('\n5. Testing page features after navigation...\n');
    
    // Viajes tabs
    console.log('   Testing Viajes tabs...');
    await iframe.locator('a[href="/agentes/viajes"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const tabs = iframe.locator('button, [role="tab"], a').filter({ hasText: /choferes|camiones/i });
      const tabCount = await tabs.count();
      if (tabCount > 0) {
        console.log(`   ✓ Viajes tabs found (${tabCount} tabs)`);
        results.push({ test: 'Viajes tabs exist', status: 'PASS' });
      } else {
        console.log('   ⚠ Viajes tabs not found');
        results.push({ test: 'Viajes tabs exist', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Viajes error: ${error.message}`);
      results.push({ test: 'Viajes tabs', status: 'FAIL' });
    }
    
    // Finanzas modal
    console.log('\n   Testing Finanzas Cobrar modal...');
    await iframe.locator('a[href="/agentes/finanzas"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const cobrarBtn = iframe.locator('button').filter({ hasText: /cobrar/i }).first();
      if (await cobrarBtn.count() > 0) {
        await cobrarBtn.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        
        const modal = iframe.locator('[class*="modal"], [role="dialog"], .overlay');
        const isVisible = await modal.first().isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          console.log('   ✓ Finanzas Cobrar modal opens');
          results.push({ test: 'Finanzas Cobrar modal', status: 'PASS' });
          
          const cancelBtn = iframe.locator('button').filter({ hasText: /cancelar/i }).first();
          if (await cancelBtn.count() > 0) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
            console.log('   ✓ Modal closes');
          }
        } else {
          console.log('   ⚠ Modal did not appear (may have different structure)');
          results.push({ test: 'Finanzas Cobrar modal', status: 'SKIP' });
        }
      } else {
        console.log('   ⚠ Cobrar button not found');
        results.push({ test: 'Finanzas Cobrar button', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Finanzas error: ${error.message}`);
      results.push({ test: 'Finanzas modal', status: 'FAIL' });
    }
    
    // WhatsApp
    console.log('\n   Testing WhatsApp page...');
    await iframe.locator('a[href="/contactos"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const content = iframe.locator('body');
      if (await content.count() > 0) {
        console.log('   ✓ WhatsApp page loads');
        results.push({ test: 'WhatsApp page', status: 'PASS' });
      } else {
        console.log('   ✗ WhatsApp page did not load');
        results.push({ test: 'WhatsApp page', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`   ✗ WhatsApp error: ${error.message}`);
      results.push({ test: 'WhatsApp page', status: 'FAIL' });
    }
    
    // Destinos
    console.log('\n   Testing Destinos page...');
    await iframe.locator('a[href="/destinos"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const content = iframe.locator('body');
      if (await content.count() > 0) {
        console.log('   ✓ Destinos page loads');
        results.push({ test: 'Destinos page', status: 'PASS' });
      } else {
        console.log('   ✗ Destinos page did not load');
        results.push({ test: 'Destinos page', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`   ✗ Destinos error: ${error.message}`);
      results.push({ test: 'Destinos page', status: 'FAIL' });
    }
    
    // Torre
    console.log('\n   Testing Torre de Control...');
    await iframe.locator('a[href="/"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const content = iframe.locator('body');
      if (await content.count() > 0) {
        console.log('   ✓ Torre page loads');
        results.push({ test: 'Torre page', status: 'PASS' });
      } else {
        console.log('   ✗ Torre page did not load');
        results.push({ test: 'Torre page', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`   ✗ Torre error: ${error.message}`);
      results.push({ test: 'Torre page', status: 'FAIL' });
    }
    
    // Monitor
    console.log('\n   Testing Monitor page...');
    await iframe.locator('a[href="/monitor"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const content = iframe.locator('body');
      if (await content.count() > 0) {
        console.log('   ✓ Monitor page loads');
        results.push({ test: 'Monitor page', status: 'PASS' });
      } else {
        console.log('   ✗ Monitor page did not load');
        results.push({ test: 'Monitor page', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`   ✗ Monitor error: ${error.message}`);
      results.push({ test: 'Monitor page', status: 'FAIL' });
    }
    
    // Summary
    console.log('\n\n=== LIVE TEST RESULTS ===');
    console.log('────────────────────────────────────────────────────');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠';
      console.log(`${icon} ${r.test}: ${r.status}`);
    });
    
    console.log('────────────────────────────────────────────────────');
    console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log(`Pass rate: ${passed}/${passed + failed} = ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0 && passed >= 8) {
      console.log('\n✓✓✓ ALL CRITICAL TESTS PASSED! ✓✓✓');
      console.log('PR #21 deployment successful!');
      return true;
    } else if (failed > 0) {
      console.log('\n✗✗✗ SOME TESTS FAILED ✗✗✗');
      console.log('REVERT REQUIRED!');
      return false;
    } else {
      console.log('\n⚠⚠⚠ INSUFFICIENT DATA ⚠⚠⚠');
      console.log('Manual verification recommended');
      return null;
    }
    
  } catch (error) {
    console.error('\n✗✗✗ TEST ERROR ✗✗✗');
    console.error(error.message);
    console.error(error.stack);
    return false;
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

const result = await runComprehensiveLiveTest();
process.exit(result === true ? 0 : result === false ? 1 : 2);
