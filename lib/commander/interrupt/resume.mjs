/**
 * Semántica explícita de resume (v1.1.1).
 *
 * - resume_top: un solo pop del tope
 * - resume_parent: reanuda el padre esperado del active actual (frame.childProcessId === active)
 * - resume_until(processId): desapila con trace por cada pop hasta el proceso indicado
 *
 * Nunca múltiples pops implícitos sin trace.
 * Objetivo debe existir y estar paused.
 * Ambigüedad → ok:false (caller fail-safe V1).
 */

import {
  getOrchestration,
  getProcess,
  upsertProcess,
} from "./process-store.mjs";
import { expirePausedProcesses, popResume, peekStackTop, getActiveProcess } from "./interrupt-stack.mjs";
import { traceInterruptTransition } from "./trace.mjs";
import { resumeHintForProcessType } from "./resume-hints.mjs";

function validatePausedOnStack(subjectId, processId) {
  if (!processId) return { ok: false, reason: "missing_process_id" };
  const proc = getProcess(processId);
  if (!proc) return { ok: false, reason: "process_not_found", processId };
  if (proc.status !== "paused") {
    return { ok: false, reason: "process_not_paused", processId, status: proc.status };
  }
  const orch = getOrchestration(subjectId);
  const idx = (orch.interruptStack || []).findIndex((f) => f.processId === processId);
  if (idx < 0) return { ok: false, reason: "process_not_on_stack", processId };
  return { ok: true, process: proc, frameIndex: idx, frame: orch.interruptStack[idx] };
}

/**
 * resume_top — reanuda únicamente el frame superior (un pop).
 */
export function resumeTop({
  subjectId,
  decisionId = null,
  completeChild = true,
  reason = "resume_top",
} = {}) {
  expirePausedProcesses(subjectId);
  const top = peekStackTop(subjectId);
  if (!top) return { ok: false, reason: "empty_stack", mode: "resume_top" };

  const check = validatePausedOnStack(subjectId, top.processId);
  if (!check.ok) {
    traceInterruptTransition({
      op: "resume_rejected",
      subjectId,
      parentProcessId: top.processId,
      depth: top.depth,
      reason: check.reason,
      decisionId,
      error: check.reason,
      extra: { mode: "resume_top" },
    });
    return { ok: false, reason: check.reason, mode: "resume_top", frame: top };
  }

  const popped = popResume({ subjectId, decisionId, completeChild });
  if (popped.ok) {
    traceInterruptTransition({
      op: "resume_top",
      subjectId,
      frameId: popped.frame?.frameId,
      parentProcessId: popped.parent?.processId,
      childProcessId: popped.frame?.childProcessId,
      depth: popped.frame?.depth,
      reason,
      processType: popped.parent?.processType,
      decisionId,
    });
  }
  return { ...popped, mode: "resume_top" };
}

/**
 * Encuentra el frame cuyo hijo activo es el process actual.
 * Ambigüedad (0 o >1 matches inesperados) → fail.
 */
export function findParentFrameForActive(subjectId) {
  const active = getActiveProcess(subjectId);
  const orch = getOrchestration(subjectId);
  const stack = orch.interruptStack || [];
  if (!active) return { ok: false, reason: "no_active" };
  const matches = stack.filter((f) => f.childProcessId === active.processId);
  if (matches.length === 0) {
    // Fallback: si hay exactamente 1 frame y es el tope, asumir padre del flujo
    if (stack.length === 1) {
      return { ok: true, frame: stack[0], active, ambiguous: false, via: "single_frame" };
    }
    return { ok: false, reason: "parent_frame_not_found", activeProcessId: active.processId };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: "ambiguous_parent_frames",
      activeProcessId: active.processId,
      matches: matches.map((m) => m.processId),
    };
  }
  return { ok: true, frame: matches[0], active, ambiguous: false, via: "childProcessId" };
}

/**
 * resume_parent — reanuda el proceso padre esperado del flujo actual.
 * Si el padre no es el tope, usa resume_until (cada pop trazado).
 */
export function resumeParent({
  subjectId,
  decisionId = null,
  completeChild = true,
} = {}) {
  expirePausedProcesses(subjectId);
  const found = findParentFrameForActive(subjectId);
  if (!found.ok) {
    traceInterruptTransition({
      op: "resume_rejected",
      subjectId,
      reason: found.reason,
      decisionId,
      error: found.reason,
      extra: { mode: "resume_parent", matches: found.matches || null },
    });
    return { ok: false, reason: found.reason, mode: "resume_parent", detail: found };
  }
  return resumeUntil({
    subjectId,
    processId: found.frame.processId,
    decisionId,
    completeChild,
    reason: "resume_parent",
  });
}

