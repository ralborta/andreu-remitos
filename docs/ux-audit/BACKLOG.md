# Backlog de correcciones UX/UI · TransitOne

Tareas priorizadas y mapeadas a archivos del código, derivadas de la auditoría UX/UI completa.

**Leyenda de esfuerzo:**
- **S (Small):** 1-4 horas
- **M (Medium):** 1-2 días
- **L (Large):** 3-5 días o más

---

## P0 — Bugs críticos y quick wins (Alto impacto, Bajo esfuerzo)

### 1. Artefactos de punto flotante en peso de carga

**Módulo:** Viajes  
**Problema:** Se muestra "1.7999999999999998 t carga general" por error de precisión de float.  
**Criterios de aceptación:**
- Los pesos se muestran con máximo 1 decimal: "1,8 t"
- Formato con coma decimal para locale español
- Aplicar redondeo consistente en toda la app

**Archivos involucrados:**
- `frontend/src/components/ViajesTable.tsx` — Renderizado de la tabla de viajes
- `frontend/src/lib/data.ts` — Función de formato de números
- `backend/src/routes/viajes.mjs` — Validación y almacenamiento de peso

**Esfuerzo:** S

---

### 2. DELETE 400 en Marketing (Promociones y Catálogo)

**Módulo:** Marketing  
**Problema:** Eliminar ofertas y elementos del catálogo devuelve 400 Bad Request.  
**Criterios de aceptación:**
- DELETE `/backend/api/marketing/offers/:id` devuelve 200 o 204
- DELETE `/backend/api/marketing/catalog/:id` devuelve 200 o 204
- Se eliminan correctamente de la base de datos
- Mensaje de confirmación al usuario

**Archivos involucrados:**
- `backend/src/routes/` — **Crear** `marketing.mjs` con rutas DELETE
- `backend/src/services/` — **Crear** servicio de marketing si no existe
- Frontend: buscar componentes de Marketing en `frontend/src/app/(app)/`

**Nota:** Estas rutas parecen no estar implementadas aún. Verificar si existe `/backend/api/marketing/*` o si se debe crear.

**Esfuerzo:** M

---

### 3. Validación de precio y nombre en Marketing

**Módulo:** Marketing (Planificador, Promociones)  
**Problema:**
- Precio acepta texto "abc" sin validación
- Se guardan ítems de catálogo sin nombre ("$1 (servicio)")

**Criterios de aceptación:**
- Campo precio solo acepta números (validación cliente y servidor)
- Campo nombre es obligatorio (validación cliente y servidor)
- Mensajes de error claros en español
- No se puede guardar con datos inválidos

**Archivos involucrados:**
- Backend: `backend/src/routes/marketing.mjs` (crear validación con schema)
- Frontend: componentes de formulario en Marketing

**Esfuerzo:** S

---

### 4. Fechas con timezone incorrecto (-1 día)

**Módulo:** Marketing (Promociones), Global  
**Problema:** Fecha "Desde" 01/01/2026 se muestra como "31 de dic de 2025" por corrimiento de zona horaria.  
**Criterios de aceptación:**
- Las fechas se muestran en la zona horaria local del usuario (ART)
- "Desde" 01/01/2026 se ve como "1 de ene de 2026"
- Consistencia en todos los módulos

**Archivos involucrados:**
- `frontend/src/lib/data.ts` — Función de formato de fechas
- `frontend/src/lib/api.ts` — Serialización/deserialización de fechas
- Todos los componentes que renderizan fechas

**Esfuerzo:** S

---

### 5. Formato de fechas inconsistente

**Módulo:** Global  
**Problema:** Mezcla de formatos: "2026-10-23" (ISO), "15/10/2026 - 08:00", "mm/dd/yyyy" en formularios, "martes, 3 de noviembre de 2026, 08:30:16 p. m.".  
**Criterios de aceptación:**
- **Estándar único:** dd/mm/aaaa para fechas, hh:mm formato 24h para horas
- Formularios usan dd/mm/aaaa (no mm/dd/yyyy)
- Timestamps largos solo en logs técnicos, no en UI de usuario

**Archivos involucrados:**
- `frontend/src/lib/data.ts` — Funciones centralizadas de formato `formatDate()`, `formatDateTime()`
- `frontend/src/components/ViajesTable.tsx`
- `frontend/src/components/RemitosPanel.tsx`
- `frontend/src/app/(app)/page.tsx` — Torre de Control
- Componentes de Finanzas (buscar en `frontend/src/`)

