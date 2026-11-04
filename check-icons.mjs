import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3456/stitch/redesign/torre.html');
await page.waitForTimeout(1500);

// Check if Material Icons font is loaded
const fontLoaded = await page.evaluate(() => {
  return document.fonts.check('16px "Material Symbols Outlined"');
});

console.log('Material Icons font loaded:', fontLoaded);

// Check icon elements
const iconSpans = await page.locator('.material-symbols-outlined').all();
console.log(`\nFound ${iconSpans.length} material-symbols-outlined spans`);

// Sample first 5 icons
for (let i = 0; i < Math.min(5, iconSpans.length); i++) {
  const text = await iconSpans[i].textContent();
  const computed = await iconSpans[i].evaluate(el => {
    const style = window.getComputedStyle(el);
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      display: style.display
    };
  });
  console.log(`  Icon ${i + 1}: text="${text}", font="${computed.fontFamily}"`);
}

await browser.close();
