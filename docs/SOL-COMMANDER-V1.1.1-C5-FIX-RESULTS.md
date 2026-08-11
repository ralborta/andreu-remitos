# SOL Commander v1.1.1 — C5 fix + re-test

**Fecha:** 2026-08-11T22:15:29Z  
**Commit fix:** `f9f64ba57c96950193e5798dd1cc5db2888bd643`  
**Allowlist:** sin cambio (`mode=list`, size=9) — **no global**

## Causa raíz (C5)

| Área | ¿Era? | Detalle |
|------|-------|---------|
| status del proceso hijo | **Sí** | Legacy `*_error` → `markActiveFailedNoPop` ponía `status=failed` |
| activeProcessId / getActiveProcess | **Sí** | `getActiveProcess` exigía `status===active` → `null` |
| reconstrucción ProcessContext | **Sí (efecto)** | `syncActiveFromDetected` / `ensureActiveFromDomain` creaba otro Process |
| InterruptPolicy | No (síntoma) | Veía `no_active` / contexto equivocado |
| persistencia/trace | No | Traces OK |
| resultado ejecución legacy | **Trigger** | `AgentExecutionResult.status=failed` disparaba el mark destructivo del binding |

## Fix genérico

- Fallo de ejecución: `lastExecutionStatus=failed`, **`status` permanece `active`** (binding orquestación intacto).
- `getActiveProcess`: recovery si residual `failed` → rehidrata a `active`.
- `ensureActiveFromDomain`: reusa binding vigente (no duplica).
- Sin heurísticas, sin excepciones por agente, sin cambiar Remitos/H1–H14.

## Resultados post-fix

| Suite | Resultado |
|-------|-----------|
| Protocolo controlado 15 casos | **15/15 PASS** (C5: d1=1, d2=2, d3=2) |
| Unitarios v1.1.1 | **11/11** (incluye repro C5 nested after failed) |
| Restart/persistencia (X6) | PASS |
| Rollback flag OFF (parity V1) | PASS (local + criterio) |

## Criterio ALLOWLIST=*

| Requisito | Estado |
|-----------|--------|
| 15/15 controlados | **Sí** |
| unitarios OK | **Sí** (11/11; supersede 10/10) |
| 0 pérdida de stack | Sí |
| 0 padre incorrecto | Sí |
| 0 auto-resume heurístico | Sí |
| 0 regresiones V1 | Sí |

**Aún no activar globalmente** — esperar aprobación explícita.
