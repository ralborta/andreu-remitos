# Desk Chat — Chat Central Commander (mesa web)

**Rama:** `demo` · TransitOne  
**Runtime:** el mismo `backend/src/services/desk-chat/runtime.mjs` (no hay segundo runtime).

## Flujo obligatorio

```
Pregunta operador
  → LLM Planner (elige 1..N capabilities del catálogo)
  → executeCapabilitiesParallel (autoriza + valida schema + timeout)
  → LLM Synthesis (grounded; parciales si alguna falla)
  → agent-chat-store (workingSet + traces)
```

Prohibido en path productivo: keywords, regex, includes, switch, árboles, fallback a reglas.

`agentId=commander` = interfaz transversal. El backend **no** interpreta semántica: solo autoriza/valida/ejecuta.

## Alcance etapa

- Read-only
- Un dominio o multiagente en paralelo
- Follow-ups + workingSet referencial
- Resultados parciales / timeout por capability
- Sin Tool Registry general, Event Bus ni mutaciones

WhatsApp `lib/commander` es otro camino (BAILEYS); este chat no lo reemplaza.
