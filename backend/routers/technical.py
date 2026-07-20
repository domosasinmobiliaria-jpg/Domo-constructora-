"""Ruta Técnica. Escritura: admin + technical."""
from fastapi import APIRouter, Depends

from db import technical_processes
from models import StageUpdate
from auth import get_current_user, require_write_role
from labels import TECHNICAL_STAGES, TECHNICAL_STAGE_LABELS
from routers.clients import _empty_stages
from routers.stages_common import get_process, update_stage

router = APIRouter(tags=["technical"])


@router.get("/clients/{client_id}/technical")
async def get_technical(client_id: str, user: dict = Depends(get_current_user)):
    return await get_process(
        technical_processes, client_id, TECHNICAL_STAGES, _empty_stages
    )


@router.put("/clients/{client_id}/technical/{stage}")
async def update_technical_stage(
    client_id: str,
    stage: str,
    body: StageUpdate,
    user: dict = Depends(require_write_role("technical")),
):
    return await update_stage(
        technical_processes,
        client_id,
        stage,
        body,
        user,
        TECHNICAL_STAGES,
        "tecnico",
        TECHNICAL_STAGE_LABELS,
    )
