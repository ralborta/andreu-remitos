# SOL Tracking Express

Módulo de seguimiento operativo vía webapp/PWA (sin app nativa ni GPS hardware).

## Feature flag

```bash
SOL_TRACKING_EXPRESS_ENABLED=true
```

Opcional:

- `SOL_TRACKING_LINK_TTL_HOURS` (default 72)
- `SOL_TRACKING_CONSENT_VERSION` (default 1.0)
- `SOL_TRACKING_GEOFENCE_RADIUS_M` (default 300)
- `SOL_TRACKING_PUBLIC_BASE_URL` — base para URLs enviadas por WhatsApp

## API (Fase 1)

Autenticado (JWT):

- `POST /api/tracking/links` — `{ tripId }`
- `POST /api/tracking/links/:id/revoke`
- `GET /api/tracking/trips/active`
- `GET /api/tracking/trips/:tripId/live`
- `GET /api/tracking/trips/:tripId/history`

Público (token):

- `GET /api/tracking/public/:token`
- `POST /api/tracking/public/:token/consent|start|heartbeat|positions/batch|incidents|arrive|pod|stop`

## Persistencia

`DATA_DIR/tracking/*.json` — links, sessions, positions, consents, events, trip-state.

## Tests

```bash
node scripts/verify-tracking-express.mjs
```

## Fase 2 — Webapp chofer

Ruta pública (sin login):

`/tracking/t/:token`

Flujo: validación → detalle → consentimiento → GPS → inicio → activo → incidencia / llegada → POD.

- Cola offline IndexedDB para posiciones
- Compresión de fotos en cliente
- Wake Lock (best effort)
- Page Visibility → heartbeat

POD e incidencias integrados con `pod-store` e `incidencias-store`.
Upload fotos: `POST /api/tracking/public/:token/upload`

## Fase 3 — Torre de control

En agente **Gestión de Viajes** → pestaña **Tracking Express**:

- Mapa Leaflet con última posición real (sin interpolar)
- Lista de viajes activos + asignados sin tracking
- Colores: verde / amarillo / rojo / gris / azul
- Detalle: antigüedad exacta, precisión, fuente, alertas, historial y eventos
- Poll cada 12 s

Desde el detalle de un viaje: **Generar enlace** + copiar / WhatsApp (`wa.me`).

Config cliente: `GET /api/config/client` incluye `trackingExpressEnabled`.

## Fase 4 — WhatsApp y reglas

Plantillas en `lib/tracking/wa-templates.mjs` (sin IA):

1. viaje asignado con enlace
2. recordatorio de inicio
3. tracking interrumpido
4. reabrir webapp
5. ubicación puntual
6. llegada próxima (geocerca)
7. POD pendiente
8. viaje completado
9. incidencia escalada

Envío vía Baileys (`builderbot-send`), mismo canal que el resto de SOL.

API mesa:

- `POST /api/tracking/links` con `{ tripId, sendWhatsApp: true }`
- `POST /api/tracking/links/:id/send` `{ kind, force }`

Watcher en background (`startTrackingWhatsAppWatcher`):

- recordatorio si no inicia (default 15 min)
- interrupted / reopen si stale o >5 min sin señal
- POD pendiente tras llegada (default 10 min)
- cooldown por viaje+kind (default 30 min)

Flags:

```bash
SOL_TRACKING_EXPRESS_ENABLED=true
SOL_TRACKING_WA_ENABLED=true          # default true si el módulo está on
SOL_TRACKING_PUBLIC_BASE_URL=https://sol.nivel41.com
# umbrales opcionales: SOL_TRACKING_WA_*_MS
```

El token se guarda **hasheado** + **sellado** (AES-GCM) solo para rearmar la URL en reenvíos.

## Fase 5 — Piloto

Allowlist fail-closed + métricas. Guía operativa: [`SOL-TRACKING-EXPRESS-PILOT.md`](./SOL-TRACKING-EXPRESS-PILOT.md).

```bash
SOL_TRACKING_ALLOWLIST_TENANTS=tsb
SOL_TRACKING_ALLOWLIST_PHONES=54911...,54911...
# vacío = nadie; * = todos (solo con autorización explícita)
```

- `GET /api/tracking/pilot/metrics`
- `GET /api/tracking/pilot/gate`
- Torre muestra etiqueta de piloto + resumen 24h

**No** habilitar flag global en producción ni `ALLOWLIST=*` sin autorización.

## Limitaciones MVP

- Seguimiento solo mientras el navegador permanece activo.
- Sin PostGIS / Redis / SSE.
- File-store JSON (1 réplica recomendada).

## Rollback

1. `SOL_TRACKING_EXPRESS_ENABLED=false`
2. Redeploy / restart API.
3. Opcional: vaciar allowlists.

Stores en `DATA_DIR/tracking/` son aditivos; el resto de SOL no depende de ellos.
