"""Lógica compartida para rutas de crédito y técnica (misma estructura)."""
from fastapi import HTTPException

from models import StageUpdate
from utils import now, serialize, log_audit


async def get_process(collection, client_id: str, valid_stages, empty_factory):
    doc = await collection.find_one({"client_id": client_id})
    if not doc:
        # Auto-crear si faltara (defensivo).
        doc = {"client_id": client_id, "stages": empty_factory(valid_stages)}
        await collection.insert_one(doc)
    return serialize(doc)


async def update_stage(
    collection,
    client_id: str,
    stage: str,
    body: StageUpdate,
    user: dict,
    valid_stages,
    process_type: str,
    stage_labels: dict,
):
    if stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Etapa inválida")

    doc = await collection.find_one({"client_id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    stage_data = {
        "status": body.status,
        "notes": body.notes or "",
        "updated_by_id": str(user["_id"]),
        "updated_by_name": user.get("name"),
        "updated_at": now(),
    }
    if body.attachment_ids is not None:
        stage_data["attachment_ids"] = body.attachment_ids
    else:
        stage_data["attachment_ids"] = doc.get("stages", {}).get(stage, {}).get(
            "attachment_ids", []
        )

    await collection.update_one(
        {"client_id": client_id}, {"$set": {f"stages.{stage}": stage_data}}
    )

    label = stage_labels.get(stage, stage)
    await log_audit(
        client_id,
        user,
        process_type,
        "actualizar_etapa",
        f"Etapa '{label}' → {body.status}",
    )

    updated = await collection.find_one({"client_id": client_id})
    return serialize(updated)
