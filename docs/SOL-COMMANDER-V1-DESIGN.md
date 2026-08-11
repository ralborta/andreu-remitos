# SOL Commander v1 — Especificación técnica (diseño)

**Estado:** **aprobado para implementación v1** (corrección process-policy aplicada)  
**Base normativa:** [`docs/SOL-AI-OS-CONSTITUCION.md`](./SOL-AI-OS-CONSTITUCION.md)  
**Modo:** fachada incremental / **strangler** sobre AS-IS  
**Rama de referencia:** `demo` (SOL / TransitOne) — **no tocar Andreu `main` / logistica**  
**Corrección arquitectónica (2026-08-11):** *no hay pipeline pre-Commander*; toda decisión conversacional pasa por SOL Commander vía `LegacyProcessPolicy`.

> Remitos no se modifica internamente. Sin Tool Registry / Event Bus / handoffs reales en v1.

---

## 0. Objetivo de v1

Introducir **SOL Commander** como el **único punto arquitectónico de decisión** conversacional/operativa de enrutamiento:

- ¿El mensaje continúa un proceso activo?
- ¿Qué intención tiene?
- ¿Qué agente atiende?
- ¿Se anota interrupción (informativa en v1)?

v1 **envuelve** el comportamiento actual (`flujoRemitoAbierto`, destinos sticky, viaje pending, `enrutarPorIntencion`, `clasificarIntencionWhatsApp`, etc.) **sin cambiar parity observable**.

### Principio rectificado (obligatorio)

> **TODO mensaje normalizado pasa primero por SOL Commander.**  
> No existe un pipeline *pre-Commander* que tome decisiones conversacionales.

La lógica legacy de prioridad/stickiness **no se elimina ni se “mejora”**: se **encapsula** dentro de Commander como **`LegacyProcessPolicy`** (o nombre equivalente), 1:1 con el orden y las limitaciones actuales.

v1 **no** implementa Tool Registry, Event Bus ni Handoffs formales; solo deja **hooks / tipos / seams** para ellos.

---

## 1. Flujo final de V1 (canónico)

```
Channel Adapter (webhooks.mjs)
    → normaliza mensaje (BuilderBot/Baileys contract → InboundMessage)
    → I/O de canal (media download, appendMensaje inbound, auth, bot_pausado)
    → SOL Commander.decide(input)
           → 1) build ConversationContext + detect ProcessContext[]
           → 2) LegacyProcessPolicy.evaluate(...)     // stickiness AS-IS, 1:1
           → 3) si policy dice “pertenece al proceso activo”
                   → CommanderDecision { action: continue_process | run_agent(dueño), ... }
           → 4) si no → IntentRouter (wa-intent-router encapsulado; H1–H14 intactas)
           → 5) Agent Registry.resolve(intent, actor)
           → 6) CommanderDecision
    → Executor (mapa executorKey → tryProcesar* / procesarTextoChofer / ingest foto…)
    → side-effects de canal (notificarChofer, appendMensaje outbound, shape webhook)
```

**Resumen de una línea:**

`Channel Adapter → SOL Commander → Process Policy → Intent Router → Agent Registry → CommanderDecision → Executor`

---

## 2. Responsabilidad exacta de SOL Commander (v1)

### 2.1 Commander **SÍ** hace

1. Recibir **todos** los mensajes de canal ya normalizados (texto, media, location).
2. Construir / refrescar **ConversationContext** y detectar **ProcessContext[]**.
3. Evaluar primero **`LegacyProcessPolicy`** (parity sticky: remito abierto, destinos, viaje pending, etc.).
4. Si la policy no retiene el mensaje: **clasificar intención** vía router encapsulado.
5. **Seleccionar agente** vía Agent Registry.
6. Devolver **CommanderDecision** (único output de decisión).
7. Trace ligero: intent/policy branch, confianza, fuente, agente, processId, `interruptedProcessId` informativo.
8. Ser el **único** módulo que decide routing conversacional (principio 9 / 15 de la constitución).

