"""Verify app module imports correctly."""
import sys
sys.path.insert(0, '.')
from app.admin import router
print("admin module imports OK")
print(f"Routes registered: {len(router.routes)}")
for r in router.routes:
    methods = ", ".join(r.methods) if hasattr(r, 'methods') else "ANY"
    print(f"  {methods} {r.path}")
