# SOL Commander v1.1 — Process Interrupt & Resume (diseño)

**Estado:** **implementado — pendiente de activación** (`SOL_COMMANDER_V1_1_INTERRUPT` default `false`; **no activar en TransitOne todavía**)  
**Base:** [`SOL-COMMANDER-V1-DESIGN.md`](./SOL-COMMANDER-V1-DESIGN.md) · [`SOL-AI-OS-CONSTITUCION.md`](./SOL-AI-OS-CONSTITUCION.md) · Principio 7  
**Ámbito:** TransitOne / rama `demo`  
**V1 en producción demo:** `SOL_COMMANDER_V1=true` + `SOL_COMMANDER_SHADOW=true` (aprobado)  
**Código:** `lib/commander/interrupt/*`, `decide.mjs` (v1.1 gated), tests `scripts/verify-commander-v1-1-interrupt.mjs`

---

## 0. Objetivo

Permitir que una conversación **interrompa temporalmente** un proceso activo, resuelva una **intención lateral**, y **reanude exactamente** el proceso anterior **sin perder contexto**.

En v1, sticky (`LegacyProcessPolicy`) **retiene** el mensaje en el proceso activo (parity AS-IS). En v1.1, Commander puede:

1. Detectar intención lateral distinta del proceso activo.
2. **Pausar** el proceso (push a `interruptStack`) sin cancelarlo.
3. Atender la intención nueva (nuevo proceso o respuesta puntual).
4. **Reanudar** el proceso pausado (pop) cuando corresponda.

### Qué v1.1 **no** es

| Fuera de alcance v1.1 | Motivo |
|----------------------|--------|
| Tool Registry | Fase posterior |
| Event Bus | Fase posterior |
| Handoffs formales ricos (`Handoff` object completo) | Solo seam mínimo de human takeover |
| Refactors de Remitos internos | Restricción dura |
| Eliminar / reemplazar H1–H14 | Se reutilizan; no se “mejoran” |
| Heurísticas nuevas de intención | Detección lateral usa el **mismo** Intent Router (H1–H14) |
| Cambios Baileys / canal / proveedor LLM | Restricción dura |
| Refactors de V1 salvo bugs | V1 queda estable |

---

## 1. Relación Conversation ↔ Process

### 1.1 Separación de responsabilidades

| Concepto | Dueño | Contenido |
|----------|-------|-----------|
| **Conversation** | hilo por `subjectId` (teléfono) | mensajes, `botPaused`, `interruptStack`, punteros legacy (`remito_en_revision_id`, etc.) |
| **Process** | entidad de dominio + estado de orquestación | `processId`, `processType`, `status`, `agentId`, snapshot de reanudación |
| **InterruptFrame** | marco en el stack de la conversación | referencia al Process pausado + metadatos de por qué / cómo reanudar |

```
Conversation (1) ───────<* Process (N, 0..1 active)
       │
       └── interruptStack: InterruptFrame[]  → Process (paused)
```

### 1.2 Estados de Process (v1.1)

```ts
type ProcessStatus =
  | "active"      // recibe mensajes (sticky / binding)
  | "paused"      // en interruptStack; no sticky
  | "completed"   // terminó OK
  | "cancelled"   // cancelación explícita o policy
  | "expired"     // TTL mientras paused (o idle activo)
  | "failed";     // error no recuperable
```

**Regla:** como máximo **un** Process `active` por Conversation (salvo human takeover, donde el bot no decide).

Los Process “pending” de dominio (viaje recolectando, remito en revisión, reclamo abierto) siguen viviendo en sus stores actuales. v1.1 **no** mueve Remitos a otro schema: solo añade capa de orquestación (`ProcessOrchestration` / campos en conversation + índice ligero).

### 1.3 ProcessContext (extensión v1 → v1.1)

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
  | "human_takeover"
  | "ephemeral_qa"; // respuesta puntual sin proceso de dominio persistente

interface ProcessContext {
  processId: string;
  processType: ProcessType;
  agentId: string;
  status: ProcessStatus;
  domainRef?: { store: string; id: string } | null; // p.ej. remitos.json / id
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  /** Snapshot mínimo para reanudar sin re-preguntar todo */
  resumeSnapshot?: ResumeSnapshot | null;
}