### 2.2 Commander **NO** hace (v1)

- Descargar media ni hablar con Baileys/BuilderBot.
- Ejecutar OCR / Document AI / mutar remitos u otros stores de dominio.
- Enviar WhatsApp (`notificarChofer` queda en el adapter/executor).
- Conocer implementación interna de agentes (solo `executorKey`).
- Implementar Tool Registry / Event Bus / stack real de interrupciones (v1.1).
- “Mejorar” sticky de Remitos ni la semántica de interrupciones.

---

## 3. Qué sale de `webhooks.mjs` vs qué permanece

### 3.1 Sale hacia Commander (toda decisión conversacional)

| Bloque actual en `webhooks.mjs` | Destino v1 |
|---------------------------------|------------|
| Early-returns sticky: destinos activos, `flujoRemitoAbierto` → correcciones/confirmación, viaje `pending`, gates que eligen agente **antes** del router | **`LegacyProcessPolicy`** (misma lógica, nuevo dueño) |
| `enrutarPorIntencion` + mapeo intent→agente | **IntentRouter** + **Agent Registry** + `decide()` |
| Cualquier `if` que decida “quién atiende” el mensaje | **Prohibido** fuera de Commander cuando `SOL_COMMANDER_V1=true` |

### 3.2 Permanecen en `webhooks.mjs` (Channel Adapter + Executor)

| Responsabilidad | Por qué queda |
|-----------------|---------------|
| HTTP webhook + parse BuilderBot (`builderbot-webhook`) | Canal |
| Download media / buffers | I/O canal |
| `appendMensaje` inbound/outbound | Persistencia de hilo (luego Tool) |
| `notificarChofer` / respuesta silent | Transporte |
| Auth del endpoint | Seguridad (P3) |
| **Executor:** invocar `tryProcesar*`, `procesarTextoChofer`, ingest de foto remito, según `Decision.executorKey` | Ejecución, no decisión |
| Feature flag / shadow | Rollback |
| Shape `respuestaWebhook` | Contrato HTTP legacy |

### 3.3 Frontera clara v1

```
webhooks.mjs     = Channel Adapter + Executor + side-effects WA
lib/commander/*  = ÚNICO cerebro de decisión (policy + intent + registry)
lib/*-wa, services/* = agentes (contratos públicos iguales)
```

**Importante:** con flag ON, el adapter **no** evalúa “¿hay remito abierto?” para elegir camino; eso lo hace `LegacyProcessPolicy` **dentro** de `decide()`.

---

## 4. LegacyProcessPolicy (abstracción central de la corrección)

### 4.1 Rol

Encapsular **1:1** el orden y las reglas sticky actuales del webhook (limitaciones incluidas), de modo que:

- el comportamiento observable no cambie;
- arquitectónicamente **ya no existan** decisiones conversacionales *pre-Commander*;
- Remitos / Destinos / Viajes pending no se “arreglen” todavía.

### 4.2 Contrato

```ts
interface LegacyProcessPolicyInput {
  message: CommanderInboundMessage;
  conversation: ConversationContext;
  processes: ProcessContext[];
  actor: CommanderDecideInput["actor"];
  log?: CommanderDecideInput["log"];
}

type LegacyProcessPolicyResult =
  | {
      handled: true;
      /** Decisión parcial que Commander completa (decisionId, trace). */
      decision: Omit<CommanderDecision, "decisionId" | "trace"> & {
        traceNotes?: string[];
      };
    }
  | {
      handled: false;
      /** Continuar a Intent Router. */
      reason?: string;
    };

interface LegacyProcessPolicy {
  evaluate(input: LegacyProcessPolicyInput): Promise<LegacyProcessPolicyResult>;
}
```

### 4.3 Contenido inicial (parity — copiar orden AS-IS, no inventar)

