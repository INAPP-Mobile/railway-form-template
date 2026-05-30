# E2E Test Report — t_9d8fdd61

**Date:** 2026-05-30
**Branch:** feature/t_9d8fdd61
**Test Target:** https://form-api-staging.up.railway.app
**Suite:** 70 tests across 6 spec files

## Summary

| Metric | Value |
|--------|-------|
| Total tests | 70 |
| Passed | 66 |
| Failed | 4 |
| Flaky | 0 |
| Skipped | 0 |
| Duration | 81.2s |

**All 4 failures are in form-page.spec.ts, all caused by browser-side form validation or client-side cap-widget behavior — NOT backend code bugs.**

---

## Failure 1: "empty required field shows error"

**File:** `e2e/form-page.spec.ts`, lines 66-73
**Expected:** `#form-response` contains "required"
**Actual:** `#form-response` is empty (`""`)
**Status:** Test design issue — NOT a backend bug

### Root Cause

The form template (`app/templates/public_form.html` line 155/173) adds the HTML5 `required` attribute to inputs when the field definition in the database has `required: true`. In the Playwright test, `page.fill('input[name="name"]', '')` clears the field, then `page.click('button[type="submit"]')` triggers browser-native form validation. The browser shows a "Please fill out this field" popup and **prevents the submit event from firing**. HTMX never intercepts the submission, so no request reaches the backend, and `#form-response` remains in its initial empty state.

The backend DOES handle this correctly — confirmed by api.spec.js test "POST /form/{slug} with missing required field returns 400" (line 48-54) which sends `name: ''` via direct API call and gets status 400 as expected.

### Resolution

Two options:
- Add `novalidate` attribute to the `<form>` element to disable browser validation and let the backend handle field validation
- Or use `page.evaluate(() => { form.noValidate = true; })` before clicking submit to disable browser validation in the test

---

## Failure 2: "honeypot filled triggers CAPTCHA error"

**File:** `e2e/form-page.spec.ts`, lines 75-87
**Expected:** `#form-response` contains "CAPTCHA"
**Actual:** `#form-response` is empty (`""`)
**Status:** Environment/infrastructure issue — cap-widget CORS failure on staging

### Root Cause

The cap-widget (loaded from CDN in the form template when `settings.cap_endpoint` is configured) encounters a **CORS error**:
```
Access to fetch at 'https://cap-staging.up.railway.app/challenge'
from origin 'https://form-api-staging.up.railway.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The cap-widget's CDN script inserts a hidden `<input name="cap-token" value="">` into the form, but cannot obtain a valid CAPTCHA token because the challenge fetch fails. The cap-widget, in its error state, **intercepts and blocks the form submit event** regardless of the honeypot field state. Debug-cap test confirms `submitEventFired: false` when clicking the submit button.

Even though all visible fields have valid data, the form never reaches the backend. The backend correctly handles honeypot-filled submissions (confirmed by api.spec.js test "POST /form/{slug} with honeypot returns 400 JSON" at line 40-46 which passes).

### Resolution

- **Deploy a CORS configuration** on `cap-staging.up.railway.app` that allows requests from `form-api-staging.up.railway.app`
- OR configure the app to not use the cap endpoint (remove `CAP_ENDPOINT` env variable) if the CAP service isn't fully deployed yet
- OR switch CAPTCHA mode to `honeypot` on staging to bypass the cap-widget entirely

---

## Failure 3: "all fields empty shows first required error"

**File:** `e2e/form-page.spec.ts`, lines 89-93
**Expected:** `#form-response` contains "Your Name"
**Actual:** `#form-response` is empty (`""`)
**Status:** Test design issue — NOT a backend bug

### Root Cause

Same as Failure 1. When the form has `required` attributes on fields and all fields are empty, browser-native HTML5 validation blocks form submission before the submit event fires. HTMX never intercepts, `#form-response` stays empty.

The backend correctly handles this (confirmed by api.spec.js test and `app/main.py` lines 136-140).

### Resolution

Same as Failure 1:
- Add `novalidate` to the form
- Or disable browser validation in test with `page.evaluate`

---

## Failure 4: "email field validation"

**File:** `e2e/form-page.spec.ts`, lines 136-145
**Expected:** `#form-response` is visible
**Actual:** `#form-response` is hidden
**Status:** Test design issue — NOT a backend bug

### Root Cause

The form renders the email input as `<input type="email">` (line 173 of public_form.html). The test fills it with `"not-an-email"`, which is not a valid email address format. The browser's built-in email type validation fires on submit, showing "Please enter a valid email address" and **preventing the submit event from firing**.

`#form-response` remains in its initial hidden state (empty div with no bounding box = not visible).

### Resolution

Use a valid but undesirable email format, or disable browser validation:
- Change test to use an email-like value that triggers backend validation instead of browser validation (e.g., `email@` or `test@`)
- Or add `novalidate` to the form
- Or use `page.evaluate(() => { form.noValidate = true; })` before submitting

---

## Test Suite Health by Spec File

| Spec File | Tests | Pass | Fail | Notes |
|-----------|-------|------|------|-------|
| admin.spec.ts | 32 | 32 | 0 | All clean |
| api.spec.js | 10 | 10 | 0 | Direct API calls bypass browser validation |
| debug-400.spec.ts | 1 | 1 | 0 | Debug test only |
| debug-cap.spec.ts | 1 | 1 | 0 | Debug test only |
| form-page.spec.ts | 18 | 14 | 4 | **All failures here** |
| submissions-filter.spec.ts | 8 | 8 | 0 | All clean |

## Environment Issues Found

1. **CORS on cap-staging.up.railway.app** — The CAP challenge endpoint lacks CORS headers for the form-api-staging origin, causing the cap-widget to fail and block form submissions
2. **Form uses HTML5 `required` and `type="email"` attributes** — These prevent the E2E tests from reaching the backend for validation error scenarios; tests designed for server-side validation errors can't exercise those paths through the browser

## Prior Session Comparison

- **Previous run (referenced in parent task):** 54 pass / 14 fail (test pollution issues)
- **Current run:** 66 pass / 4 fail (test pollution fixed; 4 browser-validation failures remain)
- **Improvement:** 12 additional tests passing — the cap-token fix, strict mode violations, and other bugs from previous iterations have been resolved

## Conclusion

**The cap-widget fix (t_55fddd8b) is successfully merged and deployed.** No backend regressions were introduced. The 4 remaining failures are all frontend/browser-facing test design issues where HTML5 form validation or the cap-widget's CORS-related failure prevents the form submission from reaching the backend. The backend logic for validation and CAPTCHA is confirmed working via direct API tests.
