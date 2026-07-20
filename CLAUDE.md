# DOMO CONSTRUCTORA — App de Gestión de Clientes
## Especificación técnica v2 (lista para Claude Code)

> Este documento reemplaza al spec original. Guardarlo como `CLAUDE.md` en la raíz del proyecto para que el agente lo tenga siempre en contexto.

---

## 1. Contexto

App móvil para el control integral del cliente desde el cierre de venta hasta la entrega de la vivienda. Empresa: DOMO Constructora e Inmobiliaria (Ambato, Ecuador). Moneda: USD. Idioma: **español en toda la interfaz, mensajes, PDFs y Excel**.

Cuatro flujos de trabajo conviven sobre el mismo cliente:
- **CEO / admin** — panorama completo, KPIs, alertas de cobro
- **Asesor de crédito** — rutero con entidades financieras
- **Equipo técnico** — diseño, planos, tiempos
- **Residente de obra** — cronograma y avance en sitio

---

## 2. Stack obligatorio

| Capa | Tecnología |
|---|---|
| Frontend | Expo SDK 54+, TypeScript, Expo Router (file-based), React Native Paper |
| Backend | FastAPI, Pydantic v2, motor (MongoDB async) |
| Base de datos | MongoDB local vía `MONGO_URL` del `.env` |
| PDF | `expo-print` + templates HTML |
| Archivos | `expo-image-picker`, `expo-document-picker` |
| Excel | `openpyxl` |
| Compartir | `expo-sharing`, `expo-file-system/legacy` |
| Iconos | `@expo/vector-icons` (Ionicons) |

**Prohibido**: react-router-dom, MUI, Tailwind o cualquier librería web. Todas las rutas backend con prefijo `/api`. Nunca hardcodear URLs ni puertos. No modificar los `.env` del framework.

---

## 3. Decisiones de arquitectura (resueltas — no reabrir)

### 3.1 Adjuntos en colección separada
**No** guardar base64 dentro de `credit_processes`, `technical_processes` ni `construction_schedules`. MongoDB tiene un límite duro de 16 MB por documento y con adjuntos de hasta 6 MB se rompe rápido.

Colección `attachments`:

```
{
  _id, 
  owner_type: "credit" | "technical" | "construction" | "payment_receipt",
  client_id,
  ref_key,            // stage_key o activity_id o installment_id
  filename, mime_type, size_bytes,
  data,               // base64
  description,
  uploaded_by_id, uploaded_by_name, uploaded_at
}
```

Índice compuesto: `{client_id: 1, owner_type: 1, ref_key: 1}`.

Los documentos de proceso guardan **solo** `attachment_ids: [ObjectId]`. Los endpoints de listado **nunca** devuelven el campo `data` — se sirve por un endpoint dedicado `GET /api/attachments/{id}/content`.

Límite: 6 MB por archivo, validado en backend además del frontend.

### 3.2 Seguridad de autenticación
- Contraseñas con **bcrypt** (`passlib`). Nunca en texto plano.
- **JWT** con expiración de 7 días, refresh al abrir la app.
- Token en `expo-secure-store`, no en AsyncStorage.
- Admin único: `domo.sas.inmobiliaria@gmail.com`. Se crea en el primer registro y se bloquea cualquier intento posterior de rol admin.
- **Recuperación de admin**: comando CLI en el backend (`python -m backend.reset_admin`) que permite resetear la contraseña del admin desde el servidor. Sin esto, perder la contraseña bloquea el sistema completo.

### 3.3 Visibilidad y permisos (RBAC)
Todos los roles aprobados **ven la lista completa de clientes y sus tres procesos** (lectura global). La restricción es de **escritura**:

| Rol | Escribe en |
|---|---|
| `admin` | Todo |
| `credit_advisor` | Solo Ruta de Crédito + Plan de Pagos |
| `technical` | Solo Ruta Técnica |
| `site_manager` | Solo Cronograma de Obra |