La implementación (cuando se autorice) debe portar el **mismo orden efectivo** que hoy tiene el handler de mensajes en `webhooks.mjs`, por ejemplo (ilustrativo; el PR de código debe diff-checkear contra el árbol real):

1. Flujos **Destinos** activos (cliente/chofer) si hoy cortan antes del router.  
2. **Remito en revisión** (`flujoRemitoAbierto` / `remito_en_revision_id`) → continuación de correcciones / confirmación OK / negación → `continue_process` / `run_agent` con `executorKey` de remitos-texto.  
3. **Solicitud de viaje pending** → `continue_process` / `run_agent` viajes.  
4. Otros early-binds que hoy existan **antes** de `enrutarPorIntencion`.  
5. Si nada aplica → `handled: false` → Intent Router.

**No** añadir reglas nuevas de stickiness.  
**No** suavizar el limbo de interrupciones Remitos↔incidencia (queda para v1.1).

### 4.4 Relación con Intent Router

```
decide():
  policy = LegacyProcessPolicy.evaluate(...)
  if policy.handled → return finalize(policy.decision)
  intent = IntentRouter.classify(...)          // H1–H14 intactas
  agent  = AgentRegistry.resolve(intent, actor)
  return finalize({ action: run_agent | ask_clarification | noop, ... })
```

---

## 5. Contrato de entrada

```ts
type ChannelId = "whatsapp" | "web" | "api" | "mobile";

interface CommanderInboundMessage {
  messageId: string;
  channel: ChannelId;
  subjectId: string;
  displayName?: string | null;
  text?: string | null;
  hasMedia: boolean;
  mediaKind?: "image" | "audio" | "document" | "video" | "location" | null;
  mediaRef?: { mime?: string | null };
  location?: unknown;
  receivedAt: string;
  rawChannelEventId?: string;
}

interface CommanderDecideInput {
  message: CommanderInboundMessage;
  conversation: ConversationContext;
  processes: ProcessContext[];
  actor: {
    isChoferRemitos: boolean;
    isChoferFlotaViajes: boolean;
    isChoferOperativo: boolean;
    choferNombre?: string | null;
    tenantHint?: string | null;
  };
  log?: { info?: Function; warn?: Function; error?: Function };
}
```

**Adapter:** siempre llama `decide()` para mensajes normalizados elegibles (texto/media/location que hoy entran al cerebro). No hay rama “skip Commander porque hay remito abierto”.

**Reutilización actor:** `master.resolverChoferPorTelefono`, `resolverChoferIncidencia` (igual que hoy).

---

## 6. Contrato de salida

```ts
type IntentId =
  | "remito"
  | "viaje"
  | "reclamo"
  | "rendicion"
  | "incidencia"
  | "pod"
  | "chat"
  | "desconocido"
  | "continue_process";

type DecisionAction =
  | "run_agent"
  | "ask_clarification"
  | "continue_process"
  | "noop";

interface CommanderDecision {
  decisionId: string;
  intent: IntentId;
  confidence: number;
  intentSource: "ia" | "heuristica" | "process_binding" | "policy";
  agentId: string | null;
  action: DecisionAction;
  processId?: string | null;
  processType?: ProcessType | null;
  /** Solo informativo en v1; stack real = v1.1 */
  interruptedProcessId?: string | null;
  suggestedReply?: string | null;
  forceAgent: boolean;
  executorHints?: {
    executorKey: string;
    legacyFlow?: string;
  };
  trace: {
    branch: "legacy_process_policy" | "intent_router";
    routerRaw?: unknown;
    notes?: string[];
  };
}
```

**Nota:** se elimina `defer_to_pipeline` como acción de “dejar que el webhook decida”. El webhook **ejecuta**; no **decide**. Si hace falta el comportamiento sticky, sale de `LegacyProcessPolicy` como `continue_process` / `run_agent`.

