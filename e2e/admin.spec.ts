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

  test('delete form response is empty HTML (no "ok" text)', async ({ page }) => {
    const slug = 'delete-empty-test-' + Date.now();
    let deleteResponseBody = '';

    // Intercept DELETE /admin/form/{id} and capture response body
    await page.route('**/admin/form/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const response = await route.fetch();
        deleteResponseBody = await response.text();
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE}/admin/forms/new`);
    await page.fill('input[name="slug"]', slug);
    await page.fill('input[name="title"]', 'Delete Empty Test');
    await page.locator('.add-field-btn').click();
    await page.locator('.field-card input[type="text"]').first().fill('Full Name');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(`.form-item:has-text("${slug}") h3`)).toBeVisible();

    await page.goto(`${BASE}/admin/forms`);

    const formItem = page.locator(`.form-item:has-text("${slug}")`);
    await expect(formItem).toBeVisible();

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Delete this form');
      dialog.accept();
    });

    await formItem.locator('.btn-danger').click();

    // Verify the form item is removed from DOM
    await expect(formItem).toHaveCount(0);

    // CRITICAL: Verify the response body is empty HTML (not "ok" text)
    expect(deleteResponseBody).toBe('');
    // Also check no "ok" text remains visible on the page
    await expect(page.locator('body')).not.toContainText('ok', { timeout: 1000 });
  });

  test('delete form does not show "ok" text on screen', async ({ page }) => {
    const slug = 'delete-no-ok-test-' + Date.now();

    await page.goto(`${BASE}/admin/forms/new`);
    await page.fill('input[name="slug"]', slug);
    await page.fill('input[name="title"]', 'No OK Test');
    await page.locator('.add-field-btn').click();
    await page.locator('.field-card input[type="text"]').first().fill('Full Name');
    await page.locator('button[type="submit"]').click();
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

    // After deletion, the word "ok" should not appear as visible text on the page
    // (It could appear as part of other words, so check specifically that no
    //  standalone "ok" text element is visible)
    const pageText = await page.locator('body').innerText();
    // Check that the page body doesn't contain plain "ok" as content
    const standaloneOk = pageText.split(/\s+/).filter(w => w.toLowerCase() === 'ok');
    expect(standaloneOk.length).toBe(0);
  });

  test('delete submission response is empty HTML (no "ok" text)', async ({ page }) => {
    // First create a submission via the contact form
    await page.goto(`${BASE}/form/contact`);
    await page.waitForSelector('form');
    await page.fill('input[name="name"]', 'Delete E2E Test');
    await page.fill('input[name="email"]', 'delete-test@example.com');
    await page.fill('textarea[name="message"]', 'Test message for deletion');
    await page.click('button[type="submit"]');
    // Wait for success message
    await expect(page.locator('#form-response')).toContainText('Thank you', { timeout: 10000 });

    // Now go to admin dashboard and find the submission
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('.table-wrapper');

    let deleteResponseBody = '';
    let deleteCaptured = false;

    // Intercept DELETE /admin/submission/{id}
    await page.route('**/admin/submission/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const response = await route.fetch();
        deleteResponseBody = await response.text();
        deleteCaptured = true;
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    // Find a submission row with a delete button
    const rows = page.locator('.table-wrapper tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    let deleteFound = false;
    for (let i = 0; i < rowCount; i++) {
      const deleteBtn = rows.nth(i).locator('.btn-danger');
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible()) {
        // Handle confirmation dialog
        page.once('dialog', dialog => {
          expect(dialog.message()).toContain('Delete this submission');
          dialog.accept();
        });

        await deleteBtn.click();
        deleteFound = true;
        break;
      }
    }

    if (!deleteFound) {
      test.skip();
      return;
    }

    // Verify the response body was captured and is empty (not "ok")
    expect(deleteCaptured).toBe(true);
    expect(deleteResponseBody).toBe('');
    // Check no standalone "ok" on screen after deletion
    const pageText = await page.locator('body').innerText();
    const standaloneOk = pageText.split(/\s+/).filter(w => w.toLowerCase() === 'ok');
    expect(standaloneOk.length).toBe(0);
  });
});

test.describe('Submission Detail View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('submission detail page loads showing form data, metadata, and back button', async ({ page }) => {
    // Go to dashboard to find a submission
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('.table-wrapper');

    // Check there's at least one submission row (not empty state)
    const rows = page.locator('.table-wrapper tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0 || await rows.locator('.empty-state').count() > 0) {
      // No submissions exist — skip gracefully
      test.skip();
      return;
    }

    // Get the first submission's View link
    const viewLink = rows.first().locator('a:has-text("View")');
    await expect(viewLink).toBeVisible();

    // Get the submission ID from href
    const href = await viewLink.getAttribute('href');
    expect(href).toContain('/admin/submission/');

    // Click View — uses HTMX to load detail
    await viewLink.click();

    // Should navigate to submission detail URL
    await page.waitForURL('**/admin/submission/**');

    // Verify detail page content
    await expect(page.locator('h1:has-text("Submission Detail")')).toBeVisible();

    // Should show form data section
    await expect(page.locator('.detail-card:has-text("Form Data")')).toBeVisible();

    // Should show metadata section
    await expect(page.locator('.detail-card:has-text("Metadata")')).toBeVisible();

    // Should show back button
    await expect(page.locator('a:has-text("Back")')).toBeVisible();
  });

  test('direct URL access to submission detail loads full page layout', async ({ page }) => {
    // First, find a submission ID from the dashboard
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('.table-wrapper');

    const rows = page.locator('.table-wrapper tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0 || await rows.locator('.empty-state').count() > 0) {
      test.skip();
      return;
    }

    const viewLink = rows.first().locator('a:has-text("View")');
    const href = await viewLink.getAttribute('href');
    const subId = href!.split('/').pop();

    // Navigate directly (non-HTMX, full page load)
    await page.goto(`${BASE}/admin/submission/${subId}`);

    // Verify full page layout — sidebar should be present
    await expect(page.locator('.sidebar')).toBeVisible();

    // Detail content should be visible
    await expect(page.locator('h1:has-text("Submission Detail")')).toBeVisible();
    await expect(page.locator('.detail-card')).toHaveCount(2); // Form Data + Metadata cards
  });

  test('non-existent submission id returns 404 error', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/submission/nonexistent-id`, {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(404);
  });

  test('back button returns to admin dashboard', async ({ page }) => {
    // Navigate to a submission detail
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('.table-wrapper');

    const rows = page.locator('.table-wrapper tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0 || await rows.locator('.empty-state').count() > 0) {
      test.skip();
      return;
    }

    const viewLink = rows.first().locator('a:has-text("View")');
    const href = await viewLink.getAttribute('href');

    // Navigate directly
    await page.goto(`${BASE}${href}`);
    await expect(page.locator('h1:has-text("Submission Detail")')).toBeVisible();

    // Click back button
    await page.locator('a:has-text("Back")').click();

    // Should return to dashboard — wait for the hx-target swap
    await expect(page.locator('h1:has-text("Submissions")')).toBeVisible({ timeout: 8000 });
  });

  test('HTMX detail view does NOT duplicate sidebar inside main content (BUG CHECK)', async ({ page }) => {
    // Go to dashboard
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('.table-wrapper');

    const rows = page.locator('.table-wrapper tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0 || await rows.locator('.empty-state').count() > 0) {
      test.skip();
      return;
    }

    // Count sidebars before
    const sidebarsBefore = await page.locator('.sidebar').count();

    // Click View on first submission (HTMX request with hx-target="main.content")
    await rows.first().locator('a:has-text("View")').click();
    await page.waitForURL('**/admin/submission/**');

    // Wait for HTMX swap to complete
    await expect(page.locator('h1:has-text("Submission Detail")')).toBeVisible({ timeout: 8000 });

    // BUG CHECK: The endpoint returns full admin_dashboard.html for HTMX requests,
    // so the sidebar gets duplicated inside main.content
    // Count sidebars after — if > sidebarsBefore, there's a duplicated layout
    const sidebarsAfter = await page.locator('.sidebar').count();

    // A sidebars count of 1 means the full layout swap correctly handled itself.
    // A sidebars count > 1 means the full layout got nested inside main.content
    // This test documents the current behavior — if it fails, the bug is present
    expect(sidebarsAfter).toBeLessThanOrEqual(sidebarsBefore + 0);
    // ^ If sidebarsAfter > sidebarsBefore, the full layout was duplicated inside main.content
  });
});

