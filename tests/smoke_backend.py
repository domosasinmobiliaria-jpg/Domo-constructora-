"""Prueba end-to-end del backend con Mongo en memoria (mongomock_motor)."""
import asyncio
import sys
from mongomock_motor import AsyncMongoMockClient

# Parchear el cliente de mongo ANTES de importar módulos que lo usan.
import db as dbmod
mock_client = AsyncMongoMockClient()
mock_db = mock_client["domo_test"]
dbmod.client = mock_client
dbmod.db = mock_db
dbmod.users = mock_db["users"]
dbmod.clients = mock_db["clients"]
dbmod.credit_processes = mock_db["credit_processes"]
dbmod.technical_processes = mock_db["technical_processes"]
dbmod.construction_schedules = mock_db["construction_schedules"]
dbmod.payment_schedules = mock_db["payment_schedules"]
dbmod.attachments = mock_db["attachments"]
dbmod.audit_logs = mock_db["audit_logs"]
dbmod.schedule_templates = mock_db["schedule_templates"]

# Reasignar en módulos ya importados por routers (importan nombres directamente).
import importlib
for modname in [
    "auth", "utils", "routers.auth_router", "routers.admin", "routers.clients",
    "routers.credit", "routers.technical", "routers.construction",
    "routers.attachments", "routers.payments", "routers.analytics",
    "routers.audit", "exports.excel",
]:
    pass

from fastapi.testclient import TestClient
import server

# Los routers hacen `from db import users`, capturando la referencia original.
# Parcheamos también los atributos importados en cada módulo.
import routers.auth_router as ar
import routers.admin as adm
import routers.clients as cl
import routers.credit as cr
import routers.technical as te
import routers.construction as co
import routers.attachments as at
import routers.payments as pay
import routers.analytics as an
import routers.audit as au
import auth as authmod
import exports.excel as ex

def patch(mod):
    for name in ["users","clients","credit_processes","technical_processes",
                 "construction_schedules","payment_schedules","attachments",
                 "audit_logs","schedule_templates"]:
        if hasattr(mod, name):
            setattr(mod, name, getattr(dbmod, name))

for m in [ar, adm, cl, cr, te, co, at, pay, an, au, authmod, ex]:
    patch(m)

# utils.log_audit usa audit_logs importado
import utils
utils.audit_logs = dbmod.audit_logs

failures = []
def check(cond, msg):
    status = "OK " if cond else "FALLO"
    print(f"  [{status}] {msg}")
    if not cond:
        failures.append(msg)

async def seed():
    await dbmod.ensure_indexes()
    await dbmod.seed_schedule_templates()

asyncio.get_event_loop().run_until_complete(seed())

client = TestClient(server.app)

print("== Auth / Admin único ==")
r = client.get("/api/auth/admin-exists")
check(r.status_code == 200 and r.json()["exists"] is False, "admin-exists inicial=false")

# Registrar admin
r = client.post("/api/auth/register", json={
    "name": "CEO", "email": "domo.sas.inmobiliaria@gmail.com",
    "password": "secret123", "role": "admin"})
check(r.status_code == 200, "registro admin")
admin_token = r.json()["access_token"]
check(r.json()["user"]["status"] == "approved", "admin aprobado automáticamente")

# Intento de segundo admin -> bloqueado
r = client.post("/api/auth/register", json={
    "name": "Falso", "email": "otro@x.com", "password": "secret123", "role": "admin"})
check(r.status_code == 403, "segundo admin bloqueado")

# Registrar los 4 roles
tokens = {}
for role in ["credit_advisor", "technical", "site_manager"]:
    r = client.post("/api/auth/register", json={
        "name": role, "email": f"{role}@x.com", "password": "secret123", "role": role})
    check(r.status_code == 200 and r.json()["user"]["status"] == "pending",
          f"registro {role} queda pendiente")

# Login pendiente -> 403
r = client.post("/api/auth/login", json={"email": "credit_advisor@x.com", "password": "secret123"})
check(r.status_code == 403, "login de usuario pendiente rechazado")

# Admin aprueba a todos
H = {"Authorization": f"Bearer {admin_token}"}
r = client.get("/api/admin/pending-users", headers=H)
check(r.status_code == 200 and len(r.json()) == 3, "3 usuarios pendientes")
for u in r.json():
    rr = client.put(f"/api/admin/users/{u['id']}/approve", headers=H)
    check(rr.status_code == 200, f"aprobar {u['role']}")

for role in ["credit_advisor", "technical", "site_manager"]:
    r = client.post("/api/auth/login", json={"email": f"{role}@x.com", "password": "secret123"})
    check(r.status_code == 200, f"login {role} tras aprobación")
    tokens[role] = r.json()["access_token"]
tokens["admin"] = admin_token

print("== Clientes ==")
Hc = {"Authorization": f"Bearer {tokens['credit_advisor']}"}
r = client.post("/api/clients", headers=Hc, json={
    "name": "Juan Pérez", "phone": "0999999999", "email": "juan@x.com",
    "address": "Ambato", "payment_method": "credito", "status": "activo"})
check(r.status_code == 200, "crear cliente")
cid = r.json()["id"]
client.post("/api/clients", headers=Hc, json={"name": "Ana López", "payment_method": "efectivo"})
client.post("/api/clients", headers=Hc, json={"name": "Carlos Ruiz", "payment_method": "credito"})
r = client.get("/api/clients", headers=Hc)
check(r.status_code == 200 and len(r.json()) == 3, "listar 3 clientes")
r = client.get("/api/clients?search=Ana", headers=Hc)
check(len(r.json()) == 1 and r.json()[0]["name"] == "Ana López", "búsqueda por nombre")
r = client.get("/api/clients?payment_method=credito&sort=az", headers=Hc)
check(len(r.json()) == 2 and r.json()[0]["name"] == "Carlos Ruiz", "filtro+orden az")