interface ResumeSnapshot {
  /** Texto / hint que el executor/agente usa al reabrir */
  promptHint: string;
  /** Paso lógico del diálogo (opcional, opaco al Commander) */
  stepKey?: string | null;
  /** Campos ya recolectados (solo IDs / flags, no PII extra) */
  collectedKeys?: string[];
  /** Versión del snapshot para migraciones futuras */
  version: 1;
}
```

---

## 2. InterruptFrame e interruptStack

### 2.1 InterruptFrame

```ts
type InterruptReason =
  | "user_lateral_intent"
  | "nested_interrupt"
  | "human_takeover"
  | "policy_force"
  | "system_error_park";

type ResumeMode =
  | "auto_on_child_complete"   // al completar/cancelar el hijo
  | "auto_on_child_idle"       // hijo ephemeral respondido
  | "manual_only"              // espera señal explícita o operador
  | "never";                   // proceso padre no se reanuda (raro; documentar)

interface InterruptFrame {
  frameId: string;
  processId: string;
  processType: ProcessType;
  agentId: string;
  pausedAt: string;
  reason: InterruptReason;
  /** Intent que provocó el push (si aplica) */
  lateralIntent?: string | null;
  /** Process hijo que se volvió active al interrumpir */
  childProcessId?: string | null;
  resumeMode: ResumeMode;
  resumeHint?: string | null;
  /** Copia del ResumeSnapshot al momento del pause */
  resumeSnapshot?: ResumeSnapshot | null;
  depth: number; // 0 = primer interrupt; 1 = nested, …
}
```

### 2.2 interruptStack

```ts
interface ConversationContext {
  // …campos v1…
  interruptStack: InterruptFrame[]; // LIFO; tope = último pausado (más reciente)
  activeProcessId?: string | null;
}
```

- **Push:** pausa el process activo → `status=paused` → frame al **tope** del stack → nuevo process (o ephemeral) pasa a `active`.
- **Pop:** al reanudar, se saca el **tope**, se restaura ese process a `active`, se emite hint de reanudación.
- **Vacío:** comportamiento idéntico a v1 sticky (solo `LegacyProcessPolicy` + router).

**Profundidad de stack:** el process `active` siempre es el único sticky. Los del stack **no** reciben mensajes hasta pop.

---

## 3. Reglas de push / pop

### 3.1 Push (interrumpir)

Condiciones **todas** verdaderas:

1. Existe process `active` (o sticky v1 equivalente reconocible).
2. `InterruptPolicy.allowsInterrupt(active, lateralIntent, actor, message)` = true.
3. Flag `SOL_COMMANDER_V1_1_INTERRUPT=true`.
4. Conversación **no** está en human takeover (`botPaused` / process `human_takeover`).
5. Profundidad `interruptStack.length < MAX_INTERRUPT_DEPTH` (propuesta: **2**).

Efectos atómicos (misma decisión / misma request):

```
active.status → paused
push InterruptFrame { depth, resumeSnapshot, … }
crear o activar child (nuevo Process o ephemeral_qa)
activeProcessId → child
Decision.action ∈ { interrupt_and_run, interrupt_and_clarify }
Decision.interruptedProcessId = parent.processId
```

### 3.2 Pop (reanudar)

Triggers (ver §7–8):

| Trigger | Cuándo |
|---------|--------|
| Auto child complete | Hijo `completed` / `cancelled` y `resumeMode=auto_on_child_complete` |
| Auto ephemeral | Respuesta puntual enviada y `resumeMode=auto_on_child_idle` |
| Manual | Usuario: “volvamos al remito / seguí con el viaje / continuemos” (vía Intent Router existente + intents ya conocidos; **sin** regex nuevas de negocio) |
| Operador | UI Contactos / mesa reanuda o despausa bot |
| Cancel padre | Usuario “dejemos eso” → cancela padre en stack **sin** reanudar (pop + `cancelled`) |

Efectos:

```
pop frame
child (si sigue active y terminal) → completed/cancelled
frame.processId.status → active (si no expired/cancelled)
activeProcessId → frame.processId
Decision.action = resume_process
suggestedReply / executorHint = frame.resumeHint || snapshot.promptHint
```

### 3.3 Profundidad máxima

`MAX_INTERRUPT_DEPTH = 2` (activo + 2 pausados).  
Si se intenta un tercer push: **no interrumpir**; sticky del activo actual (comportamiento v1) **o** `ask_clarification` “terminemos lo actual primero” — preferencia de diseño: **no push + sticky del activo** (predecible, sin heurística nueva).

---

## 4. Detección de intención lateral

### 4.1 Principio

**No hay heurísticas nuevas.**  
La clasificación sigue siendo `clasificarIntencionWhatsApp` / Intent Router (H1–H14 intactas).

### 4.2 Definición de “lateral”

Dado:

- `active`: Process activo (`processType`, `agentId`, dominio).
- `intent`: salida del Intent Router para el mensaje.

Es **lateral** sii:

```
intent ∉ CONTINUATION_INTENTS(active)
AND intent ∉ { desconocido }           // desconocido se trata aparte (§5)
AND confidence >= LATERAL_MIN_CONF     // reutilizar umbrales del router actual; no inventar
```

`CONTINUATION_INTENTS` es una **tabla declarativa** por `processType` (no keyword matching nuevo):

| processType activo | Intents que **continúan** (no interrumpen) |
|--------------------|--------------------------------------------|
| `remito_revision` | `remito`, confirmaciones/negaciones que el executor remitos ya trata como texto de revisión |
| `viaje_solicitud` | `viaje` |
| `destino_*` | (continúa vía policy destinos; intents de destino si existieran) |
| `incidencia` | `incidencia` |
| `reclamo` | `reclamo` |
| `pod_caso` | `pod` |
| `rendicion_gasto` | `rendicion` |
| `ephemeral_qa` | `chat` (sigue en Q&A) |
| `human_takeover` | — (bot no clasifica / no decide) |

**Nota:** mensajes ambiguos (`chat` / `desconocido` / baja confianza) **no** fuerzan interrupt automático (§5).

### 4.3 Orden en `decide()` v1.1

```
1. Human takeover? → noop / handoff_wait
2. InterruptPolicy + IntentRouter (misma llamada / mismo resultado)
3. Si active && lateral && allowsInterrupt → push + decidir hijo
4. Else LegacyProcessPolicy (sticky v1)  // INTACTO como fallback seguro
5. Else IntentRouter → Agent Registry (como v1)
```

**Importante:** `LegacyProcessPolicy` **no se elimina**. Con v1.1 OFF, el árbol es idéntico a v1. Con v1.1 ON, el paso de interrupt se evalúa **antes** del sticky puro, solo cuando la policy de interrupt autoriza.

---

## 5. Política de interrupción (`InterruptPolicy`)

### 5.1 `allowsInterrupt(active, intent, ctx) → boolean`

Matriz propuesta (aprobable en implementación; editable sin tocar Remitos):

| Activo ↓ \ Intent → | viaje | reclamo | incidencia | remito | pod | rendicion | chat | desconocido |
|---------------------|-------|---------|------------|--------|-----|-----------|------|-------------|
| remito_revision | sí | sí | sí* | no | sí | sí* | condicional | no |
| viaje_solicitud | no | sí | sí | sí | sí | sí | condicional | no |
| destino_* | sí | sí | sí | sí | — | — | condicional | no |
| incidencia | sí | sí | no | sí | — | — | condicional | no |
| reclamo | sí | no | sí | sí | — | — | condicional | no |

\*misma prioridad relativa AS-IS que hoy (incidencia/rendición pueden ganar sobre remito en early-binds v1); v1.1 formaliza si eso es **interrupt** (pausa remito) vs **steal** (remito sigue active). **Diseño preferido:** interrupt (push remito, active=incidencia) para poder reanudar remito.

**`chat` condicional:** solo interrupt si `confidence ≥ umbral router` **y** el mensaje no es continuación típica del process (p.ej. “ok/dale” en remito siguen siendo continuation vía policy, no chat lateral). Sin nuevas regex: si el router ya devolvió `remito`/`viaje`/… por H1–H14, no es chat.

### 5.2 Condiciones para **no** interrumpir

1. Flag v1.1 OFF → sticky v1.
2. `intent` es continuación del activo.
3. `intent=desconocido` o confianza baja.
4. Media que el process activo espera (foto remito, foto POD, audio corrección) → **siempre** continúa el activo (parity media v1).
5. `botPaused` / human takeover.
6. Stack en profundidad máxima.
7. Process activo marcado `nonInterruptible: true` (reserva; default false).
8. Operación crítica mid-flight (opcional, v1.1.1): p.ej. OCR en curso — fuera del MVP si no hay señal clara.

---

## 6. Tipos de hijo tras interrupt

| Tipo hijo | Cuándo | resumeMode padre típico |
|-----------|--------|-------------------------|
| Process de dominio (`incidencia`, `reclamo`, …) | Intent de agente con store propio | `auto_on_child_complete` o `manual_only` si el hijo queda abierto largo |
| `ephemeral_qa` | `chat` autorizado / pregunta puntual | `auto_on_child_idle` (tras una respuesta) |
| `human_takeover` | Operador toma el hilo | `manual_only` |

**Reclamo especial (caso obligatorio):**  
Viaje/remito activo → reclamo → se crea process `reclamo` active; padre pausado. El reclamo puede quedar `active` muchas turnos. Padre **no** auto-resume en cada mensaje del reclamo. Resume cuando:

- reclamo pasa a estado terminal de diálogo corto, **o**
- mesa/operador marca “reanudar proceso previo”, **o**
- usuario pide explícitamente volver al proceso anterior.

Default propuesto: `resumeMode=manual_only` para hijo `reclamo`; `auto_on_child_complete` para `incidencia` (suele ser más corto) y `ephemeral_qa`.

---

## 7. Reanudación automática

### 7.1 Cuándo

1. Hijo terminal (`completed` / `cancelled`) y `resumeMode=auto_on_child_complete`.
2. `ephemeral_qa` respondió una vez y `resumeMode=auto_on_child_idle`.
3. Pop inmediato en la **misma** request si el hijo fue one-shot (p.ej. clarify + resume hint en un solo ciclo — cuidado con UX; preferible: responder hijo y en el **siguiente** mensaje o al final del executor emitir resume prompt).

### 7.2 Cómo se reanuda (sin tocar internos Remitos)

Commander emite:

```ts
Decision {
  action: "resume_process",
  processId: parentId,
  processType: parentType,
  agentId: parentAgent,
  processBinding: true,
  suggestedReply: resumeHint, // opcional
  executorHints: { executorKey: "<mismo que sticky v1>", legacyFlow: "resume_<type>" }
}
```

El **executor** llama al mismo `tryProcesar*` / `procesarTextoChofer` que v1.  
**No** se invoca API interna nueva de Remitos: solo se rehidrata el binding (`remito_en_revision_id` ya existía) y se envía un mensaje de reanudación amable (“Retomamos la revisión del remito…”).

### 7.3 Prompt de reanudación (plantillas por processType)

Declarativas, no heurística de comprensión:

| processType | Hint ejemplo |
|-------------|--------------|
| remito_revision | “Retomamos tu remito. ¿Confirmás con *OK* o me decís qué corregimos?” |
| viaje_solicitud | “Seguimos con tu viaje. ¿Me pasás el dato que faltaba?” |
| destino_confirmacion | “Volvemos al destino. ¿La dirección es correcta?” |

---

## 8. Reanudación manual

Señales (vía Intent Router / intents existentes + confirmaciones ya soportadas; **sin** keywords nuevas de negocio):

- Usuario pide continuar el proceso previo (clasificado como continuación del `processType` pausado en el tope del stack).
- Operador en Contactos: “Reanudar proceso” / despausar bot con `resumeTop=true`.
- Comando de mesa explícito (API futura mínima; no Event Bus).

Si el tope del stack está `expired` → no reanudar; informar y limpiar frame.

---

## 9. Interrupción anidada (interrupt dentro de interrupt)

```
P0 active (p.ej. viaje)
  → lateral incidencia → push P0, active=P1 (incidencia)
    → lateral reclamo → push P1, active=P2 (reclamo)   // depth=1→2
