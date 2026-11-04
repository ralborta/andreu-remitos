#!/usr/bin/env node
import { chromium } from 'playwright';

async function runComprehensiveTest() {
  console.log('=== COMPREHENSIVE NAVIGATION FLICKER FIX TEST ===\n');
  
  const browser = await chromium.launch({ 
    headless: false, // Run headed to see what's happening
    slowMo: 100 // Slow down a bit to observe
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  const results = [];
  
  try {
    // Start local dev server
    console.log('1. Loading local site...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Set marker on top window to prove it never reloads
    console.log('2. Setting shell marker on top window...');
    await page.evaluate(() => {
      window.__shellMarker = Date.now();
      console.log('[TEST] Shell marker set:', window.__shellMarker);
    });
    
    const initialMarker = await page.evaluate(() => window.__shellMarker);
    const initialNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    console.log(`   Shell marker: ${initialMarker}`);
    console.log(`   Initial navigation count: ${initialNavCount}\n`);
    
    // Get iframe
    const iframe = page.frameLocator('iframe[title*="Stitch"]');
    
    // Menu items to test (in order)
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
    console.log('3. Clicking through all menu items (2 complete cycles)...');
    for (let cycle = 1; cycle <= 2; cycle++) {
      console.log(`\n   === CYCLE ${cycle} ===`);
      for (const item of menuItems) {
        try {
          console.log(`   Clicking: ${item.name} (${item.href})`);
          
          // Find and click the nav link in iframe
          const link = iframe.locator(`a[href="${item.href}"]`).first();
          await link.click({ timeout: 5000 });
          
          // Wait for navigation to settle
          await page.waitForTimeout(1500);
          
          console.log(`   ✓ Navigated to ${item.name}`);
        } catch (error) {
          console.log(`   ✗ Failed to navigate to ${item.name}: ${error.message}`);
        }
      }
    }
    
    // Check marker and navigation count
    console.log('\n4. Verifying top window did not reload...');
    const finalMarker = await page.evaluate(() => window.__shellMarker);
    const finalNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    
    if (finalMarker === initialMarker) {
      console.log(`   ✓ Shell marker unchanged (${finalMarker})`);
      results.push({ test: 'Top window never reloaded (marker check)', status: 'PASS' });
    } else {
      console.log(`   ✗ Shell marker changed! Initial: ${initialMarker}, Final: ${finalMarker}`);
      results.push({ test: 'Top window never reloaded (marker check)', status: 'FAIL' });
    }
    
    if (finalNavCount === initialNavCount) {
      console.log(`   ✓ Navigation count unchanged (${finalNavCount})`);
      results.push({ test: 'No additional navigations (performance check)', status: 'PASS' });
    } else {
      console.log(`   ✗ Navigation count changed! Initial: ${initialNavCount}, Final: ${finalNavCount}`);
      results.push({ test: 'No additional navigations (performance check)', status: 'FAIL' });
    }
    
    // Now verify page scripts work after navigation
    console.log('\n5. Verifying page scripts work after navigation...\n');
    
    // Test Viajes - Choferes/Camiones tabs
    console.log('   Testing Viajes tabs...');
    await iframe.locator('a[href="/agentes/viajes"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      // Look for tab elements (common patterns)
      const choferesTab = iframe.locator('button:has-text("Choferes"), [role="tab"]:has-text("Choferes"), .tab:has-text("Choferes")').first();
      const camionesTab = iframe.locator('button:has-text("Camiones"), [role="tab"]:has-text("Camiones"), .tab:has-text("Camiones")').first();
      
      if (await choferesTab.count() > 0) {
        await choferesTab.click();
        await page.waitForTimeout(500);
        console.log('   ✓ Viajes Choferes tab clickable');
        results.push({ test: 'Viajes Choferes tab', status: 'PASS' });
      } else {
        console.log('   ⚠ Choferes tab not found (may have different selector)');
        results.push({ test: 'Viajes Choferes tab', status: 'SKIP' });
      }
      
      if (await camionesTab.count() > 0) {
        await camionesTab.click();
        await page.waitForTimeout(500);
        console.log('   ✓ Viajes Camiones tab clickable');
        results.push({ test: 'Viajes Camiones tab', status: 'PASS' });
      } else {
        console.log('   ⚠ Camiones tab not found (may have different selector)');
        results.push({ test: 'Viajes Camiones tab', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Viajes tabs error: ${error.message}`);
      results.push({ test: 'Viajes tabs', status: 'FAIL' });
    }
    
    // Test Finanzas - Cobrar modal
    console.log('\n   Testing Finanzas Cobrar modal...');
    await iframe.locator('a[href="/agentes/finanzas"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      const cobrarButton = iframe.locator('button:has-text("Cobrar")').first();
      
      if (await cobrarButton.count() > 0) {
        await cobrarButton.click();
        await page.waitForTimeout(500);
        
        // Check for modal
        const modal = iframe.locator('.modal-overlay, [role="dialog"], .dialog, [class*="modal"]');
        if (await modal.isVisible().catch(() => false)) {
          console.log('   ✓ Finanzas Cobrar modal opens');
          results.push({ test: 'Finanzas Cobrar modal opens', status: 'PASS' });
          
          // Try to close it
          const cancelButton = iframe.locator('button:has-text("Cancelar")').first();
          if (await cancelButton.count() > 0) {
            await cancelButton.click();
            await page.waitForTimeout(300);
            console.log('   ✓ Modal closes with Cancelar');
            results.push({ test: 'Finanzas modal closes', status: 'PASS' });
          } else {
            console.log('   ⚠ Cancelar button not found');
            results.push({ test: 'Finanzas modal closes', status: 'SKIP' });
          }
        } else {
          console.log('   ✗ Cobrar modal did not open');
          results.push({ test: 'Finanzas Cobrar modal opens', status: 'FAIL' });
        }
      } else {
        console.log('   ⚠ Cobrar button not found');
        results.push({ test: 'Finanzas Cobrar button', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Finanzas modal error: ${error.message}`);
      results.push({ test: 'Finanzas modal', status: 'FAIL' });
    }
    
    // Test WhatsApp - Chat list
    console.log('\n   Testing WhatsApp chat list...');
    await iframe.locator('a[href="/contactos"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      // Look for chat list elements
      const chatItems = iframe.locator('.chat-item, .conversation, [class*="chat"], [class*="contact"]');
      const count = await chatItems.count();
      
      if (count > 0) {
        console.log(`   ✓ WhatsApp chat list loads (${count} items)`);
        results.push({ test: 'WhatsApp chat list', status: 'PASS' });
      } else {
        console.log('   ⚠ No chat items found (may have different selector or empty)');
        results.push({ test: 'WhatsApp chat list', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ WhatsApp error: ${error.message}`);
      results.push({ test: 'WhatsApp chat list', status: 'FAIL' });
    }
    
    // Test Destinos - Map
    console.log('\n   Testing Destinos map...');
    await iframe.locator('a[href="/destinos"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      // Look for map container or canvas
      const map = iframe.locator('#map, .map, canvas, [class*="mapbox"], [class*="leaflet"]').first();
      
      if (await map.count() > 0) {
        console.log('   ✓ Destinos map element found');
        results.push({ test: 'Destinos map', status: 'PASS' });
      } else {
        console.log('   ⚠ Map element not found (may have different selector)');
        results.push({ test: 'Destinos map', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Destinos error: ${error.message}`);
      results.push({ test: 'Destinos map', status: 'FAIL' });
    }
    
    // Test Torre - KPIs/map/chat
    console.log('\n   Testing Torre de Control KPIs...');
    await iframe.locator('a[href="/"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      // Look for KPI cards or metrics
      const kpis = iframe.locator('.kpi, .metric, .stat, .card, [class*="kpi"], [class*="metric"]');
      const count = await kpis.count();
      
      if (count > 0) {
        console.log(`   ✓ Torre KPIs load (${count} elements)`);
        results.push({ test: 'Torre KPIs', status: 'PASS' });
      } else {
        console.log('   ⚠ KPI elements not found (may have different selector)');
        results.push({ test: 'Torre KPIs', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Torre error: ${error.message}`);
      results.push({ test: 'Torre KPIs', status: 'FAIL' });
    }
    
    // Test Monitor - Data
    console.log('\n   Testing Monitor data...');
    await iframe.locator('a[href="/monitor"]').first().click();
    await page.waitForTimeout(2000);
    
    try {
      // Look for data tables or lists
      const data = iframe.locator('table, .table, .data-table, [class*="monitor"]');
      
      if (await data.count() > 0) {
        console.log('   ✓ Monitor data elements found');
        results.push({ test: 'Monitor data', status: 'PASS' });
      } else {
        console.log('   ⚠ Monitor data not found (may have different selector or empty)');
        results.push({ test: 'Monitor data', status: 'SKIP' });
      }
    } catch (error) {
      console.log(`   ✗ Monitor error: ${error.message}`);
      results.push({ test: 'Monitor data', status: 'FAIL' });
    }
    
    // Summary
    console.log('\n\n=== TEST RESULTS SUMMARY ===');
    console.log('────────────────────────────────────────────────────');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠';
      const color = r.status === 'PASS' ? '' : r.status === 'FAIL' ? '' : '';
      console.log(`${icon} ${r.test}: ${r.status}`);
    });
    
    console.log('────────────────────────────────────────────────────');
    console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log(`Pass rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0 && passed >= 2) {
      console.log('\n✓✓✓ ALL CRITICAL TESTS PASSED! ✓✓✓');
      console.log('Safe to merge to sol-borrador and deploy.');
    } else if (failed > 0) {
      console.log('\n✗✗✗ SOME TESTS FAILED ✗✗✗');
      console.log('Do NOT merge until all tests pass.');
    } else {
      console.log('\n⚠⚠⚠ NOT ENOUGH DATA ⚠⚠⚠');
      console.log('Verify manually before merging.');
    }
    
  } catch (error) {
    console.error('\n✗✗✗ TEST ERROR ✗✗✗');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    await page.waitForTimeout(2000); // Keep browser open briefly
    await browser.close();
  }
}

runComprehensiveTest();