test.describe('HTMX Search Partial', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /**
   * Helper: make an authenticated fetch() call from inside the browser context
   * so cookies (session) are naturally included.
   */
  async function fetchFromPage(page: any, url: string, extraHeaders: Record<string, string> = {}) {
    return await page.evaluate(async (args: { url: string; headers: Record<string, string> }) => {
      const resp = await fetch(args.url, {
        method: 'GET',
        headers: { ...args.headers },
      });
      return {
        status: resp.status,
        body: await resp.text(),
      };
    }, { url, headers: extraHeaders });
  }

  test('submissions search with HX-Request returns partial without html/nav', async ({ page }) => {
    const { status, body } = await fetchFromPage(page, `${BASE}/admin/submissions?search=test`, {
      'HX-Request': 'true',
    });

    expect(status).toBe(200);

    // Should be a partial — no full-page HTML structure
    // NOTE: This test fails if the is_htmx template-switching feature is not deployed
    expect(body).not.toContain('<html');
    expect(body).not.toContain('<nav');

    // Should contain submission-related content
    expect(body).toContain('submissions');
  });

  test('submissions search without HX-Request returns full page with html/nav', async ({ page }) => {
    const { status, body } = await fetchFromPage(page, `${BASE}/admin/submissions?search=test`);

    expect(status).toBe(200);

    // Without HX-Request, should return full dashboard layout
    expect(body).toContain('<html');
    expect(body).toContain('<nav');

    // Should still have submission content
    expect(body).toContain('Submissions');
  });

  test('submissions list with HX-Request and empty search returns partial', async ({ page }) => {
    const { status, body } = await fetchFromPage(page, `${BASE}/admin/submissions?search=`, {
      'HX-Request': 'true',
    });

    expect(status).toBe(200);

    // Should be a partial — no full-page HTML structure
    expect(body).not.toContain('<html');
    expect(body).not.toContain('<nav');

    // Should still contain submission content
    expect(body).toContain('submissions');
  });

  test('submissions with HX-Request and form_slug filter returns partial', async ({ page }) => {
    const { status, body } = await fetchFromPage(page, `${BASE}/admin/submissions?search=&form_slug=contact`, {
      'HX-Request': 'true',
    });

    // NOTE: This test fails with status 500 due to SQL parameter numbering bug
    // in the deployed version: when search="" is falsy, no $1 param is added,
    // but form_slug uses $2 in the SQL query with only 1 param.
    expect(status).toBe(200);

    // Should be a partial
    expect(body).not.toContain('<html');
    expect(body).not.toContain('<nav');
  });
});
