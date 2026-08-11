/**
 * interruptStack — push / pop / cancel / expire / human_takeover.
 * Procesos paused nunca se destruyen implícitamente (solo status).
 */

import { randomUUID } from "node:crypto";
import {
  getOrchestration,
  saveOrchestration,
  getProcess,
  upsertProcess,
  createProcess,
  enforceSingleActive,
  listProcesses,
} from "./process-store.mjs";
import { getInterruptMaxDepth, expiresAtForProcessType } from "./config.mjs";
import { buildResumeSnapshot, resumeHintForProcessType } from "./resume-hints.mjs";
import { resumeModeForChild } from "./interrupt-policy.mjs";
import { traceInterruptTransition } from "./trace.mjs";

export function expirePausedProcesses(subjectId, now = Date.now()) {
  const orch = getOrchestration(subjectId);
  const kept = [];
  const expired = [];
  for (const frame of orch.interruptStack || []) {
    const proc = getProcess(frame.processId);
    const exp = proc?.expiresAt || frame.expiresAt;
    if (exp && new Date(exp).getTime() <= now) {
      if (proc && proc.status === "paused") {
        upsertProcess({ ...proc, status: "expired" });
      }
      expired.push(frame);
      traceInterruptTransition({
        op: "expire",
        subjectId,
        frameId: frame.frameId,
        parentProcessId: frame.processId,
        depth: frame.depth,
        processType: frame.processType,
        reason: "ttl",
      });
    } else {
      kept.push(frame);
    }
  }
  if (expired.length) {
    orch.interruptStack = kept;
    saveOrchestration(orch);
  }
  return { expired, orchestration: getOrchestration(subjectId) };
}

/**
 * Sync / ensure active process from domain binding (remito, viaje, …).
 * No muta Remitos; solo capa de orquestación.
 */
export function ensureActiveFromDomain({
  subjectId,
  processType,
  agentId,
  domainRef = null,
  resumeSnapshot = null,
}) {
  // Reusa binding vigente (incluye recovery de lastExecutionStatus=failed)
  const existing = getActiveProcess(subjectId);
  if (existing) {
    return { process: existing, orchestration: getOrchestration(subjectId), created: false };
  }
  const orch = getOrchestration(subjectId);
  const snap = resumeSnapshot || buildResumeSnapshot(processType);
  const proc = createProcess({
    processType,
    agentId,
    subjectId,
    status: "active",
    domainRef,
    resumeSnapshot: snap,
    expiresAt: null,
  });
  orch.activeProcessId = proc.processId;
  saveOrchestration(orch);
  enforceSingleActive(subjectId, proc.processId);
  return { process: proc, orchestration: getOrchestration(subjectId), created: true };
}

export function getActiveProcess(subjectId) {
  const orch = getOrchestration(subjectId);
  if (!orch.activeProcessId) return null;
  let p = getProcess(orch.activeProcessId);
  if (!p) return null;
  // Compat / recuperación: ejecución failed no debe romper el binding active
  // (si no, syncActiveFromDetected crea otro Process y el nested interrupt falla).
  if (p.status === "failed") {
    p = upsertProcess({
      ...p,
      status: "active",
      lastExecutionStatus: p.lastExecutionStatus || "failed",
    });
  }
  if (p.status !== "active") return null;
  return p;
}

/**
 * Push: pausa active, apila frame, activa child.
 * @returns {{ ok, reason?, frame?, parent?, child?, orchestration? }}
 */
