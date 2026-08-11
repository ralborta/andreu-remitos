# SOL AI OS — Constitución técnica y arquitectura objetivo

**Estado del documento:** norma arquitectónica del repositorio  
**Alcance:** SOL · TransitOne (demo) y línea de evolución hacia SOL AI OS  
**Fecha de análisis:** 2026-08-11  
**Código analizado:** monorepo `andreu-remitos` (ramas `demo` / `main` — la estructura de agentes es compartida)

> **Cómo usar este documento**  
> - Es la **constitución** de SOL: futuros desarrollos (Cursor, otras IAs, humanos) deben respetarla.  
> - Describe **arquitectura objetivo**, no el estado idealizado del código actual.  
> - **No autoriza** por sí solo refactors. Toda migración debe ser explícita, incremental y aprobada.  
> - **Remitos** es el módulo operativo más maduro: **no es laboratorio** de refactorización inicial.

---

## 0. Principios fundacionales (texto canónico)

1. **SOL es una plataforma Agent-Native.** Los agentes no son una interfaz agregada sobre workflows tradicionales.
2. **El lenguaje natural siempre debe ser interpretado por un modelo de IA.** No debe utilizarse heurística basada en palabras clave como motor principal de comprensión.
3. **Las reglas determinísticas se reservan para:** seguridad, permisos, cálculos, integridad de datos, restricciones operativas, reglas de negocio.
4. **El LLM puede:** interpretar intención, comprender contexto, decidir qué herramienta utilizar, seleccionar un agente, resolver interrupciones conversacionales, sintetizar información, construir respuestas.
5. **El LLM NO ejecuta directamente modificaciones críticas.** Toda acción se realiza mediante tools controladas.
6. **Un proceso operativo y una conversación son estados diferentes.**
7. **Una conversación puede interrumpir un proceso sin cancelarlo.**
8. **Los agentes son especialistas.** No deben conocer ni implementar toda la plataforma.
9. **SOL Commander coordina.** No reemplaza el conocimiento especializado de los agentes.
10. **Los agentes se comunican principalmente mediante:** Tools, Events, Context/Handoffs.
11. **Los canales son intercambiables.** WhatsApp, Web, Mobile o API no contienen inteligencia de negocio.
12. **Ningún agente debe depender estructuralmente de** BuilderBot, Baileys, n8n o de un proveedor específico de LLM.
13. **n8n es una capa de integración y automatización,** no el cerebro de SOL.
14. **Todas las acciones de agentes deben ser trazables.**
15. **Toda nueva funcionalidad debe poder incorporarse sin modificar el núcleo del orquestador.**

---

## 1. Cuatro dimensiones (mapa general)

### 1.1 AS-IS — Cómo funciona SOL hoy

```
Canal WhatsApp
    ↓
Bot (BuilderBot + Baileys)          ← transporte + media + blacklist
    ↓  POST /api/webhooks/builderbot
API Fastify (webhooks.mjs)          ← ORQUESTADOR DE FACTO (árbol if/else)
    ↓
  Gates heurísticos + estado en conversaciones.json / stores por agente
    ↓
  Router IA (wa-intent-router) + fallbacks regex
    ↓
  Agentes especializados (lib/*-wa.mjs, *-agente.mjs, services/*)
    ↓  mutaciones directas a stores / remitos / notificarChofer
Canal de vuelta (Baileys /v1/messages o fallBack)
```

- **Inteligencia de negocio** vive mayormente en la API (`backend/src/routes/webhooks.mjs` + `lib/`), no en un Commander.
- **Canal WA** está acoplado al contrato BuilderBot (`lib/builderbot-webhook.mjs`, `lib/builderbot-send.mjs`, `bot/`).
- **Estado** es file-store JSON (conversaciones, remitos, colas por agente), no un modelo unificado proceso vs conversación.
- **LLM** se usa en varios agentes (router, viajes, destinos, POD, rendición, reclamos, incidencias), pero con **heurísticas de entrada, atajos duros y fallbacks**.
- **Tools / Event Bus / Tool Registry / Handoffs formales:** no existen como abstracciones.
- **Trazabilidad:** logs Fastify + campos `fuente`/`historial` parciales; no hay audit trail de tool calls ni de decisiones del LLM.

