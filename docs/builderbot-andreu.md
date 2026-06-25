# Conectar BuilderBot (WhatsApp) con Andreu Remitos

**Un solo bot** para TSB y Beraldi. La API detecta el cliente leyendo el remito (Document AI).

## Arquitectura

```
Chofer WhatsApp → BuilderBot "Andreu Remitos"
    → POST https://TU-API/api/webhooks/builderbot
    → Document AI detecta TSB o Beraldi + extrae campos
    → JSON { "message": "..." } → BB responde al chofer
    → Mesa de control: /remitos/tsb o /remitos/beraldi
```

## 1. Proyecto BuilderBot (usar este)

| Campo | Valor |
|-------|--------|
| **Nombre** | Andreu Remitos |
| **Project ID** | `aeeef7d8-024c-4aab-ba3f-d8a8fa5f193f` |

Flujos en BuilderBot (proyecto `aeeef7d8-024c-4aab-ba3f-d8a8fa5f193f`):

| Flujo | Trigger | Qué hace |
|-------|---------|----------|
| **Foto remito** | `EVENTS.MEDIA` | Foto → API → Document AI |
| **Audio chofer** | `EVENTS.VOICE_NOTE` | Nota de voz → Speech-to-Text → correcciones |
| **Bienvenida** | `EVENTS.WELCOME`, hola, ok… | Texto → API (saludo / confirmación) |
| **Ayuda remito** | remito, guía | Texto → API |

URL HTTP (todos los flujos):

```
https://logistica-andreu-remitos.wd75db.easypanel.host/api/webhooks/builderbot
```

**Deploy** → escaneá QR con el WhatsApp del bot (un solo número para todos los choferes).

## 2. URL del HTTP (obligatorio)

En el flujo **Foto remito** → editar HTTP:

```
https://TU-API-REAL/api/webhooks/builderbot
```

Reemplazá `https://CAMBIAR-TU-API` por la URL pública de Easypanel.

Body (sin `tenant` — la API lo detecta sola):

```json
{
  "eventName": "media",
  "data": {
    "from": "@phone",
    "attachment": { "url": "@attachment" },
    "name": "@name"
  }
}
```

`messageMapping`: **message**

### Flujo Audio (notas de voz)

Duplicá el HTTP de **Foto remito** con trigger `EVENTS.AUDIO` (misma URL y body):

```json
{
  "eventName": "audio",
  "data": {
    "from": "@phone",
    "attachment": { "url": "@attachment" },
    "name": "@name"
  }
}
```

La API transcribe con **Google Speech-to-Text** y procesa como mensaje de texto (correcciones km, patente, OK).

Requisito GCP: habilitar **Cloud Speech-to-Text API** en `kiev-prueba` y mismo service account con rol `roles/speech.client` o ampliar permisos.

## 3. Variables Easypanel (API)

```env
# Para que operadores respondan desde /contactos
BUILDERBOT_BOT_ID=aeeef7d8-024c-4aab-ba3f-d8a8fa5f193f
BUILDERBOT_API_KEY=tu-api-key-de-builderbot
```

Opcionales — solo si querés forzar cliente sin leer el papel:

```env
# NO hace falta si Document AI detecta bien TSB/Beraldi
# BUILDERBOT_DEFAULT_TENANT=tsb

# Solo si un chofer siempre es de un cliente (raro):
# TENANT_BY_PHONE_JSON={"5492616168767":"tsb"}
```

Volúmenes: `uploads/` + `data/`.

## 4. Probar

```bash
curl https://TU-API/api/webhooks/builderbot/health

curl -X POST https://TU-API/api/webhooks/builderbot \
  -H "Content-Type: application/json" \
  -d '{"eventName":"message","data":{"from":"5492616168767","body":"Hola"}}'
```

## 5. Checklist

- [ ] API en Easypanel con HTTPS
- [ ] GCP + Document AI (TSB y Beraldi)
- [ ] URL HTTP actualizada en BB
- [ ] Deploy + QR escaneado
- [ ] Foto TSB → respuesta + aparece en `/remitos/tsb`
- [ ] Foto Beraldi → respuesta + aparece en `/remitos/beraldi`