El backend valida el rol en **cada** endpoint de escritura. No confiar en que el frontend oculte botones.

### 3.4 Moneda e impuestos
Solo **USD**. Eliminar COP/MXN del plan de pagos.

En su lugar, el plan de pagos maneja:
- `subtotal`, `iva_rate` (por defecto 0.15), `iva_amount`, `total_amount`
- Flag `aplica_iva` por cliente (algunos contratos se manejan sin desglose)

### 3.5 Estado "Vencida"
Se calcula **al vuelo** en las consultas comparando `due_date < hoy AND status != "paid"`. Sin jobs programados, sin campo persistido.

---

## 4. Modelo de datos

```
users
  _id, email, password_hash, name, role, status, created_at, updated_at
  role:   admin | credit_advisor | technical | site_manager
  status: pending | approved | rejected

clients
  _id, name, phone, email, address, payment_method, status, notes,
  created_by, created_by_name, created_at, updated_at
  payment_method: credito | efectivo
  status: activo | en_progreso | completado

credit_processes
  _id, client_id, stages: { <stage_key>: {
    status, notes, updated_by_id, updated_by_name, updated_at,
    attachment_ids: []
  }}

technical_processes    // misma estructura que credit_processes

construction_schedules
  _id, client_id, activities: [{
    id, name, status, start_date, end_date, progress, notes,
    updated_by_name, updated_at, attachment_ids: []
  }]

payment_schedules
  _id (= client_id), client_id, subtotal, iva_rate, iva_amount,
  total_amount, down_payment, num_installments, frequency,
  first_due_date, installments: [{
    id, number, amount, due_date, status, paid_date,
    receipt_attachment_id, notes
  }], created_at, updated_at
  frequency: mensual | quincenal | semanal

attachments            // ver 3.1

audit_logs
  _id, client_id, user_id, user_name, user_role, process_type,
  action, description, created_at
```

### Etapas fijas — Ruta de Crédito
`pre_calificacion`, `documentacion`, `solicitud_credito`, `avaluo`, `aprobacion`, `desembolso`, `acompanamiento`

### Etapas fijas — Ruta Técnica
`levantamiento_topografico`, `linea_fabrica`, `diseno_borrador`, `diseno_final`, `planos_hidrosanitarios`, `planos_electricos`, `calculo_estructural`, `planos_estructurales`, `socializacion_produccion`, `asignacion_residente`

Estados de etapa: `pending` | `in_progress` | `completed`. Traducir siempre a español en la UI, PDFs y Excel.

---

## 5. Módulos funcionales

### A. Gestión de clientes
Lista con búsqueda por texto (nombre / teléfono / correo), filtros por método de pago y estado, ordenamiento (recientes, antiguos, A-Z, Z-A), pull-to-refresh y FAB para agregar.

Detalle con 4 pestañas: **Info** (datos + acceso al plan de pagos), **Crédito**, **Técnico**, **Obra**.

Si el cliente es `efectivo`, la pestaña Crédito se oculta.

### B/C. Rutas de Crédito y Técnica
Cada etapa: estado, notas libres, registro automático de autor y fecha, adjuntos, botón de PDF por etapa. Botón adicional para PDF consolidado de toda la ruta.

### D. Cronograma de obra
Lista libre de actividades creadas por el residente. Cada una: nombre, estado, fecha inicio, fecha fin, % de progreso, notas, fotos de avance. Timeline visual. PDF consolidado.

**Plantillas**: el residente puede partir de una plantilla precargada de actividades típicas de vivienda (cimentación, mampostería, instalaciones, acabados) o crear desde cero. Las plantillas viven en una colección `schedule_templates` editable por el admin.

### E. Plan de pagos
Configuración: subtotal, IVA, abono inicial, número de cuotas, fecha del primer pago, frecuencia. Al guardar, se generan todas las cuotas automáticamente; cada una editable individualmente.

