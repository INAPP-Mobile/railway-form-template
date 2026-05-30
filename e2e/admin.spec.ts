import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://form-api-staging.up.railway.app';

// Admin password from env or known value
const ADMIN_PW = 'admin123';

async function login(page: any) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[name="password"]', ADMIN_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin');
}

test.describe('Admin Login', () => {
  test('login page renders', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`);
    await expect(page.locator('h2')).toContainText('Admin Login');
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid password')).toBeVisible();
  });

  test('correct password logs in', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill('input[name="password"]', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms`);
    await page.waitForURL('**/admin/login');
  });
});

test.describe('Form Builder UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('forms page shows list', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms`);
    await expect(page.locator('h1')).toContainText('Forms');
  });

  test('new form page shows form builder', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    await expect(page.locator('#field-builder')).toBeVisible();
    await expect(page.locator('.add-field-btn')).toBeVisible();
  });

  test('add field creates a card', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    const initial = await page.locator('.field-card').count();
    await page.locator('.add-field-btn').click();
    await expect(page.locator('.field-card')).toHaveCount(initial + 1);
  });

  test('add field then delete removes card', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    await page.locator('.add-field-btn').click();
    await expect(page.locator('.field-card')).toHaveCount(1);
    await page.locator('.btn-del').click();
    await expect(page.locator('.field-card')).toHaveCount(0);
  });

  test('reorder buttons move fields', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    // Add 2 fields
    await page.locator('.add-field-btn').click();
    await page.locator('.add-field-btn').click();
    // First field should have ▼ (move down) but not ▲ (already at top)
    const firstCard = page.locator('.field-card').first();
    await expect(firstCard.locator('text=▲')).toHaveCount(0);
    await expect(firstCard.locator('text=▼')).toHaveCount(1);
    // Second field should have ▲ (move up) 
    const lastCard = page.locator('.field-card').last();
    await expect(lastCard.locator('text=▲')).toHaveCount(1);
  });

  test('field type dropdown shows all types', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    await page.locator('.add-field-btn').click();
    const select = page.locator('.field-card select').first();
    const options = await select.locator('option').allTextContents();
    const expected = ['text', 'email', 'textarea', 'select', 'checkbox', 'tel', 'number', 'url'];
    for (const t of expected) {
      expect(options).toContain(t);
    }
  });

  test('select type shows options input', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    await page.locator('.add-field-btn').click();
    await page.locator('.field-card select').first().selectOption('select');
    await expect(page.locator('.field-options-input')).toBeVisible();
  });

  test('create form with fields and verify success', async ({ page }) => {
    const slug = 'test-form-' + Date.now();
    await page.goto(`${BASE}/admin/forms/new`);
    await page.fill('input[name="slug"]', slug);
    await page.fill('input[name="title"]', 'Test Form');
    await page.locator('.add-field-btn').click();
    await page.locator('.field-card input[type="text"]').first().fill('Full Name');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(`.form-item:has-text("${slug}") h3`)).toBeVisible();
  });

  test('duplicate slug shows error', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms/new`);
    await page.fill('input[name="slug"]', 'contact');
    await page.fill('input[name="title"]', 'Duplicate');
    await page.locator('.add-field-btn').click();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=already exists')).toBeVisible();
  });

  test('edit existing form shows slug as readonly', async ({ page }) => {
    await page.goto(`${BASE}/admin/forms`);
    await page.locator('a:has-text("Edit")').first().click();
    const slugInput = page.locator('input[name="slug"]');
    await expect(slugInput).toHaveAttribute('readonly', '');
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard shows submission count', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.locator('h1')).toContainText('Submissions');
  });

  test('forms link navigates to forms', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.click('a:has-text("Forms")');
    await page.waitForURL('**/admin/forms');
    await expect(page.locator('h1')).toContainText('Forms');
  });

  test('logout ends session', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.click('text=Logout');
    await page.waitForURL('**/admin/login');
  });
});

test.describe('Form Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('delete a form removes it from the forms list', async ({ page }) => {
    const slug = 'delete-test-' + Date.now();
    const title = 'Delete Test Form';

    await page.goto(`${BASE}/admin/forms/new`);
    await page.fill('input[name="slug"]', slug);
    await page.fill('input[name="title"]', title);
    await page.locator('.add-field-btn').click();
    await page.locator('.field-card input[type="text"]').first().fill('Full Name');
    await page.locator('button[type="submit"]').click();

    // Wait for form creation to complete — match by unique slug
    await expect(page.locator(`.form-item:has-text("${slug}") h3`)).toBeVisible();

    await page.goto(`${BASE}/admin/forms`);

    const formItem = page.locator(`.form-item:has-text("${slug}")`);
    await expect(formItem).toBeVisible();

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Delete this form');
      dialog.accept();
    });

    await formItem.locator('.btn-danger').click();

    await expect(formItem).toHaveCount(0);
  });
});
