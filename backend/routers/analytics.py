"""KPIs, clientes estancados, timeline y KPIs de cobros."""
from datetime import date, timedelta, datetime, timezone

from fastapi import APIRouter, Depends, Query

from db import (
    clients,
    payment_schedules,
    audit_logs,
    credit_processes,
    technical_processes,
    construction_schedules,
)
from auth import get_current_user
from utils import serialize, parse_iso_date, compute_installment_status, oid

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/kpis")
async def kpis(user: dict = Depends(get_current_user)):
    total_clients = await clients.count_documents({})
    activos = await clients.count_documents({"status": "activo"})
    en_progreso = await clients.count_documents({"status": "en_progreso"})
    completados = await clients.count_documents({"status": "completado"})
    credito = await clients.count_documents({"payment_method": "credito"})
    efectivo = await clients.count_documents({"payment_method": "efectivo"})

    # Etapas completadas de crédito/técnico.
    def count_completed(process_docs):
        total = 0
        done = 0
        for p in process_docs:
            for _, st in p.get("stages", {}).items():
                total += 1
                if st.get("status") == "completed":
                    done += 1
        return total, done

    credit_docs = await credit_processes.find().to_list(5000)
    tech_docs = await technical_processes.find().to_list(5000)
    c_total, c_done = count_completed(credit_docs)
    t_total, t_done = count_completed(tech_docs)

    return {
        "total_clients": total_clients,
        "by_status": {
            "activo": activos,
            "en_progreso": en_progreso,
            "completado": completados,
        },
        "by_payment_method": {"credito": credito, "efectivo": efectivo},
        "credit_progress_pct": round(100 * c_done / c_total, 1) if c_total else 0,
        "technical_progress_pct": round(100 * t_done / t_total, 1) if t_total else 0,
    }


@router.get("/stalled-clients")
async def stalled_clients(
    days: int = Query(15, ge=1), user: dict = Depends(get_current_user)
):
    """Clientes sin actividad de auditoría en > days días."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    all_clients = await clients.find().to_list(5000)
    result = []
    for c in all_clients:
        cid = str(c["_id"])
        last = await audit_logs.find_one(
            {"client_id": cid}, sort=[("created_at", -1)]
        )
        last_date = last.get("created_at") if last else c.get("created_at")
        if last_date and last_date.tzinfo is None:
            last_date = last_date.replace(tzinfo=timezone.utc)
        if not last_date or last_date < cutoff:
            days_inactive = None
            if last_date:
                days_inactive = (datetime.now(timezone.utc) - last_date).days
            result.append(
                {
                    "client_id": cid,
                    "client_name": c.get("name"),
                    "status": c.get("status"),
                    "last_activity": last_date.isoformat() if last_date else None,
                    "days_inactive": days_inactive,
                }
            )
    result.sort(key=lambda x: x.get("days_inactive") or 0, reverse=True)
    return result


@router.get("/timeline")
async def timeline(
    days: int = Query(30, ge=1), user: dict = Depends(get_current_user)
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logs = (
        await audit_logs.find({"created_at": {"$gte": cutoff}})
        .sort("created_at", -1)
        .to_list(500)
    )
    # Enriquecer con nombre del cliente.
    ids = list({oid(l["client_id"]) for l in logs if l.get("client_id")})
    name_map = {}
    if ids:
        cdocs = await clients.find({"_id": {"$in": ids}}).to_list(5000)
        name_map = {str(d["_id"]): d.get("name") for d in cdocs}
    out = []
    for l in logs:
        item = serialize(l)
        item["client_name"] = name_map.get(l.get("client_id"), "—")
        out.append(item)
    return out


@router.get("/payment-kpis")
async def payment_kpis(user: dict = Depends(get_current_user)):
    schedules = await payment_schedules.find().to_list(5000)
    total_cobrado = 0.0
    total_pendiente = 0.0
    total_vencido = 0.0
    total_plan = 0.0
    cuotas_pagadas = 0
    cuotas_a_tiempo = 0

    atrasos = {}  # client_id -> {name, monto, cuotas}
    client_ids = [oid(s["client_id"]) for s in schedules]
    name_map = {}
    if client_ids:
        cdocs = await clients.find({"_id": {"$in": client_ids}}).to_list(5000)
        name_map = {str(d["_id"]): d.get("name") for d in cdocs}

    for s in schedules:
        cid = s["client_id"]
        for inst in s.get("installments", []):
            amount = inst.get("amount", 0) or 0
            total_plan += amount
            status = compute_installment_status(inst)
            if status == "paid":
                total_cobrado += amount
                cuotas_pagadas += 1
                paid = parse_iso_date(inst.get("paid_date"))
                due = parse_iso_date(inst.get("due_date"))
                if paid and due and paid <= due:
                    cuotas_a_tiempo += 1
                elif paid and not due:
                    cuotas_a_tiempo += 1
            elif status == "overdue":
                total_vencido += amount
                total_pendiente += amount
                entry = atrasos.setdefault(
                    cid, {"client_id": cid, "client_name": name_map.get(cid, "—"),
                          "monto": 0.0, "cuotas": 0}
                )
                entry["monto"] = round(entry["monto"] + amount, 2)
                entry["cuotas"] += 1
            else:
                total_pendiente += amount

    pct_cobro = round(100 * total_cobrado / total_plan, 1) if total_plan else 0
    pct_cumplimiento = (
        round(100 * cuotas_a_tiempo / cuotas_pagadas, 1) if cuotas_pagadas else 0
    )
    top_atrasos = sorted(atrasos.values(), key=lambda x: x["monto"], reverse=True)[:5]

    return {
        "total_cobrado": round(total_cobrado, 2),
        "total_pendiente": round(total_pendiente, 2),
        "total_vencido": round(total_vencido, 2),
        "total_plan": round(total_plan, 2),
        "pct_cobro": pct_cobro,
        "pct_cumplimiento": pct_cumplimiento,
        "cuotas_pagadas": cuotas_pagadas,
        "cuotas_a_tiempo": cuotas_a_tiempo,
        "top_atrasos": top_atrasos,
    }
