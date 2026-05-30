# E2E Test Report — t_9655cc4b (QA re-verify)

**Date:** 2026-05-30
**Branch:** feature/t_9655cc4b
**Test Target:** https://form-api-staging.up.railway.app
**Suite:** 70 tests across 6 spec files
**Previous run:** t_9d8fdd61 — 66 pass / 4 fail
**This run:** 67 pass / 3 fail

## Summary

| Metric | Value |
|--------|-------|
| Total tests | 70 |
| Passed | 67 |
| Failed | 3 |
| Flaky | 0 |
| Skipped | 0 |

**Improvement:** "email field validation" test now passes (1 of 4 fixed by `noValidate` disable in browser).

**All 3 remaining failures share the same root cause: HTMX 2.0.4 does not swap 4xx responses into the DOM (see QA_REPORT_t_9655cc4b.md for details). This is a backend code bug, not a test design issue.**

---

## Failure 1: "empty required field shows error"

**File:** `e2e/form-page.spec.ts`, lines 66-73
**Expected:** `#form-response` contains "required"
**Actual:** `#form-response` is empty (`""`)
**Status:** **Backend code bug** — HTMX 2.0.4 blocks 4xx response swaps

### Root Cause

The backend (`app/main.py`, lines 136-151) returns validation errors as:
```python
return HTMLResponse(status_code=400, content=f'<div...>Field ... is required</div>')
```

HTMX 2.0.4 sets `shouldSwap = false` for 4xx responses in the `htmx:beforeSwap` event, preventing the error HTML from rendering in `#form-response`. Debug evidence:
```
htmx:beforeSwap { detail: { xhr: {status: 400}, shouldSwap: false, isError: true, ... } }
```

**The form does submit to the backend** (HTMX fires, network POST returns 400). The response contains the correct error HTML. But HTMX refuses to swap 4xx content into the DOM.

### Resolution

Change `status_code=400` to `status_code=200` in all `HTMLResponse(...)` calls inside `if _wants_html(request):` blocks in `app/main.py` at lines 130, 142, 150, 165, and 174. This is the standard HTMX pattern — response content matters for display, not the status code.

### Test Framework Fix Already Applied

The test already uses `page.evaluate(() => { form.noValidate = true; })` to bypass HTML5 validation. This correctly allows the form to submit via HTMX. The remaining blocker is the backend's improper use of 4xx status codes for HTMX responses.

---

## Failure 2: "honeypot filled triggers CAPTCHA error"

**File:** `e2e/form-page.spec.ts`, lines 77-94
**Expected:** `#form-response` contains "CAPTCHA"
**Actual:** `#form-response` is empty (`""`)
**Status:** **Backend code bug** — same HTMX 4xx swap issue as Failure 1

### Root Cause

Same as Failure 1. The backend (`app/main.py`, line 172-174) returns CAPTCHA errors as:
```python
return HTMLResponse(status_code=400, content=html)
```

Additionally, the cap-widget CDN script (loaded in `public_form.html` line 183) experiences a CORS error fetching from `cap-staging.up.railway.app` and registers event listeners on the form that block submission. Removing the `<cap-widget>` element via `document.querySelector('cap-widget')?.remove()` does NOT remove the previously-registered event listeners.

However, the primary blocker for this test is the same HTMX 4xx swap issue.

### Resolution

Same as Failure 1 — change `status_code=400` to `status_code=200` for HTMX HTML responses.

---

## Failure 3: "all fields empty shows first required error"

**File:** `e2e/form-page.spec.ts`, lines 97-103
**Expected:** `#form-response` contains "Your Name"
**Actual:** `#form-response` is empty (`""`)
**Status:** **Backend code bug** — same HTMX 4xx swap issue as Failure 1

### Root Cause

Identical to Failure 1. Backend returns `HTMLResponse(status_code=400, ...)` for empty required fields. HTMX drops the 4xx response. The test correctly disables HTML5 validation with `noValidate`, but the backend's status code prevents HTMX from rendering the error.

### Resolution

Same as Failure 1 — change `status_code=400` to `status_code=200` for HTMX HTML responses.

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
| api.spec.js | 10 | 10 | 0 | All clean — uses Accept:application/json, bypasses HTMX |
| debug-400.spec.ts | 1 | 1 | 0 | Debug test only |
| debug-cap.spec.ts | 1 | 1 | 0 | Debug test only |
| form-page.spec.ts | 18 | 15 | 3 | **All 3 failures = same HTMX 4xx swap bug** |
| submissions-filter.spec.ts | 8 | 8 | 0 | All clean |

| Metric | Value |
|--------|-------|
| Total tests | 70 |
| Passed | 67 |
| Failed | 3 |

- **Previous run (t_9d8fdd61):** 66 pass / 4 fail — 4 browser-validation failures
- **This run (t_9655cc4b):** 67 pass / 3 fail — 1 fixed (email validation via noValidate), 3 still fail with a new root cause finding

## Conclusion

**The original assumption was wrong.** The 3 remaining failures are NOT test design issues. They are a **backend code bug**: all 5 `HTMLResponse(status_code=400, ...)` calls inside `if _wants_html(request):` blocks in `app/main.py` prevent HTMX 2.0.4 from swapping error responses into the DOM. The test code correctly disables HTML5 validation with `noValidate = true`. The backend returns the correct error HTML content. The network request fires and returns 400. But HTMX refuses to render 4xx responses by default.

**Fix required in `app/main.py`:** Change `status_code=400` to `status_code=200` in 5 locations (lines 130, 142, 150, 165, 174). This is the standard HTMX pattern.

## What Changed from Previous Assessment

| Metric | t_9d8fdd61 (previous) | t_9655cc4b (this) |
|--------|----------------------|-------------------|
| Total pass | 66 | 67 |
| Total fail | 4 | 3 |
| Email validation | ❌ Fail | ✅ Pass (noValidate fix) |
| Empty required | ❌ Fail (test design) | ❌ Fail (backend 4xx bug) |
| Honeypot + CAPTCHA | ❌ Fail (CORS issue) | ❌ Fail (backend 4xx bug) |
| All fields empty | ❌ Fail (test design) | ❌ Fail (backend 4xx bug) |

**The email validation test was fixed.** The 3 remaining failures are now properly identified as backend code bugs requiring status code changes in `app/main.py`.
