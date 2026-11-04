#!/usr/bin/env node
/**
 * test-sidebar-direct.mjs
 * 
 * Direct tests of Stitch HTML pages (bypassing Next.js auth)
 * Tests sidebar, status pill, navigation, icons, mobile responsive
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:3456/stitch/redesign';

const TEST_PAGES = [
  { name: 'Torre', file: 'torre.html' },
  { name: 'Viajes', file: 'viajes.html' },
  { name: 'Destinos', file: 'destinos.html' },
  { name: 'WhatsApp', file: 'whatsapp.html' },
  { name: 'Finanzas', file: 'finanzas.html' },
  { name: 'Promociones', file: 'marketing-ofertas.html' },
  { name: 'Monitor', file: 'monitor.html' }
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const results = { pass: [], fail: [] };

async function checkSidebar(page, viewport) {
  // Wait for bridge.js to execute
  await page.waitForTimeout(1500);
  
  // 1. Check sidebar exists
  const sidebarCount = await page.locator('[data-sol-sidebar]').count().catch(() => 0);
  if (sidebarCount === 0) {
    return { success: false, error: 'Sidebar no existe' };
  }
  
  // 2. Check link count
  const linkCount = await page.locator('[data-sol-sidebar] a[href]').count().catch(() => 0);
  if (linkCount === 0) {
    return { success: false, error: `Sidebar sin enlaces (${linkCount} links)` };
  }
  
  // 3. Check Material Icons NOT as literal text (checking visible text nodes)
  const iconTextIssues = [];
  const iconNames = ['dashboard', 'monitor_heart', 'chat', 'analytics', 'local_shipping'];
  for (const iconName of iconNames) {
    // Check if icon name appears as visible text (not inside material-symbols-outlined span)
    const asText = await page.locator(`body :not(.material-symbols-outlined):has-text("${iconName}")`).count();
    if (asText > 0) {
      const isVisible = await page.locator(`body :not(.material-symbols-outlined):has-text("${iconName}")`).first().isVisible({ timeout: 500 }).catch(() => false);
      if (isVisible) iconTextIssues.push(iconName);
    }
  }
  
  // 4. Check pill text (no overlap)
  const pill = page.locator('[data-sol-system-status]').first();
  const pillText = await pill.textContent().catch(() => '');
  const hasOverlap = (pillText.match(/activos|desconectado|degradado/gi) || []).length > 1;
  
  // 5. Check visibility
  let visibilityOk = true;
  if (viewport.name === 'desktop') {
    const sidebarVisible = await page.locator('[data-sol-sidebar]').isVisible({ timeout: 2000 }).catch(() => false);
    visibilityOk = sidebarVisible;
  } else {
    // Mobile: should be hidden initially
    const sidebar = page.locator('[data-sol-sidebar]').first();
    const hasHiddenClass = await sidebar.evaluate(el => el.classList.contains('-translate-x-full')).catch(() => true);
    visibilityOk = hasHiddenClass;
  }
  
  return {
    success: linkCount > 0 && iconTextIssues.length === 0 && !hasOverlap && visibilityOk,
    linkCount,
    iconTextIssues,
    hasOverlap,
    visibilityOk,
    pillText: pillText.trim()
  };
}

async function testNavigation(page, toPath) {
  try {
    const link = page.locator(`[data-sol-sidebar] a[href="${toPath}"]`).first();
    await link.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    
    // Check URL changed (top window)
    const url = page.url();
    return { success: url.includes(toPath), url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testPage(page, pageInfo, viewport, screenshotDir) {
  console.log(`\n  📄 ${pageInfo.name} (${pageInfo.file})`);
  
  try {
    await page.goto(BASE_URL + '/' + pageInfo.file, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check sidebar
    const sidebarCheck = await checkSidebar(page, viewport);
    if (!sidebarCheck.success) {
      console.log(`    ❌ FAIL: ${sidebarCheck.error || 'Sidebar check failed'}`);
      if (sidebarCheck.linkCount !== undefined) console.log(`       Links: ${sidebarCheck.linkCount}`);
      if (sidebarCheck.iconTextIssues?.length) console.log(`       Íconos como texto: ${sidebarCheck.iconTextIssues.join(', ')}`);
      if (sidebarCheck.hasOverlap) console.log(`       Overlap en pill: "${sidebarCheck.pillText}"`);
      if (!sidebarCheck.visibilityOk) console.log(`       Visibilidad incorrecta`);
      results.fail.push({ page: pageInfo.name, viewport: viewport.name, reason: sidebarCheck.error });
      return false;
    }
    
    console.log(`    ✅ Sidebar OK (${sidebarCheck.linkCount} links, pill: "${sidebarCheck.pillText}")`);
    
    // Screenshot
    const screenshotPath = join(screenshotDir, `${viewport.name}-${pageInfo.name.toLowerCase()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`    📸 ${screenshotPath}`);
    
    results.pass.push({ page: pageInfo.name, viewport: viewport.name });
    return true;
    
  } catch (error) {
    console.log(`    ❌ FAIL: ${error.message}`);
    results.fail.push({ page: pageInfo.name, viewport: viewport.name, reason: error.message });
    return false;
  }
}

async function main() {
  console.log('🧪 Testing sidebar + status pill (DIRECT STITCH ACCESS)');
  console.log('URL:', BASE_URL);
  
  const screenshotDir = join(__dirname, 'artifacts', 'screenshots-local');
  mkdirSync(screenshotDir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  
  for (const viewport of VIEWPORTS) {
    console.log(`\n📱 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    
    const page = await context.newPage();
    
    try {
      for (const pageInfo of TEST_PAGES) {
        await testPage(page, pageInfo, viewport, screenshotDir);
      }
      
      // Test navigation (only on desktop)
      if (viewport.name === 'desktop') {
        console.log('\n  🔗 Testing navegación...');
        const navTest = await testNavigation(page, '/agentes/destinos');
        if (navTest.success) {
          console.log('    ✅ Click sidebar → Destinos OK');
        } else {
          console.log('    ❌ Nav falló:', navTest.error || navTest.url);
          results.fail.push({ page: 'Navegación', viewport: viewport.name, reason: 'Nav link failed' });
        }
      }
      
    } catch (error) {
      console.error(`  ❌ Error en viewport ${viewport.name}:`, error.message);
    } finally {
      await context.close();
    }
  }
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`✅ PASS: ${results.pass.length}`);
  console.log(`❌ FAIL: ${results.fail.length}`);
  
  if (results.fail.length > 0) {
    console.log('\n❌ FALLOS:');
    results.fail.forEach(f => {
      console.log(`  - ${f.page} (${f.viewport}): ${f.reason}`);
    });
  }
  
  console.log('\n📸 Screenshots en:', screenshotDir);
  
  if (results.fail.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
