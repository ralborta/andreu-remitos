/**
 * Persistencia de orquestación Conversation ↔ Process (separada de Remitos).
 * - commander-orchestration.json: por subjectId → stack + activeProcessId
 * - commander-processes.json: índice de Process
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function dataDir() {
  return process.env.DATA_DIR || "./data";
}

function orchFile() {
  return path.join(dataDir(), "commander-orchestration.json");
}

function processFile() {
  return path.join(dataDir(), "commander-processes.json");
}

function readJson(file, fallback) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function getOrchestration(subjectId) {
  const phone = String(subjectId || "").replace(/\D/g, "");
  if (!phone) {
    return { subjectId: "", interruptStack: [], activeProcessId: null, updated_at: null };
  }
  const db = readJson(orchFile(), {});
  const row = db[phone] || {
    subjectId: phone,
    interruptStack: [],
    activeProcessId: null,
    updated_at: null,
  };
  if (!Array.isArray(row.interruptStack)) row.interruptStack = [];
  return { ...row, subjectId: phone };
}

export function saveOrchestration(orch) {
  const phone = String(orch.subjectId || "").replace(/\D/g, "");
  if (!phone) return;
  const db = readJson(orchFile(), {});
  db[phone] = {
    subjectId: phone,
    interruptStack: Array.isArray(orch.interruptStack) ? orch.interruptStack : [],
    activeProcessId: orch.activeProcessId ?? null,
    updated_at: new Date().toISOString(),
  };
  writeJson(orchFile(), db);
}

export function listProcesses() {
  const raw = readJson(processFile(), []);
  return Array.isArray(raw) ? raw : [];
}

export function saveProcesses(rows) {
  writeJson(processFile(), Array.isArray(rows) ? rows : []);
}

export function getProcess(processId) {
  if (!processId) return null;
  return listProcesses().find((p) => p.processId === processId) ?? null;
}

export function upsertProcess(process) {
  const rows = listProcesses();
  const i = rows.findIndex((p) => p.processId === process.processId);
  const now = new Date().toISOString();
  const row = {
    ...process,
    updatedAt: now,
    createdAt: process.createdAt || now,
  };
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  saveProcesses(rows);
  return row;
}

export function createProcess({
  processType,
  agentId,
  subjectId,
  status = "active",
  domainRef = null,
  resumeSnapshot = null,
  expiresAt = null,
  processId = null,
}) {
  const now = new Date().toISOString();
  const row = {
    processId: processId || randomUUID(),
    processType,
    agentId,
    subjectId: String(subjectId || "").replace(/\D/g, ""),
    status,
    domainRef,
    resumeSnapshot,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  return upsertProcess(row);
}

/** Garantiza un solo active por subjectId (marca otros active del mismo sujeto como failed_guard). */
export function enforceSingleActive(subjectId, keepProcessId) {
  const phone = String(subjectId || "").replace(/\D/g, "");
  const rows = listProcesses();
  let changed = false;
  for (const p of rows) {
    if (p.subjectId !== phone) continue;
    if (p.status === "active" && p.processId !== keepProcessId) {
      p.status = "paused"; // no destruir; alinear a invariant (caller debe haber pushed)
      p.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveProcesses(rows);
}

export function getOrchestrationPaths() {
  return { ORCH_FILE: orchFile(), PROCESS_FILE: processFile(), DATA_DIR: dataDir() };
}

/** Test helper: wipe orchestration files under current DATA_DIR */
export function resetOrchestrationForTests() {
  for (const f of [orchFile(), processFile()]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
