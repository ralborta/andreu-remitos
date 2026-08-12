# Desk Chat Runtime — etapa Runtime + POD

**Rama:** `demo`  
**Estado:** Runtime compartido + pack POD + path productivo sin heurísticas.

## Flujo productivo

```
UI AgentChat (agentId=pod)
  → POST /api/agents/chat
  → resolvePodDeskAnswer  (NO forceEngine)
  → runDeskChatTurn
       Pass 1 LLM → plan JSON
       → executeCapabilitiesParallel (pod.*)
       Pass 2 LLM → reply grounded
  → agent-chat-store (workingSet referencial + traces)
```

Si el LLM falla → `engine: llm_error` y mensaje honesto.  
**Nunca** se activa `rules_fallback` automáticamente.

`forceEngine=rules` queda solo para scripts/regresión legacy (`answerPodFromFactsRules`).

## Capabilities POD

| name | args (schema estricto) | resultado |
|------|------------------------|-----------|
| `pod.resumen` | `{}` | conteos + recibidosHoy |
| `pod.list` | `estado?`, `destinoContains?`, `recibidosHoy?`, `ids?`, `workingSetOnly?`, `limit?` | items + entityIds |
| `pod.get` | `id?` \| `codigo?` | detalle (notas, viaje, historial) |

Todas: `readOnly=true`, `requiredPermissions: ["desk:read"]`.

## WorkingSet

```json
{
  "entityType": "pod",
  "entityIds": ["POD-…"],
  "filters": {},
  "lastGoal": "…",
  "lastCapability": "pod.list",
  "label": "…",
  "podIds": ["…"]
}
```

Sin dumps de resultados en el contexto.

## Archivos

| Path | Rol |
|------|-----|
| `backend/src/services/desk-chat/schemas.mjs` | plan/args/workingSet |
| `backend/src/services/desk-chat/capability-registry.mjs` | registro + validate + execute |
| `backend/src/services/desk-chat/openai.mjs` | cliente JSON |
| `backend/src/services/desk-chat/runtime.mjs` | 2-pass |
| `backend/src/services/desk-chat/capabilities/pod.mjs` | pack POD |
| `backend/src/services/desk-chat/index.mjs` | bootstrap |
| `backend/src/services/pod-desk-chat.mjs` | fachada POD + legacy rules |
| `backend/src/routes/agent-chat.mjs` | traces enriquecidas |
| `scripts/verify-pod-desk-chat-runtime.mjs` | 10 tests POD |
| `scripts/verify-pod-desk-chat.mjs` | legacy rules (forceEngine) |

## Tests

```bash
node scripts/verify-pod-desk-chat-runtime.mjs
node scripts/verify-pod-desk-chat.mjs   # legacy forceEngine=rules
```

## No incluido (siguiente etapa)

_(ninguno — especialistas + Chat Central Commander en mesa web)_

WhatsApp Commander (`lib/commander`) es un camino distinto; el Chat Central desk **no** lo reemplaza ni lo enciende.
