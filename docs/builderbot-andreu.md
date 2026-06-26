# BuilderBot Andreu — patrón Mis Reclamos

**Un bot, TSB + Beraldi.** La IA conversa en WhatsApp; el backend recibe copia por **webhook de proyecto** (sin HTTP en flujos).

## Arquitectura (igual que Mis Reclamos)

```
Chofer WhatsApp
    ↓
BuilderBot Cloud (agente IA add_chatpdf)
    ├── EVENTS.WELCOME  → presentación
    ├── EVENTS.ACTION   → conversación + fotos (interpretMultimedia)
    └── EVENTS.VOICE_NOTE → transcribe → ACTION
    ↓ (webhook de proyecto, silencioso)
POST https://logistica-andreu-remitos.wd75db.easypanel.host/api/webhooks/builderbot
    → Document AI + guardar remito + inbox /contactos
    → respuesta { received: true } — NO manda texto al chofer
```

| Capa | Responsabilidad |
|------|-----------------|
| **BuilderBot IA** | Hablar con el chofer, leer foto, verificar datos, correcciones |
| **Webhook API** | OCR (Document AI), persistir remito, historial para mesa de control |

## 1. Proyecto BuilderBot

| Campo | Valor |
|-------|--------|
| **Nombre** | Andreu Remitos |
| **Project ID** | `aeeef7d8-024c-4aab-ba3f-d8a8fa5f193f` |

### Flujos (3 — sin add_http)

| Flujo | Trigger | Bloque |
|-------|---------|--------|
| **Mensaje Inicial** | `EVENTS.WELCOME` | `add_chatpdf` (presentación corta) |
| **Conversación remitos** | `EVENTS.ACTION` | `add_chatpdf` + `assistantInterpretMultimedia: true` |
| **Transcribe voz** | `EVENTS.VOICE_NOTE` | `transcribeAudio` + `listenKeywords` (sin respuestas; pasa a ACTION) |

Referencia: bot **Mis Reclamos** `d7e09f82-a980-4ed9-853c-ca44d1fa266a` (misma estructura).

## 2. Webhook de proyecto (obligatorio — igual que Mis Reclamos)

En BuilderBot → proyecto **Andreu Remitos** → **Desarrollador → Webhooks**:

| Evento | URL |
|--------|-----|
| `message.incoming` | `https://logistica-andreu-remitos.wd75db.easypanel.host/api/webhooks/builderbot` |
| `message.outgoing` | misma URL |

Payload real de BuilderBot (no el body manual de add_http):

```json
{
  "eventName": "message.incoming",
  "data": {
    "body": "texto o _event_image__...",
    "from": "5492616168767",
    "name": "Juan",
    "attachment": [{ "url": "https://...", "mimetype": "image/jpeg" }],
    "urlTempFile": "https://..."
  }
}
```

- **`urlTempFile`**: URL temporal del archivo (fotos de remito) — la usa el backend para OCR.
- **`attachment`**: array de adjuntos (no un objeto suelto).
- **`message.outgoing`**: respuestas del agente IA → se guardan en `/contactos`.

Referencia: `MisReclamos/src/app/api/whatsapp/inbound/route.ts`

## 3. Variables Easypanel (API `andreu-remitos`)

```env
BUILDERBOT_BOT_ID=aeeef7d8-024c-4aab-ba3f-d8a8fa5f193f
BUILDERBOT_API_KEY=tu-api-key-de-builderbot
BUILDERBOT_WEBHOOK_SILENT=true
```

`BUILDERBOT_WEBHOOK_SILENT=true` (default): el backend procesa pero no devuelve texto — la IA ya respondió.

Volúmenes: `uploads/` + `data/`.

## 4. Probar

```bash
curl https://logistica-andreu-remitos.wd75db.easypanel.host/api/webhooks/builderbot/health

# Simula webhook de proyecto (solo procesamiento, sin respuesta al chofer)
curl -X POST https://logistica-andreu-remitos.wd75db.easypanel.host/api/webhooks/builderbot \
  -H "Content-Type: application/json" \
  -d '{"eventName":"message","data":{"from":"5492616168767","body":"Hola"}}'
```

Prueba real: mandá foto de remito por WhatsApp → la IA debe responder en el chat y el remito debe aparecer en `/remitos`.

## 5. Checklist

- [ ] Webhook de proyecto configurado en BB (no HTTP en flujos)
- [ ] 3 flujos: WELCOME + ACTION + VOICE_NOTE
- [ ] API en Easypanel con GCP + Document AI
- [ ] `BUILDERBOT_BOT_ID` + `BUILDERBOT_API_KEY` en API
- [ ] Deploy BB + QR escaneado (bot ONLINE)
- [ ] Foto TSB → IA responde + remito en `/remitos/tsb`