### 1.2 TARGET — Arquitectura objetivo SOL AI OS

```
Canales (WhatsApp | Web | Mobile | API)
    ↓  adaptadores tontos (sin negocio)
Ingress / Channel Adapter
    ↓  MessageReceived (Event)
SOL Commander (orquestador)
    ↓  clasifica con LLM + Context
    ↓  elige Agente | Tool | Handoff
Agent specialists (Remitos, Viajes, Destinos, POD, …)
    ↓  solo vía Tool Registry
Tools controladas (mutaciones, OCR, Maps, notificaciones, …)
    ↓  emiten Events
Stores / Projections (proceso operativo ≠ hilo conversacional)
    ↓
Trace store (decisiones LLM, tool calls, handoffs)
```

Propiedades obligatorias del TARGET:

- Comprensión de lenguaje natural = **LLM** (heurística solo emergencia / feature-flag).
- Mutaciones críticas = **tools** con validación determinística.
- **Proceso** (remito abierto, viaje pendiente, incidencia INC-…) ≠ **Conversación** (hilo de mensajes).
- Interrupciones: el Commander puede pausar/apilar un proceso sin cancelarlo.
- Canales y proveedores LLM **intercambiables** detrás de interfaces.
- Nuevos agentes = registro + tools + eventos, **sin editar el núcleo del Commander**.

### 1.3 GAP — Qué nos separa

| Área | Gap principal |
|------|----------------|
| Orquestación | `webhooks.mjs` es un árbol de decisión monolítico, no SOL Commander |
| Comprensión NL | Heurísticas `parece*` y regex siguen siendo gates de entrada |
| Tools | Mutaciones invocadas como funciones internas, sin registry ni contrato |
| Events | No hay bus; side-effects síncronos en el request |
| Handoffs | `forzar` / `pending` / `flujoRemitoAbierto` ad hoc |
| Canal | Contrato BuilderBot + Baileys en el camino crítico |
| LLM provider | `fetch` directo a OpenAI/Gemini por módulo |
| Estado | Conversación y proceso mezclados en JSON por teléfono |
| Trace | Sin registro estructurado de decisiones/tool calls |
| Extensibilidad | Nuevo agente = tocar `webhooks.mjs` (viola principio 15) |

### 1.4 MIGRATION — Evolución sin romper

Principios de migración (obligatorios):

1. **Strangler:** introducir Commander/Tools/Events **alrededor** del flujo actual; no reescribir Remitos de entrada.
2. **Remitos last (o casi):** no usar Remitos como laboratorio; migrar primero routing, canales y agentes menos maduros.
3. **Feature flags:** `WA_ROUTER_IA_ENABLED`, futuros `SOL_COMMANDER_ENABLED`, etc.; fallback al AS-IS.
4. **No convertir workflows en nuevas heurísticas.** Si hoy un `if` regex decide, el reemplazo es LLM+tool, no otro árbol más grande.
5. **Preservar reglas determinísticas** de validación, permisos, cálculos e integridad (principio 3).
6. **No microservicios por moda:** primero límites de módulo y contratos en el monorepo.
7. **No reemplazar Baileys/n8n/OpenAI por iniciativa propia:** abstraer detrás de puertos; el adapter actual puede permanecer.

Orden sugerido (alto nivel; el **próximo paso** concreto está al final):

1. Documentar y congelar esta constitución ← **este documento**  
2. Introducir **puerto de canal** + **Trace mínimo** (sin cambiar comportamiento)  
3. Extraer **SOL Commander** del routing de `webhooks.mjs` (mismo comportamiento)  
4. **Tool Registry** para mutaciones no-Remitos  
5. Separar **Process state** vs **Conversation state**  
6. Reducir heurísticas de comprensión a emergencia  
7. Remitos: solo cuando el orquestador esté estable  

---

## 2. Evaluación principio por principio

Leyenda: **CUMPLIDO** | **PARCIAL** | **PENDIENTE**

---

