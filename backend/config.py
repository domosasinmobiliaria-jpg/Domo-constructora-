"""Configuración central leída del entorno. Nunca hardcodear URLs ni puertos."""
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "domo_constructora")
JWT_SECRET = os.environ.get("JWT_SECRET", "domo-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "7"))

# Admin único del sistema. Se crea en el primer registro con este correo.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "domo.sas.inmobiliaria@gmail.com")

# Límite de tamaño por adjunto (6 MB).
MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024
