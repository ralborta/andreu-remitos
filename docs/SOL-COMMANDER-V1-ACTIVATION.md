# Activación SOL Commander V1 — TransitOne (demo)

**Fecha:** 2026-08-11  
**Servicio:** `transitone` / `transitone-remitos`  
**Andreu / logistica:** no tocado  
**v1.1 / Tool Registry / Event Bus / handoffs:** no iniciados

## Configuración activa

| Flag | Valor |
|------|-------|
| `SOL_COMMANDER_V1` | **true** |
| `SOL_COMMANDER_SHADOW` | **true** |

Health: `sol_commander_v1: true`, `sol_commander_shadow: true`  
Rollback inmediato: `SOL_COMMANDER_V1=false` + restart (sin redeploy GitHub que pise env).

**Nota operativa:** un `deploy_service` desde Git puede dejar el panel con `V1=false` si el env del deploy no trae el override. Tras activar, preferir `set_env_var` + `restart_service`.

## Código de soporte (observación)

Commit `5ff04cb` — V1 path arma shadow observation (`decideMs`, sticky, parity vs flow del executor) y fallback a legacy si `decide`/executor lanzan.

## Prueba operativa controlada (5 casos)

Artefacto: `data/commander-v1-activation-results.json`

| ID | Caso | Flow | Decisión | Sticky | Parity | decideMs |
|----|------|------|----------|--------|--------|----------|
| T01 | viaje | viajes_error* | viaje/viajes/run_agent | — | true | 1489 |
| T02 | chat | intent_clarificar | chat/router/ask_clarification | — | true | 894 |
| T03 | reclamo | reclamo_dialogo | reclamo/reclamos/run_agent | — | true | 1095 |
| T04 | remito `ok` | **confirmado** | remito/remitos/run_agent | remito_revision | true | 863 |
| T05 | rendición | rendicion_error* | rendicion/rendicion/run_agent | sticky:rendicion | true | 625 |

\* `*_error` = fallo de envío WhatsApp a números de prueba (`Cannot read properties of undefined (reading 'id')` en Baileys) — **preexistente / canal**, no divergencia de routing Commander. T04 Remitos `confirmado` demuestra efecto executor correcto.

### Totales

- Casos: **5**
- Parity OK: **5 / 5**
- Divergencias agent: **0**
- Divergencias action: **0**
- Errores Commander V1 → fallback legacy: **0**
- Latencia decide: avg **~993 ms**, max **1489 ms**

### Sticky observados

- T04: `processBinding=true`, `processType=remito_revision`, executor `remitos_texto` → flow `confirmado`
- T05: `sticky:rendicion`

## Criterio de rollback (no disparado)

No hubo:
- divergencia de agent/action operativa
- error Commander con necesidad de fallback
- regresión Remitos (confirmación OK vía sticky)

**V1 permanece ON** con shadow de observación. No se inicia v1.1.
