/**
 * Trazas de transiciones interrupt (sanitizadas).
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizeText, hashSubject } from "../shadow-trace.mjs";

function dataDir() {
  return process.env.DATA_DIR || "./data";
}

function traceFile() {
  return path.join(dataDir(), "commander-interrupt-traces.jsonl");
}

export function persistInterruptTrace(row) {
  const file = traceFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, "utf8");
  return row;
}

export function traceInterruptTransition({
  op,
  subjectId,
  frameId = null,
  parentProcessId = null,
  childProcessId = null,
  depth = null,
  reason = null,
  processType = null,
  intent = null,
  decisionId = null,
  error = null,
  extra = {},
}) {
  return persistInterruptTrace({
    at: new Date().toISOString(),
    transitionId: randomUUID(),
    op, // push | pop | cancel | expire | human_takeover | resume_error
    subjectIdHash: hashSubject(subjectId),
    frameId,
    parentProcessId,
    childProcessId,
    depth,
    reason,
    processType,
    intent,
    decisionId,
    error: error ? String(error).slice(0, 200) : null,
    ...extra,
  });
}

export function getInterruptTracePath() {
  return traceFile();
}

export { sanitizeText };
