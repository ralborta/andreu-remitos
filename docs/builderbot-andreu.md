# Conectar BuilderBot (WhatsApp) con Andreu Remitos

Flujo igual al CRM viejo (Arianna): chofer manda foto → bot responde con datos leídos → mesa de control revisa en la web.

## Arquitectura

```
Chofer WhatsApp
    → BuilderBot Cloud (Arianna TSB o Beraldi)
    → POST https://TU-API/api/webhooks/builderbot
    → Document AI + validación
    → JSON { "message": "..." } → BB responde al chofer
    → Remito + conversación guardados en API
    → Mesa de control: /remitos/tsb o /remitos/beraldi
```

## 1. Variables en Easypanel (API)

```env
BUILDERBOT_DEFAULT_TENANT=tsb
# O por chofer:
# TENANT_BY_PHONE_JSON={"5492616168767":"tsb","5492634890963":"beraldi"}
```

Si usás **dos bots** (recomendado, como el CRM viejo):
- Bot **Arianna TSB** → `BUILDERBOT_DEFAULT_TENANT=tsb` en el servicio API **o** `tenant: "tsb"` en el body del HTTP de BB
- Bot **Arianna Beraldi** → `tenant: "beraldi"` en el HTTP de BB

Volúmenes persistentes: `uploads/` y `data/` (fotos + remitos + conversaciones).

## 2. Proyectos BuilderBot

Ya creados en tu cuenta BuilderBot:

| Bot | Project ID | Tenant |
|-----|------------|--------|
| **Andreu - Arianna TSB** | `93d47395-0d86-42ef-952b-a42cc35a2049` | `tsb` |
| **Andreu - Arianna Beraldi** | `52b50c11-62c7-4800-8694-e3d91bfbeb5b` | `beraldi` |

Flujos incluidos: **Bienvenida** + **Foto remito** (`EVENTS.MEDIA` → HTTP).

**Importante:** en cada bot, editá la URL del HTTP `Foto remito` y reemplazá `https://CAMBIAR-TU-API` por tu API real de Easypanel.

En cada proyecto, **Deploy** → escaneá QR con el WhatsApp del bot.

## 3. Flujos en BuilderBot

### A) Bienvenida (`bienvenida_remitos`)

- **Keywords:** `EVENTS.WELCOME`, `hola`, `buenas`
- **Respuesta:** `add_text`
- **Mensaje:**
  ```
  Hola 👋 Soy Arianna, asistente de remitos TSB.
  Por favor, enviame una *foto clara del remito* de tu viaje.
  ```
  (Cambiar TSB/Beraldi según el bot.)

### B) Foto remito (`foto_remito`) — **el importante**

- **Keywords:** `EVENTS.MEDIA`
- **interpretImage:** `false` (la IA la hace nuestra API)
- **Respuesta:** `add_http`

Configuración HTTP:

| Campo | Valor |
|-------|--------|
| URL | `https://TU-API/api/webhooks/builderbot` |
| Method | `POST` |
| Headers | `Content-Type: application/json` |
| Body | ver abajo |
| rules | `[]` (obligatorio) |
| messageMapping | `message` |

**Body (TSB):**
```json
{
  "eventName": "media",
  "data": {
    "from": "@phone",
    "attachment": { "url": "@attachment" },
    "tenant": "tsb",
    "name": "@name"
  }
}
```

**Body (Beraldi):** igual con `"tenant": "beraldi"`.

> Si `@phone` / `@attachment` no funcionan en tu versión de BB, probá `{{phone}}` / `{{attachment}}` o reenviá el payload completo que BB muestre en logs.

### C) Texto sin foto (`ayuda_remito`)

- **Keywords:** `remito`, `guia`, `guía`
- **Respuesta:** `add_text` — "Enviame una *foto* del remito, no texto."

## 4. Probar el webhook

```bash
# Health
curl https://TU-API/api/webhooks/builderbot/health

# Simular texto
curl -X POST https://TU-API/api/webhooks/builderbot \
  -H "Content-Type: application/json" \
  -d '{"eventName":"message","data":{"from":"5492616168767","body":"Hola"}}'

# Simular foto (URL pública de imagen de prueba)
curl -X POST https://TU-API/api/webhooks/builderbot \
  -H "Content-Type: application/json" \
  -d '{"eventName":"media","data":{"from":"5492616168767","tenant":"tsb","attachment":{"url":"https://..."}}}'
```

## 5. APIs útiles

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/webhooks/builderbot` | BuilderBot |
| GET | `/api/webhooks/builderbot/health` | Ping |
| GET | `/api/conversaciones` | Listado chats (como Contactos) |
| GET | `/api/conversaciones/:telefono` | Historial (como "Mensajes") |

## 6. Respuesta al chofer (formato CRM)

```
Empresa: TSB
Nro Remito: 0117245
Chasis: AG914LF
Acoplado: AC317RI
Origen: PROSIL
Destino: PLUSPETROL - PAD B5
Fecha: 11/06/26
Peso: 29620

✅ Recibido — queda en revisión de mesa de control.
Buen viaje!
```

## 7. Checklist producción

- [ ] API desplegada con URL pública HTTPS
- [ ] Variables GCP + Document AI en Easypanel
- [ ] Volúmenes `uploads` + `data`
- [ ] Flujo `EVENTS.MEDIA` + `add_http` en BB
- [ ] `messageMapping: message` en el HTTP
- [ ] QR escaneado / WhatsApp conectado
- [ ] Prueba: foto real → respuesta con datos → aparece en `/remitos/tsb`
