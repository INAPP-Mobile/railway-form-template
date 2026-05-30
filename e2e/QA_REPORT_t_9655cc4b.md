# QA Report — t_9655cc4b

## Summary

**Test Run:** `npx playwright test` against staging (https://form-api-staging.up.railway.app)
**Result:** 67 passed / 3 failed (previously: 66 passed / 4 failed)
**Improvement:** "email field validation" test now passes (fixed by `noValidate` + HTMX approach)

The 3 remaining failures are all caused by the **same root cause bug** in `app/main.py`:
HTMX 2.0.4 does NOT swap 4xx response content into the DOM by default.

## Root Cause

**File:** `app/main.py`, lines 130, 142, 150, 165, 174

**Problem:** HTMX 2.0.4's `htmx:beforeSwap` event sets `shouldSwap = false` for error status codes (4xx/5xx). The backend returns validation errors as `HTMLResponse(status_code=400, ...)` with correct error HTML content, but HTMX refuses to swap it into `#form-response`.

**Debug evidence** (from `htmx:beforeSwap` event detail):
```
xhr.status: 400
target: "form-response"
shouldSwap: false   ← HTMX blocks the swap
serverResponse: "<div style=\"...\">Field \"Your Name\" is required</div>"  ← correct HTML
isError: true
```

**All 3 failing tests share this pattern:**
| Test | Line | What happens |
|------|------|-------------|
| "empty required field shows error" | form-page.spec.ts:74 | Backend returns 400 with "Field 'Your Name' is required" → HTMX drops it |
| "honeypot filled triggers CAPTCHA error" | form-page.spec.ts:94 | Backend returns 400 with CAPTCHA error → HTMX drops it (also: cap-widget remove didn't fix because event listeners remain) |
| "all fields empty shows first required error" | form-page.spec.ts:102 | Backend returns 400 with "Field 'Your Name' is required" → HTMX drops it |

## Fix Required

**Change `status_code=400` to `status_code=200`** in all `HTMLResponse(...)` calls inside `if _wants_html(request):` blocks.

Affected lines in `app/main.py`:
1. **Line 130** — `HTMLResponse(status_code=400, content='<div ...>No form data submitted</div>')`
2. **Line 142** — `HTMLResponse(status_code=400, content=f'<div ...>Field ... is required</div>')`
3. **Line 150** — `HTMLResponse(status_code=400, content=f'<div ...>Field ... is required</div>')`
4. **Line 165** — `HTMLResponse(status_code=400, content='<div ...>Unexpected field detected</div>')`
5. **Line 174** — `HTMLResponse(status_code=400, content=html)` (CAPTCHA errors)

**Why this is safe:**
- All 5 are inside `if _wants_html(request):` blocks — they only apply to HTMX requests
- JSON/API requests use the `raise HTTPException(status_code=400, ...)` path which returns proper 400
- API tests (`api.spec.js`) use `Accept: application/json` header which goes through the JSON path
- This is the **standard HTMX pattern** — the response content matters for display, not the status code

**Alternative approach** (not recommended — keep it simple):
```javascript
// Client-side fix — add to template
document.body.addEventListener('htmx:beforeSwap', function(evt) {
  if (evt.detail.xhr.status >= 400 && evt.detail.xhr.status < 500) {
    evt.detail.shouldSwap = true;
  }
});
```

## Secondary Issue (Low Priority)

**File:** `form-page.spec.ts`, lines 88-92

The workaround of removing `<cap-widget>` via `document.querySelector('cap-widget')?.remove()` doesn't fully work because the cap-widget CDN script (loaded asynchronously) registers event listeners on the form's submit event. Removing the DOM element doesn't remove the listeners. However, this test only fails because of the primary issue above — once the backend returns 200 for error responses, HTMX will swap the response and the test should pass.

## Test Infrastructure Notes

- The staging git branch is outdated (behind main) but Railway is deploying from main
- All 67 passing tests confirm the server is healthy
- Tests use E2E_BASE_URL defaulting to form-api-staging.up.railway.app
- Workspace: `dir:<path>` — changes persist
- Branch: `feature/t_9655cc4b`
