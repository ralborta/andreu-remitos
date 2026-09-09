import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type DemoRoom = {
  token: string;
  company: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  painPoint?: string;
  highlightAgents?: string[];
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  extendedCount?: number;
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "rooms.json");

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
}

function readAll(): DemoRoom[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(rows: DemoRoom[]) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function listRooms(): DemoRoom[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRoom(token: string): DemoRoom | null {
  return readAll().find((r) => r.token === token) ?? null;
}

export function isExpired(room: DemoRoom, now = Date.now()): boolean {
  return new Date(room.expiresAt).getTime() <= now;
}

export function createRoom(input: {
  company: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  painPoint?: string;
  days?: number;
  createdBy?: string;
}): DemoRoom {
  const days = Math.max(1, Math.min(14, input.days ?? 3));
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rand = crypto.randomBytes(3).toString("hex");
  const base = slugify(input.company) || "cliente";
  let token = `${base}-${rand}`;
  const rows = readAll();
  while (rows.some((r) => r.token === token)) {
    token = `${base}-${crypto.randomBytes(3).toString("hex")}`;
  }
  const room: DemoRoom = {
    token,
    company: input.company.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail?.trim() || undefined,
    contactPhone: input.contactPhone?.trim() || undefined,
    painPoint: input.painPoint?.trim() || undefined,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    createdBy: input.createdBy || "vendedor",
    extendedCount: 0,
  };
  rows.unshift(room);
  writeAll(rows);
  return room;
}

export function extendRoom(token: string, days = 3): DemoRoom | null {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.token === token);
  if (idx < 0) return null;
  const base = Math.max(Date.now(), new Date(rows[idx].expiresAt).getTime());
  rows[idx].expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  rows[idx].extendedCount = (rows[idx].extendedCount || 0) + 1;
  writeAll(rows);
  return rows[idx];
}

export function deleteRoom(token: string): boolean {
  const rows = readAll();
  const next = rows.filter((r) => r.token !== token);
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}
