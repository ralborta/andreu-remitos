# Chat contextual POD (fase 1) — arquitectura

**Estado:** path productivo = **Desk Chat Runtime** (LLM → capabilities → LLM).  
Ver `docs/SOL-DESK-CHAT-RUNTIME.md`.  
**No** se globalizó Commander allowlist.  
**No** Tool Registry / Event Bus.  
**No** se tocaron Remitos internos.

## Objetivo

Interfaz conversacional web para consultar el agente especialista **POD** con datos reales del módulo (`pod-casos.json`), trazabilidad pregunta→plan→capabilities→respuesta, y un componente reutilizable para Viajes / Incidencias / etc.

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
     agent-chat-store                 desk-chat/runtime
     (agent-chats.json)               Pass1 plan LLM
     messages + traces                → pod.resumen|list|get
     workingSet referencial           Pass2 answer LLM
                                      (llm_error si falla; sin regex)
```

- Frontend **no** calcula KPIs ni filtra negocio: solo envía el mensaje.
- Backend ejecuta **solo** capabilities autorizadas con args validados.
- `forceEngine=rules` → legacy `answerPodFromFactsRules` **solo scripts**.
- Canal distinto al inbox WhatsApp (`conversaciones.json`).

## Endpoints

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/agents/chat` | JWT | Turno de chat. Body: `{ agentId, message, conversationId?, tenant?, context?, forceEngine? }` |
| GET | `/api/agents/chat/:conversationId` | JWT | Conversación (mensajes) |
| GET | `/api/agents/chat/:conversationId/traces` | JWT | Trazas pregunta / plan / capabilities / respuesta |

**Fase actual:** solo `agentId=pod`. Otros → `501 agente_no_habilitado`.

## Tests

```bash
node scripts/verify-pod-desk-chat-runtime.mjs   # 10 casos path productivo
node scripts/verify-pod-desk-chat.mjs           # legacy forceEngine=rules
```

## Próximos agentes

Mismo runtime + nuevo capability pack. Orden: Viajes → Incidencias → Rendición → ETA → Remitos → Chat Central.