**Esfuerzo:** M

---

### 6. Formato de moneda inconsistente

**Módulo:** Finanzas, Global  
**Problema:** "$ 2.372.500", "$1.8M (58%)", "$ 30.800", "$30.800", "$1 (servicio)".  
**Criterios de aceptación:**
- **Estándar único:** $1.234.567 (sin espacios, punto como separador de miles)
- Siempre 2 decimales para montos financieros: $1.234.567,00
- 1 decimal para pesos/toneladas: 1,8 t
- Función centralizada `formatCurrency()`

**Archivos involucrados:**
- `frontend/src/lib/data.ts` — Nueva función `formatCurrency(amount: number)`
- Componentes de Finanzas
- `frontend/src/components/ViajesTable.tsx`

**Esfuerzo:** M

---

### 7. Estados en inglés y snake_case

**Módulo:** Global  
**Problema:** `NOT_STARTED`, `en_gestión`, `article`, `case_study`, `PUBLISHED`, `DRAFT`, `APPROVED`, `ready`, `running`, `completed`.  
**Criterios de aceptación:**
- Todos los estados se muestran en español
- Usar el diccionario de estados propuesto en la auditoría
- Backend puede mantener enums en inglés, pero frontend siempre traduce
- Consistencia: "En viaje" (no "En curso"), "Borrador" (no "DRAFT")

**Archivos involucrados:**
- `frontend/src/lib/data.ts` — Crear constante `STATUS_DICTIONARY` con traducciones
- `frontend/src/components/ui.tsx` — Actualizar `StatusBadge`
- Buscar todos los usos de status/estado en componentes

**Esfuerzo:** S

---

### 8. Contadores inconsistentes (fuente única de verdad)

**Módulo:** Global (Torre, Métricas, Viajes, Finanzas)  
**Problema:**
- Métricas: 13 viajes vs Viajes: 17
- Torre: "15 de 26 en gestión" vs Métricas: "26 en gestión"
- Finanzas: cobrado $2.372.500 vs $3.032.500
- Cartera: $467.400 vs $3.148.920 vs $3.100.000

**Criterios de aceptación:**
- Un solo endpoint `/api/metrics/summary` que devuelve KPIs consolidados
- Todos los módulos consumen la misma fuente
- Drill-down desde KPI hasta listado muestra el mismo total
- Tests que validan coherencia de conteos

**Archivos involucrados:**
- **Backend:** `backend/src/routes/` — **Crear** `metrics.mjs` con endpoint unificado
- **Backend:** `backend/src/services/` — **Crear** `metrics-service.mjs` para cálculos centralizados
- `frontend/src/lib/api.ts` — Función `fetchMetrics()`
- `frontend/src/app/(app)/page.tsx` — Torre de Control
- Componentes de Métricas y Finanzas

**Esfuerzo:** L (estructural)

---

### 9. Header "Sistemas activos" contradice Monitor

**Módulo:** Torre de Control, Monitor  
**Problema:** Header muestra "Sistemas activos" mientras Monitor dice "hay servicios caídos" (WhatsApp Error 401).  
**Criterios de aceptación:**
- Header lee estado desde `/api/monitor/status`
- Si hay 1+ servicios caídos → "1 servicio caído" en rojo
- Si todos OK → "Sistemas activos" en verde
- Click lleva a Monitor con detalle

**Archivos involucrados:**
- `frontend/src/components/Topbar.tsx` — Indicador global de estado
- `backend/src/routes/monitor.mjs` — Endpoint `/status` consolidado
- `frontend/src/app/(app)/monitor/page.tsx`

**Esfuerzo:** S

---

### 10. "8 agentes en línea" contradice Monitor (4 vs 8)

**Módulo:** Torre de Control, Monitor  
**Problema:** Torre muestra "8 agentes en línea", Monitor muestra "4 agentes en línea" y 7 Offline.  
**Criterios de aceptación:**
- Mismo contador en Torre y Monitor
- Se actualiza en tiempo real (o con refresh explícito)
- Fuente única: endpoint `/api/monitor/agents`

**Archivos involucrados:**
- `frontend/src/app/(app)/page.tsx` — Torre de Control (línea ~48)
- `frontend/src/app/(app)/monitor/page.tsx`
- `backend/src/routes/monitor.mjs`

