"""Cliente motor (MongoDB async) e inicialización de índices."""
from motor.motor_asyncio import AsyncIOMotorClient

from config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Colecciones
users = db["users"]
clients = db["clients"]
credit_processes = db["credit_processes"]
technical_processes = db["technical_processes"]
construction_schedules = db["construction_schedules"]
payment_schedules = db["payment_schedules"]
attachments = db["attachments"]
audit_logs = db["audit_logs"]
schedule_templates = db["schedule_templates"]


async def ensure_indexes():
    """Crea los índices necesarios. Idempotente."""
    await users.create_index("email", unique=True)
    await clients.create_index("created_at")
    await clients.create_index([("name", 1)])
    await credit_processes.create_index("client_id", unique=True)
    await technical_processes.create_index("client_id", unique=True)
    await construction_schedules.create_index("client_id", unique=True)
    await payment_schedules.create_index("client_id", unique=True)
    await attachments.create_index(
        [("client_id", 1), ("owner_type", 1), ("ref_key", 1)]
    )
    await audit_logs.create_index([("client_id", 1), ("created_at", -1)])


async def seed_schedule_templates():
    """Carga una plantilla de cronograma de obra por defecto si no existe ninguna."""
    existing = await schedule_templates.count_documents({})
    if existing:
        return
    default = {
        "name": "Vivienda estándar",
        "description": "Actividades típicas de construcción de vivienda",
        "activities": [
            {"name": "Cimentación", "order": 1},
            {"name": "Estructura y columnas", "order": 2},
            {"name": "Mampostería", "order": 3},
            {"name": "Instalaciones hidrosanitarias", "order": 4},
            {"name": "Instalaciones eléctricas", "order": 5},
            {"name": "Enlucidos", "order": 6},
            {"name": "Cubierta", "order": 7},
            {"name": "Acabados de pisos", "order": 8},
            {"name": "Carpintería y puertas", "order": 9},
            {"name": "Pintura", "order": 10},
            {"name": "Limpieza y entrega", "order": 11},
        ],
    }
    await schedule_templates.insert_one(default)