/**
 * resume_until(processId) — desapila de forma controlada hasta el proceso indicado.
 * Cada pop genera trace. No salta frames sin registrar.
 */
export function resumeUntil({
  subjectId,
  processId,
  decisionId = null,
  completeChild = true,
  maxPops = 8,
  reason = "resume_until",
} = {}) {
  expirePausedProcesses(subjectId);
  const check = validatePausedOnStack(subjectId, processId);
  if (!check.ok) {
    traceInterruptTransition({
      op: "resume_rejected",
      subjectId,
      parentProcessId: processId,
      reason: check.reason,
      decisionId,
      error: check.reason,
      extra: { mode: "resume_until" },
    });
    return { ok: false, reason: check.reason, mode: "resume_until", processId };
  }

  const pops = [];
  let last = null;
  let guard = 0;

  while (guard < maxPops) {
    guard += 1;
    const active = getActiveProcess(subjectId);
    if (active && active.processId === processId) {
      return {
        ok: true,
        mode: "resume_until",
        parent: active,
        resumeHint: resumeHintForProcessType(active.processType),
        pops,
        orchestration: getOrchestration(subjectId),
      };
    }

    const top = peekStackTop(subjectId);
    if (!top) {
      return {
        ok: false,
        reason: "empty_stack_before_target",
        mode: "resume_until",
        processId,
        pops,
      };
    }

    const isTarget = top.processId === processId;
    const popped = popResume({
      subjectId,
      decisionId,
      completeChild: completeChild || !isTarget,
    });

    traceInterruptTransition({
      op: isTarget ? "resume_until" : "resume_until_intermediate",
      subjectId,
      frameId: top.frameId,
      parentProcessId: top.processId,
      childProcessId: top.childProcessId,
      depth: top.depth,
      reason: isTarget ? reason : "intermediate_pop",
      processType: top.processType,
      decisionId,
      extra: {
        mode: "resume_until",
        targetProcessId: processId,
        popIndex: pops.length,
        ok: popped.ok,
        popReason: popped.reason || null,
      },
    });

    pops.push({
      frameId: top.frameId,
      processId: top.processId,
      ok: popped.ok,
      reason: popped.reason || (isTarget ? "target" : "intermediate"),
    });

    last = popped;
    if (!popped.ok) {
      return {
        ok: false,
        reason: popped.reason || "pop_failed",
        mode: "resume_until",
        processId,
        pops,
        last,
      };
    }

    if (isTarget) {
      return {
        ok: true,
        mode: "resume_until",
        parent: popped.parent,
        frame: popped.frame,
        resumeHint: popped.resumeHint,
        pops,
        orchestration: getOrchestration(subjectId),
      };
    }
  }

  traceInterruptTransition({
    op: "resume_rejected",
    subjectId,
    parentProcessId: processId,
    reason: "max_pops_exceeded",
    decisionId,
    error: "max_pops_exceeded",
    extra: { mode: "resume_until", maxPops, pops: pops.length },
  });
  return { ok: false, reason: "max_pops_exceeded", mode: "resume_until", processId, pops };
}

/**
 * Aplica auto-resume según AgentExecutionResult (sin heurística de texto).
 */
export function applyResumeFromExecutionResult({
  subjectId,
  result,
  decisionId = null,
} = {}) {
  if (!result || result.status !== "completed" || result.resumePolicy !== "auto") {
    return { ok: false, reason: "policy_not_auto", result };
  }

  if (result.status === "failed") {
    // nunca pop destructivo
    const active = getActiveProcess(subjectId);
    if (active) {
      upsertProcess({ ...active, status: "failed" });
      traceInterruptTransition({
        op: "child_failed_no_pop",
        subjectId,
        parentProcessId: active.processId,
        reason: "failed_no_destructive_pop",
        decisionId,
      });
    }
    return { ok: false, reason: "failed_no_pop", result };
  }

  if (result.resumeTargetProcessId) {
    return resumeUntil({
      subjectId,
      processId: result.resumeTargetProcessId,
      decisionId,
      completeChild: true,
      reason: "auto_resume_until_target",
    });
  }

  // default auto → resume_top (un pop)
  return resumeTop({
    subjectId,
    decisionId,
    completeChild: true,
    reason: "auto_resume_top",
  });
}

/** Marca active como failed sin pop. */
export function markActiveFailedNoPop({ subjectId, decisionId = null } = {}) {
  const active = getActiveProcess(subjectId);
  if (!active) return { ok: false, reason: "no_active" };
  upsertProcess({ ...active, status: "failed" });
  traceInterruptTransition({
    op: "child_failed_no_pop",
    subjectId,
    parentProcessId: active.processId,
    processType: active.processType,
    reason: "failed_no_destructive_pop",
    decisionId,
  });
  return { ok: true, process: getProcess(active.processId) };
}