Estados: 🟠 Pendiente / 🟢 Pagada / 🔴 Vencida (calculada).

Al marcar como pagada se pide fecha real y comprobante (cámara, galería o PDF). Botón para ver el comprobante y botón "Revertir" para deshacer.

### F. Alertas de cobro (dashboard)
Dos tarjetas: pagos vencidos y pagos próximos (≤7 días). Click → plan de pagos del cliente.

### G. Panel ejecutivo
Chips de sección: **KPIs generales**, **Alertas** (clientes estancados sin movimiento > X días), **Timeline** (actividad de los últimos 30 días).

Bloque "Gestión de Cobros": total cobrado / pendiente / vencido, % de cobro sobre el total, % de cumplimiento (cuotas pagadas en fecha o antes), top 5 clientes con atrasos.

### H. Reportes PDF
Por etapa individual y consolidados por proceso. Todos con logo DOMO en el encabezado (base64 en `src/constants/logo.ts`), colores corporativos, datos del cliente, modal previo que pide responsable y fecha (opcional), y líneas de firma al final.

### I. Auditoría
Cada acción de escritura registra automáticamente en `audit_logs`. Pantalla de historial por cliente.

### J. Respaldo Excel (solo admin)
Archivo `.xlsx` con 9 hojas: Resumen, Clientes, **Detalle por Cliente** (bloque consolidado por cliente con colores y emojis por sección), Ruta Crédito, Ruta Técnica, Cronograma Obra, Plan de Pagos, Usuarios, Auditoría (últimos 2.000 registros).

Todo traducido al español. **Excluir campos base64.** Descarga directa en web, `expo-sharing` en móvil.

---

## 6. Diseño

**Paleta**
- Azul principal `#1A3A6B` — headers, elementos primarios
- Naranja secundario `#F57C00` — acciones principales, FAB
- Verde `#4CAF50` — pagado, completado
- Rojo `#D32F2F` — vencido, error, eliminar
- Naranja alerta `#FF9800` — pendiente, en progreso

**Reglas**: mobile-first, tarjetas con elevación, `borderRadius` 10–12, touch targets ≥ 44 px, spacing en múltiplos de 8. Componente reusable `<DomoHeader>` con logo en pantallas principales.

Tabs del dashboard: Inicio / Clientes / KPIs / Usuarios (solo admin) / Perfil.

---

## 7. Estructura de carpetas

```
/app
├── backend/
│   ├── server.py            # app FastAPI, routers
│   ├── auth.py              # JWT, bcrypt, dependencias de rol
│   ├── models.py            # Pydantic
│   ├── db.py                # cliente motor, índices
│   ├── routers/             # clients, credit, technical, construction,
│   │                        # payments, attachments, analytics, admin
│   ├── exports/excel.py     # openpyxl
│   ├── reset_admin.py       # recuperación de contraseña admin
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx                        # login + registro
    │   ├── add-client.tsx
    │   ├── dashboard/
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx
    │   │   ├── clients.tsx
    │   │   ├── kpis.tsx
    │   │   ├── users.tsx
    │   │   └── profile.tsx
    │   ├── client-detail/[id].tsx
    │   ├── update-credit-stage/[clientId]/[stage].tsx
    │   ├── update-technical-stage/[clientId]/[stage].tsx
    │   ├── construction-schedule/[clientId].tsx
    │   ├── payment-schedule/[client_id].tsx
    │   └── audit-logs/[clientId].tsx
    └── src/
        ├── components/   DomoHeader, AttachmentsSection, ReportResponsibleModal
        ├── constants/    logo.ts, colors.ts, labels.ts
        ├── context/      AuthContext.tsx
        └── utils/        pdfGenerator.ts, api.ts, format.ts
```

`labels.ts` centraliza **todas** las traducciones de claves técnicas a español. Un solo lugar, usado por UI, PDFs y (replicado) por el generador de Excel.

---

## 8. Endpoints (`/api`)

