"""App FastAPI. Todas las rutas bajo el prefijo /api."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    await ensure_indexes()
    await seed_schedule_templates()
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
