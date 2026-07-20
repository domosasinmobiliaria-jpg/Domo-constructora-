"""Ruta de Crédito. Escritura: admin + credit_advisor."""
from fastapi import APIRouter, Depends

from db import credit_processes
from models import StageUpdate
from auth import get_current_user, require_write_role
from labels import CREDIT_STAGES, CREDIT_STAGE_LABELS
from routers.clients import _empty_stages
from routers.stages_common import get_process, update_stage

router = APIRouter(tags=["credit"])


@router.get("/clients/{client_id}/credit")
async def get_credit(client_id: str, user: dict = Depends(get_current_user)):
    return await get_process(
        credit_processes, client_id, CREDIT_STAGES, _empty_stages
    )


@router.put("/clients/{client_id}/credit/{stage}")
async def update_credit_stage(
    client_id: str,
    stage: str,
    body: StageUpdate,
    user: dict = Depends(require_write_role("credit_advisor")),
):
    return await update_stage(
        credit_processes,
        client_id,
        stage,
        body,
        user,
        CREDIT_STAGES,
        "credito",
        CREDIT_STAGE_LABELS,
    )