**Esfuerzo:** S

---

### 11. Fechas hardcodeadas o desfasadas

**Módulo:** Torre, Monitor, Finanzas  
**Problema:**
- Torre: "12 de marzo de 2024"
- Monitor: "12 de marzo de 2026"
- Finanzas: "Hoy (26 Oct)" fijo
- Conciliación: "Hora Operativa: 15:42 ART" desfasada

**Criterios de aceptación:**
- Todas las fechas dinámicas usan `new Date()` o timestamp del servidor
- Quitar cualquier fecha hardcodeada
- "Hoy" se calcula en tiempo real

**Archivos involucrados:**
- `frontend/src/app/(app)/page.tsx` — Torre de Control
- `frontend/src/app/(app)/monitor/page.tsx`
- Componentes de Finanzas
- `frontend/src/lib/data.ts` — Revisar mock data

**Esfuerzo:** S

---

### 12. Confirmación en acciones de dinero y envío masivo

**Módulo:** Finanzas, WhatsApp  
**Problema:** "Cobrar", "Conciliar", "Pagar / Autorizar", "Recordatorio Masivo WhatsApp" se ejecutan sin confirmación explícita con monto y destinatarios.  
**Criterios de aceptación:**
- Modal de confirmación con:
  - Acción: "¿Cobrar esta factura?"
  - Monto: $1.234.567
  - Cliente: "PepsiCo Central"
  - Botones: "Cancelar" / "Confirmar y cobrar" (primario)
- Lo mismo para Conciliar, Pagar, Recordatorio masivo (mostrar lista de destinatarios)

**Archivos involucrados:**
- `frontend/src/lib/confirm-context.tsx` — Ya existe, extender para acciones de dinero
- Componentes de Finanzas (dashboard, cobranza, facturas)
- Componente de envío de WhatsApp

**Esfuerzo:** M

---

### 13. Badges "Nuevo" permanentes

**Módulo:** Global (WhatsApp, Finanzas, Marketing)  
**Problema:** Badges "Nuevo" que no cambian nunca pierden sentido.  
**Criterios de aceptación:**
- Quitar badges "Nuevo" fijos
- Opcional: badge "Nuevo" solo si el feature tiene < 30 días desde su release (fecha en base de datos)
- O simplemente eliminarlos

**Archivos involucrados:**
- `frontend/src/components/Sidebar.tsx` — Quitar badges hardcodeados
- `frontend/src/app/(app)/layout.tsx`

**Esfuerzo:** S

---

## Quick wins adicionales (Medio impacto, Bajo esfuerzo)

### 14. Error JS crudo en chat de WhatsApp

**Módulo:** WhatsApp  
**Problema:** "Cannot read properties of undefined (reading 'id')" renderizado en un mensaje.  
**Criterios de aceptación:**
- Error no se filtra a la UI
- Logs en consola para debug
- Mensaje genérico al usuario si falla: "No se pudo cargar el mensaje"

**Archivos involucrados:**
- `frontend/src/components/ContactoChatThread.tsx`
- `frontend/src/components/WhatsAppChat.tsx`

**Esfuerzo:** S

---

### 15. Asteriscos de markdown crudos en WhatsApp

**Módulo:** WhatsApp  
**Problema:** Mensajes automáticos muestran `*texto*` en lugar de renderizar negrita.  
**Criterios de aceptación:**
- Parsear markdown básico: `*negrita*` → **negrita**
- Usar librería ligera o regex simple

**Archivos involucrados:**
- `frontend/src/components/ContactoChatThread.tsx`
- `frontend/src/components/WhatsAppChat.tsx`

**Esfuerzo:** S

---

### 16. "Nueva conversación con agente" navega sin aviso

**Módulo:** Viajes  
**Problema:** Botón "Nueva conversación con agente" navega a `/contactos` (WhatsApp) sin aviso, rompiendo el modelo mental.  
**Criterios de aceptación:**
- Renombrar a "Ir a WhatsApp" o "Abrir chat"
- Tooltip explica "Abrir conversación en WhatsApp"
- O abrir modal de chat in-place

**Archivos involucrados:**
- Buscar componente de Viajes que tiene este botón (probablemente en detalle de viaje)
- `frontend/src/app/(app)/agentes/[slug]/page.tsx` o similar

**Esfuerzo:** S

---

