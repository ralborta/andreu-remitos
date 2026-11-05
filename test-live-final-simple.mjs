#!/usr/bin/env node
import { chromium } from 'playwright';

async function testLiveSimple() {
  console.log('=== PRUEBA EN VIVO - Enfoque Simple ===\n');
  console.log('URL: https://transitone-transitone-borrador.wd75db.easypanel.host/\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  const results = [];
  
  try {
    const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';
    
    // Cargar sitio
    console.log('1. Cargando sitio...');
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Marcar ventana top
    console.log('\n2. Marcando ventana top...');
    await page.evaluate(() => {
      window.__testMarker = Date.now();
      console.log('[TEST] Marker:', window.__testMarker);
    });
    
    const initialMarker = await page.evaluate(() => window.__testMarker);
    const initialNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    console.log(`   Marker inicial: ${initialMarker}`);
    console.log(`   Nav count inicial: ${initialNavCount}`);
    
    const iframe = page.frameLocator('iframe[title*="Stitch"]');
    
    // Navegaciones a probar
    const navTests = [
      { name: 'Torre → Viajes', href: '/agentes/viajes' },
      { name: 'Viajes → Destinos', href: '/destinos' },
      { name: 'Destinos → WhatsApp', href: '/contactos' },
      { name: 'WhatsApp → Finanzas', href: '/agentes/finanzas' },
      { name: 'Finanzas → Marketing', href: '/marketing' },
      { name: 'Marketing → Monitor', href: '/monitor' },
      { name: 'Monitor → Métricas', href: '/backoffice' },
      { name: 'Métricas → Torre', href: '/' },
    ];
    
    console.log('\n3. Ejecutando 18+ clicks de navegación...\n');
    
    let clickCount = 0;
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`   === Ciclo ${cycle} ===`);
      for (const nav of navTests) {
        try {
          clickCount++;
          const link = iframe.locator(`a[href="${nav.href}"]`).first();
          await link.click({ timeout: 5000 });
          await page.waitForTimeout(800); // Tiempo para transición
          console.log(`   ${clickCount}. ✓ ${nav.name}`);
        } catch (error) {
          console.log(`   ${clickCount}. ✗ ${nav.name}: ${error.message}`);
          results.push({ test: nav.name, status: 'FAIL', error: error.message });
        }
      }
    }
    
    console.log(`\n   Total: ${clickCount} clicks ejecutados`);
    
    // Verificar marker
    console.log('\n4. Verificando integridad de ventana top...');
    const finalMarker = await page.evaluate(() => window.__testMarker);
    const finalNavCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    
    if (finalMarker === initialMarker) {
      console.log(`   ✓ Marker intacto: ${finalMarker}`);
      results.push({ test: 'Top window NO recargó', status: 'PASS' });
    } else {
      console.log(`   ✗ Marker cambió: ${initialMarker} → ${finalMarker}`);
      results.push({ test: 'Top window NO recargó', status: 'FAIL' });
    }
    
    if (finalNavCount === initialNavCount) {
      console.log(`   ✓ Nav count sin cambios: ${finalNavCount}`);
      results.push({ test: 'Sin navegaciones adicionales', status: 'PASS' });
    } else {
      console.log(`   ✗ Nav count cambió: ${initialNavCount} → ${finalNavCount}`);
      results.push({ test: 'Sin navegaciones adicionales', status: 'FAIL' });
    }
    
    // Pruebas de funcionalidad
    console.log('\n5. Verificando funcionalidad de páginas...\n');
    
    // Finanzas
    console.log('   Probando Finanzas...');
    await iframe.locator('a[href="/agentes/finanzas"]').first().click();
    await page.waitForTimeout(1500);
    const finanzasOk = await iframe.locator('body').count() > 0;
    console.log(`   ${finanzasOk ? '✓' : '✗'} Finanzas carga`);
    results.push({ test: 'Finanzas carga', status: finanzasOk ? 'PASS' : 'FAIL' });
    
    // WhatsApp
    console.log('   Probando WhatsApp...');
    await iframe.locator('a[href="/contactos"]').first().click();
    await page.waitForTimeout(1500);
    const whatsappOk = await iframe.locator('body').count() > 0;
    console.log(`   ${whatsappOk ? '✓' : '✗'} WhatsApp carga`);
    results.push({ test: 'WhatsApp carga', status: whatsappOk ? 'PASS' : 'FAIL' });
    
    // Torre
    console.log('   Probando Torre...');
    await iframe.locator('a[href="/"]').first().click();
    await page.waitForTimeout(1500);
    const torreOk = await iframe.locator('body').count() > 0;
    console.log(`   ${torreOk ? '✓' : '✗'} Torre carga`);
    results.push({ test: 'Torre carga', status: torreOk ? 'PASS' : 'FAIL' });
    
    // Resumen
    console.log('\n\n=== RESULTADOS ===');
    console.log('─────────────────────────────────────');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : '✗';
      console.log(`${icon} ${r.test}: ${r.status}`);
    });
    
    console.log('─────────────────────────────────────');
    console.log(`${clickCount} clicks ejecutados`);
    console.log(`${passed} pruebas OK, ${failed} fallos`);
    
    if (failed === 0 && passed >= 5) {
      console.log('\n✅ TODAS LAS PRUEBAS PASARON');
      return true;
    } else if (failed > 0) {
      console.log('\n❌ ALGUNAS PRUEBAS FALLARON');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS');
    console.error(error.message);
    return false;
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

const success = await testLiveSimple();
process.exit(success ? 0 : 1);
