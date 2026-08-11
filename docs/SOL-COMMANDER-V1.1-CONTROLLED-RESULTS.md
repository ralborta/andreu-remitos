# SOL Commander v1.1 — resultados prueba controlada (TransitOne)

**Fecha:** 2026-08-11T21:33:23Z  
**Servicio:** `transitone-remitos`  
**Commits:** `8e72c9f` (allowlist) · `a6aeeb9` (runner) · imagen `16790a0`+  
**Alcance:** allowlist only — **no** activación global (`allowlist_mode=list`, size=9)

## Flags en TransitOne

| Flag | Valor |
|------|-------|
| `SOL_COMMANDER_V1` | `true` |
| `SOL_COMMANDER_SHADOW` | `true` |
| `SOL_COMMANDER_V1_1_INTERRUPT` | `true` |
| `SOL_COMMANDER_V1_1_ALLOWLIST` | `5491198800101…108` + `5491133788190` |

Health: `sol_commander_v1_1_gate.gated=true`, `allowlist_mode=list`, `allowlist_size=9`.

## Totales

- **8 / 9 PASS**
- **1 FAIL** (C4 — anidamiento no deseado en turno intermedio de reclamo)

## Casos

| ID | Caso | Resultado | Padre | Push | Hijo | Completion | Pop/resume | Stack final |
|----|------|-----------|-------|------|------|------------|------------|-------------|
| C1 | remito → lateral → resume | PASS | remito_revision | sí | viaje_solicitud | manual_resume | pop → remito | 0 |
| C2 | confirmación → lateral → volver | PASS | remito_revision | sí | reclamo | manual_resume_confirm | pop → remito | 0 |
| C3 | viaje → incidencia → volver | PASS | viaje_solicitud | sí | incidencia | explicit_resume | pop → viaje | 0 |
| C4 | reclamo largo → resume manual | **FAIL** | viaje paused | sí (`manual_only`) | reclamo | manual_only | pop 1 nivel (quedó viaje en stack) | **1** |
| C5 | nested + 3er bloqueado | PASS | — | depth 2 | — | max_depth | 3er lateral sin push | 2 |
| C6 | dejemos eso | PASS | remito cancelled | sí | viaje active | explicit_cancel_stack_top | cancel sin resume padre | 0 |
| C7 | human takeover | PASS | viaje paused | reason=human_takeover | human_takeover active | noop | — | 1 |
| C8 | child legacy sin auto pop | PASS | viaje paused | `auto_on_child_complete` | incidencia active | legacy_no_auto_pop | sin pop tras msg hijo | 1 |
| OFF | fuera allowlist | PASS | — | no | — | outside_allowlist | V1 sticky remito | 0 |

## Detalle C4 (único fallo)

1. Push viaje→reclamo con `resumeMode=manual_only` OK.  
2. Mensaje intermedio «faltan 2 pallets» disparó **otro** interrupt (stack depth 2; flow `incidencia_error` por canal Baileys).  
3. «retomemos el viaje» hizo **un** pop (reanudó reclamo), dejando viaje aún paused.  
4. Criterio del test exigía stack vacío → FAIL.  
**Lectura:** resume manual funciona LIFO; el fallo es interferencia de intent lateral en el turno del reclamo + error de envío WhatsApp preexistente (`Cannot read properties of undefined (reading 'id')`).

## Errores / fallback observados

- `viajes_error` / `incidencia_error`: fallo Baileys al notificar números sintéticos (preexistente; no rompe orquestación).  
- OFF allowlist: flow `esperando_correccion_o_foto` sticky V1, **sin** `interrupt`, stack 0.  
- Fail-safe V1 para sujetos no listados: verificado.

## Artefacto

`data/commander-v1-1-controlled-results.json` (volumen `transitone-data`).

## Frenado

- **No** se setea `ALLOWLIST=*` / `all`.  
- **No** Tool Registry / Event Bus / cambios Remitos internos.  
- Rollback: `SOL_COMMANDER_V1_1_INTERRUPT=false` + restart.