### 17. Contadores de paginación incorrectos

**Módulo:** Remitos, Facturas, Conciliación  
**Problema:**
- Remitos: "Mostrando 17 de 18" y "Mostrando 8 de 8" bajo una lista vacía
- Conciliación: "Todos (3)" vs 142 operaciones y 15 páginas
- Facturas: "1–6 de 82" vs chips con 8 en total

**Criterios de aceptación:**
- Contador real: "Mostrando X–Y de Z" donde Z es el total filtrado
- Si no hay resultados: "Sin resultados" (no "0 de 0")
- Chips y contadores usan la misma query

**Archivos involucrados:**
- `frontend/src/components/RemitosPanel.tsx`
- Componentes de Finanzas (facturas, conciliación)
- `frontend/src/components/DataTable.tsx` (si es componente reutilizable)

**Esfuerzo:** S

---

### 18. Viaje cancelado muestra "Asignar" y cuenta como "en curso"

**Módulo:** Viajes  
**Problema:** Un viaje cancelado aún muestra botón "Asignar" y se cuenta en viajes activos.  
**Criterios de aceptación:**
- Viajes cancelados no tienen botón "Asignar"
- No se cuentan en métricas de "en curso" o "activos"
- Badge "Cancelado" en gris/neutro

**Archivos involucrados:**
- `frontend/src/components/ViajesTable.tsx`
- `frontend/src/lib/data.ts` — Filtros de viajes activos
- `backend/src/routes/viajes.mjs` — Lógica de estados

**Esfuerzo:** S

---

### 19. Botón "•••" (tres puntos) abre edición en vez de menú

**Módulo:** Viajes  
**Problema:** Botón de menú contextual abre directamente el modal de edición.  
**Criterios de aceptación:**
- "•••" abre un menú con opciones: Ver detalle / Editar / Cancelar / Duplicar
- "Ver detalle" → modal de solo lectura
- "Editar" → modal de edición

**Archivos involucrados:**
- `frontend/src/components/ViajesTable.tsx`
- Componentes de detalle/edición de viaje

**Esfuerzo:** S

---

### 20. Pestañas "Choferes" y "Camiones" en Viajes no hacen nada

**Módulo:** Viajes  
**Problema:** Tabs inactivos confunden al usuario.  
**Criterios de aceptación:**
- **Opción A:** Implementar vistas de Choferes y Camiones
- **Opción B:** Ocultar tabs hasta que estén implementados

**Archivos involucrados:**
- Componente de Viajes (buscar tabs)

**Esfuerzo:** S (ocultar) o M (implementar)

---

## Mediano plazo (1–2 meses, impacto Alto-Medio)

### 21. Tipografía: mínimo 12px y escala consistente

**Módulo:** Global  
**Problema:** Etiquetas de 9–11px, texto ilegible.  
**Criterios de aceptación:**
- Variables CSS:
  - `--text-xs: 12px`
  - `--text-sm: 14px`
  - `--text-base: 16px`
  - `--text-lg: 20px`
  - `--text-xl: 28px`
- Auditar todos los componentes y reemplazar tamaños < 12px

**Archivos involucrados:**
- `frontend/src/app/globals.css` — Variables CSS
- Todos los componentes (auditoría global)

**Esfuerzo:** M

---

### 22. MAYÚSCULAS en títulos → Sentence case

**Módulo:** Global  
**Problema:** "GESTIÓN DE INCIDENCIAS", "CONCILIACIÓN DE COBROS Y PASARELAS", "MÓDULO REMITOS".  
**Criterios de aceptación:**
- Todos los títulos en sentence case: "Gestión de incidencias"
- MAYÚSCULAS solo para overlines muy cortas (ej: "ESTADO", "TIPO")
- Actualizar `PageHeader` component

**Archivos involucrados:**
- `frontend/src/components/ui.tsx` — `PageHeader`
- Buscar `text-transform: uppercase` en CSS
- Auditar todos los títulos

**Esfuerzo:** M

---

### 23. Un solo color primario (violeta de marca)

**Módulo:** Global  
**Problema:** 6 colores distintos usados como primario (violeta, negro, azul, verde, rojo, teal).  
**Criterios de aceptación:**
- Botones primarios: violeta (color de marca)
- Verde solo para éxito/confirmación
- Rojo solo para error/destructivo
- Negro/gris para secundarios
- Actualizar `<button>` y componentes de UI

