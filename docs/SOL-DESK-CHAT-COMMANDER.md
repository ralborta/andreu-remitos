# Desk Chat — Chat Central Commander (mesa web)

**Rama:** `demo` · TransitOne  
**Runtime:** el mismo `backend/src/services/desk-chat/runtime.mjs` (no hay segundo runtime).  
**Tip:** `776489c`

## Flujo obligatorio

```
Pregunta operador
  → LLM Planner (elige 1..N capabilities del catálogo)
  → executeCapabilitiesParallel (autoriza + valida schema + timeout)
  → LLM Synthesis (grounded; parciales si alguna falla)
  → agent-chat-store (workingSet multi-dominio + traces)
```

Prohibido en path productivo: keywords, regex, includes, switch, árboles, fallback a reglas.

`agentId=commander` = interfaz transversal. El backend **no** interpreta semántica: solo autoriza/valida/ejecuta.

## Grounding relacional

Cross-domain viaje↔X **solo** vía `commander.relacionar_viajes` (match por `viaje_ref` / `viaje` en stores).  
Si no hay campo verificable (p.ej. remitos): `relationAvailable=false` → respuesta fija grounded, sin invención Pass2.

## WorkingSet multi-dominio

Tras resumen/joins se persisten (sin dumps): `domains.{agente}.{entityIds,capability,filters,goal}`, `relations[]` verificadas, `agentId`, `lastGoal`.

## Alcance etapa

- Read-only
- Un dominio o multiagente en paralelo
- Follow-ups + workingSet referencial
- Resultados parciales / timeout por capability
- Sin Tool Registry general, Event Bus ni mutaciones

WhatsApp `lib/commander` es otro camino (BAILEYS); este chat no lo reemplaza.
