/**
 * API pública interrupt v1.1
 */

export {
  getInterruptMaxDepth,
  getDefaultPausedTtlMs,
  getPausedTtlMsForProcessType,
  getInterruptConfigSnapshot,
  expiresAtForProcessType,
} from "./config.mjs";

export {
  getOrchestration,
  saveOrchestration,
  getProcess,
  createProcess,
  upsertProcess,
  listProcesses,
  getOrchestrationPaths,
  resetOrchestrationForTests,
} from "./process-store.mjs";

export {
  allowsInterrupt,
  isContinuationIntent,
  childSpecForIntent,
  resumeModeForChild,
  isExplicitCancelText,
  isExplicitResumeText,
  CONTINUATION_INTENTS,
} from "./interrupt-policy.mjs";

export {
  expirePausedProcesses,
  ensureActiveFromDomain,
  getActiveProcess,
  pushInterrupt,
  popResume,
  cancelProcess,
  enterHumanTakeover,
  stackDepth,
  peekStackTop,
  listSubjectProcesses,
  tryAutoResumeAfterChildComplete,
} from "./interrupt-stack.mjs";

export { resumeHintForProcessType, buildResumeSnapshot } from "./resume-hints.mjs";
export { traceInterruptTransition, getInterruptTracePath } from "./trace.mjs";
