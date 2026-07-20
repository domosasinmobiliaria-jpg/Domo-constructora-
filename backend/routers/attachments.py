"""Adjuntos en colección separada. Nunca devolver 'data' en listados."""
import base64

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from config import MAX_ATTACHMENT_BYTES
from db import attachments
from models import AttachmentCreate
from auth import get_current_user
from utils import now, oid, serialize

router = APIRouter(tags=["attachments"])


@router.post("/attachments")
async def create_attachment(
    body: AttachmentCreate, user: dict = Depends(get_current_user)
):
    # Validar tamaño real del contenido decodificado.
    try:
        raw = base64.b64decode(body.data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Contenido base64 inválido")
    if len(raw) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=413, detail="El archivo supera el límite de 6 MB"
        )

    doc = {
        "owner_type": body.owner_type,
        "client_id": body.client_id,
        "ref_key": body.ref_key,
        "filename": body.filename,
        "mime_type": body.mime_type,
        "size_bytes": len(raw),
        "data": body.data,
        "description": body.description or "",
        "uploaded_by_id": str(user["_id"]),
        "uploaded_by_name": user.get("name"),
        "uploaded_at": now(),
    }
    result = await attachments.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc.pop("data", None)
    return serialize(doc)


@router.get("/attachments")
async def list_attachments(
    client_id: str = Query(...),
    owner_type: str = Query(""),
    ref_key: str = Query(""),
    user: dict = Depends(get_current_user),
):
    query = {"client_id": client_id}
    if owner_type:
        query["owner_type"] = owner_type
    if ref_key:
        query["ref_key"] = ref_key
    # Excluir el campo 'data' en el listado.
    docs = await attachments.find(query, {"data": 0}).sort("uploaded_at", -1).to_list(
        500
    )
    return [serialize(d) for d in docs]


@router.get("/attachments/{attachment_id}/content")
async def get_content(attachment_id: str, user: dict = Depends(get_current_user)):
    doc = await attachments.find_one({"_id": oid(attachment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    try:
        raw = base64.b64decode(doc["data"])
    except Exception:
        raise HTTPException(status_code=500, detail="Adjunto corrupto")
    headers = {
        "Content-Disposition": f'inline; filename="{doc.get("filename", "archivo")}"'
    }
    return Response(
        content=raw,
        media_type=doc.get("mime_type", "application/octet-stream"),
        headers=headers,
    )


@router.delete("/attachments/{attachment_id}")
async def delete_attachment(
    attachment_id: str, user: dict = Depends(get_current_user)
):
    res = await attachments.delete_one({"_id": oid(attachment_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    return {"ok": True}
