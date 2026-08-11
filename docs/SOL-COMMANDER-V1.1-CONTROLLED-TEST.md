# SOL Commander v1.1 — prueba controlada (allowlist)

**Estado:** prueba controlada en TransitOne — **no** activación global  
**Servicio:** `transitone` / `transitone-remitos`

## Flags

| Variable | Valor controlado |
|----------|------------------|
| `SOL_COMMANDER_V1` | `true` |
| `SOL_COMMANDER_SHADOW` | `true` |
| `SOL_COMMANDER_V1_1_INTERRUPT` | `true` |
| `SOL_COMMANDER_V1_1_ALLOWLIST` | subjectIds de prueba (CSV) |

- Allowlist **vacía** + interrupt ON → **nadie** recibe v1.1 (fail-closed).
- `*` / `all` → global (prohibido en esta fase).
- Fuera de allowlist → exactamente Commander V1.

## Runner

```bash
# En contenedor transitone-remitos (con DATA_DIR del volumen):
node scripts/run-commander-v1-1-controlled.mjs
```

Resultados: `data/commander-v1-1-controlled-results.json`

## Rollback

```text
SOL_COMMANDER_V1_1_INTERRUPT=false
# o vaciar ALLOWLIST
+ restart_service
```

No toca Remitos internos / H1–H14 / Tool Registry / Event Bus.
