"""JWT, bcrypt y dependencias de rol para RBAC."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS
from db import users
from bson import ObjectId

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado"
        )
    token = creds.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await users.find_one({"_id": _oid(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if user.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Usuario no aprobado")
    return user


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Requiere rol administrador")
    return user


def require_write_role(*allowed_roles: str):
    """Dependencia que valida que el rol pueda escribir en el recurso.
    admin siempre puede."""

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role")
        if role == "admin" or role in allowed_roles:
            return user
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para modificar este recurso",
        )

    return checker