### Principio 1 — Plataforma Agent-Native

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | Agentes de dominio (Remitos, Viajes, Destinos, POD, Rendición, Incidencias, ETA, Reclamos) con UI y backends propios. |
| **Dónde** | `frontend/src/lib/agents.ts`, `lib/*-wa.mjs`, `lib/*-agente.mjs`, `backend/src/services/*-agent.mjs`, páginas `/agentes/[slug]`. |
| **Gap** | El “cerebro” sigue siendo un **workflow webhook** (`webhooks.mjs`) que despacha a funciones. Los agentes son módulos llamados desde un pipeline tradicional, no ciudadanos de un runtime Agent-Native. |

---

### Principio 2 — Lenguaje natural interpretado por IA (no heurística como motor principal)

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | `clasificarIntencionWhatsApp` usa OpenAI como camino preferente; varios agentes (Viajes, Destinos, POD, Reclamos, Rendición, Incidencias) llaman LLM. |
| **Dónde** | `lib/wa-intent-router.mjs`, `lib/viajes-agente.mjs`, `lib/destinos-ia.mjs`, `lib/pod-wa.mjs`, `lib/reclamos-wa.mjs`, `lib/rendicion-wa.mjs`, `lib/incidencias-wa.mjs`. |
| **Gap** | Persisten **atajos duros** y **fallback regex** que actúan como motor cuando la IA falla o incluso **antes** de la IA (`pareceQuiereRemito`). Gates `parece*` en el webhook **sustituyen** comprensión. Ver §3 inventario de heurísticas. |

---

### Principio 3 — Reglas determinísticas solo para seguridad / permisos / cálculos / integridad / negocio

**Situación: PARCIAL**

| | |
|--|--|
| **Existe (bien)** | Auth JWT + roles; validación de remitos/horarios; match de maestros; blacklist/pausa bot; “solo choferes” en rendición/incidencia; OCR + enrich determinístico de campos documentales. |
| **Dónde** | `backend` auth; `lib` validación/enriquecer; `webhooks.mjs` (permisos de rol operativo); Document AI + regex de extracción documental. |
| **Gap** | Muchas reglas “determinísticas” actuales son en realidad **clasificadores de lenguaje** (principio 2), no reglas de negocio. Hay que **reclasificar**: regex de patente/hora/peso sobre un campo ya interpretado = OK; regex para “¿qué quiere el usuario?” = deuda. |

**Nota:** La extracción OCR / parseo de campos estructurados (patentes, KM, horas) **sí** puede seguir siendo determinística o híbrida: no es “comprensión conversacional”.

---

### Principio 4 — Capacidades permitidas del LLM

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | Intención (router), contexto de diálogo (viajes/destinos/reclamos), síntesis de respuestas, algo de “qué falta pedir”. |
| **Dónde** | Mismos módulos IA de §P2. |
| **Gap** | El LLM **casi no** “elige tools” ni “selecciona agente” vía un protocolo de tools; el código TypeScript/JS elige el agente con `if (intent === …)`. Interrupciones conversacionales se resuelven con flags ad hoc, no con un modelo de stack de procesos. |

---

### Principio 5 — LLM no muta; solo tools controladas

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | En la práctica el LLM suele devolver JSON y el código aplica cambios (stores, `actualizarCampos`, etc.). No hay “el modelo escribe directo en la DB”. |
| **Dónde** | Agentes WA + services. |
| **Gap** | No hay **Tool Registry** ni contrato uniforme (nombre, schema, permisos, audit). Las “tools” son imports internos. Riesgo: prompts que empujan side-effects implícitos o mutaciones sin validación homogénea. |

---

### Principio 6 — Proceso operativo ≠ conversación

**Situación: PENDIENTE** (con indicios PARCIALES)

| | |
|--|--|
| **Existe** | Entidades de proceso (remito, solicitud viaje, POD, gasto, incidencia, ETA) en stores separados; conversación en `conversaciones.json`. |
| **Dónde** | `backend/src/db/*-store.mjs`, `conversations-store.mjs`. |
| **Gap** | El orquestador mezcla ambos: `flujoRemitoAbierto(conv)`, `ultimo_remito_id`, `remito_en_revision_id`, `pending` viaje en el mismo hilo telefónico. No hay modelo explícito `Process` + `Conversation` + vínculo. |

