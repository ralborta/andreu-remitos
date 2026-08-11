# Resultados — Protocolo Shadow Commander v1.0.1

**Fecha:** 2026-08-11T18:58–18:59Z  
**Commit:** `592a08e` — Fix(SOL): Commander v1.0.1 — parity semántico de process binding.  
**Entorno:** `transitone-remitos`  
**Flags:** `SOL_COMMANDER_V1=false` · `SOL_COMMANDER_SHADOW=true` (sin cambios)  
**Andreu / logistica:** no tocado

## Resumen

| Métrica | v1.0.0 (antes) | v1.0.1 (ahora) |
|---------|----------------|----------------|
| Escenarios / pasos | 13 / 16 | 13 / 16 |
| Parity OK | 8 | **13** |
| Divergencias | 8 | **3** |
| Divergencias de **agente** | 0 | **0** |
| Divergencias de **action** | 8 | **0** |
| Critical | 0 | **0** |
| V1 activado | no | **no** |

**Veredicto frente al criterio de activación:**  
- 0 divergencias de agente ✓  
- 0 divergencias de action que alteren ejecución ✓  
- 3 restantes = solo label `intent` (`chat` vs `remito`) con mismo `agentId=remitos` y `action=run_agent` → telemetría sin efecto operativo ✓  

**No se activa V1** hasta nueva aprobación explícita.

## Tabla por escenario

| ID | Input | Proceso / policy | Legacy | Commander | Parity | Div. |
|----|-------|------------------|--------|-----------|--------|------|
| S01 | viaje simple | sticky viaje* | viaje/viajes/run_agent | viaje/viajes/run_agent | true | — |
| S02 | cuanto sale el flete? | sticky:viaje_pending | viaje/viajes/run_agent | viaje/viajes/run_agent | true | — |
| S03 | semi remolque AH318WB | sticky:rendicion (AS-IS) | rendicion/…/run_agent | rendicion/…/run_agent | true | — |
| S04 | pinchazo en la ruta | sticky:incidencia_parece | incidencia/…/run_agent | incidencia/…/run_agent | true | — |
| S05 | si esta bien creo | sticky:remito_revision | remito/remitos/run_agent | remito/remitos/run_agent | true | — |
| S06 | no, esta mal | sticky:remito_revision | remito/remitos/run_agent | remito/remitos/run_agent | true | — |
| S07 | ok | sticky:remito_revision | remito/remitos/run_agent | remito/remitos/run_agent | true | — |
| S07 | dale | (post-confirmado) | remito/remitos/run_agent | chat/remitos/run_agent | false | intent |
| S07 | porfa | (post-confirmado) | remito/remitos/run_agent | chat/remitos/run_agent | false | intent |
| S07 | espera | (post-confirmado) | remito/remitos/run_agent | chat/remitos/run_agent | false | intent |
| S08 | cambio a reclamo | sticky:viaje_pending | viaje/viajes/run_agent | viaje/viajes/run_agent | true | — |
| S09 | POD | sticky pod | pod/pod/run_agent | pod/pod/run_agent | true | — |
| S10 | rendicion nafta | sticky:rendicion | rendicion/…/run_agent | rendicion/…/run_agent | true | — |
| S11 | reclamo faltante | sticky reclamo | reclamo/reclamos/run_agent | reclamo/reclamos/run_agent | true | — |
| S12 | destino sí | sticky:destinos_cliente | destino/destinos/run_agent | destino/destinos/run_agent | true | — |
| S13 | horarios? | intent_router | chat/router/ask_clarification | chat/router/ask_clarification | true | — |

\*S01 pudo heredar viaje pending del protocolo previo en el mismo teléfono de prueba; parity OK.

## Divergencias restantes (priorizadas)

### Solo telemetría — sin efecto operativo (3)

1. **S07 dale / porfa / espera** — tras `ok` el legacy cierra `remito_en_revision`; Commander ya no aplica sticky y el router etiqueta `chat`, pero sigue `agentId=remitos` + `action=run_agent` → mismo executor `remitos_texto` / `procesarTextoChofer` que el flujo legacy.

No hay P1/P2 operativos pendientes para activar V1 bajo el criterio acordado.

## Diff v1.0.1 (qué cambió)

- `LegacyProcessPolicy`: `bindProcess()` → intent de dominio + `action=run_agent` + `processBinding=true`
- Sticky nuevo: `remito_revision` (después de early binds AS-IS: incidencia/rendición/destinos/viaje)
- `decide` / router chofer: `continue_process` → `run_agent` hacia `remitos_texto`
- `inferLegacyDecisionFromPayload`: destinos → `destino`/`run_agent`
- `detectActiveProcesses`: incluye `remito_revision`
- Sin cambios a Remitos internos, H1–H14, v1.1, ni flags de producción

## Flags post-corrida

```
SOL_COMMANDER_V1=false
SOL_COMMANDER_SHADOW=true
```
