"""Cronograma de obra. Escritura: admin + site_manager."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from db import construction_schedules, schedule_templates
from models import ActivityCreate, ActivityUpdate, ScheduleFromTemplate
from auth import get_current_user, require_write_role
from utils import now, serialize, log_audit

router = APIRouter(tags=["construction"])


@router.get("/clients/{client_id}/construction")
async def get_construction(client_id: str, user: dict = Depends(get_current_user)):
    doc = await construction_schedules.find_one({"client_id": client_id})
    if not doc:
        doc = {"client_id": client_id, "activities": []}
        await construction_schedules.insert_one(doc)
    return serialize(doc)


@router.post("/clients/{client_id}/construction/activities")
async def add_activity(
    client_id: str,
    body: ActivityCreate,
    user: dict = Depends(require_write_role("site_manager")),
):
    activity = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "status": body.status,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "progress": max(0, min(100, body.progress)),
        "notes": body.notes or "",
        "attachment_ids": body.attachment_ids or [],
        "updated_by_name": user.get("name"),
        "updated_at": now(),
    }
    doc = await construction_schedules.find_one({"client_id": client_id})
    if not doc:
        await construction_schedules.insert_one(
            {"client_id": client_id, "activities": [activity]}
        )
    else:
        await construction_schedules.update_one(
            {"client_id": client_id}, {"$push": {"activities": activity}}
        )
    await log_audit(
        client_id, user, "obra", "crear_actividad", f"Actividad creada: {body.name}"
    )
    updated = await construction_schedules.find_one({"client_id": client_id})
    return serialize(updated)


@router.post("/clients/{client_id}/construction/from-template")
async def from_template(
    client_id: str,
    body: ScheduleFromTemplate,
    user: dict = Depends(require_write_role("site_manager")),
):
    from utils import oid

    if body.template_id:
        tpl = await schedule_templates.find_one({"_id": oid(body.template_id)})
    else:
        tpl = await schedule_templates.find_one({})
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    activities = []
    for a in sorted(tpl.get("activities", []), key=lambda x: x.get("order", 0)):
        activities.append(
            {
                "id": str(uuid.uuid4()),
                "name": a["name"],
                "status": "pending",
                "start_date": None,
                "end_date": None,
                "progress": 0,
                "notes": "",
                "attachment_ids": [],
                "updated_by_name": user.get("name"),
                "updated_at": now(),
            }
        )

    doc = await construction_schedules.find_one({"client_id": client_id})
    if not doc:
        await construction_schedules.insert_one(
            {"client_id": client_id, "activities": activities}
        )
    else:
        await construction_schedules.update_one(
            {"client_id": client_id},
            {"$push": {"activities": {"$each": activities}}},
        )
    await log_audit(
        client_id,
        user,
        "obra",
        "cargar_plantilla",
        f"Plantilla cargada: {tpl.get('name')} ({len(activities)} actividades)",
    )
    updated = await construction_schedules.find_one({"client_id": client_id})
    return serialize(updated)


@router.put("/clients/{client_id}/construction/activities/{activity_id}")
async def update_activity(
    client_id: str,
    activity_id: str,
    body: ActivityUpdate,
    user: dict = Depends(require_write_role("site_manager")),
):
    doc = await construction_schedules.find_one({"client_id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado")

    activities = doc.get("activities", [])
    found = False
    for act in activities:
        if act.get("id") == activity_id:
            found = True
            data = body.model_dump(exclude_none=True)
            if "progress" in data:
                data["progress"] = max(0, min(100, data["progress"]))
            act.update(data)
            act["updated_by_name"] = user.get("name")
            act["updated_at"] = now()
            break
    if not found:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    await construction_schedules.update_one(
        {"client_id": client_id}, {"$set": {"activities": activities}}
    )
    await log_audit(
        client_id, user, "obra", "editar_actividad", "Actividad actualizada"
    )
    updated = await construction_schedules.find_one({"client_id": client_id})
    return serialize(updated)


@router.delete("/clients/{client_id}/construction/activities/{activity_id}")
async def delete_activity(
    client_id: str,
    activity_id: str,
    user: dict = Depends(require_write_role("site_manager")),
):
    doc = await construction_schedules.find_one({"client_id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado")
    await construction_schedules.update_one(
        {"client_id": client_id},
        {"$pull": {"activities": {"id": activity_id}}},
    )
    await log_audit(
        client_id, user, "obra", "eliminar_actividad", "Actividad eliminada"
    )
    updated = await construction_schedules.find_one({"client_id": client_id})
    return serialize(updated)


@router.get("/schedule-templates")
async def list_templates(user: dict = Depends(get_current_user)):
    docs = await schedule_templates.find().to_list(100)
    return [serialize(d) for d in docs]