---

### Principio 7 — La conversación puede interrumpir un proceso sin cancelarlo

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | Intentos: router puede forzar viaje/reclamo aunque haya contexto; Destinos documenta “chat = handoff”; pausa de bot humana. |
| **Dónde** | `webhooks.mjs` (`forzar`, `flujoRemitoAbierto`), `destinos.mjs` comentarios handoff, Contactos `bot_pausado`. |
| **Gap** | No hay **stack de procesos** ni política formal de interrupción/reanudación. Interrumpir suele “ganar el último if” o dejar estados inconsistentes. |

---

### Principio 8 — Agentes especialistas

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | Módulos por dominio con prompts y stores propios. |
| **Dónde** | `lib/viajes-agente.mjs`, `lib/pod-wa.mjs`, etc. |
| **Gap** | `webhooks.mjs` conoce **todos** los agentes y sus condiciones. Varios agentes importan utilidades de canal (`notificarChofer` / builderbot). Fronteras permeables. |

---

### Principio 9 — SOL Commander coordina

**Situación: PENDIENTE**

| | |
|--|--|
| **Existe** | Función de facto: `enrutarPorIntencion` + pipeline del webhook. |
| **Dónde** | `backend/src/routes/webhooks.mjs`. |
| **Gap** | No existe componente nombrado **SOL Commander** con API estable, plugins de agentes y sin lógica de dominio embebida. |

---

### Principio 10 — Comunicación vía Tools, Events, Context/Handoffs

**Situación: PENDIENTE**

| | |
|--|--|
| **Existe** | Llamadas de función síncronas; algunos `historial` por entidad; flag `forzar` como proto-handoff. |
| **Dónde** | Services + stores. |
| **Gap** | Sin Event Bus, sin Handoff object (`fromAgent`, `toAgent`, `reason`, `contextSnapshot`), sin Tools como ciudadanos de primera clase. |

---

### Principio 11 — Canales intercambiables

**Situación: PENDIENTE** (parcial mínimo en Web upload)

| | |
|--|--|
| **Existe** | Ingesta manual de remito por web (`/api/remitos/ingest`); UI de mesa. |
| **Dónde** | Frontend + routes remitos. |
| **Gap** | El camino conversacional está modelado como **WhatsApp/BuilderBot event**. No hay `ChannelMessage` neutro. Mover a otro canal implica reescribir adapters y parte del orquestador. |

---

### Principio 12 — Sin dependencia estructural de BuilderBot / Baileys / n8n / LLM vendor

**Situación: PENDIENTE** (con mitigaciones)

| | |
|--|--|
| **Existe** | Baileys self-hosted; envío preferente por HTTP interno; n8n **no** es el cerebro. Algunos agentes intentan OpenAI luego Gemini. |
| **Dónde** | `bot/`, `lib/builderbot-*.mjs`, `lib/destinos-ia.mjs`, `lib/viajes-agente.mjs`. |
| **Gap** | Nombres, payloads y flujos asumen BuilderBot. LLM se invoca con `fetch` hardcodeado a URLs de vendor en cada archivo. No hay `LlmPort` / `ChannelPort` únicos. |

---

### Principio 13 — n8n no es el cerebro

**Situación: CUMPLIDO** (en el diseño actual del producto)

| | |
|--|--|
| **Existe** | Orquestación en API Node; n8n no aparece como runtime de agentes en el camino crítico SOL/TransitOne. |
| **Gap** | Mantener esta frontera: n8n solo integraciones/automatizaciones periféricas si se incorpora. |

---

### Principio 14 — Acciones de agentes trazables

**Situación: PARCIAL**

| | |
|--|--|
| **Existe** | Logs (`fuente`, `intent`, `confianza`); historiales en POD/Rendición/Incidencias; mensajes en Contactos. |
| **Dónde** | Logger Fastify; stores de agentes; `conversaciones.json`. |
| **Gap** | No hay **trace id** de extremo a extremo, ni registro de prompt/completion/tool calls con input/output sanitizado, ni quién decidió el handoff. Imposible auditar “por qué el Commander eligió X”. |

