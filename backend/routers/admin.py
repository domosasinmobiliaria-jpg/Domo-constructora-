"""Gestión de usuarios (solo admin) y perfil propio."""
from fastapi import APIRouter, Depends, HTTPException

from db import users
from models import UpdateUserRequest, UpdateProfileRequest
from auth import get_current_admin, get_current_user, hash_password
from utils import now, oid, serialize

router = APIRouter(tags=["users"])


def _clean(u: dict) -> dict:
    u = serialize(u)
    u.pop("password_hash", None)
    return u


@router.get("/admin/users")
async def list_users(admin: dict = Depends(get_current_admin)):
    docs = await users.find().sort("created_at", -1).to_list(1000)
    return [_clean(d) for d in docs]


@router.get("/admin/pending-users")
async def pending_users(admin: dict = Depends(get_current_admin)):
    docs = await users.find({"status": "pending"}).sort("created_at", -1).to_list(1000)
    return [_clean(d) for d in docs]


@router.put("/admin/users/{user_id}/approve")
async def approve_user(user_id: str, admin: dict = Depends(get_current_admin)):
    res = await users.find_one_and_update(
        {"_id": oid(user_id)},
        {"$set": {"status": "approved", "updated_at": now()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _clean(res)


@router.put("/admin/users/{user_id}/reject")
async def reject_user(user_id: str, admin: dict = Depends(get_current_admin)):
    res = await users.find_one_and_update(
        {"_id": oid(user_id)},
        {"$set": {"status": "rejected", "updated_at": now()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _clean(res)


@router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str, body: UpdateUserRequest, admin: dict = Depends(get_current_admin)
):
    target = await users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.status is not None:
        updates["status"] = body.status
    if body.role is not None:
        # No se puede otorgar ni quitar admin por este endpoint.
        if body.role == "admin" or target.get("role") == "admin":
            raise HTTPException(
                status_code=403, detail="No se puede modificar el rol de administrador"
            )
        updates["role"] = body.role

    if not updates:
        return _clean(target)

    updates["updated_at"] = now()
    res = await users.find_one_and_update(
        {"_id": oid(user_id)}, {"$set": updates}, return_document=True
    )
    return _clean(res)


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    target = await users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="No se puede eliminar al administrador")
    await users.delete_one({"_id": oid(user_id)})
    return {"ok": True}


@router.put("/users/{user_id}/profile")
async def update_profile(
    user_id: str,
    body: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
):
    if str(user["_id"]) != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    if not updates:
        return _clean(user)
    updates["updated_at"] = now()
    res = await users.find_one_and_update(
        {"_id": oid(user_id)}, {"$set": updates}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _clean(res)
