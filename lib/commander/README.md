# SOL Commander v1

Ver diseño: [`docs/SOL-COMMANDER-V1-DESIGN.md`](../../docs/SOL-COMMANDER-V1-DESIGN.md)  
Constitución: [`docs/SOL-AI-OS-CONSTITUCION.md`](../../docs/SOL-AI-OS-CONSTITUCION.md)

## Flags

- `SOL_COMMANDER_V1=true` — webhook usa `decide()` + executor
- `SOL_COMMANDER_SHADOW=true` — decide en paralelo (log), ejecuta legacy

## Layout

```
lib/commander/
  index.mjs
  decide.mjs
  flags.mjs
  intent/route-by-intent.mjs
  policy/legacy-process-policy.mjs
  registry/
  trace/
```

Default: flag OFF (parity / rollback).
