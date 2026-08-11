# Resultados — Protocolo Shadow Commander (TransitOne)

**Fecha:** 2026-08-11T18:09–18:10Z  
**Entorno:** `transitone-remitos`  
**Flags:** `SOL_COMMANDER_V1=false` · `SOL_COMMANDER_SHADOW=true` (sin cambios)  
**Andreu / logistica:** no tocado  
**Artefacto runtime:** `data/commander-shadow-protocol-results.json`

## Resumen

| Métrica | Valor |
|---------|-------|
| Escenarios | 13 |
| Pasos (msgs) | 16 |
| Parity OK | 8 |
| Divergencias | 8 |
| Traces faltantes | 0 |
| Critical (agente distinto + sticky) | 0 |
| V1 activado | no |

**Veredicto:** Shadow responde y traza en todos los escenarios. No hay divergencia de **agente** (mismo destino operativo en los 16 pasos). Las 8 “parity=false” son desalineación de **labels** `intent`/`action` (`continue_process`/`chat`/`desconocido` vs `viaje`/`remito` + `run_agent`), no ruteo a otro agente.

## Tabla por escenario

| ID | Input | Proceso activo | Legacy | Commander | Parity | Tipo div. | Sev. métrica | Observación |
|----|-------|----------------|--------|-----------|--------|-----------|--------------|-------------|
| S01 | necesito un viaje a Neuquen con 15 toneladas | — | viaje/viajes/run_agent (`viajes_recolectando`) | viaje/viajes/run_agent (IA) | true | — | none | OK |
| S02 | cuanto sale el flete? | viaje_solicitud | viaje/viajes/run_agent | continue_process/viajes/continue_process (sticky) | false | intent+action | high* | Mismo agente; sticky AS-IS correcto; pregunta lateral **no** interrumpe (v1.1) |
| S03 | semi remolque AH318WB | — (remito sembrado) | rendicion/rendicion | rendicion (heurística sticky) | true | — | none† | Escenario no midió corrección remito: “semi/remolque” cae en rendición AS-IS en **ambos** |
| S04 | tuve un pinchazo en la ruta | — (remito sembrado) | incidencia/incidencias | incidencia (heurística) | true | — | none† | Remito abierto **no** es sticky en policy; incidencia gana (AS-IS). Parity OK |
| S05 | si esta bien creo | — | remito/remitos (`confirmado`) | chat/remitos/continue_process | false | intent+action | high* | Mismo agente remitos; label intent distinto |
| S06 | no, esta mal | — | remito/remitos | desconocido/remitos/continue_process | false | intent+action | high* | Idem |
| S07 | ok | — | remito (`confirmado`) | chat/remitos/continue_process | false | intent+action | high* | Idem |
| S07 | dale | — | remito (`confirmado_repetido`) | chat/remitos/continue_process | false | intent+action | high* | Idem |
| S07 | porfa | — | remito | chat/remitos/continue_process | false | intent+action | high* | Idem |
| S07 | espera | — | remito | chat/remitos/continue_process | false | intent+action | high* | Idem |
| S08 | mejor abri un reclamo… | viaje_solicitud | viaje/viajes | continue_process/viajes (sticky) | false | intent+action | high* | Sticky viaje retiene; cambio a reclamo **no** (esperado sin v1.1) |
| S09 | entregue, te mando el POD | — | pod/pod | pod (sticky:pod_parece) | true | — | none | OK (flow pod_error = side-effect env, no decisión) |
| S10 | rendicion nafta 45000 | — | rendicion/rendicion | rendicion | true | — | none | OK |
| S11 | quiero hacer un reclamo por faltante | — | reclamo/reclamos | reclamo | true | — | none | OK |
| S12 | si, la direccion es correcta | destino_confirmacion | continue_process/destinos | continue_process/destinos (sticky) | true | — | none | OK |
| S13 | buenas, que horarios tienen? | — | chat/router/ask_clarification | chat/router/ask_clarification | true | — | none | OK |

\*Severidad del runner marca `high` ante cualquier `intent`/`action` distinto. **Severidad operativa sugerida:** `medium` (mismo agente; riesgo solo si V1 ejecuta action distinta sin mapear).  
†Parity true pero el setup “remito abierto” no quedó como proceso sticky visible: hallazgo de cobertura AS-IS, no de divergencia Commander↔legacy.

## Divergencias priorizadas

### P1 — Ajuste de métrica de parity (no producto)

1. **Sticky viaje (`continue_process`) vs legacy `viaje`/`run_agent`** — S02, S08  
   - Mismo agente `viajes`.  
   - Policy sticky correcta 1:1 con early-bind AS-IS.  
   - Parity false por normalización de labels en `inferLegacyDecisionFromPayload` / `computeParity`.  
   - **Acción sugerida (futura, no hecha):** mapear flows `viajes_*` sticky a `continue_process` en el comparador.

### P2 — Diálogo remito abierto (labels; agente OK)

2. **Confirmación / negación / ok-dale-porfa-espera** — S05, S06, S07 (×4)  
   - Legacy: intent `remito` + `run_agent`.  
   - Commander: `chat`/`desconocido` + `continue_process`, agente `remitos`.  
   - Remito en revisión **no** está en `LegacyProcessPolicy` como sticky; el router IA etiqueta chat.  
   - **Riesgo V1:** bajo–medio si el executor de `continue_process`+`remitos` no replica el path de correcciones/OK.  
   - **No es v1.1:** no hay cambio de agente.

### P3 — Cobertura de escenario / comportamiento AS-IS compartido

3. **S03 remito+corrección → rendición (ambos)**  
   - Texto con “semi/remolque” dispara heurística de rendición antes de tratar corrección de remito.  
   - Parity true; el protocolo no valida “corrección sobre remito abierto”.  
   - Re-probar con frase sin tokens de rendición (ej. `el acoplado es AH318WB`) en una pasada futura.

4. **S04 remito+incidencia → incidencia (ambos)**  
   - AS-IS: `pareceIncidencia` gana; remito abierto no sticky en policy.  
   - Interrupción real = v1.1 (fuera de alcance).

5. **S08 cambio de intención**  
   - Sticky viaje retiene (Commander y legacy en viajes).  
   - Divergencia solo de label; comportamiento sticky correcto sin v1.1.

## Qué no se hizo (por pedido)

- No se activó V1.  
- No se modificaron heurísticas ni Remitos internos.  
- No se implementó v1.1.  
- No se tocó Andreu.  
- Shadow se mantuvo exactamente (`V1=false`, `SHADOW=true`).

## Cómo re-ejecutar

```bash
# en transitone-remitos (cwd /app/backend)
node scripts/run-commander-shadow-protocol.mjs
```

Protocolo: `docs/SOL-COMMANDER-SHADOW-TEST-PROTOCOL.md`
