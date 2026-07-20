"""App FastAPI. Todas las rutas bajo el prefijo /api.

Además, si existe el build web de Expo (WEB_DIST_DIR), lo sirve como SPA en el
mismo servidor: un solo servicio = una sola URL.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from db import ensure_indexes, seed_schedule_templates
from routers import (
    auth_router,
    admin,
    clients,
    credit,
    technical,
    construction,
    attachments,
    payments,
    analytics,
    audit,
    backup,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No impedir el arranque si MongoDB aún no está disponible: el servicio
    # debe levantar igual (health check y web) y reintentar en cada request.
    try:
        await ensure_indexes()
        await seed_schedule_templates()
    except Exception as exc:  # pragma: no cover
        print(f"[startup] Aviso: no se pudo inicializar MongoDB todavía: {exc}")
    yield


app = FastAPI(title="DOMO Constructora API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router raíz con prefijo /api.
from fastapi import APIRouter

api = APIRouter(prefix="/api")
api.include_router(auth_router.router)
api.include_router(admin.router)
api.include_router(clients.router)
api.include_router(credit.router)
api.include_router(technical.router)
api.include_router(construction.router)
api.include_router(attachments.router)
api.include_router(payments.router)
api.include_router(analytics.router)
api.include_router(audit.router)
api.include_router(backup.router)


@api.get("/health")
async def health():
    return {"status": "ok", "service": "domo-constructora"}


app.include_router(api)


# ---- Servir el build web de Expo (SPA) desde el mismo servidor ----
# Por defecto busca ../frontend/dist; en Docker se fija con WEB_DIST_DIR.
WEB_DIST_DIR = os.environ.get(
    "WEB_DIST_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"),
)

if os.path.isdir(WEB_DIST_DIR):
    _web_base = os.path.realpath(WEB_DIST_DIR)
    _index = os.path.join(_web_base, "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Nunca interceptar la API.
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi"):
            raise HTTPException(status_code=404, detail="No encontrado")
        # Servir el archivo estático si existe (con protección contra path traversal).
        target = os.path.realpath(os.path.join(_web_base, full_path))
        if full_path and target.startswith(_web_base) and os.path.isfile(target):
            return FileResponse(target)
        # Fallback SPA: cualquier ruta de cliente devuelve index.html.
        return FileResponse(_index)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