```

Reglas:

1. LIFO estricto: completar P2 → auto/manual resume P1 → luego P0.
2. No se reanuda P0 mientras P1 sigue paused en stack.
3. Si `depth` excedería máximo → no push; sticky sobre P2.
4. Trace: cada frame lleva `depth` y `childProcessId`.

---

## 10. Cancelación explícita del proceso anterior

Usuario expresa abandono del proceso pausado (“dejemos eso”, “cancelá el viaje”, etc.) — **solo** si el Intent Router / agentes actuales ya distinguen cancelación; no inventar detector nuevo en v1.1 MVP.

Comportamiento diseñado:

1. Identificar **cuál** process cancelar: activo vs tope del stack vs id explícito.
2. `status=cancelled` + pop si estaba paused.
3. Si se cancela el activo y hay stack → pop resume del tope (salvo que el usuario cancele “todo”).
4. Si se cancela un frame del stack sin ser el tope → **no** permitido en MVP (solo tope o activo); evita corrupción LIFO.

---

## 11. Expiración de procesos pausados

| Parámetro | Propuesta inicial |
|-----------|-------------------|
| `PAUSED_TTL` | 24 h (configurable env) |
| `ACTIVE_IDLE_TTL` | opcional; fuera de MVP interrupt si no existe hoy |

Al expirar un frame paused:

1. `process.status=expired`.
2. Remover frame del stack (o marcar `expired` y saltarlo en pop).
3. Trace `process_expired`.
4. **No** borrar entidad de dominio (remito/viaje siguen en su store).
5. Si el usuario vuelve después: sticky v1 puede reabrir según datos de dominio; no se inventa resume mágico.

Job: reutilizar poll ligero existente (p.ej. patrón incidencias) o chequeo lazy en `detectActiveProcesses` — **sin** Event Bus.

---

## 12. Human takeover

### 12.1 Entrada

- `bot_pausado=true` (Contactos) — ya existe.
- O process `human_takeover` active.

### 12.2 Efectos

1. Push de todo process `active` a stack con `reason=human_takeover`, `resumeMode=manual_only`.
2. Commander: `action=noop` / no executor de agentes.
3. Mensajes humanos no pasan por InterruptPolicy.

### 12.3 Salida

- Operador despausa bot.
- Pop manual o “reanudar último proceso”.
- Si TTL expiró → stack limpio / expired.

---

## 13. Acciones nuevas en CommanderDecision (v1.1)

Extensión mínima sobre v1:

```ts
type DecisionAction =
  | "run_agent"
  | "ask_clarification"
  | "continue_process" // alias semántico; v1.0.1 normaliza a run_agent en executor
  | "interrupt_and_run"
  | "resume_process"
  | "cancel_process"
  | "noop";
