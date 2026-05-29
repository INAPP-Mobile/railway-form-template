---
title: Privacy-First Contact Form
description: Self-hosted, privacy-focused contact form backend with anti-spam (Cap CAPTCHA), PostgreSQL storage, admin dashboard with HTMX, and optional email forwarding via SendGrid/SMTP.
tags:
  - fastapi
  - python
  - postgresql
  - captcha
  - privacy
  - htmx
---

# Privacy-First Contact Form

> A self-hosted, privacy-focused contact form backend with anti-spam built in. Deploy on Railway in 2 minutes.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/your-org/railway-form-template)

> **Note:** Replace `your-org/railway-form-template` with your actual GitHub repository path after forking.

```text
┌─────────────────────────────────────────────────┐
│                   Your Website                   │
│  ┌───────────────────────────────────────────┐  │
│  │         Embedded Contact Form             │  │
│  │  Name: [________]  Email: [________]      │  │
│  │  Message: [___________________________]   │  │
│  │  [Send]                                   │  │
│  └──────────┬────────────────────────────────┘  │
└─────────────┼────────────────────────────────────┘
              │ POST /form/{slug}
              ▼
┌─────────────────────────────────────────────────┐
│              Railway (this app)                  │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ CAPTCHA │──│  FastAPI  │──│   PostgreSQL   │ │
│  │  Chain  │  │  Backend  │  │  (asyncpg)     │ │
│  └─────────┘  └────┬─────┘  └────────────────┘ │
│                    │                            │
│                    ▼                            │
│           ┌────────────────┐                    │
│           │ SendGrid / SMTP│ (optional)         │
│           └────────────────┘                    │
└─────────────────────────────────────────────────┘
              ▲
              │ GET /admin
     ┌────────┴────────┐
     │  Admin Dashboard │
     │  (HTMX-powered)  │
     └─────────────────┘
```

## What It Does

- **Receive form submissions** from your static site, blog, or any HTML page
- **Block spam** automatically via Cap (primary), honeypot, and proof-of-work (fallback chain)
- **Store submissions** in PostgreSQL for review
- **Notify you** via email (SendGrid or SMTP)
- **Admin dashboard** to view, search, and manage submissions (HTMX-powered, no page reloads)

## Service Architecture

This template uses 3 services:

1. **Form API** — The FastAPI backend (this repository)
2. **Cap CAPTCHA** — Anti-spam CAPTCHA service from Docker image `tiago2/cap`
3. **PostgreSQL** — Database for storing submissions and form definitions

In the Railway Template Composer, after clicking the deploy button:

1. Add the Form API service (auto-deployed from this repo)
2. Click **Add Service** → **Database** → **PostgreSQL** to provision the database
3. Click **Add Service** → **From Docker Image** → enter `tiago2/cap` to add Cap CAPTCHA
4. Set `CAP_ENDPOINT` to the Cap service URL (e.g., `http://cap:8080/c`) and `CAP_SECRET_KEY` to a shared secret

## Prerequisites

- A [Railway](https://railway.app) account
- A PostgreSQL database (Railway can provision one automatically)

## Quick Start

### 1. Deploy to Railway

Click the "Deploy on Railway" button above. Railway will:

1. Clone the repository
2. Detect the Python/FastAPI project (via Nixpacks)
3. Provision a PostgreSQL database
4. Deploy the app

### 2. Configure Environment Variables

After deployment, set these variables in Railway:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Postgres connection string (auto-set by Railway) |
| `ADMIN_PASSWORD` | ✅ | — | Password for the admin dashboard |
| `CAPTCHA_MODE` | ❌ | `auto` | Spam protection mode (`auto`, `cap`, `honeypot`, `pow`) |
| `FORM_RECIPIENT_EMAIL` | ❌ | — | Where to forward submissions |
| `SENDGRID_API_KEY` | ❌ | — | SendGrid API key for email |
| `SMTP_HOST` | ❌ | — | SMTP host (fallback if SendGrid unset) |
| `SMTP_PORT` | ❌ | `587` | SMTP port |
| `SMTP_USER` | ❌ | — | SMTP username |
| `SMTP_PASS` | ❌ | — | SMTP password |
| `FROM_EMAIL` | ❌ | `noreply@contact-form.app` | Sender address |
| `RATE_LIMIT` | ❌ | `10` | Max submissions per IP per hour |
| `RATE_LIMIT_BACKEND` | ❌ | `memory` | `memory` or `db` |

### 3. Get Your Form Endpoint

Visit your app's URL (`https://your-app.railway.app/`) to see the embed snippet page with the correct endpoint URL.

### 4. Embed the Form

Copy the HTML snippet from the embed page and paste it into your website:

```html
<form action="https://your-app.railway.app/form/contact" method="post">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Message" required></textarea>
  <button type="submit">Send</button>
</form>
```

For HTMX-powered submission (no page reload):

```html
<form
  hx-post="https://your-app.railway.app/form/contact"
  hx-target="#form-response"
  hx-swap="innerHTML"
>
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Message" required></textarea>
  <button type="submit">Send</button>
</form>
<div id="form-response"></div>
```

## Admin Dashboard

Access your admin dashboard at `https://your-app.railway.app/admin`

Features:
- **Submissions** — View all form submissions in a paginated table
- **Search** — Search across all submission data
- **Read/unread** — Toggle submission status
- **Delete** — Remove spam or old submissions
- **CSV Export** — Download all submissions as a CSV file
- **Forms** — Create and manage multiple form definitions
- **Custom fields** — Define your own form fields (text, email, textarea, tel, number, select, checkbox)

## Spam Protection

The app uses a three-layer anti-spam approach:

| Layer | Method | Description |
|-------|--------|-------------|
| 1 | **Cap** | Primary CAPTCHA provider. Simple, privacy-friendly alternative to reCAPTCHA. |
| 2 | **Honeypot** | Hidden form field that bots fill in but humans don't see. |
| 3 | **PoW** | Built-in proof-of-work challenge (SHA-256) as last resort. |

Set `CAPTCHA_MODE=auto` (default) to try each layer in order. Set it to `cap`, `honeypot`, or `pow` to pin a specific method.

## API Reference

### Submit a Form

```
POST /form/{slug}
Content-Type: application/x-www-form-urlencoded
```

Body: Form fields as defined in the form configuration.

Response (201):
```json
{"status": "ok", "message": "Form submitted successfully"}
```

### Health Check

```
GET /health
```

Response (200):
```json
{"status": "healthy", "database": "connected"}
```

### Get PoW Challenge

```
GET /pow-challenge?difficulty=4
```

Response:
```json
{"secret": "abc123...", "nonce": 42, "difficulty": 4}
```

## Blogger Setup

See [examples/blogger-embed.html](examples/blogger-embed.html) for a complete Blogger-compatible form with AJAX submission (no HTMX needed — Blogger doesn't support it).

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Copy env file
cp .env.sample .env
# Edit .env with your DATABASE_URL and ADMIN_PASSWORD

# Run locally
uvicorn app.main:app --reload --port 8000
```

## License

MIT
