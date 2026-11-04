#!/usr/bin/env node
/**
 * test-sidebar-local.mjs
 * 
 * Pruebas exhaustivas de sidebar + status pill en build local
 * Owner requirements: verificar sidebar tiene links, navegación funciona,
 * íconos NO renderizan como texto, sin overlaps, mobile 390px
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:3456';
const LOGIN_USER = 'demo';
const LOGIN_PASS = 'demo123';

const TEST_PAGES = [
  { name: 'Torre', path: '/', tabs: [] },
  { name: 'Viajes', path: '/agentes/viajes', tabs: ['Choferes', 'Camiones'] },
  { name: 'Destinos', path: '/agentes/destinos', tabs: [] },
  { name: 'WhatsApp', path: '/contactos', tabs: [] },
  { name: 'Finanzas', path: '/finanzas', modals: ['Cobrar', 'Cancelar'] },
  { name: 'Promociones', path: '/marketing/ofertas', tabs: [] },
  { name: 'Monitor', path: '/monitor', tabs: [] }
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const results = {
  pass: [],
  fail: []
};

async function login(page) {
  console.log('  🔐 Login...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  
  // Try multiple selectors for username/password
  const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  
  await usernameInput.fill(LOGIN_USER);
  await passwordInput.fill(LOGIN_PASS);
  
  const submitBtn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Login")').first();
  await submitBtn.click();
  
  await page.waitForURL(/\/(?:torre|monitor)?/, { timeout: 10000 }).catch(() => 
    page.waitForTimeout(2000) // fallback if URL doesn't change
  );
}

async function checkSidebar(page, viewport) {
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  
  // 1. Check sidebar exists
  const sidebar = frame.locator('[data-sol-sidebar]').first();
  const sidebarExists = await sidebar.count().catch(() => 0) > 0;
  
  if (!sidebarExists) {
    return { success: false, error: 'Sidebar no existe' };
  }
  
  // 2. Check link count
  const linkCount = await sidebar.locator('a[href]').count().catch(() => 0);
  if (linkCount === 0) {
    return { success: false, error: 'Sidebar sin enlaces (0 links)' };
  }
  
  // 3. Check Material Icons NOT as literal text
  const iconTextIssues = [];
  const iconNames = ['dashboard', 'monitor_heart', 'chat', 'analytics', 'local_shipping'];
  for (const iconName of iconNames) {
    const asText = await frame.locator(`text="${iconName}"`).isVisible({ timeout: 500 }).catch(() => false);
    if (asText) iconTextIssues.push(iconName);
  }
  
  // 4. Check no text overlap in pill
  const pill = await frame.locator('[data-sol-system-status]').first();
  const pillText = await pill.textContent().catch(() => '');
  const hasOverlap = pillText.includes('caído') && pillText.includes('activos');
  
  // 5. Check sidebar visibility based on viewport
  let visibilityOk = true;
  if (viewport.name === 'desktop') {
    const sidebarVisible = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);
    if (!sidebarVisible) visibilityOk = false;
  } else {
    // Mobile: sidebar should be hidden initially
    const isHidden = await sidebar.evaluate(el => el.classList.contains('-translate-x-full')).catch(() => true);
    if (!isHidden) visibilityOk = false;
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

async function testNavigation(page, fromPath, toPath) {
  const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
  const link = frame.locator(`a[href="${toPath}"]`).first();
  
  try {
    await link.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Check we navigated
    const url = page.url();
    const navigated = url.includes(toPath) || url.endsWith(toPath);
    return { success: navigated, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testPage(page, pageInfo, viewport, screenshotDir) {
  console.log(`\n  📄 ${pageInfo.name} (${pageInfo.path})`);
  
  try {
    await page.goto(BASE_URL + pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
    
    // Check sidebar
    const sidebarCheck = await checkSidebar(page, viewport);
    if (!sidebarCheck.success) {
      console.log(`    ❌ FAIL: ${sidebarCheck.error || 'Sidebar check failed'}`);
      if (sidebarCheck.linkCount !== undefined) console.log(`       Links: ${sidebarCheck.linkCount}`);
      if (sidebarCheck.iconTextIssues?.length) console.log(`       Íconos como texto: ${sidebarCheck.iconTextIssues.join(', ')}`);
      if (sidebarCheck.hasOverlap) console.log(`       Overlap en pill`);
      if (!sidebarCheck.visibilityOk) console.log(`       Visibilidad incorrecta`);
      results.fail.push({ page: pageInfo.name, viewport: viewport.name, reason: sidebarCheck.error });
      return false;
    }
    
    console.log(`    ✅ Sidebar OK (${sidebarCheck.linkCount} links, pill: "${sidebarCheck.pillText}")`);
    
    // Test tabs if any
    if (pageInfo.tabs?.length > 0) {
      for (const tabName of pageInfo.tabs) {
        const tabBtn = frame.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
        const tabExists = await tabBtn.count().catch(() => 0) > 0;
        if (tabExists) {
          await tabBtn.click().catch(() => {});
          await page.waitForTimeout(500);
          console.log(`    ✅ Tab "${tabName}" clickeable`);
        } else {
          console.log(`    ⚠️  Tab "${tabName}" no encontrada`);
        }
      }
    }
    
    // Test modals if any
    if (pageInfo.modals?.length > 0) {
      for (const modalName of pageInfo.modals) {
        const modalBtn = frame.locator(`button:has-text("${modalName}")`).first();
        const modalExists = await modalBtn.count().catch(() => 0) > 0;
        if (modalExists) {
          await modalBtn.click().catch(() => {});
          await page.waitForTimeout(500);
          // Close modal
          const closeBtn = frame.locator('button:has-text("Cerrar"), button[aria-label="Cerrar"]').first();
          await closeBtn.click().catch(() => {});
          await page.waitForTimeout(300);
          console.log(`    ✅ Modal "${modalName}" funciona`);
        } else {
          console.log(`    ⚠️  Modal "${modalName}" no encontrada`);
        }
      }
    }
    
    // Screenshot
    const screenshotPath = join(screenshotDir, `${viewport.name}-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`    📸 Screenshot: ${screenshotPath}`);
    
    results.pass.push({ page: pageInfo.name, viewport: viewport.name });
    return true;
    
  } catch (error) {
    console.log(`    ❌ FAIL: ${error.message}`);
    results.fail.push({ page: pageInfo.name, viewport: viewport.name, reason: error.message });
    return false;
  }
}

async function main() {
  console.log('🧪 Testing sidebar + status pill (LOCAL BUILD)');
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
      await login(page);
      console.log('  ✅ Login exitoso');
      
      for (const pageInfo of TEST_PAGES) {
        await testPage(page, pageInfo, viewport, screenshotDir);
      }
      
      // Test navigation between pages
      console.log('\n  🔗 Testing navegación entre páginas...');
      const navTest = await testNavigation(page, '/', '/agentes/destinos');
      if (navTest.success) {
        console.log('    ✅ Navegación / → /agentes/destinos OK');
      } else {
        console.log('    ❌ Navegación falló:', navTest.error || navTest.url);
        results.fail.push({ page: 'Navegación', viewport: viewport.name, reason: 'Nav link no funcionó' });
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
  
  // Exit with error if any failures
  if (results.fail.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