```

Campos extra:

```ts
interface CommanderDecision {
  // …v1…
  interrupt?: {
    op: "push" | "pop" | "cancel";
    frameId?: string;
    parentProcessId?: string;
    childProcessId?: string;
    depth?: number;
  } | null;
  processBinding?: boolean;
}
```

---

## 14. Flujo `decide()` v1.1 (canónico)

```
Channel Adapter
  → Commander.decide
       → load Conversation + Processes + interruptStack
       → if human_takeover → noop
       → IntentRouter (H1–H14)
       → InterruptPolicy.evaluate(active, intent)
            → if interrupt: push + route child
            → else LegacyProcessPolicy (v1 sticky)
            → else Agent Registry
       → Decision (+ interrupt op)
  → Executor
       → apply interrupt op (persist stack/process status)
       → run agent / resume hint / cancel
  → Shadow/traces (si flags)
```

---

## 15. Trazabilidad completa

Cada decisión / mutación de stack registra (sanitizado, sin PII completa — mismo estándar shadow v1):

| Campo | Uso |
|-------|-----|
| `decisionId` | correlación |
| `subjectIdHash` | sujeto |
| `activeProcessId` / `processType` | antes |
| `intent` / `confidence` / `intentSource` | router |
| `interrupt.op` / `frameId` / `depth` | stack |
| `parentProcessId` / `childProcessId` | vínculo |
| `resumeMode` | política |
| `decideMs` | latencia |
| `parity` vs expected (shadow) | observación |

Archivos propuestos (implementación futura):

- append a `commander-shadow-traces.jsonl` (o `commander-interrupt-traces.jsonl`)
- resumen `commander-interrupt-summary.json`

Eventos lógicos (nombres; **no** Event Bus real):

`ProcessPaused` · `ProcessResumed` · `ProcessCancelled` · `ProcessExpired` · `HumanTakeoverStarted` · `HumanTakeoverEnded`

Solo logs/traces estructurados en v1.1.

---

## 16. Comportamiento ante errores

| Fallo | Comportamiento |
|-------|----------------|
| Fallo al persistir push | No cambiar sticky; Decision degrada a v1 sticky; log error |
| Fallo executor hijo tras push | Padre permanece paused; trazar `interrupt_orphan`; permitir resume manual |
| Fallo al pop | Mantener stack; reintentar lazy next message; sticky del active actual |
| Excepción en InterruptPolicy | Catch → LegacyProcessPolicy (fail-safe v1) |
| Flag v1.1 ON pero V1 OFF | v1.1 **no aplica** (requiere V1) |

**Fail-safe:** ante duda, comportarse como **V1 sticky** (no perder parity operativa).

---

## 17. Feature flag y rollback (independiente de V1)

| Variable | Default | Efecto |
|----------|---------|--------|
| `SOL_COMMANDER_V1` | (ya true en demo) | Path Commander |
| `SOL_COMMANDER_SHADOW` | true (obs.) | Traces |
| `SOL_COMMANDER_V1_1_INTERRUPT` | **false** | Habilita push/pop reales |

Rollback v1.1: `SOL_COMMANDER_V1_1_INTERRUPT=false` → stack se ignora (o se congela); sticky v1 puro.  
Rollback V1: `SOL_COMMANDER_V1=false` (ya documentado); v1.1 queda inerte.

Migración de datos: stack vacío al apagar flag; frames paused no se auto-resumen.

---

## 18. Casos obligatorios (aceptación de diseño)

### C1 — Remito en revisión → pregunta lateral → volver

1. Active: `remito_revision`.  
2. Usuario: pregunta no-continuación (p.ej. viaje/reclamo/chat autorizado).  
3. Push remito; child atiende; respuesta.  
4. Auto o manual resume → hint remito → usuario puede `OK`/corregir.  
5. Store remito **intacto** (`remito_en_revision_id` sigue).

### C2 — Confirmación pendiente → lateral → volver a confirmar

1. Remito esperando OK / correcciones pendientes.  
2. Lateral → pause.  
3. Resume → mismo hint de confirmación; executor `remitos_texto`.

### C3 — Viaje en curso → incidencia → resolver → volver viaje

1. Active `viaje_solicitud`.  
2. Intent `incidencia` → push viaje, active incidencia.  
3. Incidencia terminal → auto resume viaje + hint.

### C4 — Proceso activo → reclamo abierto → resume cuando corresponda

1. Push padre; active `reclamo` multi-turno.  
2. `resumeMode=manual_only` (default).  
3. Al cerrar o “volver al viaje/remito” → pop.

### C5 — Interrupt anidado

1. Viaje → incidencia → reclamo (depth 2).  
2. Completar reclamo → incidencia; completar incidencia → viaje.  
3. Tercer intento lateral → no push.

### C6 — “Dejemos eso” cancela proceso anterior

1. Cancel tope o activo según intent/agent existente.  
2. No resume del cancelado; pop limpio.

### C7 — Operador humano toma la conversación

1. `bot_pausado` → push `human_takeover` reason.  
2. Bot noop.  
3. Despausar → resume manual.

### C8 — Proceso original vence mientras paused

1. TTL; `expired`.  
2. No auto-resume.  
3. Usuario vuelve → dominio puede seguir existiendo; orquestación no revive frame expirado.

---

## 19. Persistencia propuesta (sin tocar schema Remitos)

| Dato | Dónde (propuesta) |
|------|-------------------|
| `interruptStack`, `activeProcessId` | extensión `conversaciones.json` (campos nuevos) |
| Process orchestration index | `data/commander-processes.json` (id, type, status, expiresAt, domainRef) |
| Remitos / viajes / reclamos | **sin cambios internos** |

Remitos sigue dueño de OCR, validación, correcciones. Commander solo orquesta binding.

---

## 20. Módulos futuros (solo diseño de carpetas)

```
lib/commander/
  interrupt/
    interrupt-policy.mjs      # allowsInterrupt + resumeMode
    interrupt-stack.mjs       # push/pop/cancel/expire
    resume-hints.mjs          # plantillas por processType
  policy/
    legacy-process-policy.mjs # INTACTO como fail-safe / v1.1-off
