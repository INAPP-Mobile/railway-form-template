import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://form-api-staging.up.railway.app';
const ADMIN_PW = 'admin123';

test.describe('Submissions Filter by form_slug', () => {
  test.beforeEach(async ({ page }) => {
    // Login via the page (handles cookies/session properly in browser context)
    await page.goto(`${BASE}/admin/login`);
    await page.fill('input[name="password"]', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
  });

  test('GET /admin/submissions (no filter) returns 200', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?form_slug=contact returns 200 (not 500)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?form_slug=contact`);
    // BUG: This currently returns 500. This test will fail until the bug is fixed.
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?form_slug=contact&search=test returns 200 (combined)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?form_slug=contact&search=test`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?search=test returns 200 (search only)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?search=test`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?form_slug= returns 200 (empty slug param)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?form_slug=`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?form_slug=nonexistent returns 200 (non-existent slug)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?form_slug=nonexistent`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?page=2 returns 200 (pagination)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?page=2`);
    expect(resp.status()).toBe(200);
  });

  test('GET /admin/submissions?form_slug=contact&page=2 returns 200 (filter + pagination)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/admin/submissions?form_slug=contact&page=2`);
    expect(resp.status()).toBe(200);
  });
});
