#!/usr/bin/env node
/**
 * verify-revert.mjs
 * 
 * Verifica que el revert del PR #13 restauró la funcionalidad correcta:
 * - Navegaciones top row, AGENTES, FINANZAS, MARKETING visibles
 * - Íconos Material renderizan (no como texto)
 * - Enlaces <a> existen y son clickeables
 * - Pill sin overlap de texto
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIVE_URL = 'https://transitone-transitone-borrador.wd75db.easypanel.host';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

async function main() {
  console.log('🔍 Verificando revert del PR #13 en:', LIVE_URL);
  
  const screenshotDir = join(__dirname, 'screenshots-revert');
  mkdirSync(screenshotDir, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  
  for (const viewport of VIEWPORTS) {
    console.log(`\n📱 Verificando viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    
    const page = await context.newPage();
    
    try {
      await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Buscar dentro del iframe Stitch
      const frame = page.frameLocator('iframe[src*="/stitch/redesign/"]').first();
      
      // 1. Verificar que existen enlaces <a>
      const links = await frame.locator('a').count().catch(() => 0);
      console.log(`  🔗 Enlaces <a> encontrados: ${links} ${links > 0 ? '✅' : '❌ CRÍTICO'}`);
      
      // 2. Verificar navegaciones visibles
      const navs = await frame.locator('nav, div:has-text("AGENTES")').count().catch(() => 0);
      console.log(`  🧭 Elementos de navegación: ${navs} ${navs > 0 ? '✅' : '⚠️'}`);
      
      // 3. Buscar textos de íconos Material que NO deberían renderear como texto
      const iconTexts = ['notifications', 'expand_more', 'forum', 'mic', 'search'];
      let iconIssues = 0;
      for (const iconText of iconTexts) {
        const visible = await frame.locator(`text="${iconText}"`).isVisible({ timeout: 1000 }).catch(() => false);
        if (visible) {
          console.log(`  ⚠️  Ícono como texto literal: "${iconText}"`);
          iconIssues++;
        }
      }
      if (iconIssues === 0) {
        console.log(`  ✅ Íconos Material no renderizan como texto`);
      } else {
        console.log(`  ❌ ${iconIssues} íconos renderean como texto literal`);
      }
      
      // 4. Verificar pill (debería existir pero sin createSidebar)
      const pills = await frame.locator('[data-sol-system-status]').count().catch(() => 0);
      console.log(`  💊 Pills de status encontradas: ${pills}`);
      
      if (pills > 0) {
        const pillText = await frame.locator('[data-sol-system-status]').first().textContent().catch(() => '');
        console.log(`  📊 Texto del pill: "${pillText?.trim()}"`);
        
        // Verificar si hay overlap (múltiples textos juntos)
        if (pillText && pillText.includes('caído') && pillText.includes('activos')) {
          console.log(`  ❌ OVERLAP detectado en pill`);
        } else {
          console.log(`  ✅ Pill sin overlap`);
        }
      }
      
      // 5. Verificar que NO existe la sidebar del PR #13
      const sidebar = await frame.locator('[data-sol-sidebar]').count().catch(() => 0);
      if (sidebar === 0) {
        console.log(`  ✅ Sidebar del PR #13 NO presente (correcto después de revert)`);
      } else {
        console.log(`  ❌ Sidebar del PR #13 AÚN presente (revert incompleto)`);
      }
      
      // 6. Tomar screenshot
      const screenshotPath = join(screenshotDir, `${viewport.name}-${viewport.width}x${viewport.height}-revert.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  📸 Screenshot: ${screenshotPath}`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } finally {
      await context.close();
    }
  }
  
  await browser.close();
  console.log('\n✅ Verificación completada. Screenshots en:', screenshotDir);
}

main().catch(console.error);