**Archivos involucrados:**
- `frontend/src/app/globals.css` — Variables de color
- `frontend/src/components/ui.tsx` — Componentes de botones
- Auditar todos los botones primarios

**Esfuerzo:** M

---

### 24. Status pills con ícono además de color (accesibilidad)

**Módulo:** Global  
**Problema:** Estados solo con color (puntos verde/rojo) no son accesibles.  
**Criterios de aceptación:**
- Cada status pill tiene un ícono además del color
- Ejemplos:
  - ✓ En viaje (azul)
  - ⏸ En pausa (ámbar)
  - ✗ Cancelado (gris)
  - ⚠ Sin asignar (ámbar)

**Archivos involucrados:**
- `frontend/src/components/ui.tsx` — `StatusBadge` con prop `icon`
- `frontend/src/lib/data.ts` — Diccionario de estados con íconos

**Esfuerzo:** M

---

### 25. Componente KPI card unificado

**Módulo:** Global  
**Problema:** KPIs con diseños inconsistentes, algunos con "—" sin motivo.  
**Criterios de aceptación:**
- Componente `<KPICard>` único:
  - Props: `label`, `value`, `comparison?`, `period`, `tooltip`
  - Nunca mostrar "—" sin explicación
  - Tooltip con definición y fuente
- Reemplazar todos los KPIs con este componente

**Archivos involucrados:**
- `frontend/src/components/ui.tsx` — Crear `<KPICard>`
- `frontend/src/app/(app)/page.tsx` — Torre de Control
- Componentes de Métricas y Finanzas

**Esfuerzo:** M

---

### 26. Detalle de viaje en solo lectura (no formulario)

**Módulo:** Viajes  
**Problema:** Modal de "Detalle" es el mismo formulario de edición con "Guardar ficha".  
**Criterios de aceptación:**
- Modal "Ver detalle" con datos en solo lectura
- Timeline de eventos del viaje
- Mapa de ruta
- Remitos asociados
- Botón "Editar" abre el formulario en otro modal

**Archivos involucrados:**
- Componente de detalle de viaje (crear nuevo)
- Separar de edición

**Esfuerzo:** M

---

### 27. WhatsApp: nombre + patente en cada contacto

**Módulo:** WhatsApp  
**Problema:** Casi todos los contactos dicen "Chofer", indistinguibles.  
**Criterios de aceptación:**
- Cada fila muestra:
  - Nombre del chofer
  - Patente del camión (si está asignado)
  - Último mensaje (truncado)
- Avatar con iniciales

**Archivos involucrados:**
- `frontend/src/components/ContactosInbox.tsx`
- Backend: `/api/conversaciones` debe devolver nombre y patente

**Esfuerzo:** M

---

### 28. Sidebar colapsable con agrupación

**Módulo:** Global (navegación)  
**Problema:** Tres filas de navegación apiladas, duplicación de Finanzas/Marketing.  
**Criterios de aceptación:**
- Una sola sidebar colapsable a la izquierda
- 5 grupos:
  1. Operación (Torre, Viajes, Tracking, Incidencias, WhatsApp)
  2. Documentación (Remitos, POD, Rendición, Reclamos)
  3. Finanzas (Cobranzas, Facturas, Conciliación)
  4. Marketing (Hub, Campañas, Rankear)
  5. Sistema (Monitor, Métricas, Agentes)
- Solo un ítem activo a la vez
- Búsqueda global arriba

**Archivos involucrados:**
- `frontend/src/components/Sidebar.tsx` — Rediseño completo
- `frontend/src/app/(app)/layout.tsx`

**Esfuerzo:** L

---

### 29. Deep links por viaje y factura

**Módulo:** Viajes, Finanzas  
**Problema:** Las pantallas parecen iframes, sin URLs estables por entidad.  
**Criterios de aceptación:**
- `/viajes/:id` abre el detalle de un viaje específico
- `/finanzas/facturas/:id` abre una factura
- Se puede compartir el link
- Navegación con botón "atrás" funciona

**Archivos involucrados:**
- Crear rutas dinámicas en Next.js
- Refactorizar modales a páginas completas o con query params

**Esfuerzo:** M

---

### 30. Responsive: menú móvil y tablas adaptativas

