# Andreu — bot WhatsApp (Baileys)

Bot self-hosted dentro del monorepo Andreu. Reenvía mensajes e imágenes a la API (`/api/webhooks/builderbot`) y envía respuestas cuando la API lo pide.

## Requisitos

- Node 20+
- API Andreu corriendo (`npm run api:dev` en la raíz)

## Desarrollo local

```bash
cp bot/.env.example bot/.env
npm ci --prefix bot
npm run bot:dev
```

1. Escaneá el QR que aparece en la consola.
2. Mandá una foto de remito al número conectado.
3. La API procesa con Document AI y responde al chofer.

## Variables

| Variable | Descripción |
|----------|-------------|
| `ANDREU_API_URL` | API Fastify (local: `http://localhost:3001`) |
| `BOT_PUBLIC_URL` | URL para que la API descargue adjuntos (local: `http://localhost:3008`) |
| `BAILEYS_BOT_URL` | *(en la API)* URL de este bot para envíos salientes |

En **Easypanel**, servicio aparte `andreu-bot`:

```env
PORT=3008
ANDREU_API_URL=http://andreu-remitos:3001
BOT_PUBLIC_URL=http://andreu-bot:3008
```

En la **API** (`andreu-remitos`), agregar:

```env
BAILEYS_BOT_URL=http://andreu-bot:3008
BUILDERBOT_WEBHOOK_SILENT=false
```

Volúmenes recomendados:
- `/app/andreu_sessions` — sesión WhatsApp (no perder QR)
- `/app/data` — `db.json` del bot

## Endpoints HTTP

| Ruta | Uso |
|------|-----|
| `GET /health` | Health check |
| `POST /v1/messages` | Envío desde la API |
| `POST /v1/blacklist` | Pausar bot por número |
| `GET /v1/files/:id` | Adjuntos temporales (interno) |

## Convivencia con BuilderBot Cloud

Podés migrar gradualmente:

1. Levantá el bot Baileys en paralelo con otro número de prueba.
2. Configurá `BAILEYS_BOT_URL` en la API.
3. Cuando esté estable, apagá BBC en prod.

Guía completa: [docs/builderbot-andreu.md](../docs/builderbot-andreu.md)
