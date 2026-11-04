#!/usr/bin/env node
/**
 * test-responsive-live.mjs
 * 
 * Playwright test contra el deploy LIVE de sol-borrador
 * Verifica sidebar collapsible y pill de status dinámico en 3 viewports
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';
const LOGIN_USER = 'demo';
const LOGIN_PASS = 'demo123';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

async function main() {
  console.log('🚀 Iniciando tests en deploy LIVE:', LIVE_URL);
  
  // Crear directorio para screenshots
  const screenshotDir = join(__dirname, 'screenshots-live');
  mkdirSync(screenshotDir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  
  for (const viewport of VIEWPORTS) {
    console.log(`\n📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      userAgent: 'Mozilla/5.0 (compatible; PlaywrightTest/1.0)'
    });
    
    const page = await context.newPage();
    
    try {
      // 1. Navegar a la URL live
      console.log('  ⏳ Navegando a', LIVE_URL);
      await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // 2. Login
      console.log('  🔐 Intentando login con', LOGIN_USER);
      const loginInput = await page.locator('input[name="username"], input[type="text"]').first();
      const passInput = await page.locator('input[name="password"], input[type="password"]').first();
      
      if (await loginInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginInput.fill(LOGIN_USER);
        await passInput.fill(LOGIN_PASS);
        
        const submitBtn = await page.locator('button[type="submit"], button:has-text("Ingresar")').first();
        await submitBtn.click();
        
        // Esperar navegación post-login
        await page.waitForURL(/\/(torre|monitor|contactos|agentes|finanzas|marketing)?/, { timeout: 10000 });
        console.log('  ✅ Login exitoso');
      } else {
        console.log('  ℹ️  Ya autenticado o sin página de login');
      }
      
      // Esperar a que se cargue el contenido y scripts
      await page.waitForTimeout(3000);
      
      // El contenido está dentro de un iframe - buscar el iframe
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      
      // Esperar a que bridge.js se ejecute dentro del iframe (crea la sidebar dinámicamente)
      await frame.locator('[data-sol-sidebar], [data-sol-shell="chrome"]').first().waitFor({ timeout: 10000 }).catch(() => {
        console.log('  ⚠️  Sidebar no creada dinámicamente en iframe');
      });
      
      // 3. Verificar sidebar dentro del iframe
      const sidebar = frame.locator('[data-sol-sidebar]').first();
      const sidebarVisible = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (viewport.name === 'desktop') {
        console.log('  🔍 Sidebar visible en desktop:', sidebarVisible ? '✅' : '❌');
      } else {
        console.log('  🔍 Sidebar hidden en mobile/tablet (normal):', !sidebarVisible ? '✅' : '❌');
        
        // En mobile, abrir hamburger menu dentro del iframe
        const hamburger = frame.locator('[data-sol-hamburger]').first();
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('  🍔 Abriendo hamburger menu...');
          await hamburger.click();
          await page.waitForTimeout(500);
        }
      }
      
      // 4. Verificar pill de status dentro del iframe
      const statusPill = frame.locator('[data-sol-system-status]').first();
      const pillVisible = await statusPill.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('  🔍 Status pill visible:', pillVisible ? '✅' : '❌');
      
      if (pillVisible) {
        const pillText = await statusPill.textContent();
        console.log('  📊 Texto del pill:', pillText?.trim());
        
        // Verificar color del pill (verde/amarillo/rojo)
        const pillClasses = await statusPill.getAttribute('class');
        let pillColor = 'unknown';
        if (pillClasses?.includes('bg-emerald')) pillColor = 'verde (OK)';
        else if (pillClasses?.includes('bg-amber')) pillColor = 'amarillo (degradado)';
        else if (pillClasses?.includes('bg-rose')) pillColor = 'rojo (caído)';
        console.log('  🎨 Color del pill:', pillColor);
      }
      
      // 5. Tomar screenshots
      const screenshotPath = join(screenshotDir, `${viewport.name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('  📸 Screenshot guardado:', screenshotPath);
      
      // Screenshot adicional con sidebar abierta en mobile
      if (viewport.name !== 'desktop') {
        const sidebarOpenPath = join(screenshotDir, `${viewport.name}-${viewport.width}x${viewport.height}-sidebar-open.png`);
        await page.screenshot({ path: sidebarOpenPath, fullPage: false });
        console.log('  📸 Screenshot sidebar abierta:', sidebarOpenPath);
      }
      
    } catch (error) {
      console.error(`  ❌ Error en viewport ${viewport.name}:`, error.message);
    } finally {
      await context.close();
    }
  }
  
  await browser.close();
  console.log('\n✅ Tests completados. Screenshots en:', screenshotDir);
}

main().catch(console.error);
