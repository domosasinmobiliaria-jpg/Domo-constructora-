# DOMO Constructora — App de Gestión de Clientes

App móvil para el control integral del cliente desde el cierre de venta hasta la
entrega de la vivienda. Empresa: **DOMO Constructora e Inmobiliaria** (Ambato,
Ecuador). Moneda: **USD**. Interfaz, PDFs y Excel en **español**.

La especificación técnica completa está en [`CLAUDE.md`](./CLAUDE.md).

---

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | Expo SDK 54, TypeScript, Expo Router, React Native Paper |
| Backend | FastAPI, Pydantic v2, Motor (MongoDB async) |
| Base de datos | MongoDB (`MONGO_URL`) |
| PDF | `expo-print` + templates HTML |
| Excel | `openpyxl` (9 hojas, sin base64) |
| Auth | JWT (7 días) + bcrypt, token en `expo-secure-store` |

Todas las rutas del backend usan el prefijo `/api`.

### Roles y permisos (RBAC)

Todos los roles aprobados **leen** la lista completa de clientes y sus procesos.
La escritura está restringida:

| Rol | Escribe en |
|---|---|
| `admin` | Todo |
| `credit_advisor` | Ruta de Crédito + Plan de Pagos |
| `technical` | Ruta Técnica |
| `site_manager` | Cronograma de Obra |

El backend valida el rol en **cada** endpoint de escritura (403 si no corresponde).

---

## Puesta en marcha

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # opcional
pip install -r requirements.txt
cp .env.example .env        # ajustar MONGO_URL y JWT_SECRET
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Requiere una instancia de MongoDB accesible en `MONGO_URL`.

**Admin único**: el primer registro con el correo
`domo.sas.inmobiliaria@gmail.com` se convierte en administrador y queda
aprobado automáticamente. Cualquier otro intento de rol admin se bloquea.

**Recuperación de contraseña del admin** (desde el servidor):

```bash
python -m backend.reset_admin              # solicita nueva contraseña
python -m backend.reset_admin NUEVA_CLAVE  # no interactivo
```

### 2. Frontend

```bash
cd frontend
npm install
npx expo install --fix   # reconcilia versiones con el SDK de Expo instalado
npx expo start
```

La URL del backend se lee de `app.json` (`extra.apiUrl`) o de la variable
`EXPO_PUBLIC_API_URL`. Nunca se hardcodea en el código.

```bash
# Ejemplo apuntando a un backend en la red local (celular con Expo Go)
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000 npx expo start

# Para desarrollo en el NAVEGADOR (web), apunta al backend local:
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web
```

> En el despliegue de la nube no se define `EXPO_PUBLIC_API_URL`: la web usa
> automáticamente el mismo origen del servidor (`/api`), por eso funciona con
> una sola URL.

---

## Despliegue en la nube (una sola URL)

La app se despliega como **un solo servicio**: el servidor FastAPI sirve también
la app web de Expo, así que obtienes **un único enlace público** que abre la app
ya funcionando. El `Dockerfile` compila la web (`expo export`) y la sirve junto
con la API.

### Paso 1 — Base de datos gratis (MongoDB Atlas)

1. Crea una cuenta en <https://www.mongodb.com/cloud/atlas/register> (gratis).
2. Crea un clúster **M0 (Free)**.
3. En *Database Access* crea un usuario con contraseña.
4. En *Network Access* agrega `0.0.0.0/0` (permitir desde cualquier IP).
5. En *Connect → Drivers* copia la cadena de conexión, del tipo:
   `mongodb+srv://usuario:clave@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`

### Paso 2 — Publicar en Render (un clic)

1. Sube este repositorio a tu GitHub (ya está en
   `domosasinmobiliaria-jpg/Domo-constructora-`).
2. Crea una cuenta gratis en <https://render.com> y conéctala a GitHub.
3. **New + → Blueprint**, elige este repositorio. Render lee `render.yaml`.
4. Cuando lo pida, pega la variable **`MONGO_URL`** (la cadena de Atlas del paso 1).
   `JWT_SECRET` se genera solo; las demás ya vienen configuradas.
5. Clic en **Apply / Deploy** y espera a que termine el build.
6. Render te da una URL como `https://domo-constructora.onrender.com` →
   **ese es tu enlace**. Ábrelo y regístrate con
   `domo.sas.inmobiliaria@gmail.com` para entrar como administrador.

> El plan Free de Render "duerme" el servicio tras inactividad: el primer acceso
> del día puede tardar ~30–60 s en despertar. Para uso continuo, sube al plan
> pago más económico.

### Alternativa — Docker en cualquier servidor

```bash
docker build -t domo-constructora .
docker run -p 8000:8000 \
  -e MONGO_URL="mongodb+srv://usuario:clave@cluster0.xxxx.mongodb.net/..." \
  -e JWT_SECRET="una-clave-larga-y-secreta" \
  domo-constructora
# App + API en http://localhost:8000
```

---

## Módulos

- **Clientes** — búsqueda, filtros, ordenamiento, pull-to-refresh, FAB.
- **Ruta de Crédito / Técnica** — etapas fijas con estado, notas, adjuntos,
  auditoría automática y PDF por etapa / consolidado.
- **Cronograma de Obra** — actividades libres o desde plantilla, timeline
  visual, fotos de avance, PDF.
- **Plan de Pagos** — IVA configurable, cuotas automáticas, estado *Vencida*
  calculado al vuelo, comprobantes y reversión.
- **Alertas de cobro** — vencidos y próximos (≤7 días) en el inicio.
- **Panel ejecutivo** — KPIs, clientes estancados, timeline y gestión de cobros.
- **Auditoría** — historial de cada acción de escritura por cliente.
- **Respaldo Excel** (solo admin) — 9 hojas en español, sin base64.

---

## Pruebas del backend

Prueba end-to-end con MongoDB en memoria (sin servidor Mongo):

```bash
cd backend
pip install mongomock_motor httpx
PYTHONPATH=. python ../tests/smoke_backend.py
```

Cubre auth, admin único, aprobación de usuarios, RBAC (403 cruzados), CRUD de
clientes, adjuntos con límite de 6 MB, plan de pagos con IVA y estado vencido,
alertas, analytics, auditoría y respaldo Excel de 9 hojas.

---

## Estructura

```
backend/
  server.py            app FastAPI + routers (/api)
  auth.py              JWT, bcrypt, dependencias de rol (RBAC)
  models.py            Pydantic v2
  db.py                cliente motor, índices, seed de plantillas
  utils.py             serialización, auditoría, estado "vencida"
  labels.py            traducciones (espejo de labels.ts)
  routers/             auth, admin, clients, credit, technical,
                       construction, attachments, payments, analytics,
                       audit, backup
  exports/excel.py     respaldo de 9 hojas
  reset_admin.py       recuperación de contraseña admin
frontend/
  app/                 rutas (Expo Router, file-based)
  src/components/       DomoHeader, AttachmentsSection, StageEditor,
                        ReportResponsibleModal
  src/constants/        colors, labels, logo
  src/context/          AuthContext
  src/utils/            api, format, pdfGenerator
```