---

### Principio 15 — Nuevas funcionalidades sin modificar el núcleo del orquestador

**Situación: PENDIENTE**

| | |
|--|--|
| **Existe** | Agregar un agente hoy implica editar `webhooks.mjs` (imports, `tryProcesar*`, ramas de `enrutarPorIntencion`) y a menudo el bot. |
| **Gap** | Viola explícitamente este principio. TARGET: registro de agente (`manifest` + tools + events) descubierto por el Commander. |

---

## 3. Inventario de heurísticas que sustituyen comprensión LLM

> Criterio: si el código decide **qué quiere decir el usuario / a qué agente va / si “parece” X** con keywords/regex/gates **en lugar de** (o **antes de**) un modelo, se lista aquí.  
> **No** se listan como deuda: validaciones de negocio, parseo de campos ya estructurados, OCR regex de odómetro/patente, auth, permisos.

| # | Archivo / componente | Qué hace hoy | Por qué es heurística (deuda P2) |
|--|----------------------|--------------|----------------------------------|
| H1 | `lib/wa-intent-router.mjs` → `pareceQuiereRemito` | Atajo **antes** de la IA: si el texto matchea remito/guía/foto… → intent `remito` | Clasificación semántica por regex; el propio comentario admite que evita fallos de IA |
| H2 | `lib/wa-intent-router.mjs` → `clasificarIntencionHeuristica` | Fallback completo por keywords (rendición, incidencia, remito, reclamo, viaje) | Motor de comprensión de respaldo **y** camino si no hay API key |
| H3 | `backend/src/routes/webhooks.mjs` → `esConfirmacionOk` / `esNegacion` | Detecta “ok/dale/listo/si…” y negaciones para cerrar remito | Comprensión de confirmación conversacional por lista cerrada |
| H4 | `lib/correcciones-chofer.mjs` → `pareceCorreccionRemito` + parsers | Decide si el texto es corrección y extrae campos con regex | Parte **gate** (parece corrección) es comprensión; la extracción de `AH318WB` / `6,10` puede ser regla de negocio **después** de que el LLM diga “es corrección” |
| H5 | `lib/correccion-ia.mjs` → `pareceCorreccionRemito` | Misma familia de gate por keywords | Duplica H4 como filtro previo |
| H6 | `lib/viajes-solicitud.mjs` → `pareceSolicitudViaje` + `parseRegex` | Detecta pedido de flete y parsea origen/destino/tn | Gate de entrada histórico; compite con router IA |
| H7 | `lib/viajes-agente.mjs` → fallback heurístico de turno (`fuente: "heuristica"`) | Si el LLM falla, interpreta confirmar/rechazar/selección con reglas | Comprensión de diálogo de propuesta por keywords |
| H8 | `lib/rendicion-wa.mjs` → `pareceRendicionGasto` + `heuristicaGasto` | Gate y categorización de gasto por keywords | Sustituye interpretación de intención/categoría |
| H9 | `lib/incidencias-wa.mjs` → `pareceIncidenciaEnRuta` | Detecta pinchazo/parado/policía… por regex | Gate de incidencia; también exclusiones por keywords de rendición/remito |
| H10 | `lib/reclamos.mjs` → `pareceConsultaEstadoReclamo` | Detecta consulta de estado de reclamo | Comprensión de intención de consulta |
| H11 | `lib/destinos-ia.mjs` / `lib/destinos.mjs` | Fallbacks heurísticos de confirm/ETA/demora cuando no hay IA | Comprensión de confirmación y tiempos |
| H12 | `lib/pod-wa.mjs` → `parecePod` (capa IA con fallbacks) | Entrada a POD; documenta “100% IA” pero el webhook aún puede gatear | Revisar que no reintroduzca keywords como motor |
| H13 | `backend/src/routes/webhooks.mjs` pipeline | Orden fijo: destinos → remito abierto → viajes pending → rendición/pod/reclamo/incidencia → router | **Árbol de decisión** que reemplaza política de Commander+LLM |
| H14 | `lib/detectar-tenant.mjs` (Andreu multi-tenant) | Heurística OCR de tenant | Más cercano a clasificación documental; en demo SOL está forzado a TSB — menor prioridad |

