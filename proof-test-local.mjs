#!/usr/bin/env node
import { chromium } from 'playwright';

const LOCAL_URL = 'http://localhost:3000';

async function main() {
  console.log('🧪 COMPREHENSIVE PROOF TEST - LOCAL');
  console.log('='.repeat(70));
  console.log('\nMUST PASS BEFORE MERGE:');
  console.log('  1. window.__shellMarker unchanged through all nav');
  console.log('  2. performance.getEntriesByType("navigation") count unchanged');
  console.log('  3. All page scripts work after menu navigation');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Login
  console.log('\n🔐 Logging in...');
  await page.goto(LOCAL_URL + '/login');
  await page.waitForTimeout(1000);
  
  await page.locator('input[type="text"]').first().fill('demo');
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  
  // Set marker on top page
  await page.evaluate(() => {
    window.__shellMarker = Date.now();
    console.log('[TEST] Shell marker set:', window.__shellMarker);
  });
  
  const initialMarker = await page.evaluate(() => window.__shellMarker);
  const initialNavCount = await page.evaluate(() => 
    performance.getEntriesByType('navigation').length
  );
  
  console.log(`✅ Initial marker: ${initialMarker}`);
  console.log(`✅ Initial nav count: ${initialNavCount}\n`);
  
  // Menu items to click through TWICE
  const menuItems = [
    'Torre', 'Viajes', 'Destinos', 'WhatsApp', 
    'Finanzas', 'Marketing', 'Promociones', 'Monitor', 'Métricas'
  ];
  
  const results = [];
  
  // Click each menu item TWICE
  for (let round = 1; round <= 2; round++) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`ROUND ${round}/2`);
    console.log('='.repeat(70));
    
    for (const item of menuItems) {
      console.log(`\n📍 Clicking: ${item}`);
      
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      const link = frame.locator(`a:has-text("${item}")`).first();
      
      if (await link.count() === 0) {
        console.log(`   ⚠️  Link not found`);
        results.push({ round, item, found: false });
        continue;
      }
      
      await link.click();
      await page.waitForTimeout(1500);
      
      // Check marker and nav count
      const currentMarker = await page.evaluate(() => window.__shellMarker);
      const currentNavCount = await page.evaluate(() => 
        performance.getEntriesByType('navigation').length
      );
      
      const markerUnchanged = currentMarker === initialMarker;
      const navCountUnchanged = currentNavCount === initialNavCount;
      
      console.log(`   Marker: ${currentMarker} ${markerUnchanged ? '✅' : '❌ CHANGED!'}`);
      console.log(`   Nav count: ${currentNavCount} ${navCountUnchanged ? '✅' : '❌ INCREASED!'}`);
      
      results.push({
        round,
        item,
        found: true,
        markerUnchanged,
        navCountUnchanged
      });
    }
  }
  
  // Functional checks after navigation
  console.log(`\n${'='.repeat(70)}`);
  console.log('FUNCTIONAL CHECKS (after menu navigation)');
  console.log('='.repeat(70));
  
  const functionalChecks = [];
  
  // 1. Viajes Choferes/Camiones tabs
  console.log('\n📋 Viajes Choferes/Camiones tabs');
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  await frame.locator('a:has-text("Viajes")').first().click();
  await page.waitForTimeout(2000);
  
  const choferesTab = frame.locator('button, [role="tab"]').filter({ hasText: /Choferes/i }).first();
  if (await choferesTab.count() > 0) {
    await choferesTab.click();
    await page.waitForTimeout(1000);
    const rows = await frame.locator('table tbody tr, [data-row], .data-row').count();
    console.log(`   ${rows > 0 ? '✅' : '❌'} Choferes tab: ${rows} rows`);
    functionalChecks.push({ name: 'Viajes Choferes', pass: rows > 0 });
  } else {
    console.log(`   ❌ Choferes tab not found`);
    functionalChecks.push({ name: 'Viajes Choferes', pass: false });
  }
  
  // 2. Finanzas Cobrar modal
  console.log('\n📋 Finanzas Cobrar modal');
  await frame.locator('a:has-text("Finanzas")').first().click();
  await page.waitForTimeout(2000);
  
  const cobrarBtn = frame.locator('button').filter({ hasText: /Cobrar/i }).first();
  if (await cobrarBtn.count() > 0) {
    await cobrarBtn.click();
    await page.waitForTimeout(500);
    
    const modal = frame.locator('[role="dialog"], .modal, [data-modal], [id*="modal"]').first();
    const modalVisible = await modal.count() > 0;
    console.log(`   ${modalVisible ? '✅' : '❌'} Modal opened: ${modalVisible}`);
    
    if (modalVisible) {
      const cancelarBtn = frame.locator('button').filter({ hasText: /Cancelar/i }).first();
      if (await cancelarBtn.count() > 0) {
        await cancelarBtn.click();
        await page.waitForTimeout(500);
        console.log(`   ✅ Cancelar closed modal`);
      }
    }
    functionalChecks.push({ name: 'Finanzas Cobrar', pass: modalVisible });
  } else {
    console.log(`   ❌ Cobrar button not found`);
    functionalChecks.push({ name: 'Finanzas Cobrar', pass: false });
  }
  
  // 3. WhatsApp chat list
  console.log('\n📋 WhatsApp chat list');
  await frame.locator('a:has-text("WhatsApp")').first().click();
  await page.waitForTimeout(2000);
  
  const chats = await frame.locator('[data-chat], .chat, [class*="chat"]').count();
  console.log(`   ${chats > 0 ? '✅' : '❌'} Chat items: ${chats}`);
  functionalChecks.push({ name: 'WhatsApp chats', pass: chats > 0 });
  
  // 4. Torre KPIs
  console.log('\n📋 Torre KPIs');
  await frame.locator('a:has-text("Torre")').first().click();
  await page.waitForTimeout(2000);
  
  const kpis = await frame.locator('[data-kpi], [class*="kpi"], [class*="metric"], [class*="stat"]').count();
  console.log(`   ${kpis > 0 ? '✅' : '❌'} KPI elements: ${kpis}`);
  functionalChecks.push({ name: 'Torre KPIs', pass: kpis > 0 });
  
  // 5. Monitor data
  console.log('\n📋 Monitor data');
  await frame.locator('a:has-text("Monitor")').first().click();
  await page.waitForTimeout(2000);
  
  const services = await frame.locator('table tbody tr, [data-service], .service').count();
  console.log(`   ${services > 0 ? '✅' : '❌'} Service items: ${services}`);
  functionalChecks.push({ name: 'Monitor data', pass: services > 0 });
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(70));
  
  const markerFailed = results.filter(r => r.found && !r.markerUnchanged).length;
  const navCountFailed = results.filter(r => r.found && !r.navCountUnchanged).length;
  const functionalFailed = functionalChecks.filter(c => !c.pass).length;
  
  console.log(`\n✅ Marker unchanged: ${markerFailed === 0 ? 'PASS' : `FAIL (${markerFailed} changed)`}`);
  console.log(`✅ Nav count unchanged: ${navCountFailed === 0 ? 'PASS' : `FAIL (${navCountFailed} increased)`}`);
  console.log(`✅ Functional checks: ${functionalFailed === 0 ? 'PASS' : `FAIL (${functionalFailed} failed)`}`);
  
  if (markerFailed > 0 || navCountFailed > 0 || functionalFailed > 0) {
    console.log('\n❌ TESTS FAILED - DO NOT MERGE');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - SAFE TO MERGE');
  }
}

main().catch(console.error);