**Módulo:** Global  
**Problema:** Al 300% el header recorta "EM… LOG…", sin menú móvil.  
**Criterios de aceptación:**
- Header responsive con hamburger menu < 768px
- Sidebar se colapsa en móvil
- Tablas de 9 columnas se convierten en cards apiladas en móvil
- Tested en móvil real y zoom 200%

**Archivos involucrados:**
- `frontend/src/components/Topbar.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/DataTable.tsx`
- Todos los componentes con tablas anchas

**Esfuerzo:** L

---

## Estructural (trimestre, impacto muy alto)

### 31. Capa de métricas única con definiciones compartidas

**Módulo:** Backend (global)  
**Problema:** Cada módulo calcula sus propios totales, generando contradicciones.  
**Criterios de aceptación:**
- Servicio backend `MetricsService` con:
  - Definiciones canónicas de cada métrica
  - Filtros reutilizables (fecha, estado, zona)
  - Cache de 1 minuto para queries pesadas
- Endpoints:
  - `GET /api/metrics/summary` (Torre)
  - `GET /api/metrics/viajes`
  - `GET /api/metrics/finanzas`
  - `GET /api/metrics/incidencias`
- Tests de integración que validan coherencia

**Archivos involucrados:**
- **Backend:** `backend/src/services/metrics-service.mjs` (crear)
- **Backend:** `backend/src/routes/metrics.mjs` (crear)
- Refactorizar todos los componentes para consumir estos endpoints

**Esfuerzo:** L

---

### 32. Torre de Control por excepción

**Módulo:** Torre de Control  
**Problema:** El centro lo ocupa SOL (chat), las excepciones quedan abajo del pliegue.  
**Criterios de aceptación:**
- Layout rediseñado:
  - **Arriba:** Cola priorizada de excepciones (sin asignar, demorados, paradas no previstas, incidencias críticas)
  - **Derecha:** Panel SOL colapsable
  - **Abajo:** Mapa y KPIs secundarios
- Click en excepción lleva a acción directa
- Excepciones ordenadas por criticidad y tiempo

**Archivos involucrados:**
- `frontend/src/app/(app)/page.tsx` — Rediseño completo
- Nuevos componentes: `<ExceptionsQueue>`, `<SOLPanel>`

**Esfuerzo:** L

---

### 33. Salir del esquema de iframes

**Módulo:** Global (arquitectura)  
**Problema:** Flash al cargar pantallas, sin deep links estables.  
**Criterios de aceptación:**
- Eliminar todos los iframes que cargan páginas HTML embebidas
- Convertir a componentes Next.js nativos
- Navegación instantánea
- Deep linking por entidad

**Archivos involucrados:**
- **Buscar:** `<iframe>` en todos los componentes
- Refactorizar módulos embebidos a componentes React

**Nota:** Este es un cambio arquitectónico grande. Evaluar si el patrón iframe se usa para cargar `/stitch/redesign/*.html` (mencionado en el contexto inicial). Si es así, considerar migración gradual módulo por módulo.

**Esfuerzo:** L (muy grande)

---

### 34. Sistema de diseño completo (tokens + Storybook)

**Módulo:** Global  
**Problema:** Tres dialectos de diseño coexisten sin coherencia.  
**Criterios de aceptación:**
- Tokens CSS:
  - Colores (primario, semánticos, grises)
  - Tipografía (escala, pesos)
  - Espaciado (escala de 4)
  - Sombras, border-radius
- Componentes documentados en Storybook:
  - Botones (5 variantes)
  - KPI card
  - Page header
  - Status pill
  - Tabla
  - Formularios
- Guía de uso con ejemplos

**Archivos involucrados:**
- `frontend/src/app/globals.css` — Tokens
- `frontend/src/components/ui.tsx` — Componentes
- **Crear:** `frontend/stories/` con Storybook

**Esfuerzo:** L

---

## Bugs funcionales adicionales del QA

### 35. Catálogo: nombre/descripción no persisten (POST 201)

**Módulo:** Marketing  
**Problema:** POST `/api/marketing/catalog` devuelve 201 pero nombre/descripción no se guardan.  
**Criterios de aceptación:**
- Datos se persisten correctamente
- GET devuelve el nombre guardado

**Archivos involucrados:**
- `backend/src/routes/marketing.mjs` (crear o revisar)

**Esfuerzo:** S

---

### 36. Logout / User menu: chevron no hace nada

