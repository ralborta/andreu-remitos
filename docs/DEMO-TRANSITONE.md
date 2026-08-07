# Demo TransitOne

Rama **`demo`** — clon funcional de Andreu con marca TransitOne.

## Qué cambia vs Andreu prod

| | Andreu (`main`) | Demo (`demo`) |
|--|-----------------|---------------|
| Marca | Andreu / Empliados | TransitOne |
| Remitos UI | TSB, Beraldi, Corina, M&E | Solo **TransitOne** |
| OCR | Multi-tenant | Pipeline **TSB** (guías sin marca) |
| Deploy | `andreu.nivel41.com` | **Otro** dominio / servicios |
| WhatsApp | Bot Andreu | **Número y bot propios** |
| DB / volúmenes | Prod | **Aislados** |

## Deploy (sin tocar Andreu)

1. Crear en Easypanel proyecto/servicios nuevos (ej. `transitone-api`, `transitone-web`, `transitone-bot`).
2. Source: repo `andreu-remitos`, branch **`demo`**.
3. Env API (mínimo): mismas keys Document AI TSB que Andreu + DB nueva + `BAILEYS_BOT_URL` al bot demo.
4. Frontend: `API_INTERNAL_URL` al API demo.
5. Vincular WhatsApp en la pantalla de QR del **bot demo**.

## Papeles de prueba

Usar remitos formato guía TSB **sin logo/marca TSB** (editados). El OCR sigue el schema TSB; en chat/UI se muestra **TransitOne**.