**Auth** — `POST /auth/login`, `POST /auth/register`, `GET /auth/admin-exists`, `GET /auth/me`

**Users** — `GET /admin/users`, `GET /admin/pending-users`, `PUT /admin/users/{id}/approve`, `PUT /admin/users/{id}/reject`, `PUT /admin/users/{id}`, `DELETE /admin/users/{id}`, `PUT /users/{id}/profile`

**Clients** — `GET|POST /clients`, `GET|PUT|DELETE /clients/{id}`

**Crédito** — `GET /clients/{id}/credit`, `PUT /clients/{id}/credit/{stage}`

**Técnico** — `GET /clients/{id}/technical`, `PUT /clients/{id}/technical/{stage}`

**Obra** — `GET /clients/{id}/construction`, `POST /clients/{id}/construction/activities`, `PUT|DELETE /clients/{id}/construction/activities/{activity_id}`, `GET /schedule-templates`

**Pagos** — `POST|GET|DELETE /payment-schedule/{client_id}`, `PUT /payment-schedule/{client_id}/installment/{inst_id}`, `GET /payments/upcoming?days=7`

**Adjuntos** — `POST /attachments`, `GET /attachments?client_id=&owner_type=&ref_key=`, `GET /attachments/{id}/content`, `DELETE /attachments/{id}`

**Analytics** — `GET /analytics/kpis`, `/analytics/stalled-clients`, `/analytics/timeline?days=30`, `/analytics/payment-kpis`

**Auditoría** — `GET /audit-logs/{client_id}`

**Respaldo** — `GET /backup/export-excel`

---

## 9. Orden de implementación

| Fase | Contenido | Criterio de cierre |
|---|---|---|
| 1 | Setup, auth con bcrypt+JWT, admin único, aprobación de usuarios | Admin entra y aprueba un usuario de cada rol |
| 2 | CRUD de clientes con búsqueda, filtros y ordenamiento | 3 clientes reales cargados |
| 3 | Ruta de Crédito + Ruta Técnica con RBAC real | Cada rol edita solo lo suyo; los demás reciben 403 |
| 4 | Cronograma de obra + plantillas | Residente arma un cronograma desde plantilla |
| 5 | Auditoría automática en todo cambio | Historial completo visible por cliente |
| 6 | Colección `attachments` + componente reusable | Foto, galería y PDF en las tres rutas |
| 7 | Plan de pagos con IVA, cuotas y comprobantes | Cuota marcada como pagada con comprobante y revertible |
| 8 | Alertas de cobro en dashboard | Vencidos y próximos con navegación directa |
| 9 | Panel ejecutivo (KPIs, estancados, timeline, cobros) | Todos los KPIs cuadran con los datos reales |
| 10 | PDFs con marca DOMO | PDF por etapa y consolidado en las tres rutas |
| 11 | Respaldo Excel de 9 hojas | Archivo legible, en español, sin base64 |

**Cerrar cada fase antes de abrir la siguiente.** Al terminar cada una, correr la app y validar el criterio de cierre manualmente.

---

## 10. Criterio de éxito global

1. El CEO entra como admin y aprueba 4 usuarios, uno por rol.
2. Los asesores cargan 3 clientes reales.
3. Cada rol actualiza únicamente sus propias etapas; el backend rechaza lo demás.
4. Se configura un plan de pagos, se marcan cuotas como pagadas con comprobante y se revierte una.
5. El admin ve KPIs en tiempo real y las alertas de vencidos y próximos.
6. Todos generan PDFs por etapa y consolidados con marca DOMO.
7. El admin descarga el respaldo Excel con las 9 hojas ordenadas y legibles.

---

## 11. Extras para después del MVP

Compartir plan de pagos por WhatsApp (deep link), plan de pagos en PDF, filtro de clientes por estado de cobranza, calendario mensual de pagos, login biométrico, notificaciones push (requiere build nativo), migración de adjuntos a S3 o Cloudinary cuando el volumen lo pida.
