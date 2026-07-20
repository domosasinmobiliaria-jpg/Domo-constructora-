"""Historial de auditoría por cliente."""
from fastapi import APIRouter, Depends

from db import audit_logs
from auth import get_current_user
from utils import serialize

router = APIRouter(tags=["audit"])


@router.get("/audit-logs/{client_id}")
async def get_audit_logs(client_id: str, user: dict = Depends(get_current_user)):
    docs = (
        await audit_logs.find({"client_id": client_id})
        .sort("created_at", -1)
        .to_list(2000)
    )
    return [serialize(d) for d in docs]
