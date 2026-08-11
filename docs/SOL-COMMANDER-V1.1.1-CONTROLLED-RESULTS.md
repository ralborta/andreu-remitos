# SOL Commander v1.1.1 — resultados controlados TransitOne

**Fecha:** 2026-08-11T21:57:30Z  
**Commit:** `ec8b7c54272e881326f55757525ede03562bc224`  
**Allowlist:** sin cambio (9 subjects, `mode=list`) — **no global**

## Totales

**14 / 15 PASS** · **1 FAIL (C5)**

## Casos base (9)

| ID | Resultado | Completion | Stack final |
|----|-----------|------------|-------------|
| C1 remito→lateral→resume | PASS | manual_resume | 0 |
| C2 confirmación→lateral→volver | PASS | manual_resume_confirm | 0 |
| C3 viaje→incidencia→volver | PASS | explicit_resume | 0 |
| C4 reclamo multi-turno nested→resume_until original | **PASS** | resume_until_original | 0 |
| C5 nested + 3er bloqueado | **FAIL** | max_depth | 2 |
| C6 dejemos eso | PASS | explicit_cancel | 0 |
| C7 human takeover | PASS | human_takeover | 1 |
| C8 child legacy sin auto pop | PASS | legacy_no_auto_pop | ≥1 |
| OFF fuera allowlist | PASS | decideV1 | 0 |

## Casos v1.1.1 (extras)

| ID | Resultado | Notas |
|----|-----------|-------|
| X1 nested depth2 + resume_until original | PASS | API: pops trazados hasta viaje |
| X2 completed + resumePolicy=auto | PASS | contrato → auto resume |
| X3 waiting_user sin pop | PASS | stack intacto |
| X4 failed sin pop destructivo | PASS | status=failed, stack intacto |
| X5 resumeTarget inexistente | PASS | reject `process_not_found` |
| X6 restart stack anidado | PASS | JSON depth=2 |

## C5 — por qué falla

El segundo lateral (reclamo) vía webhook no siempre alcanza `stackDepth=2` (clasificación/intent en el momento). El criterio `d2>=2 && d3===d2` falla.  
**Mitigación evidenciada:** X1 cubre nested depth=2 + `resume_until` al padre original por API (determinístico).

## Criterio ALLOWLIST=*

| Requisito | Estado |
|-----------|--------|
| 100% casos controlados | **No** (14/15) |
| 0 padres incorrectamente reanudados | OK en casos PASS (C4/X1) |
| 0 auto-resume por heurística | OK (solo contrato) |
| Estado final trazable | OK |

→ **No autorizar `ALLOWLIST=*` todavía.**

## Rollback

`SOL_COMMANDER_V1_1_INTERRUPT=false` + restart.
