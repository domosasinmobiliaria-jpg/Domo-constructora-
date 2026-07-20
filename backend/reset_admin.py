"""Recuperación de contraseña del admin desde el servidor.

Uso:
    python -m backend.reset_admin           # solicita nueva contraseña
    python -m backend.reset_admin NUEVA_CLAVE

Si el admin no existe aún, lo crea con el correo autorizado.
"""
import asyncio
import getpass
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from config import MONGO_URL, DB_NAME, ADMIN_EMAIL
from auth import hash_password
from datetime import datetime, timezone


async def reset(password: str):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users = db["users"]

    admin = await users.find_one({"email": ADMIN_EMAIL.lower()})
    now = datetime.now(timezone.utc)
    if admin:
        await users.update_one(
            {"_id": admin["_id"]},
            {
                "$set": {
                    "password_hash": hash_password(password),
                    "role": "admin",
                    "status": "approved",
                    "updated_at": now,
                }
            },
        )
        print(f"✅ Contraseña del admin ({ADMIN_EMAIL}) restablecida.")
    else:
        await users.insert_one(
            {
                "email": ADMIN_EMAIL.lower(),
                "password_hash": hash_password(password),
                "name": "Administrador DOMO",
                "role": "admin",
                "status": "approved",
                "created_at": now,
                "updated_at": now,
            }
        )
        print(f"✅ Admin creado ({ADMIN_EMAIL}).")
    client.close()


def main():
    if len(sys.argv) > 1:
        password = sys.argv[1]
    else:
        password = getpass.getpass("Nueva contraseña del admin: ")
        confirm = getpass.getpass("Confirmar contraseña: ")
        if password != confirm:
            print("❌ Las contraseñas no coinciden.")
            sys.exit(1)
    if len(password) < 6:
        print("❌ La contraseña debe tener al menos 6 caracteres.")
        sys.exit(1)
    asyncio.run(reset(password))


if __name__ == "__main__":
    main()