---

## 7. ConversationContext

```ts
interface ConversationContext {
  subjectId: string;
  tenant?: string | null;
  displayName?: string | null;
  botPaused: boolean;
  recentMessages: Array<{
    from: "customer" | "bot" | "human";
    text?: string | null;
    at: string;
    agentTag?: string | null;
  }>;
  legacy: {
    ultimoRemitoId?: string | null;
    remitoEnRevisionId?: string | null;
    correccionesPendientes?: unknown;
    corinaClienteMarca?: string | null;
  };
  interruptStack: InterruptFrame[]; // v1: [] o solo anotaciones; v1.1: stack real
}

interface InterruptFrame {
  processId: string;
  processType: ProcessType;
  agentId: string;
  pausedAt: string;
  reason: "user_lateral_intent" | "human_takeover" | "policy";
  resumeHint?: string | null;
}
```

Fuentes: `conversations-store.getConversacion`, campos legacy actuales.

---

## 8. ProcessContext (modelo inicial)

```ts
type ProcessType =
  | "remito_revision"
  | "viaje_solicitud"
  | "destino_confirmacion"
  | "destino_eta_chofer"
  | "pod_caso"
  | "rendicion_gasto"
  | "incidencia"
  | "reclamo"
  | "eta_item";

type ProcessStatus = "active" | "paused" | "waiting_user" | "closed";

interface ProcessContext {
  processId: string;
  type: ProcessType;
  status: ProcessStatus;
  agentId: string;
  subjectId: string;
  stickiness: number;
  updatedAt: string;
  refs: Record<string, string | null | undefined>;
}
```

### Detectores (solo lectura; alimentan policy + trace)

| ProcessType | Fuente AS-IS | stickiness sugerida |
|-------------|--------------|---------------------|
| `remito_revision` | `remito_en_revision_id` / `flujoRemitoAbierto` | 80 |
| `viaje_solicitud` | `getSolicitudPendientePorTelefono` | 70 |
| `destino_*` | destinos-store / flags actuales | 75 |
| otros | stubs `[]` hasta que la policy legacy los necesite | — |

`LegacyProcessPolicy` puede usar `processes[]` **y/o** leer los mismos flags que hoy (durante el port 1:1), siempre **dentro** de Commander.

---

## 9. Intención, confianza, agente; interrupciones

### 9.1 Intent + confianza

- De `clasificarIntencionWhatsApp` cuando la policy no retuvo el mensaje.
- `intentSource`: `policy` / `process_binding` si ganó LegacyProcessPolicy; `ia` | `heuristica` si vino del router.

### 9.2 Selección de agente

Solo vía **Agent Registry** (tabla de manifests). Prohibido nuevo `if (intent===…)` de negocio fuera del registry/bootstrap.

### 9.3 Interrupciones

- **v1:** si el router elige otro agente con proceso activo, se puede setear `interruptedProcessId` **informativo** en el Decision; **no** hay stack real ni cambio de sticky Remitos.  
- **v1.1:** push/pop `interruptStack`, `status=paused`, reanudación explícita.

---

## 10. Encapsulación del router (H1–H14 intactas)

```
commander/intent/LegacyWaIntentRouter
  └── lib/wa-intent-router.mjs
        ├── pareceQuiereRemito (H1)
        ├── clasificarIntencionHeuristica (H2)
        └── path OpenAI
```

- Sin heurísticas nuevas en `commander/`.  
- `WA_ROUTER_IA_ENABLED` sigue mandando.  
- Gates `parece*` de agentes (H8–H12) siguen **dentro** de los executors/agentes actuales, no se duplican en policy (salvo que ya formen parte del early-bind AS-IS a portar 1:1 a LegacyProcessPolicy).

---

## 11. Convivencia LLM + heurísticas sin aumentar deuda

