"""Plan de pagos con IVA, cuotas y comprobantes. Escritura: admin + credit_advisor."""
import uuid
from datetime import timedelta, date

from fastapi import APIRouter, Depends, HTTPException, Query

from db import payment_schedules, clients
from models import PaymentScheduleCreate, InstallmentUpdate
from auth import get_current_user, require_write_role
from utils import (
    now,
    oid,
    serialize,
    log_audit,
    parse_iso_date,
    compute_installment_status,
)

router = APIRouter(tags=["payments"])


def _freq_delta(frequency: str, index: int) -> timedelta:
    if frequency == "semanal":
        return timedelta(weeks=index)
    if frequency == "quincenal":
        return timedelta(days=15 * index)
    # mensual (aprox. 30 días para evitar dependencias externas)
    return timedelta(days=30 * index)


def _with_computed_status(schedule: dict) -> dict:
    schedule = serialize(schedule)
    for inst in schedule.get("installments", []):
        inst["status"] = compute_installment_status(inst)
    return schedule


@router.post("/payment-schedule/{client_id}")
async def create_schedule(
    client_id: str,
    body: PaymentScheduleCreate,
    user: dict = Depends(require_write_role("credit_advisor")),
):
    client = await clients.find_one({"_id": oid(client_id)})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    iva_rate = body.iva_rate if body.aplica_iva else 0.0
    iva_amount = round(body.subtotal * iva_rate, 2)
    total_amount = round(body.subtotal + iva_amount, 2)
    financed = round(total_amount - body.down_payment, 2)
    if financed < 0:
        financed = 0.0

    base = parse_iso_date(body.first_due_date) or date.today()
    per_installment = round(financed / body.num_installments, 2) if body.num_installments else 0.0

    installments = []
    accumulated = 0.0
    for i in range(body.num_installments):
        # Ajustar la última cuota para cuadrar el total financiado.
        if i == body.num_installments - 1:
            amount = round(financed - accumulated, 2)
        else:
            amount = per_installment
            accumulated = round(accumulated + amount, 2)
        due = base + _freq_delta(body.frequency, i)
        installments.append(
            {
                "id": str(uuid.uuid4()),
                "number": i + 1,
                "amount": amount,
                "due_date": due.isoformat(),
                "status": "pending",
                "paid_date": None,
                "receipt_attachment_id": None,
                "notes": "",
            }
        )

    doc = {
        "client_id": client_id,
        "subtotal": body.subtotal,
        "aplica_iva": body.aplica_iva,
        "iva_rate": iva_rate,
        "iva_amount": iva_amount,
        "total_amount": total_amount,
        "down_payment": body.down_payment,
        "num_installments": body.num_installments,
        "frequency": body.frequency,
        "first_due_date": body.first_due_date,
        "installments": installments,
        "created_at": now(),
        "updated_at": now(),
    }
    await payment_schedules.replace_one(
        {"client_id": client_id}, doc, upsert=True
    )
    await log_audit(
        client_id,
        user,
        "pagos",
        "crear_plan",
        f"Plan de pagos creado ({body.num_installments} cuotas)",
    )
    saved = await payment_schedules.find_one({"client_id": client_id})
    return _with_computed_status(saved)


@router.get("/payment-schedule/{client_id}")
async def get_schedule(client_id: str, user: dict = Depends(get_current_user)):
    doc = await payment_schedules.find_one({"client_id": client_id})
    if not doc:
        return None
    return _with_computed_status(doc)


@router.delete("/payment-schedule/{client_id}")
async def delete_schedule(
    client_id: str, user: dict = Depends(require_write_role("credit_advisor"))
):
    res = await payment_schedules.delete_one({"client_id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado")
    await log_audit(client_id, user, "pagos", "eliminar_plan", "Plan de pagos eliminado")
    return {"ok": True}


@router.put("/payment-schedule/{client_id}/installment/{inst_id}")
async def update_installment(
    client_id: str,
    inst_id: str,
    body: InstallmentUpdate,
    user: dict = Depends(require_write_role("credit_advisor")),
):
    doc = await payment_schedules.find_one({"client_id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado")

    installments = doc.get("installments", [])
    found = None
    for inst in installments:
        if inst.get("id") == inst_id:
            found = inst
            data = body.model_dump(exclude_none=True)
            # Revertir a pendiente limpia el comprobante y la fecha de pago.
            if data.get("status") == "pending":
                inst["paid_date"] = None
                inst["receipt_attachment_id"] = None
            inst.update(data)
            break
    if not found:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")

    await payment_schedules.update_one(
        {"client_id": client_id},
        {"$set": {"installments": installments, "updated_at": now()}},
    )
    action = "marcar_pagada" if body.status == "paid" else "editar_cuota"
    desc = f"Cuota #{found.get('number')} actualizada"
    if body.status == "paid":
        desc = f"Cuota #{found.get('number')} marcada como pagada"
    elif body.status == "pending":
        desc = f"Cuota #{found.get('number')} revertida a pendiente"
    await log_audit(client_id, user, "pagos", action, desc)

    saved = await payment_schedules.find_one({"client_id": client_id})
    return _with_computed_status(saved)


@router.get("/payments/upcoming")
async def upcoming(
    days: int = Query(7, ge=1, le=90), user: dict = Depends(get_current_user)
):
    """Pagos vencidos y próximos (<= days) sobre todos los clientes."""
    today = date.today()
    limit = today + timedelta(days=days)
    schedules = await payment_schedules.find().to_list(5000)
    client_ids = [oid(s["client_id"]) for s in schedules]
    client_map = {}
    if client_ids:
        docs = await clients.find({"_id": {"$in": client_ids}}).to_list(5000)
        client_map = {str(d["_id"]): d.get("name", "") for d in docs}

    overdue = []
    upcoming_list = []
    for s in schedules:
        cname = client_map.get(s["client_id"], "Cliente")
        for inst in s.get("installments", []):
            status = compute_installment_status(inst)
            if status == "paid":
                continue
            due = parse_iso_date(inst.get("due_date"))
            if not due:
                continue
            item = {
                "client_id": s["client_id"],
                "client_name": cname,
                "number": inst.get("number"),
                "amount": inst.get("amount"),
                "due_date": inst.get("due_date"),
                "status": status,
            }
            if due < today:
                overdue.append(item)
            elif due <= limit:
                upcoming_list.append(item)

    overdue.sort(key=lambda x: x["due_date"])
    upcoming_list.sort(key=lambda x: x["due_date"])
    return {"overdue": overdue, "upcoming": upcoming_list}
