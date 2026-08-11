# SOL Commander v1.1.1 — Canary real (TransitOne)

**Fecha:** 2026-08-11  
**Entorno:** Easypanel `transitone` / `transitone-remitos`  
**Subject allowlist:** `5491133788190` (mode=`list`, size=`1`, gated=`true`)  
**Flags:** `SOL_COMMANDER_V1=true`, `SOL_COMMANDER_SHADOW=true`, `SOL_COMMANDER_V1_1_INTERRUPT=true`  
**ALLOWLIST=*:** **NO** habilitado

## Resultado

| Suite | Resultado |
|-------|-----------|
| Canary script (`run-commander-v1-1-canary.mjs`) | **7/7 PASS** |
| Restart real mid-interrupt → `resume_until` | **PASS** |

### Casos canary

| ID | Caso | Pass |
|----|------|------|
| K1 | activo → lateral → resume | ✅ |
| K2 | nested interrupt | ✅ |
| K3 | error hijo sin perder binding + waiting_user sin pop | ✅ |
| K4 | persist/reload entre interrupt y resume | ✅ |
| K5 | cancelación explícita | ✅ |
| K6 | resume manual | ✅ |
| OFF | fuera allowlist = V1 (sin stack) | ✅ |

### Observaciones (traces)

```
push: 6
pop: 3
resume_until: 3
cancel: 1
child_failed_no_pop: 4
resume_rejected: 0 (en sample de canary)
```

### Restart real del servicio

1. Push interrupt (viaje → incidencia), stackDepth=1, checkpoint persistido.
2. `restart_service` remitos.
3. Post-restart: stack intacto, `resume_until(parent)` → pop=1, stackDepth=0, `activeProcessId` = padre `viaje_solicitud`.

Health post-restart:

```json
{
  "interrupt_flag": true,
  "allowlist_mode": "list",
  "allowlist_size": 1,
  "gated": true
}
```

## Criterio global (estado)

| Criterio | Estado canary |
|----------|---------------|
| Ningún stack huérfano al cerrar casos | OK |
| Ningún padre equivocado reanudado | OK |
| Proceso activo no perdido por error de ejecución | OK (`lastExecutionStatus=failed`, `status=active`) |
| 0 fallback inesperado a V1 en subject allowlisted | OK |
| Fuera allowlist → V1 | OK |
| Rollback / flags operativos | OK (lista, no `*`) |

## Decisión

**Frenar aquí.** No globalizar. No setear `SOL_COMMANDER_V1_1_ALLOWLIST=*`.

Siguiente paso (solo con aprobación explícita): ampliar allowlist o habilitar global.