| Mecanismo | Uso |
|-----------|-----|
| Encapsulación | H* solo en router legacy / agentes / policy portada 1:1 |
| Trace | `% branch=legacy_process_policy` vs `intent_router`; `% fuente=ia|heuristica` |
| Freeze | Rechazar PRs con nuevos `parece*` / keyword routers en `commander/` (salvo move literal de AS-IS a LegacyProcessPolicy) |
| Remitos | OCR y parsers de campos intactos |

---

## 12. Agent Manifest / Agent Registry

Igual espíritu que el diseño previo: manifests declarativos + `executorKey`; Commander no importa agents.

| agentId | intents / binds | executorKey (adapter mapea) |
|---------|-----------------|-----------------------------|
| `viajes` | `viaje`, continue viaje pending | `tryProcesarViajes` |
| `reclamos` | `reclamo` | `tryProcesarReclamo` |
| `incidencias` | `incidencia` | `tryProcesarIncidencia` |
| `rendicion` | `rendicion` | `tryProcesarRendicion` |
| `pod` | `pod` | `tryProcesarPod` |
| `remitos` | `remito`, continue remito_revision | `procesarTextoChofer` / `remitosAskPhoto` / ingest foto |
| `destinos` | continue destino_* | `tryProcesarDestinos` |
| `router` | `chat`, `desconocido` | `clarifyOrNoop` |

Bootstrap estático = datos equivalentes a la tabla mental actual, **incluyendo** binds que hoy viven como early-return (ahora expresados vía policy → mismo executorKey).

---

## 13. Extensiones futuras (stubs)

- **Tool Registry:** campo `tools[]` vacío; seam documentado.  
- **Events:** nombres reservados en `trace` (`IntentClassified`, `ProcessContinued`, …).  
- **Handoffs:** tipo reservado; v1 solo `interruptedProcessId` informativo.

No implementar en v1.

---

## 14. Feature flag, shadow y rollback

| Variable | Default | Efecto |
|----------|---------|--------|
| `SOL_COMMANDER_V1` | `false` | Adapter usa módulo legacy **idéntico** (misma policy+router encapsulados o path previo movido sin change) |
| `SOL_COMMANDER_V1=true` | — | Adapter **siempre** `commander.decide()` → executor |
| `SOL_COMMANDER_SHADOW` | `false` | Decide en paralelo, loguea diff, **ejecuta** camino legacy |

Rollback: `SOL_COMMANDER_V1=false`. Sin migraciones de datos requeridas.

---

## 15. Parity

1. Golden transcripts / scripts `verify-*` existentes.  
2. Shadow: diff en `branch`, `intent`, `agentId`, `action`, `executorKey`.  
3. Textos de fallback **idénticos** en el primer PR.  
4. Sticky Remitos/Destinos/Viajes pending: mismos mensajes atrapados que hoy.  
5. Checklist manual demo sin regresión.

---

## 16. Estructura de archivos/módulos propuesta

```
lib/commander/
  README.md
  index.mjs                         # createCommander / decide
  decide.mjs                        # policy → router → registry → Decision
  intent/
    legacy-wa-router.mjs            # wrap clasificarIntencionWhatsApp
  policy/
    legacy-process-policy.mjs       # ★ stickiness AS-IS 1:1
  context/
    conversation.mjs
    processes.mjs
  registry/
    agent-registry.mjs
    bootstrap.mjs
    manifests/*.mjs
  trace/
    log-trace.mjs
  legacy/
    enrutar-por-intencion.mjs       # opcional: cuerpo movido para flag off / shadow
```

`backend/src/routes/webhooks.mjs`: adapter + `executorMap` solamente (cuando flag ON).

---

## 17. Secuencia completa: WhatsApp → agente → vuelta