print("== RBAC ==")
# credit_advisor escribe crédito -> OK
r = client.put(f"/api/clients/{cid}/credit/documentacion", headers=Hc,
               json={"status": "completed", "notes": "docs completos"})
check(r.status_code == 200, "credit_advisor edita crédito")
# technical intenta escribir crédito -> 403
Ht = {"Authorization": f"Bearer {tokens['technical']}"}
r = client.put(f"/api/clients/{cid}/credit/avaluo", headers=Ht, json={"status": "in_progress"})
check(r.status_code == 403, "technical NO edita crédito (403)")
# technical escribe técnico -> OK
r = client.put(f"/api/clients/{cid}/technical/diseno_final", headers=Ht, json={"status": "completed"})
check(r.status_code == 200, "technical edita técnico")
# site_manager escribe obra -> OK, credit_advisor NO
Hs = {"Authorization": f"Bearer {tokens['site_manager']}"}
r = client.post(f"/api/clients/{cid}/construction/from-template", headers=Hs, json={})
check(r.status_code == 200 and len(r.json()["activities"]) > 0, "site_manager carga plantilla obra")
r = client.post(f"/api/clients/{cid}/construction/activities", headers=Hc, json={"name": "X"})
check(r.status_code == 403, "credit_advisor NO edita obra (403)")

print("== Adjuntos (límite 6MB) ==")
import base64
small = base64.b64encode(b"hola pdf").decode()
r = client.post("/api/attachments", headers=Hc, json={
    "owner_type": "credit", "client_id": cid, "ref_key": "documentacion",
    "filename": "doc.pdf", "mime_type": "application/pdf", "data": small})
check(r.status_code == 200 and "data" not in r.json(), "subir adjunto sin devolver data")
aid = r.json()["id"]
r = client.get(f"/api/attachments?client_id={cid}&owner_type=credit", headers=Hc)
check(r.status_code == 200 and all("data" not in a for a in r.json()), "listado sin data")
r = client.get(f"/api/attachments/{aid}/content", headers=Hc)
check(r.status_code == 200 and r.content == b"hola pdf", "descargar contenido")

print("== Plan de pagos ==")
r = client.post(f"/api/payment-schedule/{cid}", headers=Hc, json={
    "subtotal": 10000, "aplica_iva": True, "iva_rate": 0.15,
    "down_payment": 1000, "num_installments": 6, "frequency": "mensual",
    "first_due_date": "2020-01-01"})
check(r.status_code == 200, "crear plan de pagos")
plan = r.json()
check(plan["iva_amount"] == 1500.0 and plan["total_amount"] == 11500.0, "IVA calculado")
check(len(plan["installments"]) == 6, "6 cuotas generadas")
# Cuotas con fecha 2020 pasadas -> vencidas
overdue = [i for i in plan["installments"] if i["status"] == "overdue"]
check(len(overdue) == 6, "cuotas antiguas marcadas vencidas al vuelo")
# Marcar pagada
inst_id = plan["installments"][0]["id"]
r = client.put(f"/api/payment-schedule/{cid}/installment/{inst_id}", headers=Hc, json={
    "status": "paid", "paid_date": "2020-01-01", "receipt_attachment_id": aid})
check(r.status_code == 200, "marcar cuota pagada")
paid_inst = [i for i in r.json()["installments"] if i["id"] == inst_id][0]
check(paid_inst["status"] == "paid", "cuota queda pagada")
# Revertir
r = client.put(f"/api/payment-schedule/{cid}/installment/{inst_id}", headers=Hc, json={"status": "pending"})
rev = [i for i in r.json()["installments"] if i["id"] == inst_id][0]
check(rev["receipt_attachment_id"] is None and rev["status"] != "paid", "revertir limpia comprobante")

print("== Alertas / Analytics ==")
r = client.get("/api/payments/upcoming?days=7", headers=Hc)
check(r.status_code == 200 and len(r.json()["overdue"]) > 0, "alertas de vencidos")
r = client.get("/api/analytics/kpis", headers=H)
check(r.status_code == 200 and r.json()["total_clients"] == 3, "KPIs generales")
r = client.get("/api/analytics/payment-kpis", headers=H)
check(r.status_code == 200 and r.json()["total_vencido"] > 0, "KPIs de cobros")
r = client.get("/api/analytics/timeline?days=30", headers=H)
check(r.status_code == 200 and len(r.json()) > 0, "timeline de actividad")

print("== Auditoría ==")
r = client.get(f"/api/audit-logs/{cid}", headers=Hc)
check(r.status_code == 200 and len(r.json()) > 0, "historial de auditoría por cliente")

print("== Respaldo Excel (solo admin) ==")
r = client.get("/api/backup/export-excel", headers=Hc)
check(r.status_code == 403, "no-admin NO exporta Excel (403)")
r = client.get("/api/backup/export-excel", headers=H)
check(r.status_code == 200 and len(r.content) > 1000, "admin descarga Excel")
# Validar 9 hojas
import io
from openpyxl import load_workbook
wb = load_workbook(io.BytesIO(r.content))
check(len(wb.sheetnames) == 9, f"Excel tiene 9 hojas ({wb.sheetnames})")

print()
if failures:
    print(f"❌ {len(failures)} FALLOS:")
    for f in failures:
        print("   -", f)
    sys.exit(1)
else:
    print("✅ TODAS LAS PRUEBAS PASARON")