**Regla de migración para H\*:** el gate `parece*` debe degradarse a (a) feature-flag de emergencia, o (b) validación **post**-LLM, nunca motor principal.

---

## 4. Deuda técnica explícita (checklist)

### 4.1 Heurísticas para interpretar lenguaje

Ver §3 (H1–H14). Concentración máxima: `wa-intent-router.mjs`, `webhooks.mjs`, `viajes-solicitud.mjs`, `correcciones-chofer.mjs`, `*-wa.mjs` gates.

### 4.2 Routing por keywords / regex / gates / árboles

- **Árbol principal:** `backend/src/routes/webhooks.mjs` (cientos de líneas de control de flujo).
- **Router híbrido:** `lib/wa-intent-router.mjs`.
- **Gates por agente:** `pareceRendicionGasto`, `pareceIncidenciaEnRuta`, `pareceSolicitudViaje`, `parecePod`, etc.

### 4.3 Acoplamiento conversacional ↔ Baileys / BuilderBot

| Pieza | Rol |
|-------|-----|
| `bot/src/app.js` | Flows BuilderBot + `fallBack` + blacklist |
| `bot/src/andreu-api.js` | Forward al webhook con contrato BuilderBot |
| `lib/builderbot-webhook.mjs` | Normalización del evento entrante |
| `lib/builderbot-send.mjs` | Envío + blacklist (Baileys o cloud) |
| `webhooks.mjs` → `notificarChofer` | Side-effect de canal dentro del orquestador |

La inteligencia no debería importar estos módulos; un **Channel Adapter** sí.

### 4.4 Estado y memoria conversacional

- `backend/src/db/conversations-store.mjs` → `conversaciones.json` (mensajes, `ultimo_remito_id`, `remito_en_revision_id`, `bot_pausado`, correcciones pendientes, flags Corina, etc.).
- Stores por agente (viajes solicitudes, POD, rendición, incidencias, ETA, destinos).
- **Falta:** modelo `Conversation` vs `Process`, memoria de largo plazo tipada, context window policy para el LLM.

### 4.5 Ausencia de SOL Commander

No hay módulo `commander` / `orchestrator` con registro de agentes. El sustituto es `webhooks.mjs`.

### 4.6 Ausencia de Tool Registry

Mutaciones: `ingestarRemito`, `actualizarCampos`, `crearSolicitud`, `decidirPod`, geocode, `sendWhatsAppMessage`, etc. — sin catálogo, sin schema JSON unificado, sin ACL por tool.

### 4.7 Ausencia de Event Bus

Todo es request/response síncrono. No hay `RemitoCreated`, `HandoffRequested`, `ProcessInterrupted` consumibles por otros agentes.

### 4.8 Handoffs entre agentes

Proto-handoffs: `forzar`, salida `intent: chat` en Destinos, comentarios en código. Sin objeto Handoff ni reanudación garantizada del proceso previo.

### 4.9 Comunicación agente ↔ agente

No existe. Solo orquestador → agente. Un agente no emite evento para que otro actúe (salvo efectos colaterales en stores compartidos).

### 4.10 Trazabilidad de decisiones LLM y tool calls

- Hay `log.info` con `fuente`/`intent`.
- No hay store de traces ni correlación `messageId → decisionId → toolCallId`.
- Completions no se persisten de forma auditables (salvo efectos en historial de negocio).

---

## 5. Remitos — zona sensible

**Política:** Remitos es el módulo más maduro (OCR Document AI, validación, planillas, correcciones WA, Contactos).  

- **No** iniciar la migración Agent-Native reescribiendo Remitos.  
- Sí se puede:  
  - dejar que el Commander **despache** a Remitos como agente opaco;  
  - envolver mutaciones críticas de Remitos en tools **sin cambiar su implementación interna**;  
  - mantener validaciones determinísticas y OCR como están.  
