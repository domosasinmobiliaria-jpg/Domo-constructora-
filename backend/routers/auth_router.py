"""Endpoints de autenticación y registro."""
from fastapi import APIRouter, Depends, HTTPException

from config import ADMIN_EMAIL
from db import users
from models import RegisterRequest, LoginRequest, TokenResponse, UserOut
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from utils import now, serialize

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user["status"],
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


@router.get("/admin-exists")
async def admin_exists():
    exists = await users.count_documents({"role": "admin"}) > 0
    return {"exists": exists}


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    email = body.email.lower().strip()

    existing = await users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    is_admin_email = email == ADMIN_EMAIL.lower()
    admin_count = await users.count_documents({"role": "admin"})

    # Reglas de admin único.
    if body.role == "admin":
        if not is_admin_email:
            raise HTTPException(
                status_code=403,
                detail="El rol administrador está reservado al correo autorizado",
            )
        if admin_count > 0:
            raise HTTPException(
                status_code=403, detail="Ya existe un administrador en el sistema"
            )
    else:
        # El correo del admin no puede registrarse con otro rol.
        if is_admin_email:
            raise HTTPException(
                status_code=403,
                detail="Este correo está reservado para el administrador",
            )

    # El admin queda aprobado automáticamente; el resto queda pendiente.
    role = "admin" if (is_admin_email and admin_count == 0) else body.role
    status_value = "approved" if role == "admin" else "pending"

    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": role,
        "status": status_value,
        "created_at": now(),
        "updated_at": now(),
    }
    result = await users.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = create_access_token(str(result.inserted_id))
    return {"access_token": token, "token_type": "bearer", "user": _user_out(doc)}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = await users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if user["status"] == "pending":
        raise HTTPException(
            status_code=403, detail="Tu cuenta está pendiente de aprobación"
        )
    if user["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Tu cuenta fue rechazada")

    token = create_access_token(str(user["_id"]))
    return {"access_token": token, "token_type": "bearer", "user": _user_out(user)}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)
