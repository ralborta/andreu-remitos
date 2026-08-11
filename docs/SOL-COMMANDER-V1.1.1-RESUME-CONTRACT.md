# SOL Commander v1.1.1 — Resume semántico + AgentExecutionResult

**Estado:** implementado — allowlist controlada (no global)  
**Base:** v1.1 Interrupt & Resume

## Cambios

### 1. Semántica explícita de resume
| Modo | Comportamiento |
|------|----------------|
| `resume_top` | Un solo pop del tope |
| `resume_parent` | Padre esperado del active (`childProcessId` match) → `resume_until` |
| `resume_until(processId)` | Cada pop trazado hasta el target paused |

- Target debe existir y estar `paused` en el stack.
- Ambigüedad / target inválido → reject + fail-safe V1 (sin pops implícitos).
- Ops de trace: `resume_top`, `resume_until`, `resume_until_intermediate`, `resume_rejected`, `child_failed_no_pop`.

### 2. `AgentExecutionResult`
```
status: completed | waiting_user | ongoing | failed
processId, agentId
resumePolicy: auto | manual | none
resumeTargetProcessId?
```
- Wrappers `wrapLegacyAgentOutcome` mapean **flow IDs** legacy (no NLP).
- Auto-resume solo si `status=completed` && `resumePolicy=auto`.
- `waiting_user` / `ongoing` → sin pop.
- `failed` → `markActiveFailedNoPop` (stack intacto).

## Flags
Sin cambio: allowlist actual. **No** `ALLOWLIST=*`.

## Tests
- Unit: `scripts/verify-commander-v1-1-1.mjs`
- Controlado: `scripts/run-commander-v1-1-controlled.mjs` (C1–C8 + OFF + X1–X6)
