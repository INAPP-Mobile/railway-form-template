import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://form-api-staging.up.railway.app';

test('debug cap-widget behavior', async ({ page }) => {
  // Listen for all requests
  const requests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('form')) {
      requests.push(`REQ: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', resp => {
    if (resp.url().includes('form') || resp.status() >= 400) {
      requests.push(`RESP: ${resp.status()} ${resp.url()}`);
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      requests.push(`CONSOLE ERR: ${msg.text()}`);
    }
  });
  
  await page.goto(BASE + '/form/contact');
  await page.waitForTimeout(1000);
  
  // Check cap-widget
  const capWidgetCount = await page.locator('cap-widget').count();
  console.log(`cap-widget count: ${capWidgetCount}`);
  
  // Check hidden inputs
  const hiddenBefore = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[type="hidden"]'))
      .map(i => ({ name: i.getAttribute('name'), value: i.value }));
  });
  console.log(`Hidden inputs before: ${JSON.stringify(hiddenBefore)}`);
  
  // Check form event listeners and submit behavior
  const formInfo = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { hasSubmitListener: false };
    // Check for htmx
    const hasHtmx = typeof (window as any).htmx !== 'undefined';
    return {
      hasHtmx,
      hxPost: form.getAttribute('hx-post'),
      hxTarget: form.getAttribute('hx-target'),
      action: form.getAttribute('action'),
      method: form.getAttribute('method'),
      capWidgetHTML: document.querySelector('cap-widget')?.innerHTML || '',
    };
  });
  console.log(`Form info: ${JSON.stringify(formInfo)}`);
  
  // Check if cap-widget has shadow DOM
  const shadowInfo = await page.evaluate(() => {
    const cw = document.querySelector('cap-widget');
    if (!cw) return { exists: false };
    const sr = cw.shadowRoot;
    if (!sr) return { hasShadowRoot: false };
    return {
      hasShadowRoot: true,
      innerHTML: sr.innerHTML.substring(0, 500),
      buttons: Array.from(sr.querySelectorAll('button')).map(b => b.textContent?.trim()),
    };
  });
  console.log(`Cap widget shadow info: ${JSON.stringify(shadowInfo)}`);

  // Check what happens if we just fill fields and try submitting
  // First check if the cap-widget has a submit blocker
  const wasBlocked = await page.evaluate(() => {
    return new Promise((resolve) => {
      const form = document.querySelector('form');
      if (!form) { resolve('no form'); return; }
      
      // Intercept form submit
      let submitFired = false;
      form.addEventListener('submit', (e) => {
        submitFired = true;
        // Don't prevent, just observe
      }, { once: true });
      
      // Simulate click
      const btn = form.querySelector('button[type="submit"]');
      if (btn instanceof HTMLElement) btn.click();
      
      setTimeout(() => {
        resolve({
          submitEventFired: submitFired,
          // Check if htmx would handle it
          hasHtmx: typeof (window as any).htmx !== 'undefined',
        });
      }, 500);
    });
  });
  console.log(`Submit test: ${JSON.stringify(wasBlocked)}`);
  
  // Wait and check for network calls
  await page.waitForTimeout(1000);
  
  // Now actually fill and submit
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('textarea[name="message"]', 'Hello from Playwright');
  await page.fill('input[name="_hp_website"]', ''); // ensure empty
  
  // Submit
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);
  
  // Check what happened
  console.log(`\n--- Network requests ---`);
  requests.forEach(r => console.log(r));
  
  // Check form-response state
  const formRespHTML = await page.evaluate(() => {
    const el = document.getElementById('form-response');
    return el ? el.innerHTML : 'NOT FOUND';
  });
  console.log(`form-response innerHTML: "${formRespHTML}"`);
  
  const formRespText = await page.locator('#form-response').textContent();
  console.log(`form-response text: "${formRespText}"`);
  
  // Current URL
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  // Check for CAPTCHA error message
  const pageText = await page.locator('body').textContent();
  const hasCapError = pageText.includes('CAPTCHA') || pageText.includes('captcha');
  console.log(`Page has CAPTCHA mention: ${hasCapError}`);
});
