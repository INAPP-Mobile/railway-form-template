import json
import secrets
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from app.templates_ import templates
from starlette.middleware.sessions import SessionMiddleware
from app import db as db_module
from app.admin import router as admin_router
from app.captcha import generate_pow_challenge, verify_captcha
from app.config import settings
from app.email_ import send_notification
from app.forms import get_form_by_slug, get_forms
from app.rate_limit import check_rate_limit, ensure_rate_limit_table

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await db_module.create_pool()
    app.state.pool = pool
    await db_module.init_db(pool)
    if settings.rate_limit_backend == "db":
        await ensure_rate_limit_table(pool)
    yield
    await pool.close()
app = FastAPI(
    title="Privacy-First Contact Form",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
secret_key = settings.session_secret_key or secrets.token_hex(32)
app.add_middleware(SessionMiddleware, secret_key=secret_key)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(admin_router, prefix="/admin")
@app.get("/", response_class=HTMLResponse)
async def embed_snippet(request: Request):
    pool = request.app.state.pool
    forms = await get_forms(pool)
    return await templates.TemplateResponse(
        "embed_snippet.html",
        {"request": request, "forms": forms},
    )
@app.get("/health")
async def health(request: Request):
    pool = request.app.state.pool
    db_ok = False
    if pool:
        try:
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
                db_ok = True
        except Exception:
            pass
    if db_ok:
        return {"status": "healthy", "database": "connected"}
    return JSONResponse(
        status_code=503,
        content={"status": "unhealthy", "database": "disconnected"},
    )
@app.post("/form/{slug}")
async def submit_form(request: Request, slug: str):
    pool = request.app.state.pool
    form_def = await get_form_by_slug(pool, slug)
    if not form_def:
        raise HTTPException(status_code=404, detail="Form not found")
    ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(pool, ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later.",
            headers={"Retry-After": "3600"},
        )
    try:
        body = await request.form()
        data = dict(body)
    except Exception:
        try:
            body = await request.json()
            data = dict(body)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request body")
    captcha_ok, captcha_err = await verify_captcha(request, data)
    if not captcha_ok:
        raise HTTPException(status_code=400, detail=captcha_err or "CAPTCHA failed")
    cap_token = data.pop("cap_token", None)
    pow_secret = data.pop("pow_secret", None)
    pow_nonce = data.pop("pow_nonce", None)
    pow_difficulty = data.pop("pow_difficulty", None)
    website = data.pop("website", None)
    submission_data = {}
    email_val = ""
    name_val = ""
    for field in form_def["fields"]:
        fname = field.get("name")
        if fname in data:
            val = data[fname]
            if isinstance(val, str):
                val = val.strip()
            if field.get("required") and not val:
                raise HTTPException(
                    status_code=400,
                    detail=f"Field '{field.get('label', fname)}' is required",
                )
            submission_data[fname] = val
            if field.get("type") == "email":
                email_val = val
            if fname == "name":
                name_val = val
    metadata = {
        "ip": ip,
        "user_agent": request.headers.get("user-agent", ""),
        "referer": request.headers.get("referer", ""),
    }
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO submissions (form_slug, data, metadata) VALUES ($1, $2, $3)",
            slug, json.dumps(submission_data), json.dumps(metadata),
        )
    if settings.form_recipient_email:
        await send_notification(name_val, email_val, submission_data.get("message", ""))
    return JSONResponse(
        status_code=201,
        content={"status": "ok", "message": "Form submitted successfully"},
    )
@app.get("/pow-challenge")
async def pow_challenge(difficulty: int = 4):
    challenge = generate_pow_challenge(difficulty)
    return challenge
