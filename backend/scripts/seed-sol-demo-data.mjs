#!/usr/bin/env node
/**
 * Reemplaza datos de prueba (protocolo V11 / QA) por ejemplos realistas en SOL.
 * Uso (en el contenedor transitone-remitos, cwd /app/backend):
 *   node scripts/seed-sol-demo-data.mjs
 *
 * Hace backup timestampado de remitos, incidencias, destinos-pendientes y viajes.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const now = new Date();

function isoDaysAgo(days, hour = 10, minute = 0) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateDaysAgo(days) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function backup(name) {
  const src = path.join(DATA_DIR, name);
  if (!fs.existsSync(src)) return null;
  const dest = path.join(DATA_DIR, `${name}.bak-${stamp}`);
  fs.copyFileSync(src, dest);
  return dest;
}

function writeJson(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

const CHOFERES = [
  { nombre: "Pereyra, Juan C.", tel: "5491144556677", tractor: "AE123CD", semi: "LJK789" },
  { nombre: "Gómez, Martín", tel: "5491155667788", tractor: "AF654KL", semi: "ZD444EE" },
  { nombre: "Fernández, Diego", tel: "5491166778899", tractor: "AH111OP", semi: "ZE555FF" },
  { nombre: "Ruiz, Carla", tel: "5491177889900", tractor: "AD987FG", semi: "AB123XY" },
  { nombre: "Sosa, Luis", tel: "5491188990011", tractor: "AC456HJ", semi: "AC789KL" },
  { nombre: "Benítez, Nora", tel: "5491199001122", tractor: "AB321MN", semi: "AD654PQ" },
];

const CLIENTES = [
  { nombre: "Distribuidora Norte SA", tel: "5491112345678", destino: "Av. del Libertador 7200, CABA" },
  { nombre: "Alimentos del Sur", tel: "5491123456789", destino: "Ruta 9 Km 412, Córdoba" },
  { nombre: "Ferretería Central", tel: "5491134567890", destino: "Calle 50 1234, La Plata" },
  { nombre: "Logística Pampeana", tel: "5491145678901", destino: "Parque Industrial, Rosario" },
  { nombre: "Frigorífico Atlántico", tel: "5491156789012", destino: "Puerto Nuevo, Mar del Plata" },
  { nombre: "Textiles Andinos", tel: "5491167890123", destino: "Av. San Martín 890, Mendoza" },
  { nombre: "Electro Hogar SRL", tel: "5491178901234", destino: "Av. Rivadavia 11500, CABA" },
  { nombre: "Construcciones Río", tel: "5491189012345", destino: "Av. Colón 2500, Córdoba" },
  { nombre: "Farmacéutica Belgrano", tel: "5491190123456", destino: "Av. Cabildo 2800, CABA" },
  { nombre: "Agroinsumos Litoral", tel: "5491101234567", destino: "Ruta 12 Km 18, Paraná" },
  { nombre: "Papelera del Plata", tel: "5491111223344", destino: "Zárate, Buenos Aires" },
  { nombre: "Cervecería Patagonia", tel: "5491122334455", destino: "Bariloche, Río Negro" },
  { nombre: "Muebles Cordobeses", tel: "5491133445566", destino: "Villa María, Córdoba" },
  { nombre: "Petroleo & Gas SA", tel: "5491144556670", destino: "Comodoro Rivadavia, Chubut" },
  { nombre: "Supermercados Uno", tel: "5491155667780", destino: "Av. Mitre 4500, Avellaneda" },
  { nombre: "Autopartes Cuyo", tel: "5491166778890", destino: "San Juan Capital" },
  { nombre: "Química Industrial", tel: "5491177889901", destino: "Campana, Buenos Aires" },
  { nombre: "Vidrios del Este", tel: "5491188990012", destino: "Berazategui, Buenos Aires" },
];

const ORIGENES = [
  "Mendoza / Guaymallén",
  "Tigre, Buenos Aires",
  "Planta Zárate",
  "CD Pilar",
  "Rosario Norte",
  "Córdoba Capital",
  "Planta Campana",
  "Puerto Dock Sud",
];

const DEMORAS = [
  { causa: "Congestión en peaje Riccheri · +45 min", eta: "18:40", estado: "nueva" },
  { causa: "Espera en playa de carga · sin dock libre", eta: "19:15", estado: "en_gestion" },
  { causa: "Tráfico pesado en Acceso Norte", eta: "17:55", estado: "nueva" },
  { causa: "Control de pesos en ruta · demora operativa", eta: "20:10", estado: "esperando_causa" },
  { causa: "Lluvia intensa · velocidad reducida", eta: "21:00", estado: "nueva" },
  { causa: "Desvío por corte de ruta en Panamericana", eta: "18:20", estado: "en_gestion" },
  { causa: "Cliente sin personal de recepción aún", eta: "16:45", estado: "nueva" },
  { causa: "Falla menor hidráulica · en revisión", eta: "22:30", estado: "en_gestion" },
  { causa: "Espera documental en aduana interna", eta: "19:50", estado: "nueva" },
  { causa: "Cola en ingreso a planta industrial", eta: "17:30", estado: "en_gestion" },
  { causa: "Choque lateral en ruta (sin lesionados) · tránsito lento", eta: "20:45", estado: "nueva" },
  { causa: "Recarga de combustible no planificada", eta: "16:20", estado: "nueva" },
  { causa: "Retraso en cruce ferroviario", eta: "18:05", estado: "en_gestion" },
  { causa: "Cambio de unidad en origen · reasignación", eta: "19:35", estado: "nueva" },
  { causa: "Niebla en tramo rural · precaución", eta: "21:20", estado: "esperando_causa" },
  { causa: "Demora por maniobra en depósito estrecho", eta: "17:10", estado: "nueva" },
  { causa: "Verificación de sellos en control", eta: "18:55", estado: "en_gestion" },
  { causa: "Espera de autorización de descarga", eta: "20:00", estado: "nueva" },
];

const ESTADOS_REMITO = [
  "pendiente_revision",
  "pendiente_revision",
  "incompleto",
  "confirmado",
  "confirmado",
  "bloqueado",
];

function buildRemitos() {
  return CLIENTES.map((cli, i) => {
    const ch = CHOFERES[i % CHOFERES.length];
    const id = randomUUID();
    const dias = (i % 12) + 1;
    const fecha = dateDaysAgo(dias);
    const estado = ESTADOS_REMITO[i % ESTADOS_REMITO.length];
    const nro = String(19600 + i).padStart(8, "0");
    const faltantes =
      estado === "incompleto"
        ? ["Semi / remolque"]
        : estado === "bloqueado"
          ? ["destino"]
          : [];
    return {
      id,
      tenant: "tsb",
      estado,
      telefono_chofer: ch.tel,
      texto_ocr: `GUÍA DEMO ${nro} · ${cli.nombre}`,
      datos: {
        tenant: "tsb",
        nro_guia: nro,
        nro_remito: nro,
        fecha_guia: fecha,
        conductor: ch.nombre,
        chasis: ch.tractor,
        acoplado: estado === "incompleto" ? null : ch.semi,
        peso_kg: 1200 + i * 85,
        procedencia: ORIGENES[i % ORIGENES.length],
        destino: cli.destino,
        malla: i % 2 === 0 ? "30/70" : "general",
        remito_cliente: `${1000 + i}-${4500 + i}`,
        nro_interno: `D${400 + i}`,
        horarios: {
          tenant: "tsb",
          fecha_remito: fecha,
          horarios: {
            carga_entrada: { fecha, hora: "07:30" },
            carga_salida: { fecha, hora: "08:15" },
            descarga_llegada: { fecha, hora: "14:10" },
            descarga_inicio: { fecha, hora: "14:25" },
            descarga_fin: { fecha, hora: "15:40" },
          },
        },
      },
      validacion: {
        valido: estado === "confirmado",
        faltantes,
        errores: estado === "bloqueado" ? ["Destino no coincide con maestro"] : [],
        destino_maestro: estado === "bloqueado" ? null : cli.destino,
        unidades_maestro: { tractor: ch.tractor, semi: ch.semi },
      },
      created_at: isoDaysAgo(dias, 8, 5 + i),
      updated_at: isoDaysAgo(dias, 9, 10 + i),
      _seed_demo: true,
    };
  });
}

function buildDestinos() {
  return CLIENTES.map((cli, i) => {
    const ch = CHOFERES[i % CHOFERES.length];
    const dem = DEMORAS[i % DEMORAS.length];
    const estados = ["en_ruta", "esperando_eta_chofer", "en_ruta", "confirmado", "en_ruta"];
    const estado = estados[i % estados.length];
    const id = `PD-DEMO-${String(i + 1).padStart(3, "0")}`;
    const viaje = `VJ-20260909-${String(i + 1).padStart(3, "0")}`;
    return {
      id,
      estado,
      telefono_cliente: cli.tel,
      telefono_chofer: ch.tel,
      cliente: cli.nombre,
      formatted_address: cli.destino,
      direccion: cli.destino,
      chofer_nombre: ch.nombre,
      viaje_ref: viaje,
      eta_texto: estado === "esperando_eta_chofer" ? null : dem.eta,
      eta_minutos: estado === "esperando_eta_chofer" ? null : 35 + i * 3,
      eta_at: estado === "esperando_eta_chofer" ? null : isoDaysAgo(0, 12, i),
      lat: -34.6 - i * 0.02,
      lng: -58.4 - i * 0.01,
      historial: [
        `${isoDaysAgo(1)} · Destino creado (seed demo)`,
        `${isoDaysAgo(0, 10)} · Estado: ${estado}`,
      ],
      created_at: isoDaysAgo(2, 9, i),
      updated_at: isoDaysAgo(0, 11, i),
      _seed_demo: true,
    };
  });
}

function buildIncidencias(destinos) {
  const rows = [];
  for (let i = 0; i < DEMORAS.length; i++) {
    const dem = DEMORAS[i];
    const dest = destinos[i];
    const ch = CHOFERES[i % CHOFERES.length];
    const day = String(now.getUTCDate()).padStart(2, "0");
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const year = now.getUTCFullYear();
    const codigo = `INC-${year}${month}${day}-${String(i + 1).padStart(4, "0")}-DE`;
    const created = isoDaysAgo(i % 5, 14, i * 2);
    rows.push({
      id: `IID-DEMO-${String(i + 1).padStart(4, "0")}`,
      codigo,
      telefono: ch.tel,
      chofer_nombre: ch.nombre,
      canal: "whatsapp",
      origen: "chofer",
      estado: dem.estado,
      tipo: "demora",
      criticidad: i % 5 === 0 ? "alta" : "media",
      causa: dem.causa,
      resumen: dem.causa,
      viaje_ref: dest.viaje_ref,
      destino_id: dest.id,
      lat: dest.lat,
      lng: dest.lng,
      imagen_url: null,
      mensajes: [
        { dir: "in", texto: dem.causa, at: created, imagen_url: null },
      ],
      historial: [`${created} · Creada (${dem.estado} · chofer · seed demo)`],
      nota_interna: null,
      consulta_at: dem.estado === "esperando_causa" ? created : null,
      recordatorio_enviado_at: null,
      cerrado_sin_respuesta: false,
      created_at: created,
      updated_at: isoDaysAgo(0, 15, i),
      _seed_demo: true,
    });
  }

  // Otras incidencias abiertas (no demora) para Incidencias panel
  const otros = [
    { tipo: "pinchazo", causa: "Pinchazo rueda trasera derecha · en banquina", criticidad: "media" },
    { tipo: "desvio", causa: "Desvío por obra en ruta 7 · +30 km", criticidad: "baja" },
  ];
  otros.forEach((o, j) => {
    const ch = CHOFERES[j];
    const dest = destinos[j];
    const created = isoDaysAgo(1, 16, j);
    const day = String(now.getUTCDate()).padStart(2, "0");
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const year = now.getUTCFullYear();
    const suf = o.tipo === "pinchazo" ? "PI" : "DV";
    rows.push({
      id: `IID-DEMO-X${j + 1}`,
      codigo: `INC-${year}${month}${day}-${String(50 + j).padStart(4, "0")}-${suf}`,
      telefono: ch.tel,
      chofer_nombre: ch.nombre,
      canal: "whatsapp",
      origen: "chofer",
      estado: "en_gestion",
      tipo: o.tipo,
      criticidad: o.criticidad,
      causa: o.causa,
      resumen: o.causa,
      viaje_ref: dest.viaje_ref,
      destino_id: dest.id,
      lat: dest.lat,
      lng: dest.lng,
      imagen_url: null,
      mensajes: [{ dir: "in", texto: o.causa, at: created, imagen_url: null }],
      historial: [`${created} · Creada (en_gestion · chofer · seed demo)`],
      nota_interna: null,
      consulta_at: null,
      recordatorio_enviado_at: null,
      cerrado_sin_respuesta: false,
      created_at: created,
      updated_at: created,
      _seed_demo: true,
    });
  });

  return rows;
}

function buildViajes(destinos) {
  return destinos.slice(0, 12).map((d, i) => {
    const ch = CHOFERES[i % CHOFERES.length];
    const cli = CLIENTES[i];
    return {
      id: `viaje_demo_${String(i + 1).padStart(4, "0")}`,
      codigo: d.viaje_ref,
      estado: i % 4 === 0 ? "asignado" : "en_curso",
      historial: [`${isoDaysAgo(1)} · Viaje creado (seed demo)`],
      created_at: isoDaysAgo(2, 8, i),
      updated_at: isoDaysAgo(0, 12, i),
      cliente: cli.nombre,
      origen: ORIGENES[i % ORIGENES.length],
      destino: cli.destino,
      carga: `${1.2 + i * 0.3} t carga general`,
      fecha: dateDaysAgo(i % 3),
      hora: `${8 + (i % 8)}:00`,
      tipo_carga: "carga general",
      tipo_unidad: "sider",
      tenant: "tsb",
      chofer: ch.nombre,
      telefono_chofer: ch.tel,
      tractor: ch.tractor,
      semi: ch.semi,
      notas: "seed demo SOL",
      telefono_cliente: cli.tel,
      remito_ids: [],
      destino_validacion_id: d.id,
      tms_id: null,
      tms_sync_status: "none",
      tms_synced_at: null,
      _seed_demo: true,
    };
  });
}

const files = ["remitos.json", "incidencias.json", "destinos-pendientes.json", "viajes.json"];
const backups = files.map(backup).filter(Boolean);

const remitos = buildRemitos();
const destinos = buildDestinos();
const incidencias = buildIncidencias(destinos);
const viajes = buildViajes(destinos);

writeJson("remitos.json", remitos);
writeJson("destinos-pendientes.json", destinos);
writeJson("incidencias.json", incidencias);
writeJson("viajes.json", viajes);

console.log(
  JSON.stringify(
    {
      ok: true,
      dataDir: DATA_DIR,
      backups,
      counts: {
        remitos: remitos.length,
        destinos: destinos.length,
        incidencias: incidencias.length,
        viajes: viajes.length,
      },
    },
    null,
    2,
  ),
);