- Heurísticas **dentro** de Remitos que son parseo de campos (`correcciones-chofer` extracción de patente/hora) se tratan distinto a gates de “¿esto es un remito?” (H1/H4 gate).

---

## 6. AS-IS vs TARGET (diagrama mental)

```
AS-IS                         TARGET
─────                         ──────
WhatsApp=canal+contrato       Channel adapters (WA/Web/API)
webhooks.mjs = cerebro        SOL Commander
parece* + if/else             LLM + policy + tools
stores mezclados              Process store ≠ Conversation
notificarChofer en agentes    Tool: notify_channel
logs sueltos                  Trace store
editar webhook p/agente nuevo Agent manifest + registry
```

---

## 7. MIGRATION — principios operativos para PRs futuros

Todo PR que toque agentes / WA / orquestación debe declarar:

1. ¿Respeta los 15 principios? ¿Cuál mejora?  
2. ¿Introduce heurística de comprensión? → **prohibido** salvo flag de emergencia documentado.  
3. ¿Toca Remitos? → justificar; preferir no.  
4. ¿Acopla a Baileys/BuilderBot/OpenAI URL? → debe ir detrás de puerto o quedar en adapter.  
5. ¿Agrega agente nuevo editando el núcleo? → rechazar si ya existe Commander; si no, documentar deuda temporal.

---

## 8. Próximo paso arquitectónico (solo propuesta — no implementar)

### Recomendación

**Extraer y nombrar el “SOL Commander” como fachada de orquestación, sin cambiar comportamiento**, empezando por el **routing de intención** (hoy `enrutarPorIntencion` + `clasificarIntencionWhatsApp`), **antes** de Tool Registry o Event Bus.

### Por qué este y no otro

1. Ataca el gap del **principio 9 y 15** (núcleo identificable).  
2. No exige reescribir Remitos.  
3. Permite en el paso siguiente enchufar Trace y Channel Port sin big-bang.  
4. Evita el error de “armar Event Bus vacío” o “microservicios” sin dueño del flujo.  
5. Deja las heurísticas H1–H2 visibles en un solo módulo para degradarlas después bajo flag.

### Qué **no** hacer en ese paso

- No eliminar heurísticas todavía (solo aislarlas).  
- No cambiar Baileys ni proveedor LLM.  
- No refactorizar OCR/Remitos.  
- No introducir n8n como orquestador.

### Criterio de éxito del próximo paso (cuando se autorice implementar)

- Un módulo/paquete `commander` (o equivalente) es el **único** punto que el webhook llama para “decidir agente”.  
- `webhooks.mjs` queda como adapter HTTP + side-effects de transporte, no como cerebro.  
- Comportamiento observable de producción/demo **idéntico** (parity).  
- Esta constitución se cita en el PR.

---

## 9. Resumen ejecutivo de madurez

| Principio | Estado |
|-----------|--------|
| 1 Agent-Native | PARCIAL |
| 2 NL → LLM | PARCIAL |
| 3 Reglas determinísticas acotadas | PARCIAL |
| 4 Capacidades LLM | PARCIAL |
| 5 Tools controladas | PARCIAL |
| 6 Proceso ≠ conversación | PENDIENTE |
| 7 Interrumpir sin cancelar | PARCIAL |
| 8 Agentes especialistas | PARCIAL |
| 9 SOL Commander | PENDIENTE |
| 10 Tools / Events / Handoffs | PENDIENTE |
| 11 Canales intercambiables | PENDIENTE |
| 12 Independencia de vendors | PENDIENTE |
| 13 n8n ≠ cerebro | CUMPLIDO |
| 14 Trazabilidad | PARCIAL |
| 15 Extensión sin tocar núcleo | PENDIENTE |

**Lectura:** SOL ya tiene **piezas de agentes e IA**, pero opera como **plataforma con agentes enchufados a un webhook monolítico**. La constitución fija el destino: **Agent-Native con Commander, tools, events y canales tontos**.

---

*Documento normativo. Cambios a estos principios requieren decisión explícita de producto/arquitectura, no un refactor oportunista.*