export function pushInterrupt({
  subjectId,
  parentProcess,
  childSpec,
  lateralIntent = null,
  reason = "user_lateral_intent",
  decisionId = null,
  maxDepth = null,
}) {
  const depthLimit = maxDepth ?? getInterruptMaxDepth();
  expirePausedProcesses(subjectId);
  const orch = getOrchestration(subjectId);
  const depth = orch.interruptStack.length;
  if (depth >= depthLimit) {
    return { ok: false, reason: "max_depth", orchestration: orch };
  }
  if (!parentProcess || parentProcess.status !== "active") {
    return { ok: false, reason: "no_active_parent", orchestration: orch };
  }

  const pausedAt = new Date().toISOString();
  const expiresAt = expiresAtForProcessType(parentProcess.processType);
  const snap = parentProcess.resumeSnapshot || buildResumeSnapshot(parentProcess.processType);

  upsertProcess({
    ...parentProcess,
    status: "paused",
    expiresAt,
    resumeSnapshot: snap,
  });

  const child = createProcess({
    processType: childSpec.processType,
    agentId: childSpec.agentId,
    subjectId,
    status: "active",
    domainRef: childSpec.domainRef ?? null,
    resumeSnapshot: buildResumeSnapshot(childSpec.processType),
    expiresAt: null,
  });

  const frame = {
    frameId: randomUUID(),
    processId: parentProcess.processId,
    processType: parentProcess.processType,
    agentId: parentProcess.agentId,
    pausedAt,
    expiresAt,
    reason: depth > 0 ? "nested_interrupt" : reason,
    lateralIntent,
    childProcessId: child.processId,
    resumeMode: resumeModeForChild(childSpec.processType),
    resumeHint: resumeHintForProcessType(parentProcess.processType),
    resumeSnapshot: snap,
    depth,
  };

  orch.interruptStack = [...orch.interruptStack, frame];
  orch.activeProcessId = child.processId;
  saveOrchestration(orch);
  enforceSingleActive(subjectId, child.processId);

  traceInterruptTransition({
    op: "push",
    subjectId,
    frameId: frame.frameId,
    parentProcessId: parentProcess.processId,
    childProcessId: child.processId,
    depth: frame.depth,
    reason: frame.reason,
    processType: parentProcess.processType,
    intent: lateralIntent,
    decisionId,
  });

  return {
    ok: true,
    frame,
    parent: getProcess(parentProcess.processId),
    child,
    orchestration: getOrchestration(subjectId),
  };
}

/**
 * Pop: reanuda tope del stack.
 */
export function popResume({ subjectId, decisionId = null, completeChild = true }) {
  expirePausedProcesses(subjectId);
  const orch = getOrchestration(subjectId);
  if (!orch.interruptStack.length) {
    return { ok: false, reason: "empty_stack", orchestration: orch };
  }

  const frame = orch.interruptStack[orch.interruptStack.length - 1];
  const parent = getProcess(frame.processId);

  if (!parent || parent.status === "expired" || parent.status === "cancelled") {
    orch.interruptStack = orch.interruptStack.slice(0, -1);
    saveOrchestration(orch);
    traceInterruptTransition({
      op: "pop",
      subjectId,
      frameId: frame.frameId,
      parentProcessId: frame.processId,
      depth: frame.depth,
      reason: "skip_expired_or_cancelled",
      decisionId,
      error: parent ? parent.status : "missing",
    });
    return { ok: false, reason: parent?.status || "missing_parent", frame, orchestration: getOrchestration(subjectId) };
  }

  try {
    if (completeChild && orch.activeProcessId) {
      const child = getProcess(orch.activeProcessId);
      if (child && child.status === "active") {
        upsertProcess({ ...child, status: "completed" });
      }
    }

    upsertProcess({
      ...parent,
      status: "active",
      expiresAt: null,
    });

    orch.interruptStack = orch.interruptStack.slice(0, -1);
    orch.activeProcessId = parent.processId;
    saveOrchestration(orch);
    enforceSingleActive(subjectId, parent.processId);

    traceInterruptTransition({
      op: "pop",
      subjectId,
      frameId: frame.frameId,
      parentProcessId: parent.processId,
      childProcessId: frame.childProcessId,
      depth: frame.depth,
      reason: "resume",
      processType: parent.processType,
      decisionId,
    });

    return {
      ok: true,
      frame,
      parent: getProcess(parent.processId),
      resumeHint: frame.resumeHint || resumeHintForProcessType(parent.processType),
      orchestration: getOrchestration(subjectId),
    };
  } catch (err) {
    traceInterruptTransition({
      op: "resume_error",
      subjectId,
      frameId: frame.frameId,
      parentProcessId: frame.processId,
      depth: frame.depth,
      decisionId,
      error: err?.message || String(err),
    });
    return { ok: false, reason: "resume_error", error: err, frame, orchestration: getOrchestration(subjectId) };
  }
}

/**
 * Cancela proceso (activo o tope del stack). No destruye el registro — status=cancelled.
 */
