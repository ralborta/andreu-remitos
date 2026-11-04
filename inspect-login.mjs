import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3456/login');
await page.waitForTimeout(2000);

console.log('URL:', page.url());
console.log('\nInputs encontrados:');
const inputs = await page.locator('input').all();
for (const input of inputs) {
  const type = await input.getAttribute('type');
  const name = await input.getAttribute('name');
  const id = await input.getAttribute('id');
  const placeholder = await input.getAttribute('placeholder');
  console.log(`  - type="${type}" name="${name}" id="${id}" placeholder="${placeholder}"`);
}

console.log('\nButtons:');
const buttons = await page.locator('button').all();
for (const btn of buttons) {
  const text = await btn.textContent();
  const type = await btn.getAttribute('type');
  console.log(`  - type="${type}" text="${text?.trim()}"`);
}

await browser.close();
