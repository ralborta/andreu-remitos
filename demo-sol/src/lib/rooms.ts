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
  /** Link permanente público (no vence). */
  public?: boolean;
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "rooms.json");
export const PUBLIC_DEMO_TOKEN = process.env.DEMO_PUBLIC_TOKEN || "public";

const RESERVED = new Set([
  "admin",
  "api",
  "demo",
  "r",
  "public",
  "sol-public",
  "stitch-screens",
  "_next",
  "favicon.ico",
]);

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

/** Garantiza una sala pública permanente para compartir sin login. */
export function ensurePublicDemoRoom(): DemoRoom {
  const rows = readAll();
  const existing = rows.find((r) => r.token === PUBLIC_DEMO_TOKEN);
  if (existing) {
    let dirty = false;
    if (!existing.public) {
      existing.public = true;
      dirty = true;
    }
    if (existing.expiresAt < "2099-01-01") {
      existing.expiresAt = "2099-12-31T23:59:59.000Z";
      dirty = true;
    }
    if (dirty) writeAll(rows);
    return existing;
  }
  const room: DemoRoom = {
    token: PUBLIC_DEMO_TOKEN,
    company: "SOL Demo Pública",
    contactName: "Prospecto",
    painPoint: "Tour completo de mesa y agentes",
    createdAt: new Date().toISOString(),
    expiresAt: "2099-12-31T23:59:59.000Z",
    createdBy: "system",
    extendedCount: 0,
    public: true,
  };
  rows.unshift(room);
  writeAll(rows);
  return room;
}

export function listRooms(): DemoRoom[] {
  ensurePublicDemoRoom();
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRoom(token: string): DemoRoom | null {
  ensurePublicDemoRoom();
  return readAll().find((r) => r.token === token) ?? null;
}

export function isExpired(room: DemoRoom, now = Date.now()): boolean {
  if (room.public || room.token === PUBLIC_DEMO_TOKEN) return false;
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
  public?: boolean;
}): DemoRoom {
  ensurePublicDemoRoom();
  const days = Math.max(1, Math.min(14, input.days ?? 3));
  const now = new Date();
  const expires = input.public
    ? new Date("2099-12-31T23:59:59.000Z")
    : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const base = slugify(input.company) || "cliente";
  const rows = readAll();

  if (input.public) {
    const idx = rows.findIndex((r) => r.token === PUBLIC_DEMO_TOKEN);
    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        company: input.company.trim(),
        contactName: input.contactName.trim(),
        public: true,
        expiresAt: expires.toISOString(),
      };
      writeAll(rows);
      return rows[idx];
    }
  }

  // Link legible: /demo/{nombre-cliente} (solo sufijo si hay colisión)
  let token = input.public ? PUBLIC_DEMO_TOKEN : base;
  if (!input.public) {
    if (RESERVED.has(token)) token = `${base}-demo`;
    let n = 2;
    while (rows.some((r) => r.token === token) || RESERVED.has(token)) {
      token = `${base}-${n}`;
      n += 1;
      if (n > 50) {
        token = `${base}-${crypto.randomBytes(2).toString("hex")}`;
        break;
      }
    }
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
    public: Boolean(input.public),
  };
  rows.unshift(room);
  writeAll(rows);
  return room;
}

export function extendRoom(token: string, days = 3): DemoRoom | null {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.token === token);
  if (idx < 0) return null;
  if (rows[idx].public) return rows[idx];
  const base = Math.max(Date.now(), new Date(rows[idx].expiresAt).getTime());
  rows[idx].expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  rows[idx].extendedCount = (rows[idx].extendedCount || 0) + 1;
  writeAll(rows);
  return rows[idx];
}

export function deleteRoom(token: string): boolean {
  if (token === PUBLIC_DEMO_TOKEN) return false;
  const rows = readAll();
  const next = rows.filter((r) => r.token !== token);
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}

export function publicBaseUrl(): string {
  const fromEnv = process.env.DEMO_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "";
}