**Módulo:** Topbar  
**Problema:** No hay logout, chevron del usuario no responde.  
**Criterios de aceptación:**
- Menú desplegable con:
  - Nombre del usuario
  - Email
  - "Cerrar sesión"
- Click en "Cerrar sesión" → logout y redirect a `/login`

**Archivos involucrados:**
- `frontend/src/components/Topbar.tsx`
- `frontend/src/lib/auth-client.ts` — Función `logout()`

**Esfuerzo:** S

---

### 37. Tracking Express: mapa carga el mundo entero

**Módulo:** Tracking Express  
**Problema:** Mapa muestra África, Australia en vez de centrarse en Argentina.  
**Criterios de aceptación:**
- Mapa centrado en Argentina por defecto
- Bounds: lat -55 a -21, lng -73 a -53
- Zoom apropiado

**Archivos involucrados:**
- `frontend/src/components/FleetMap.tsx` o componente de Tracking
- Configuración de mapa (probablemente Mapbox o Leaflet)

**Esfuerzo:** S

---

### 38. Destinos: mapa trabado en "Cargando mapa…"

**Módulo:** Destinos  
**Problema:** Spinner infinito, el mapa nunca carga.  
**Criterios de aceptación:**
- Timeout de 10 segundos
- Si falla, mostrar mensaje: "No se pudo cargar el mapa" + botón Reintentar
- Log de error para debug

**Archivos involucrados:**
- `frontend/src/components/DestinosPanel.tsx`

**Esfuerzo:** S

---

### 39. Incidencias: simulador ocupa el espacio principal

**Módulo:** Incidencias  
**Problema:** Panel de "Detección de Parada en Ruta" (simulador) deja la lista real bajo el pliegue.  
**Criterios de aceptación:**
- Lista de incidencias reales arriba
- Simulador en tab separado o colapsado por defecto

**Archivos involucrados:**
- Componente de Incidencias (buscar en `frontend/src/app/(app)/`)

**Esfuerzo:** S

---

### 40. POP/POD: placeholders de foto parecen rotos

**Módulo:** POP/POD  
**Problema:** Cajas celestes vacías sin indicación clara.  
**Criterios de aceptación:**
- Ícono de cámara + texto "Sin foto aún"
- Estado visual claro (no parece error)

**Archivos involucrados:**
- Componente de POP/POD

**Esfuerzo:** S

---

### 41. Remitos: "Remitos ▾" sin submenú

**Módulo:** Remitos  
**Problema:** Caret indica menú desplegable pero no hay submenú.  
**Criterios de aceptación:**
- **Opción A:** Quitar el caret
- **Opción B:** Implementar submenú (por tenant, por estado)

**Archivos involucrados:**
- `frontend/src/components/Sidebar.tsx`

**Esfuerzo:** S

---

### 42. Analítica: gráfico ilustrativo sin marcar explícitamente

**Módulo:** Analítica (Agentes)  
**Problema:** Gráfico con tooltip "1.120 viajes" vs "Total semana: 4 viajes", nota al pie dice "La curva del dibujo no es la serie medida".  
**Criterios de aceptación:**
- **Opción A:** Usar datos reales
- **Opción B:** Banner grande "⚠ Gráfico ilustrativo - datos de ejemplo"
- **Opción C:** Ocultar hasta tener datos reales

**Archivos involucrados:**
- Componente de Analítica

**Esfuerzo:** S (marcar) o M (implementar con datos reales)

---

### 43. Rendición: acciones solo con ícono (sin etiqueta)

**Módulo:** Rendición  
**Problema:** Botones con íconos (ojo, check, x) sin etiqueta ni tooltip.  
**Criterios de aceptación:**
- Tooltip en hover: "Ver detalle", "Aprobar", "Rechazar"
- O etiquetas visibles

**Archivos involucrados:**
- `frontend/src/components/RendicionPanel.tsx`

**Esfuerzo:** S

---

### 44. Marketing Email: sin asunto ni destinatarios

**Módulo:** Marketing  
**Problema:** Editor de email sin campos de asunto ni destinatarios.  
**Criterios de aceptación:**
- Campos visibles:
  - Para: (selector de clientes)
  - Asunto:
  - Cuerpo: (editor con vista previa)
- Vista previa renderizada del email

**Archivos involucrados:**
- Componente de Email en Marketing

**Esfuerzo:** M

---

### 45. Promociones: CANALES (COMA) como texto libre

