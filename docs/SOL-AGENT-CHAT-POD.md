# Chat contextual POD (fase 1) — arquitectura

**Estado:** chat de mesa POD funcional en UI + API.  
**No** se globalizó Commander allowlist.  
**No** Tool Registry / Event Bus.  
**No** se tocaron Remitos internos.

## Objetivo

Interfaz conversacional web para consultar el agente especialista **POD** con datos reales del módulo (`pod-casos.json`), trazabilidad pregunta→agente→respuesta, y un componente reutilizable para Viajes / Incidencias / etc.

## Arquitectura

```
UI /agentes/pod
  PodPanel (casos)     PodAgentChat → AgentChat (reutilizable)
                              │
                              ▼
                   POST /api/agents/chat
                     agentId, message, conversationId?, tenant?, user(JWT)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     agent-chat-store                 pod-desk-chat
     (agent-chats.json)               buildPodDeskFacts ← pod-store
     messages + traces                LLM (opcional) | rules_fallback
```

- Frontend **no** calcula KPIs ni filtra negocio: solo envía el mensaje.
- Backend carga hechos del **store POD real** (`dataSource: "real"`).
- Si un dato faltara / fuera demo en el futuro, debe marcarse `dataSource: "demo"` y no mezclarse sin etiqueta.
- Canal distinto al inbox WhatsApp (`conversaciones.json`).

## Endpoints

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/agents/chat` | JWT | Turno de chat. Body: `{ agentId, message, conversationId?, tenant?, context?, forceEngine? }` |
| GET | `/api/agents/chat/:conversationId` | JWT | Conversación (mensajes) |
| GET | `/api/agents/chat/:conversationId/traces` | JWT | Trazas pregunta / agente / respuesta |

**Fase 1:** solo `agentId=pod`. Otros → `501 agente_no_habilitado`.

Respuesta POST (resumen):

```json
{
  "conversationId": "ach_…",
  "agentId": "pod",
  "user": { "id", "username", "nombre" },
  "message": {
    "role": "assistant",
    "text": "…",
    "engine": "llm|rules_fallback",
    "dataSources": ["real"],
    "citedIds": ["POD-…"]
  },
  "traceId": "tr_…"
}
```

## Archivos

| Archivo | Rol |
|---------|-----|
| `backend/src/db/agent-chat-store.mjs` | Persistencia conversaciones + traces |
| `backend/src/services/pod-desk-chat.mjs` | Hechos POD + respuesta LLM/rules |
| `backend/src/routes/agent-chat.mjs` | HTTP chat agentes |
| `backend/src/server.mjs` | Registro `/api/agents/chat` |
| `frontend/src/components/AgentChat.tsx` | UI chat reutilizable |
| `frontend/src/components/PodAgentChat.tsx` | Binding POD |
| `frontend/src/components/AgentData.tsx` | Layout panel + chat en `/agentes/pod` |
| `frontend/src/lib/api.ts` | `postAgentChat` / get / traces |
| `scripts/verify-pod-desk-chat.mjs` | Casos mínimos sin HTTP |
| `docs/SOL-AGENT-CHAT-POD.md` | Este doc |

## Casos mínimos (verificados)

1. ¿cuántos POD recibimos hoy?
2. ¿cuántos están pendientes?
3. ¿cuáles fueron rechazados?
4. ¿por qué se rechazó este POD? (+ código)
5. mostrame los últimos 10
6. ¿qué viaje corresponde a este POD?
7. Follow-up: ¿y de esos cuáles son de Córdoba?

```bash
node scripts/verify-pod-desk-chat.mjs
```

## Próximos agentes (mismo patrón)

Repetir: `*-desk-chat.mjs` grounded en el store del módulo + habilitar `agentId` en `SUPPORTED` + `*AgentChat.tsx`.

Orden sugerido: Viajes → Incidencias → Rendición → ETA → Remitos (sin tocar pipeline interno de Remitos más de lo necesario para Q&A de mesa).
