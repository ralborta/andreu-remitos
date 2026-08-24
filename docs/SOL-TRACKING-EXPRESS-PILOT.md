# SOL Tracking Express — Piloto (Fase 5)

## Objetivo

Probar el MVP con un conjunto controlado de tenants/choferes, medir uso y poder apagar todo en un paso — **sin** activación global en producción hasta autorización explícita.

## Activación piloto (fail-closed)

El módulo requiere el flag **y** allowlists. Listas vacías = **nadie** (no se crean links).

```bash
# En transitone-remitos (API) — NO en prod Andreu sin OK
SOL_TRACKING_EXPRESS_ENABLED=true
SOL_TRACKING_WA_ENABLED=true
SOL_TRACKING_PUBLIC_BASE_URL=https://sol.nivel41.com

# Allowlist (CSV). Vacío = denegado. * = todos (solo con autorización).
SOL_TRACKING_ALLOWLIST_TENANTS=tsb
SOL_TRACKING_ALLOWLIST_PHONES=5491133788190,54911XXXXXXXX
```

Opcional: umbrales WA `SOL_TRACKING_WA_*_MS` (ver `docs/SOL-TRACKING-EXPRESS.md`).

### Abrir a todos (explícito)

```bash
SOL_TRACKING_ALLOWLIST_TENANTS=*
SOL_TRACKING_ALLOWLIST_PHONES=*
```

**No usar `*` en producción sin autorización.**

## Checklist de prueba real

1. Flag + allowlist en API; redeploy `transitone-remitos` (+ frontend si hay cambios UI).
2. Viaje `asignado`/`en_curso` con chofer en allowlist y teléfono.
3. Mesa → detalle viaje → **Generar y enviar WA**.
4. Chofer abre `/tracking/t/:token` (Safari iPhone + Chrome Android).
5. Consentimiento → GPS → iniciar → verificar torre (pestaña Tracking Express).
6. Abrir Maps/Waze → confirmar que la torre muestra antigüedad (no posición “viva”).
7. Modo avión → recuperar → cola offline reenvía sin duplicar.
8. Incidencia con foto; llegada + POD con foto.
9. Revisar `GET /api/tracking/pilot/metrics`.

Documentar en cada dispositivo: comportamiento con pantalla bloqueada / app en background.

## Métricas

```http
GET /api/tracking/pilot/metrics   # JWT mesa
GET /api/tracking/pilot/gate
GET /api/tracking/meta
```

Incluye: links/sesiones, posiciones y WA 24h, stale/crítico live, snapshot de gate (sin PII).

## Limitaciones conocidas (comunicar al piloto)

- El seguimiento **no** es continuo garantizado; depende del navegador en primer plano.
- Al abrir Maps/Waze la webapp puede suspenderse → estado STALE / BACKGROUND_SUSPECTED.
- Sin GPS hardware, sin app nativa, sin PostGIS/Kafka.
- Media POD/incidencias en volumen local (`UPLOAD_DIR/tracking-media`).
- 1 réplica API recomendada (file-store JSON).

## Rollback (1 paso)

1. `SOL_TRACKING_EXPRESS_ENABLED=false` en el servicio API.
2. Redeploy / restart.
3. Opcional: vaciar allowlists.

Efecto: nuevas APIs de tracking responden 404; la webapp pública no opera; flujos Viajes/POD/WA existentes **no** se rompen. Los JSON en `DATA_DIR/tracking/` quedan intactos (aditivos).

## Relación con agentes

| Agente | Rol en piloto |
|--------|----------------|
| Viajes | Crea viaje + CTA enlace |
| Tracking Express | Posiciones, estados, WA reglas |
| Incidencias | Casos desde webapp |
| POD | Constancia al cerrar |
| ETA / Destinos | Enganche futuro (ETA Routes / geocerca destino geocoded) |
| Commander | Consumir eventos `TRACKING_*` más adelante |

## Criterio de éxito del piloto

- ≥1 viaje real con posiciones en torre y antigüedad correcta.
- WA de asignación entregado.
- Al menos 1 recuperación offline o retorno desde Maps.
- POD o incidencia registrada sin romper mesa.
- Rollback probado en staging (`ENABLED=false`).
