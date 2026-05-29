import asyncio
from concurrent.futures import ThreadPoolExecutor

from jinja2 import Environment, FileSystemLoader, select_autoescape
from fastapi.responses import HTMLResponse

_env = Environment(
    loader=FileSystemLoader("app/templates"),
    autoescape=select_autoescape(["html", "xml"]),
    cache_size=100,
)

_executor = ThreadPoolExecutor(max_workers=2)


async def TemplateResponse(name: str, context: dict, status_code: int = 200):
    """Render a Jinja2 template and return an HTMLResponse."""
    loop = asyncio.get_event_loop()
    html = await loop.run_in_executor(_executor, _render, name, context)
    return HTMLResponse(content=html, status_code=status_code)


def _render(name: str, context: dict) -> str:
    """Synchronously render a Jinja2 template."""
    template = _env.get_template(name)
    return template.render(**context)
