# Protocolo de prueba manual — SOL Commander Shadow

**Entorno:** TransitOne (`transitone-remitos`) únicamente  
**Andreu / `main` / `logistica`:** no tocar  
**Flags:** `SOL_COMMANDER_V1=false` · `SOL_COMMANDER_SHADOW=true`  
**Objetivo:** comparar decisión Commander vs outcome legacy **sin** cambiar comportamiento.

## Reglas

1. Legacy es el único que ejecuta respuestas.
2. Commander solo arma decisión + trace.
3. No activar V1.
4. No modificar heurísticas, Remitos internos, ni arquitectura.
5. Traces sanitizados (IDs + preview).

## Cómo ejecutar

En el contenedor `transitone-remitos` (o con `DATA_DIR` apuntando al volumen):

```bash
node scripts/run-commander-shadow-protocol.mjs
```

Resultados:
- `data/commander-shadow-protocol-results.json`
- append a `data/commander-shadow-traces.jsonl`
- resumen en stdout

## Escenarios

| ID | Nombre | Setup | Input |
|----|--------|-------|-------|
| S01 | Viaje simple | limpio | «necesito un viaje a Neuquén con 15 toneladas» |
| S02 | Viaje + pregunta lateral | viaje pending | «¿cuánto sale?» |
| S03 | Remito abierto + corrección | remito_en_revision | «semi remolque AH318WB» |
| S04 | Remito abierto + incidencia | remito_en_revision | «tuve un pinchazo en la ruta» |
| S05 | Confirmación ambigua | remito_en_revision | «si esta bien creo» |
| S06 | Negación | remito_en_revision | «no, está mal» |
| S07 | ok / dale / porfa / espera | remito_en_revision (4 msgs) | «ok» / «dale» / «porfa» / «espera» |
| S08 | Cambio de intención a mitad | viaje pending | «mejor abrí un reclamo, no llegó la carga» |
| S09 | POD | chofer registrado | «entregué, te mando POD» |
| S10 | Rendición | chofer registrado | «rendición nafta 45000» |
| S11 | Reclamo | limpio | «quiero hacer un reclamo por faltante» |
| S12 | Destino | destino pendiente cliente | «sí, la dirección es correcta» |
| S13 | Desconocido / chat | limpio (no chofer) | «buenas, qué horarios tienen?» |

## Campos a registrar por escenario

- input  
- proceso activo  
- decisión legacy (`flow` / intent inferido / agent)  
- decisión Commander (intent, confidence, intentSource, agentId, action, policy branch)  
- parity  
- tipo de divergencia (`intent` \| `agent` \| `action` \| `sticky_process` \| —)  
- severidad (`none` \| `low` \| `medium` \| `high` \| `critical`)  
- observación  

## Severidad

| Nivel | Criterio |
|-------|----------|
| none | parity=true |
| low | mapping cosmético / flow desconocido pero mismo agente |
| medium | action distinta con mismo agente |
| high | intent o agente distintos en flujo no sticky crítico |
| critical | sticky remito vs incidencia/viaje mal interpretado |

## Criterio de éxito del protocolo

- Todos los escenarios generan trace shadow.
- V1 permanece `false`.
- Listado de divergencias priorizado entregado sin cambios de código de producto (solo runner/docs de prueba).

## Resultados

Ver corrida TransitOne: [`SOL-COMMANDER-SHADOW-PROTOCOL-RESULTS.md`](./SOL-COMMANDER-SHADOW-PROTOCOL-RESULTS.md).
