#!/usr/bin/env node
/**
 * Re-aplica correcciones del historial WhatsApp al remito vinculado.
 * Uso: API_URL=... TOKEN=... node scripts/replay-correcciones-wa.mjs [telefono_opcional]
 */
import {
  parseTodasCorreccionesChofer,
  buildPatchFromCorrecciones,
} from "../lib/correcciones-chofer.mjs";

const API = process.env.API_URL || "https://logistica-andreu-remitos.wd75db.easypanel.host";
const USER = process.env.API_USER || "admin";
const PASS = process.env.API_PASS || "admin123";
const phoneFilter = process.argv[2]?.replace(/\D/g, "") || null;

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${globalThis.__token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function esOk(texto) {
  return /^(ok|dale|listo|correcto|si|sí|confirmo|confirmado|perfecto)$/i.test(String(texto ?? "").trim());
}

function correccionesDeConversacion(conv) {
  const seen = new Set();
  const out = [];
  const push = (c) => {
    if (!c || c.campo === "_confirmacion" || seen.has(c.campo)) return;
    seen.add(c.campo);
    out.push(c);
  };

  for (const m of conv.mensajes ?? []) {
    if (m.dir === "out" || m.from === "bot") continue;
    if (!m.texto || m.tipo === "image") continue;
    if (esOk(m.texto)) continue;
    if (m.texto.startsWith("_event_media")) continue;
    for (const c of parseTodasCorreccionesChofer(m.texto)) push(c);
  }
  return out;
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  }).then((r) => r.json());
  globalThis.__token = login.token;
  if (!globalThis.__token) throw new Error("Login falló");

  let convs = await api("/api/conversaciones?limit=200");
  if (phoneFilter) convs = convs.filter((c) => c.telefono.includes(phoneFilter));

  let ok = 0;
  let skip = 0;

  for (const c of convs) {
    if (!c.ultimo_remito_id) {
      skip++;
      continue;
    }
    const correcciones = correccionesDeConversacion(
      await api(`/api/conversaciones/${c.telefono}`),
    );
    if (correcciones.length === 0) {
      skip++;
      continue;
    }

    const remito = await api(`/api/remitos/${c.ultimo_remito_id}`);
    const patch = buildPatchFromCorrecciones(remito.tenant, correcciones, remito.datos);
    const updated = await api(`/api/remitos/${c.ultimo_remito_id}/campos`, {
      method: "PATCH",
      body: patch,
    });

    console.log(
      `✓ ${c.telefono} remito ${c.ultimo_remito_id.slice(0, 8)} → ${correcciones.map((x) => x.campo).join(", ")} | estado ${updated.estado} valido=${updated.validacion?.valido}`,
    );
    ok++;
  }

  console.log(`\nListo: ${ok} remitos actualizados, ${skip} sin cambios.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
