# Andreu — API remitos TSB / Beraldi

Backend Fastify + Google Document AI para ingestar fotos de remitos, extraer campos y validar horarios.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/remitos/ingest` | Subir remito (`tenant` + `file`) |
| GET | `/api/remitos` | Listar remitos |
| GET | `/api/remitos/:id` | Detalle |
| PATCH | `/api/remitos/:id` | Corregir campos |

### Ingest

```bash
curl -X POST http://localhost:3001/api/remitos/ingest \
  -F "tenant=tsb" \
  -F "file=@Remito TSB 1.jpg"
```

`tenant`: `tsb` | `beraldi`

## Desarrollo local

```bash
cp backend/.env.example backend/.env   # completar credenciales GCP
npm ci --prefix backend
npm run api:dev
```

Postgres opcional (`docker compose up -d`). Sin `DATABASE_URL` usa file-store en `backend/data/`.

## Deploy en Easypanel

1. **Nuevo servicio** → GitHub → repo `andreu-remitos`
2. **Build:** Dockerfile en la raíz
3. **Puerto:** `3001`
4. **Variables de entorno** (desde `backend/.env.example`):
   - `GOOGLE_CLOUD_PROJECT`, `DOCUMENT_AI_LOCATION`
   - `DOCUMENT_AI_CUSTOM_TSB_ID`, `DOCUMENT_AI_TSB_VERSION`
   - `DOCUMENT_AI_CUSTOM_BERALDI_ID`, `DOCUMENT_AI_BERALDI_VERSION`
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` (JSON completo en una línea)
5. **Volumen persistente** (recomendado): `/app/backend/uploads` y `/app/backend/data`
6. **Postgres** (opcional): servicio aparte + `DATABASE_URL`

## Estructura

```
backend/     API Fastify
lib/         Document AI + extracción + validación horarios
scripts/gcp/ Setup processors en GCP
```
