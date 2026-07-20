"""Utilidades compartidas: serialización, auditoría, cálculo de estado 'Vencida'."""
from datetime import datetime, date, timezone
from typing import Any, Optional

from bson import ObjectId

from db import audit_logs


def now() -> datetime:
    return datetime.now(timezone.utc)


def oid(id_str: str) -> ObjectId:
    from fastapi import HTTPException

    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")


def serialize(doc: Any) -> Any:
    """Convierte recursivamente ObjectId y datetime a str para JSON."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            out[key] = serialize(v)
        return out
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


def parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "")).date()
    except Exception:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def compute_installment_status(inst: dict) -> str:
    """Estado 'Vencida' calculado al vuelo: due_date < hoy AND status != paid."""
    if inst.get("status") == "paid":
        return "paid"
    due = parse_iso_date(inst.get("due_date"))
    if due and due < date.today():
        return "overdue"
    return "pending"


async def log_audit(
    client_id: str,
    user: dict,
    process_type: str,
    action: str,
    description: str,
):
    """Registra automáticamente una acción de escritura."""
    await audit_logs.insert_one(
        {
            "client_id": client_id,
            "user_id": str(user.get("_id")),
            "user_name": user.get("name"),
            "user_role": user.get("role"),
            "process_type": process_type,
            "action": action,
            "description": description,
            "created_at": now(),
        }
    )
