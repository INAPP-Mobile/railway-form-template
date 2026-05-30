# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Form Builder UI >> add field then delete removes card
- Location: admin.spec.ts:65:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.add-field-btn')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - heading "Contact Form" [level=2] [ref=e4]
    - list [ref=e5]:
      - listitem [ref=e6]:
        - link "Dashboard" [ref=e7] [cursor=pointer]:
          - /url: /admin
      - listitem [ref=e8]:
        - link "Forms" [ref=e9] [cursor=pointer]:
          - /url: /admin/forms
    - link "Logout" [ref=e11] [cursor=pointer]:
      - /url: /admin/logout
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "Submissions" [level=1] [ref=e15]
        - paragraph [ref=e16]: total submissions
      - link "Export CSV" [ref=e18] [cursor=pointer]:
        - /url: /admin/export
    - textbox "Search submissions..." [ref=e20]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE = process.env.E2E_BASE_URL || 'https://form-api-production-1576.up.railway.app';
  4   | 
  5   | // Admin password from env or known value
  6   | const ADMIN_PW = 'admin123';
  7   | 
  8   | async function login(page: any) {
  9   |   await page.goto(`${BASE}/admin/login`);
  10  |   await page.fill('input[name="password"]', ADMIN_PW);
  11  |   await page.click('button[type="submit"]');
  12  |   await page.waitForURL('**/admin');
  13  | }
  14  | 
  15  | test.describe('Admin Login', () => {
  16  |   test('login page renders', async ({ page }) => {
  17  |     await page.goto(`${BASE}/admin/login`);
  18  |     await expect(page.locator('h2')).toContainText('Admin Login');
  19  |   });
  20  | 
  21  |   test('wrong password shows error', async ({ page }) => {
  22  |     await page.goto(`${BASE}/admin/login`);
  23  |     await page.fill('input[name="password"]', 'wrongpassword');
  24  |     await page.click('button[type="submit"]');
  25  |     await expect(page.locator('text=Invalid password')).toBeVisible();
  26  |   });
  27  | 
  28  |   test('correct password logs in', async ({ page }) => {
  29  |     await page.goto(`${BASE}/admin/login`);
  30  |     await page.fill('input[name="password"]', ADMIN_PW);
  31  |     await page.click('button[type="submit"]');
  32  |     await page.waitForURL('**/admin');
  33  |     await expect(page.locator('.sidebar')).toBeVisible();
  34  |   });
  35  | 
  36  |   test('unauthenticated access redirects to login', async ({ page }) => {
  37  |     await page.goto(`${BASE}/admin/forms`);
  38  |     await page.waitForURL('**/admin/login');
  39  |   });
  40  | });
  41  | 
  42  | test.describe('Form Builder UI', () => {
  43  |   test.beforeEach(async ({ page }) => {
  44  |     await login(page);
  45  |   });
  46  | 
  47  |   test('forms page shows list', async ({ page }) => {
  48  |     await page.goto(`${BASE}/admin/forms`);
  49  |     await expect(page.locator('h1')).toContainText('Forms');
  50  |   });
  51  | 
  52  |   test('new form page shows form builder', async ({ page }) => {
  53  |     await page.goto(`${BASE}/admin/forms/new`);
  54  |     await expect(page.locator('#field-builder')).toBeVisible();
  55  |     await expect(page.locator('.add-field-btn')).toBeVisible();
  56  |   });
  57  | 
  58  |   test('add field creates a card', async ({ page }) => {
  59  |     await page.goto(`${BASE}/admin/forms/new`);
  60  |     const initial = await page.locator('.field-card').count();
  61  |     await page.locator('.add-field-btn').click();
  62  |     await expect(page.locator('.field-card')).toHaveCount(initial + 1);
  63  |   });
  64  | 
  65  |   test('add field then delete removes card', async ({ page }) => {
  66  |     await page.goto(`${BASE}/admin/forms/new`);
> 67  |     await page.locator('.add-field-btn').click();
      |                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  68  |     await expect(page.locator('.field-card')).toHaveCount(1);
  69  |     await page.locator('.btn-del').click();
  70  |     await expect(page.locator('.field-card')).toHaveCount(0);
  71  |   });
  72  | 
  73  |   test('reorder buttons move fields', async ({ page }) => {
  74  |     await page.goto(`${BASE}/admin/forms/new`);
  75  |     // Add 2 fields
  76  |     await page.locator('.add-field-btn').click();
  77  |     await page.locator('.add-field-btn').click();
  78  |     // First field should have ▼ (move down) but not ▲ (already at top)
  79  |     const firstCard = page.locator('.field-card').first();
  80  |     await expect(firstCard.locator('text=▲')).toHaveCount(0);
  81  |     await expect(firstCard.locator('text=▼')).toHaveCount(1);
  82  |     // Second field should have ▲ (move up) 
  83  |     const lastCard = page.locator('.field-card').last();
  84  |     await expect(lastCard.locator('text=▲')).toHaveCount(1);
  85  |   });
  86  | 
  87  |   test('field type dropdown shows all types', async ({ page }) => {
  88  |     await page.goto(`${BASE}/admin/forms/new`);
  89  |     await page.locator('.add-field-btn').click();
  90  |     const select = page.locator('.field-card select').first();
  91  |     const options = await select.locator('option').allTextContents();
  92  |     const expected = ['text', 'email', 'textarea', 'select', 'checkbox', 'tel', 'number', 'url'];
  93  |     for (const t of expected) {
  94  |       expect(options).toContain(t);
  95  |     }
  96  |   });
  97  | 
  98  |   test('select type shows options input', async ({ page }) => {
  99  |     await page.goto(`${BASE}/admin/forms/new`);
  100 |     await page.locator('.add-field-btn').click();
  101 |     await page.locator('.field-card select').first().selectOption('select');
  102 |     await expect(page.locator('.field-options-input')).toBeVisible();
  103 |   });
  104 | 
  105 |   test('create form with fields and verify success', async ({ page }) => {
  106 |     await page.goto(`${BASE}/admin/forms/new`);
  107 |     await page.fill('input[name="slug"]', 'test-form-' + Date.now());
  108 |     await page.fill('input[name="title"]', 'Test Form');
  109 |     await page.locator('.add-field-btn').click();
  110 |     await page.fill('.field-card input[type="text"]').first().fill('Full Name');
  111 |     await page.locator('button[type="submit"]').click();
  112 |     await expect(page.locator('text=Test Form')).toBeVisible();
  113 |   });
  114 | 
  115 |   test('duplicate slug shows error', async ({ page }) => {
  116 |     await page.goto(`${BASE}/admin/forms/new`);
  117 |     await page.fill('input[name="slug"]', 'contact');
  118 |     await page.fill('input[name="title"]', 'Duplicate');
  119 |     await page.locator('.add-field-btn').click();
  120 |     await page.locator('button[type="submit"]').click();
  121 |     await expect(page.locator('text=already exists')).toBeVisible();
  122 |   });
  123 | 
  124 |   test('edit existing form shows slug as readonly', async ({ page }) => {
  125 |     await page.goto(`${BASE}/admin/forms`);
  126 |     await page.locator('a:has-text("Edit")').first().click();
  127 |     const slugInput = page.locator('input[name="slug"]');
  128 |     await expect(slugInput).toBeDisabled();
  129 |   });
  130 | });
  131 | 
  132 | test.describe('Admin Dashboard', () => {
  133 |   test.beforeEach(async ({ page }) => {
  134 |     await login(page);
  135 |   });
  136 | 
  137 |   test('dashboard shows submission count', async ({ page }) => {
  138 |     await page.goto(`${BASE}/admin`);
  139 |     await expect(page.locator('h1')).toContainText('Submissions');
  140 |   });
  141 | 
  142 |   test('forms link navigates to forms', async ({ page }) => {
  143 |     await page.goto(`${BASE}/admin`);
  144 |     await page.click('a:has-text("Forms")');
  145 |     await page.waitForURL('**/admin/forms');
  146 |     await expect(page.locator('h1')).toContainText('Forms');
  147 |   });
  148 | 
  149 |   test('logout ends session', async ({ page }) => {
  150 |     await page.goto(`${BASE}/admin`);
  151 |     await page.click('text=Logout');
  152 |     await page.waitForURL('**/admin/login');
  153 |   });
  154 | });
  155 | 
```