**Módulo:** Marketing  
**Problema:** Campo "Canales" pide separar por comas en vez de selector múltiple.  
**Criterios de aceptación:**
- Selector múltiple con chips
- Canales predefinidos: WhatsApp, Email, Web, App

**Archivos involucrados:**
- Componente de Promociones

**Esfuerzo:** S

---

### 46. Login: placeholder "admin"

**Módulo:** Login  
**Problema:** Placeholder hardcodeado con credencial.  
**Criterios de aceptación:**
- Placeholder neutro: "Tu usuario" / "Correo o usuario"

**Archivos involucrados:**
- `frontend/src/app/login/page.tsx`

**Esfuerzo:** S

---

### 47. Login: sin "¿Olvidaste tu contraseña?"

**Módulo:** Login  
**Problema:** No hay recuperación de contraseña.  
**Criterios de aceptación:**
- Link "¿Olvidaste tu contraseña?"
- Flujo de reset por email

**Archivos involucrados:**
- `frontend/src/app/login/page.tsx`
- Backend: endpoint `/api/auth/forgot-password`

**Esfuerzo:** M

---

### 48. Login: sin mostrar/ocultar contraseña

**Módulo:** Login  
**Problema:** No hay ícono de "ojo" para ver la contraseña.  
**Criterios de aceptación:**
- Botón toggle tipo="password" / tipo="text"
- Ícono de ojo/ojo-tachado

**Archivos involucrados:**
- `frontend/src/app/login/page.tsx`

**Esfuerzo:** S

---

### 49. Contraste de foco de teclado poco visible

**Módulo:** Global (accesibilidad)  
**Problema:** Outline de foco en nav poco visible.  
**Criterios de aceptación:**
- Outline de 2px con contraste AA
- Color: violeta de marca o naranja alto contraste
- Visible en todos los elementos focuseables

**Archivos involucrados:**
- `frontend/src/app/globals.css` — `:focus-visible`

**Esfuerzo:** S

---

### 50. Torre: gráfico "Viajes por día" sin valores en eje Y

**Módulo:** Torre de Control  
**Problema:** Gráfico vacío o sin etiquetas.  
**Criterios de aceptación:**
- Mostrar valores reales
- Eje Y etiquetado
- Tooltip en hover con fecha y cantidad

**Archivos involucrados:**
- `frontend/src/components/Charts.tsx` — `<ViajesArea>`
- `frontend/src/lib/data.ts` — Datos `viajesPorDia`

**Esfuerzo:** S

---

## Resumen de priorización

| Prioridad | Cantidad de tareas | Esfuerzo estimado total |
|-----------|-------------------|-------------------------|
| **P0 - Bugs críticos y quick wins** | 13 | 2–3 semanas |
| **Quick wins adicionales** | 7 | 1 semana |
| **Mediano plazo** | 10 | 1–2 meses |
| **Estructural** | 4 | 1 trimestre |
| **Bugs funcionales adicionales** | 16 | 2–3 semanas |
| **TOTAL** | **50 tareas** | **~4–6 meses** |

---

## Orden de implementación sugerido (primeros 3 PRs)

### PR #1: Formatos y validaciones críticas
- Tarea 1: Artefactos de float
- Tarea 4: Fechas con timezone
- Tarea 5: Formato de fechas
- Tarea 6: Formato de moneda
- Tarea 3: Validación de precio y nombre
- Tarea 7: Estados en español

**Impacto:** Confianza en los datos, experiencia pulida  
**Esfuerzo:** 1 semana

---

### PR #2: Estado del sistema y contadores
- Tarea 9: Header lee Monitor
- Tarea 10: Agentes en línea
- Tarea 11: Fechas hardcodeadas
- Tarea 17: Paginación correcta
- Tarea 18: Viaje cancelado

**Impacto:** Elimina contradicciones críticas  
**Esfuerzo:** 1 semana

---

### PR #3: Confirmaciones y navegación
- Tarea 12: Confirmación en dinero/envío
- Tarea 13: Quitar badges "Nuevo"
- Tarea 16: "Nueva conversación" renombrado
- Tarea 19: Menú contextual (•••)
- Tarea 36: Logout

**Impacto:** Seguridad en acciones críticas, UX clara  
**Esfuerzo:** 1 semana

---

**Total primeros 3 PRs:** ~20 tareas, 3 semanas, elimina el 80% de los problemas críticos.