```

Sin Tool Registry. Sin Event Bus.

---

## 21. Criterios de aceptación para implementar (checklist)

- [x] Flag `SOL_COMMANDER_V1_1_INTERRUPT` default false  
- [x] Con flag off, parity idéntica a V1 actual  
- [x] C1–C8 cubiertos por protocolo (`scripts/verify-commander-v1-1-interrupt.mjs`)  
- [x] 0 cambios en `services/remitos` / OCR internos  
- [x] H1–H14 sin modificación  
- [x] Profundidad máx. default 2 (configurable `SOL_COMMANDER_V1_1_MAX_DEPTH`)  
- [x] TTL paused default 24h (configurable global / por ProcessType)  
- [x] Human takeover no ejecuta agentes  
- [x] Rollback v1.1 independiente de V1  
- [x] Traces incluyen op/depth/parent/child  

---

## 22. Fuera de esta aprobación / pendiente operativo

- Activar `SOL_COMMANDER_V1_1_INTERRUPT=true` en TransitOne (**frenar** hasta aprobación explícita)  
- Cambiar sticky v1 en producción  
- v1.2 Tool Registry / Event Bus / Handoffs ricos  

---

## 23. Decisión pedida

**¿Se aprueba este diseño de Interrupt & Resume para una implementación posterior en `demo`?**

Hasta entonces: V1 sigue operativo; este documento es la especificación de espera.
