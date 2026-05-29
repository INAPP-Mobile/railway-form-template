import csv
import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, Query, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates

from app import db as db_module
from app.config import settings
from app.forms import create_form, delete_form, get_form, get_form_by_slug, get_forms, update_form

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


def auth_required(request: Request):
    if not request.session.get("authenticated"):
        raise RedirectResponse(url="/admin/login", status_code=302)


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("admin_login.html", {"request": request})


@router.post("/login")
async def login(request: Request, password: str = Form(...)):
    if password == settings.admin_password:
        request.session["authenticated"] = True
        return RedirectResponse(url="/admin", status_code=302)
    return templates.TemplateResponse(
        "admin_login.html",
        {"request": request, "error": "Invalid password"},
    )


@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/admin/login", status_code=302)


@router.get("", response_class=HTMLResponse)
async def dashboard(request: Request):
    auth_required(request)
    pool = request.app.state.pool
    forms = await get_forms(pool)

    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM submissions") or 0
        rows = await conn.fetch(
            "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 20"
        )
        submissions = [dict(r) for r in rows]

    total_pages = max(1, (total + 19) // 20)

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "forms": forms,
            "submissions": submissions,
            "page": 1,
            "total_pages": total_pages,
            "total": total,
            "search": "",
            "form_slug": "",
        },
    )


@router.get("/submissions", response_class=HTMLResponse)
async def submissions_list(
    request: Request,
    page: int = Query(1, ge=1),
    search: str = Query(""),
    form_slug: str = Query(""),
):
    auth_required(request)
    pool = request.app.state.pool
    per_page = 20
    offset = (page - 1) * per_page

    async with pool.acquire() as conn:
        where_clauses = []
        params = []
        if search:
            where_clauses.append("data::text ILIKE $1")
            params.append(f"%{search}%")
        if form_slug:
            where_clauses.append("form_slug = $2")
            params.append(form_slug)

        where = ""
        if where_clauses:
            where = "WHERE " + " AND ".join(where_clauses)

        count_row = await conn.fetchval(
            f"SELECT COUNT(*) FROM submissions {where}", *params
        )
        total = count_row or 0

        order = "ORDER BY created_at DESC"
        limit_clause = f"LIMIT {per_page} OFFSET {offset}"
        rows = await conn.fetch(
            f"SELECT * FROM submissions {where} {order} {limit_clause}",
            *params,
        )
        submissions = [dict(r) for r in rows]

    total_pages = max(1, (total + per_page - 1) // per_page)

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "submissions": submissions,
            "page": page,
            "total_pages": total_pages,
            "total": total,
            "search": search,
            "form_slug": form_slug,
            "partial": True,
        },
    )


@router.get("/submission/{sub_id}/toggle")
async def toggle_read(request: Request, sub_id: str):
    auth_required(request)
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE submissions SET is_read = NOT is_read WHERE id = $1 RETURNING is_read",
            sub_id,
        )
        is_read = row["is_read"] if row else False
    return PlainTextResponse("read" if is_read else "unread")


@router.delete("/submission/{sub_id}")
async def delete_submission(request: Request, sub_id: str):
    auth_required(request)
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM submissions WHERE id = $1", sub_id)
    return PlainTextResponse("ok")


@router.get("/export")
async def export_csv(request: Request):
    auth_required(request)
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM submissions ORDER BY created_at DESC"
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "form_slug", "data", "metadata", "is_read", "created_at"])
    for r in rows:
        writer.writerow([
            r["id"], r["form_slug"], str(r["data"]),
            str(r["metadata"]), r["is_read"], r["created_at"].isoformat(),
        ])

    output.seek(0)
    now = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=submissions_{now}.csv"},
    )


@router.get("/forms", response_class=HTMLResponse)
async def list_forms(request: Request):
    auth_required(request)
    pool = request.app.state.pool
    forms = await get_forms(pool)
    return templates.TemplateResponse(
        "admin_dashboard.html",
        {"request": request, "forms": forms, "show_forms": True},
    )


@router.get("/forms/new", response_class=HTMLResponse)
async def new_form_page(request: Request):
    auth_required(request)
    return templates.TemplateResponse(
        "admin_dashboard.html",
        {"request": request, "editing_form": None},
    )


@router.post("/forms")
async def create_form_route(
    request: Request,
    slug: str = Form(...),
    title: str = Form("Contact Form"),
    fields_json: str = Form("[]"),
):
    auth_required(request)
    pool = request.app.state.pool
    import json
    fields = json.loads(fields_json)
    await create_form(pool, slug, title, fields)
    return HTMLResponse(status_code=200, headers={"HX-Redirect": "/admin/forms"}, content="")


@router.get("/form/{form_id}", response_class=HTMLResponse)
async def edit_form_page(request: Request, form_id: str):
    auth_required(request)
    pool = request.app.state.pool
    form = await get_form(pool, form_id)
    return templates.TemplateResponse(
        "admin_dashboard.html",
        {"request": request, "editing_form": form, "forms": [form]},
    )


@router.put("/form/{form_id}")
async def update_form_route(
    request: Request,
    form_id: str,
    title: str = Form("Contact Form"),
    fields_json: str = Form("[]"),
):
    auth_required(request)
    pool = request.app.state.pool
    import json
    fields = json.loads(fields_json)
    await update_form(pool, form_id, title, fields)
    return HTMLResponse(status_code=200, headers={"HX-Redirect": "/admin/forms"}, content="")


@router.delete("/form/{form_id}")
async def delete_form_route(request: Request, form_id: str):
    auth_required(request)
    pool = request.app.state.pool
    ok = await delete_form(pool, form_id)
    return PlainTextResponse("ok" if ok else "not found")