```
1. Chofer → WhatsApp
2. bot Baileys/BuilderBot → POST webhook
3. Channel Adapter (webhooks.mjs):
   - normalize
   - download media si hay
   - appendMensaje inbound
   - sync pausa / actor facts
   - SOLO THEN → commander.decide(input)     // sin if sticky previos
4. Commander:
   - ProcessContext[]
   - LegacyProcessPolicy
   - [IntentRouter + Registry] si aplica
   - CommanderDecision
5. Executor(decision.executorKey) → agent/service actual
6. notificarChofer + appendMensaje outbound
7. Respuesta WA
```

---

## 18. Secuencia de interrupción

### v1 (parity, sin mejorar)

```
Proceso remito activo + mensaje “pinchazo”
  → decide() → LegacyProcessPolicy puede SEGUIR comiéndose el mensaje
               (igual que hoy si el early-bind remito gana)
  → O, si hoy llegaría al router: IntentRouter → incidencias
  → interruptedProcessId informativo (opcional)
  → sin pause/resume real
```

### v1.1 (objetivo documentado; no implementar en v1)

```
policy/router detecta intent lateral
  → push InterruptFrame(remito)
  → run_agent incidencias
  → AgentCompleted → pop → continue_process remito
```

---

## 19. Funciones existentes a envolver / reutilizar

| Función | Módulo | Uso |
|---------|--------|-----|
| Early-binds sticky del handler webhook | `webhooks.mjs` | Port → `LegacyProcessPolicy` |
| `enrutarPorIntencion` | `webhooks.mjs` | Post-policy path / legacy module |
| `clasificarIntencionWhatsApp` | `wa-intent-router.mjs` | IntentRouter |
| `flujoRemitoAbierto` | `webhooks.mjs` | Policy + process detector |
| `getSolicitudPendientePorTelefono` | viajes-solicitudes-store | Policy + detector |
| `tryProcesar*` / `procesarTextoChofer` | `webhooks.mjs` | Executor map |
| `resolverChoferPorTelefono` | master | actor |
| `notificarChofer` / `appendMensaje` | webhooks / conv store | Adapter only |

---

## 20. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Port incompleto de sticky → parity rotunda | Diff orden AS-IS vs LegacyProcessPolicy; shadow obligatorio en demo |
| Dejar early-if en webhook “por si acaso” | Review gate: con flag ON, cero decisiones conversacionales fuera de `decide()` |
| “Mejorar” Remitos al portar | Prohibido; copy 1:1 |
| Duplicar policy + early-if | Un solo camino |
| Scope creep Tool/Event bus | Fuera de v1 |

---

## 21. Criterios de aceptación (futuro PR)

1. Flag OFF → comportamiento idéntico.  
2. Flag ON → **todo** mensaje normalizado pasa por `decide()`; sticky solo vía `LegacyProcessPolicy`.  
3. Ningún early-return conversacional en `webhooks.mjs` antes de Commander.  
4. H1–H14 intactas; sin heurísticas nuevas.  
5. Remitos internos sin diff.  
6. Interrupciones reales no implementadas (solo seams/trace).  
7. Constitución + este diseño citados en el PR.

---

## 22. Próximo paso tras aprobación de **este** diseño corregido

Cuando se autorice implementación (otro prompt):

1. Esqueleto `lib/commander/` + `LegacyProcessPolicy` (move 1:1).  
2. `decide()` = policy → router → registry.  
3. Adapter: siempre `decide()` si flag ON.  
4. `SOL_COMMANDER_V1=false` + shadow.  
5. Tests de parity.

**No** Tool Registry / Event Bus / cambio LLM / cambio bot / mejora interrupciones Remitos.

---

## 23. Estado

| Ítem | Estado |
|------|--------|
| Constitución | En `demo` (`docs/SOL-AI-OS-CONSTITUCION.md`) |
| Este diseño v1 (corregido) | **Aprobado** — implementación v1 en curso / entregada en `demo` |
| Código Commander | **v1 implementado** (flag default `false`) |

---

*Fin del diseño corregido. Esperar aprobación explícita antes de implementar.*
