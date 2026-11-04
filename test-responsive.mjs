import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.TEST_URL || 'https://transitone-transitone-borrador.wd75db.easypanel.host';
const USERNAME = 'demo';
const PASSWORD = 'demo123';

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const routes = [
  { path: '/', name: 'torre' },
  { path: '/agentes/viajes', name: 'viajes' },
  { path: '/finanzas', name: 'finanzas' },
  { path: '/marketing', name: 'marketing' },
  { path: '/contactos', name: 'whatsapp' },
  { path: '/monitor', name: 'monitor' },
];

const screenshotsDir = join(__dirname, 'screenshots-responsive');
mkdirSync(screenshotsDir, { recursive: true });

async function run() {
  console.log('🚀 Iniciando test responsive...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log('🔐 Haciendo login...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
  console.log('✅ Login exitoso\n');

  const issues = [];

  // Test cada viewport
  for (const viewport of viewports) {
    console.log(`📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      console.log(`  → ${route.name}`);
      
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);

        // Screenshot
        const screenshotPath = join(screenshotsDir, `${viewport.name}-${route.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Verificar hamburger menu en mobile
        if (viewport.name === 'mobile') {
          const hamburger = await page.locator('button:has-text("Menu"), button[aria-label*="menu" i]').count();
          if (hamburger === 0) {
            issues.push(`❌ ${route.name}: No se encontró botón hamburger en mobile`);
          }
        }

        // Verificar overflow horizontal
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        if (hasHorizontalScroll && viewport.name !== 'desktop') {
          issues.push(`⚠️  ${route.name} (${viewport.name}): Overflow horizontal detectado`);
        }

      } catch (err) {
        issues.push(`❌ ${route.name} (${viewport.name}): Error - ${err.message}`);
      }
    }
    
    console.log('');
  }

  await browser.close();

  console.log('\n📊 RESULTADOS:\n');
  if (issues.length === 0) {
    console.log('✅ Todos los tests pasaron sin problemas detectados');
  } else {
    console.log('⚠️  Issues encontrados:\n');
    issues.forEach(issue => console.log(issue));
  }

  console.log(`\n📸 Screenshots guardados en: ${screenshotsDir}\n`);

  return issues.length === 0 ? 0 : 1;
}

run()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
