import { test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://form-api-staging.up.railway.app';

test('debug why 400', async ({ page }) => {
  // Intercept the POST response to see its body
  page.on('response', async (resp) => {
    if (resp.url().includes('/form/contact') && resp.request().method() === 'POST') {
      const body = await resp.text();
      console.log(`POST /form/contact response: ${resp.status()}`);
      console.log(`Body: "${body.substring(0, 500)}"`);
    }
  });
  
  await page.goto(BASE + '/form/contact');
  await page.waitForTimeout(500);
  
  // Check what hidden fields exist
  const allInputs = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return [];
    const inputs = form.querySelectorAll('input');
    return Array.from(inputs).map(i => ({
      name: i.getAttribute('name'),
      type: i.getAttribute('type'),
      value: i.value,
      visible: i.offsetParent !== null,
    }));
  });
  console.log('All form inputs:', JSON.stringify(allInputs, null, 2));
  
  // Fill the form
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('textarea[name="message"]', 'Hello');
  
  // Submit using JS to see exact form data
  const formDataSent = await page.evaluate(() => {
    return new Promise((resolve) => {
      const form = document.querySelector('form');
      if (!form) { resolve('no form'); return; }
      
      // Use fetch to capture the exact form data being sent
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((val, key) => {
        data[key] = val as string;
      });
      resolve(JSON.stringify(data, null, 2));
    });
  });
  console.log('Form data that would be sent:', formDataSent);
  
  // Now click submit
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
});