export function cancelProcess({ subjectId, target = "active", decisionId = null }) {
  expirePausedProcesses(subjectId);
  const orch = getOrchestration(subjectId);

  if (target === "active" || target === "both") {
    if (orch.activeProcessId) {
      const p = getProcess(orch.activeProcessId);
      if (p) upsertProcess({ ...p, status: "cancelled" });
      traceInterruptTransition({
        op: "cancel",
        subjectId,
        parentProcessId: orch.activeProcessId,
        processType: p?.processType,
        reason: "explicit_active",
        decisionId,
      });
      orch.activeProcessId = null;
    }
  }

  if (target === "stack_top" || target === "both") {
    if (orch.interruptStack.length) {
      const frame = orch.interruptStack[orch.interruptStack.length - 1];
      const p = getProcess(frame.processId);
      if (p && (p.status === "paused" || p.status === "active")) {
        upsertProcess({ ...p, status: "cancelled" });
      }
      orch.interruptStack = orch.interruptStack.slice(0, -1);
      traceInterruptTransition({
        op: "cancel",
        subjectId,
        frameId: frame.frameId,
        parentProcessId: frame.processId,
        depth: frame.depth,
        processType: frame.processType,
        reason: "explicit_stack_top",
        decisionId,
      });
    }
  }

  saveOrchestration(orch);
  return { ok: true, orchestration: getOrchestration(subjectId) };
}

/**
 * Human takeover: pausa active en stack con reason human_takeover.
 */
export function enterHumanTakeover({ subjectId, decisionId = null }) {
  expirePausedProcesses(subjectId);
  const orch = getOrchestration(subjectId);
  const active = orch.activeProcessId ? getProcess(orch.activeProcessId) : null;

  if (active && active.status === "active") {
    const depth = orch.interruptStack.length;
    const expiresAt = expiresAtForProcessType(active.processType);
    const snap = active.resumeSnapshot || buildResumeSnapshot(active.processType);
    upsertProcess({ ...active, status: "paused", expiresAt, resumeSnapshot: snap });

    const frame = {
      frameId: randomUUID(),
      processId: active.processId,
      processType: active.processType,
      agentId: active.agentId,
      pausedAt: new Date().toISOString(),
      expiresAt,
      reason: "human_takeover",
      lateralIntent: null,
      childProcessId: null,
      resumeMode: "manual_only",
      resumeHint: resumeHintForProcessType(active.processType),
      resumeSnapshot: snap,
      depth,
    };
    orch.interruptStack = [...orch.interruptStack, frame];
  }

  const ht = createProcess({
    processType: "human_takeover",
    agentId: "router",
    subjectId,
    status: "active",
  });
  orch.activeProcessId = ht.processId;
  saveOrchestration(orch);
  enforceSingleActive(subjectId, ht.processId);

  traceInterruptTransition({
    op: "human_takeover",
    subjectId,
    childProcessId: ht.processId,
    parentProcessId: active?.processId ?? null,
    reason: "human_takeover",
    decisionId,
  });

  return { ok: true, humanProcess: ht, orchestration: getOrchestration(subjectId) };
}

/**
 * Si el active está terminal y el tope del stack pide auto_on_child_complete → resume_top.
 * Preferir applyResumeFromExecutionResult cuando hay AgentExecutionResult.
 */
export function tryAutoResumeAfterChildComplete({ subjectId, decisionId = null } = {}) {
  expirePausedProcesses(subjectId);
  const orch = getOrchestration(subjectId);
  const top = orch.interruptStack.length
    ? orch.interruptStack[orch.interruptStack.length - 1]
    : null;
  if (!top) return { ok: false, reason: "empty_stack" };
  if (top.resumeMode !== "auto_on_child_complete") {
    return { ok: false, reason: "resume_mode_not_auto", resumeMode: top.resumeMode };
  }
  const child = orch.activeProcessId ? getProcess(orch.activeProcessId) : null;
  if (child && child.status === "active") {
    upsertProcess({ ...child, status: "completed" });
  }
  // Un solo pop explícito (resume_top semantics via popResume + trace en caller)
  const popped = popResume({ subjectId, decisionId, completeChild: false });
  if (popped.ok) {
    traceInterruptTransition({
      op: "resume_top",
      subjectId,
      frameId: popped.frame?.frameId,
      parentProcessId: popped.parent?.processId,
      depth: popped.frame?.depth,
      reason: "try_auto_resume_after_child_complete",
      decisionId,
    });
  }
  return { ...popped, mode: "resume_top" };
}

export function stackDepth(subjectId) {
  return getOrchestration(subjectId).interruptStack.length;
}

export function peekStackTop(subjectId) {
  const orch = getOrchestration(subjectId);
  if (!orch.interruptStack.length) return null;
  return orch.interruptStack[orch.interruptStack.length - 1];
}

/** Diagnóstico: procesos del sujeto (para tests / restart). */
export function listSubjectProcesses(subjectId) {
  const phone = String(subjectId || "").replace(/\D/g, "");
  return listProcesses().filter((p) => p.subjectId === phone);
}
