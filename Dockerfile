# DOMO Constructora — imagen única: build web de Expo + API FastAPI.
# Un solo servicio que sirve la app web y la API en la misma URL.

# ---------- Etapa 1: build del frontend web ----------
FROM node:20-slim AS webbuild
WORKDIR /app/frontend

# Instalar dependencias (con caché de capa).
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund

# Copiar el resto y exportar la web estática.
COPY frontend/ ./
# No hornear EXPO_PUBLIC_API_URL: en runtime la web usa el mismo origen.
RUN npx expo export --platform web --output-dir dist

# ---------- Etapa 2: backend + estáticos ----------
FROM python:3.11-slim
WORKDIR /app

# Dependencias del backend.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Código del backend.
COPY backend/ ./backend/

# Build web desde la etapa anterior.
COPY --from=webbuild /app/frontend/dist ./frontend/dist
ENV WEB_DIST_DIR=/app/frontend/dist
ENV PORT=8000

WORKDIR /app/backend
# Render/Railway inyectan $PORT; se expande en forma shell.
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
