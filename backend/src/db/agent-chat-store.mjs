/**
 * Conversaciones web operador ↔ agente especialista (mesa).
 * Archivo: DATA_DIR/agent-chats.json
 * No es el inbox WhatsApp (conversaciones.json).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "agent-chats.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export async function getConversation(id) {
  if (!id) return null;
  return readAll().find((c) => c.id === id) ?? null;
}

export async function listConversations({ agentId, userId, limit = 50 } = {}) {
  let rows = readAll();
  if (agentId) rows = rows.filter((c) => c.agentId === agentId);
  if (userId) rows = rows.filter((c) => c.userId === userId);
  rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return rows.slice(0, Math.min(Number(limit) || 50, 200));
}

export async function createConversation({
  agentId,
  tenant = null,
  userId = null,
  username = null,
  channel = "web",
  meta = {},
} = {}) {
  if (!agentId) throw Object.assign(new Error("agentId requerido"), { statusCode: 400 });
  const now = new Date().toISOString();
  const row = {
    id: `ach_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    agentId: String(agentId),
    tenant: tenant ? String(tenant) : null,
    userId: userId ? String(userId) : null,
    username: username ? String(username) : null,
    channel: String(channel || "web"),
    workingSet: emptyWorkingSetPlaceholder(),
    messages: [],
    traces: [],
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: now,
    updatedAt: now,
  };
  const rows = readAll();
  rows.unshift(row);
  writeAll(rows);
  return row;
}

function emptyWorkingSetPlaceholder() {
  return {
    entityType: null,
    entityIds: [],
    filters: {},
    lastGoal: null,
    lastCapability: null,
    label: null,
    podIds: [],
  };
}

export async function appendTurn(conversationId, { userMessage, assistantMessage, trace, workingSet } = {}) {
  const rows = readAll();
  const i = rows.findIndex((c) => c.id === conversationId);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();

  if (userMessage?.text) {
    row.messages.push({
      id: `msg_${randomUUID().slice(0, 8)}`,
      role: "user",
      text: String(userMessage.text),
      at: userMessage.at || now,
      meta: userMessage.meta || undefined,
    });
  }
  if (assistantMessage?.text) {
    row.messages.push({
      id: `msg_${randomUUID().slice(0, 8)}`,
      role: "assistant",
      text: String(assistantMessage.text),
      at: assistantMessage.at || now,
      meta: assistantMessage.meta || undefined,
    });
  }
  if (trace) {
    row.traces.push({
      id: `tr_${randomUUID().slice(0, 8)}`,
      at: now,
      ...trace,
    });
  }
  if (workingSet && typeof workingSet === "object") {
    const entityIds = Array.isArray(workingSet.entityIds)
      ? workingSet.entityIds.map(String)
      : Array.isArray(workingSet.podIds)
        ? workingSet.podIds.map(String)
        : [];
    row.workingSet = {
      entityType: workingSet.entityType ?? row.workingSet?.entityType ?? null,
      entityIds,
      filters:
        workingSet.filters && typeof workingSet.filters === "object"
          ? workingSet.filters
          : row.workingSet?.filters || {},
      lastGoal: workingSet.lastGoal ?? row.workingSet?.lastGoal ?? null,
      lastCapability: workingSet.lastCapability ?? row.workingSet?.lastCapability ?? null,
      label: workingSet.label ?? row.workingSet?.label ?? null,
      // compat UI antigua
      podIds: entityIds,
    };
  }
  row.updatedAt = now;
  rows[i] = row;
  writeAll(rows);
  return row;
}

export function publicConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agentId,
    tenant: row.tenant,
    userId: row.userId,
    username: row.username,
    channel: row.channel,
    workingSet: row.workingSet || {
      entityType: null,
      entityIds: [],
      filters: {},
      lastGoal: null,
      lastCapability: null,
      label: null,
      podIds: [],
    },
    messages: (row.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      at: m.at,
      meta: m.meta || undefined,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
