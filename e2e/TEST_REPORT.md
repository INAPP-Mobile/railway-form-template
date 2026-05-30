# E2E Test Report — t_07c7d9ed (HTMX fix verification)

**Date:** 2026-05-30
**Test Target:** https://form-api-staging.up.railway.app
**Suite:** 70 tests across 6 spec files

## Current Run: t_07c7d9ed (HTMX 4xx fix verification)

| Metric | Value |
|--------|-------|
| Total tests | 70 |
| Passed | 69 |
| Failed | 1 |
| Flaky | 0 |
| Skipped | 0 |

### HTMX fix deployed: `feature/t_2780ab87` merged into staging ✓
- Changed 5 `HTMLResponse(status_code=400, ...)` to `status_code=200` in `app/main.py`
- Form validation errors now render in `#form-response` via HTMX

### Fix verification (passing)
All 3 previously-failing form-page tests now pass:
- ✅ `empty required field shows error` (test 10)
- ✅ `honeypot filled triggers CAPTCHA error` (test 11)
- ✅ `all fields empty shows first required error` (test 12)

All other form-page tests pass too: 18/18

### 1 Regression found

**`POST /form/{slug} with empty body returns 400`** (api.spec.js:74-80)
- **Expected:** 400
- **Actual:** 200
- **Root cause:** The test sends an empty body with only `Content-Type: application/x-www-form-urlencoded` and no `Accept` header. Playwright defaults `Accept` to `*/*`, which causes `_wants_html()` to return True. The backend's empty-body guard (line 128-130) returns `HTMLResponse(status_code=200, ...)` for HTML clients after the fix.
- **All other API tests pass** because they set `Accept: application/json` or `HX-Request: true` explicitly.
- **Fix:** Add `headers: { 'Accept': 'application/json' }` to the failing test, matching the pattern used by other API tests.

---

## Full suite breakdown (current t_07c7d9ed)

| Spec File | Tests | Pass | Fail | Notes |
|-----------|-------|------|------|-------|
| admin.spec.ts | 32 | 32 | 0 | All clean |
| api.spec.js | 10 | 9 | 1 | 1 regression: empty body test (see above) |
| debug-400.spec.ts | 1 | 1 | 0 | Debug test only |
| debug-cap.spec.ts | 1 | 1 | 0 | Debug test only |
| form-page.spec.ts | 18 | 18 | 0 | **All pass — HTMX fix verified** |
| submissions-filter.spec.ts | 8 | 8 | 0 | All clean |

---

## Historical runs

### Run t_9655cc4b — 70 tests, 67 pass / 3 fail
- Initial discovery of HTMX 4xx swap bug
- 3 form-page tests failed with empty `#form-response`
- Correct root cause analysis produced
- Fix card created: t_6f1500aa

### Run t_9d8fdd61 — 70 tests, 66 pass / 4 fail
- 4 form-page failures (browser validation + email format)
- All backend bugs were already fixed; remaining failures were test design issues

### Run t_8a495a8e etc. — Previous runs
- Earlier runs fixed cap-token, strict mode, and other backend bugs
- Gradual improvement from 54 → 66 → 67 → 69 pass
