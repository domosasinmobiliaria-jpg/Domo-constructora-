"""CRUD de clientes. Inicializa procesos vacíos al crear."""
from fastapi import APIRouter, Depends, HTTPException, Query

from db import (
    clients,
    credit_processes,
    technical_processes,
    construction_schedules,
    payment_schedules,
    attachments,
    audit_logs,
)
from models import ClientCreate, ClientUpdate
from auth import get_current_user, get_current_admin
from labels import CREDIT_STAGES, TECHNICAL_STAGES
from utils import now, oid, serialize, log_audit

router = APIRouter(tags=["clients"])


def _empty_stages(stage_keys):
    return {
        key: {
            "status": "pending",
            "notes": "",
            "updated_by_id": None,
            "updated_by_name": None,
            "updated_at": None,
            "attachment_ids": [],
        }
        for key in stage_keys
    }


@router.get("/clients")
async def list_clients(
    search: str = Query("", description="nombre / teléfono / correo"),
    payment_method: str = Query("", description="credito | efectivo | ''"),
    status: str = Query(""),
    sort: str = Query("recent", description="recent | old | az | za"),
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if payment_method:
        query["payment_method"] = payment_method
    if status:
        query["status"] = status

    sort_map = {
        "recent": ("created_at", -1),
        "old": ("created_at", 1),
        "az": ("name", 1),
        "za": ("name", -1),
    }
    field, direction = sort_map.get(sort, ("created_at", -1))

    docs = await clients.find(query).sort(field, direction).to_list(2000)
    return [serialize(d) for d in docs]


@router.post("/clients")
async def create_client(body: ClientCreate, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update(
        {
            "created_by": str(user["_id"]),
            "created_by_name": user.get("name"),
            "created_at": now(),
            "updated_at": now(),
        }
    )
    result = await clients.insert_one(doc)
    client_id = str(result.inserted_id)

    # Inicializar procesos vacíos.
    await credit_processes.insert_one(
        {"client_id": client_id, "stages": _empty_stages(CREDIT_STAGES)}
    )
    await technical_processes.insert_one(
        {"client_id": client_id, "stages": _empty_stages(TECHNICAL_STAGES)}
    )
    await construction_schedules.insert_one(
        {"client_id": client_id, "activities": []}
    )

    await log_audit(
        client_id, user, "cliente", "crear", f"Cliente creado: {body.name}"
    )

    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    doc = await clients.find_one({"_id": oid(client_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return serialize(doc)


@router.put("/clients/{client_id}")
async def update_client(
    client_id: str, body: ClientUpdate, user: dict = Depends(get_current_user)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        doc = await clients.find_one({"_id": oid(client_id)})
        return serialize(doc)
    updates["updated_at"] = now()
    res = await clients.find_one_and_update(
        {"_id": oid(client_id)}, {"$set": updates}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await log_audit(client_id, user, "cliente", "editar", "Datos del cliente actualizados")
    return serialize(res)


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, admin: dict = Depends(get_current_admin)):
    doc = await clients.find_one({"_id": oid(client_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await clients.delete_one({"_id": oid(client_id)})
    await credit_processes.delete_many({"client_id": client_id})
    await technical_processes.delete_many({"client_id": client_id})
    await construction_schedules.delete_many({"client_id": client_id})
    await payment_schedules.delete_many({"client_id": client_id})
    await attachments.delete_many({"client_id": client_id})
    await audit_logs.delete_many({"client_id": client_id})
    return {"ok": True}
