#!/usr/bin/env node
/**
 * Seed SOL: evidencias POP/POD (varias fases), reclamos y rendiciones.
 * Uso (cwd /app/backend):
 *   DATA_DIR=./data node scripts/seed-sol-demo-ops.mjs
 */
import fs from "node:fs";
import path from "node:path";
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
  { nombre: "Pereyra, Juan C.", tel: "5491144556677" },
  { nombre: "Gómez, Martín", tel: "5491155667788" },
  { nombre: "Fernández, Diego", tel: "5491166778899" },
  { nombre: "Ruiz, Carla", tel: "5491177889900" },
  { nombre: "Sosa, Luis", tel: "5491188990011" },
  { nombre: "Benítez, Nora", tel: "5491199001122" },
];

const CLIENTES = [
  { nombre: "Distribuidora Norte SA", tel: "5491112345678", destino: "Av. del Libertador 7200, CABA", origen: "CD Pilar" },
  { nombre: "Alimentos del Sur", tel: "5491123456789", destino: "Ruta 9 Km 412, Córdoba", origen: "Planta Zárate" },
  { nombre: "Ferretería Central", tel: "5491134567890", destino: "Calle 50 1234, La Plata", origen: "Tigre, Buenos Aires" },
  { nombre: "Logística Pampeana", tel: "5491145678901", destino: "Parque Industrial, Rosario", origen: "Rosario Norte" },
  { nombre: "Frigorífico Atlántico", tel: "5491156789012", destino: "Puerto Nuevo, Mar del Plata", origen: "Puerto Dock Sud" },
  { nombre: "Textiles Andinos", tel: "5491167890123", destino: "Av. San Martín 890, Mendoza", origen: "Mendoza / Guaymallén" },
  { nombre: "Electro Hogar SRL", tel: "5491178901234", destino: "Av. Rivadavia 11500, CABA", origen: "CD Pilar" },
  { nombre: "Construcciones Río", tel: "5491189012345", destino: "Av. Colón 2500, Córdoba", origen: "Córdoba Capital" },
  { nombre: "Farmacéutica Belgrano", tel: "5491190123456", destino: "Av. Cabildo 2800, CABA", origen: "Planta Campana" },
  { nombre: "Agroinsumos Litoral", tel: "5491101234567", destino: "Ruta 12 Km 18, Paraná", origen: "Rosario Norte" },
];

const POP_FASES = [
  "pendiente",
  "observado",
  "ok",
  "rechazado",
  "pendiente",
  "ok",
  "observado",
  "ok",
  "pendiente",
  "ok",
];

const POD_FASES = [
  "pendiente",
  "ok",
  "observado",
  "rechazado",
  "ok",
  "pendiente",
  "observado",
  "ok",
  "pendiente",
  "ok",
];

function milestoneStatus(estado) {
  if (estado === "ok") return "approved";
  if (estado === "rechazado") return "rejected";
  if (estado === "observado") return "observed";
  if (estado === "pendiente") return "received";
  return "pending";
}

function buildEvidence() {
  const rows = [];
  const milestones = {};

  for (let i = 0; i < 10; i++) {
    const cli = CLIENTES[i];
    const ch = CHOFERES[i % CHOFERES.length];
    const tripId = `viaje_demo_${String(i + 1).padStart(4, "0")}`;
    const viajeRef = `VJ-20260909-${String(i + 1).padStart(3, "0")}`;
    const popEstado = POP_FASES[i];
    const podEstado = POD_FASES[i];
    const created = isoDaysAgo(3 - (i % 3), 9, i * 3);

    const popId = `POP-DEMO-${String(i + 1).padStart(4, "0")}`;
    const podId = `POD-DEMO-${String(i + 1).padStart(4, "0")}`;
    const popCodigo = `POP-${String(i + 1).padStart(4, "0")}`;
    const podCodigo = `POD-${String(i + 1).padStart(4, "0")}`;

    const bultos = 8 + i * 2;
    const peso = 240 + i * 35;

    rows.push({
      id: popId,
      type: "POP",
      codigo: popCodigo,
      estado: popEstado,
      tenant_id: "tsb",
      trip_id: tripId,
      telefono: ch.tel,
      chofer_nombre: ch.nombre,
      receptor_nombre: null,
      responsable_nombre: cli.nombre,
      imagen_url: popEstado === "esperando_foto" ? null : `/api/media/demo/pop-${i + 1}.jpg`,
      attachments:
        popEstado === "esperando_foto"
          ? []
          : [
              {
                id: `ATT-POP-${i + 1}`,
                url: `/api/media/demo/pop-${i + 1}.jpg`,
                mime_type: "image/jpeg",
                kind: "photo",
                created_at: created,
              },
            ],
      viaje_ref: viajeRef,
      origen: cli.origen,
      destino: cli.destino,
      destino_id: `PD-DEMO-${String(i + 1).padStart(3, "0")}`,
      nota_chofer: popEstado === "observado" ? "Falta 1 pallet según manifiesto" : "Retiro OK",
      texto_ocr: `POP ${popCodigo} · ${cli.nombre} · ${bultos} bultos · ${peso} kg`,
      reported_quantities: { bultos, cajas: bultos * 4, peso },
      expected_quantities: { bultos: popEstado === "observado" ? bultos + 1 : bultos, cajas: bultos * 4, peso },
      condition: popEstado === "observado" ? "diferencia_cantidad" : popEstado === "rechazado" ? "embalaje_deteriorado" : "ok",
      observed: popEstado === "observado",
      difference_notes:
        popEstado === "observado"
          ? "Reportado 1 bulto menos que lo esperado"
          : popEstado === "rechazado"
            ? "Embalaje abierto en origen — rechazado por mesa"
            : null,
      location: cli.origen,
      source: "whatsapp",
      nota_backoffice:
        popEstado === "rechazado"
          ? "Rechazado: foto ilegible / embalaje dañado"
          : popEstado === "ok"
            ? "Aprobado mesa"
            : null,
      aprobado_por: popEstado === "ok" || popEstado === "rechazado" ? "backoffice" : null,
      historial: [
        `${created} · Creado POP (${popEstado})`,
        ...(popEstado === "ok" ? [`${isoDaysAgo(1, 11, i)} · Aprobado`] : []),
        ...(popEstado === "rechazado" ? [`${isoDaysAgo(1, 12, i)} · Rechazado`] : []),
      ],
      received_at: ["pendiente", "observado", "ok", "rechazado"].includes(popEstado) ? created : null,
      approved_at: popEstado === "ok" ? isoDaysAgo(1, 11, i) : null,
      created_at: created,
      updated_at: isoDaysAgo(0, 14, i),
      _seed_demo: true,
    });

    rows.push({
      id: podId,
      type: "POD",
      codigo: podCodigo,
      estado: podEstado,
      tenant_id: "tsb",
      trip_id: tripId,
      telefono: ch.tel,
      chofer_nombre: ch.nombre,
      receptor_nombre: `Recepción ${cli.nombre.split(" ")[0]}`,
      responsable_nombre: `Recepción ${cli.nombre.split(" ")[0]}`,
      imagen_url: podEstado.startsWith("esperando") ? null : `/api/media/demo/pod-${i + 1}.jpg`,
      attachments: podEstado.startsWith("esperando")
        ? []
        : [
            {
              id: `ATT-POD-${i + 1}`,
              url: `/api/media/demo/pod-${i + 1}.jpg`,
              mime_type: "image/jpeg",
              kind: "photo",
              created_at: isoDaysAgo(1, 16, i),
            },
          ],
      viaje_ref: viajeRef,
      origen: cli.origen,
      destino: cli.destino,
      destino_id: `PD-DEMO-${String(i + 1).padStart(3, "0")}`,
      nota_chofer:
        podEstado === "observado"
          ? "Cliente firma con observación por humedad"
          : podEstado === "rechazado"
            ? "Foto sin firma del receptor"
            : "Entrega conforme",
      texto_ocr: `POD ${podCodigo} · Entrega ${cli.destino} · ${bultos} bultos`,
      reported_quantities: { bultos, cajas: bultos * 4, peso },
      expected_quantities: { bultos, cajas: bultos * 4, peso },
      condition:
        podEstado === "observado"
          ? "danada"
          : podEstado === "rechazado"
            ? "incompleta"
            : "ok",
      observed: podEstado === "observado",
      difference_notes:
        podEstado === "observado"
          ? "2 cajas con humedad leve — cliente acepta con observación"
          : podEstado === "rechazado"
            ? "Falta firma / sello del receptor"
            : null,
      location: cli.destino,
      source: "whatsapp",
      nota_backoffice:
        podEstado === "ok"
          ? "POD aprobado"
          : podEstado === "rechazado"
            ? "Pedir nueva foto firmada"
            : null,
      aprobado_por: podEstado === "ok" || podEstado === "rechazado" ? "backoffice" : null,
      historial: [
        `${isoDaysAgo(2, 15, i)} · Creado POD (${podEstado})`,
        ...(podEstado === "ok" ? [`${isoDaysAgo(0, 17, i)} · Aprobado`] : []),
        ...(podEstado === "rechazado" ? [`${isoDaysAgo(0, 17, i)} · Rechazado`] : []),
      ],
      received_at: ["pendiente", "observado", "ok", "rechazado"].includes(podEstado)
        ? isoDaysAgo(1, 16, i)
        : null,
      approved_at: podEstado === "ok" ? isoDaysAgo(0, 17, i) : null,
      created_at: isoDaysAgo(2, 15, i),
      updated_at: isoDaysAgo(0, 17, i),
      _seed_demo: true,
    });

    milestones[tripId] = {
      pop: {
        status: milestoneStatus(popEstado),
        evidence_id: popId,
        codigo: popCodigo,
        updated_at: isoDaysAgo(0, 14, i),
      },
      pod: {
        status: milestoneStatus(podEstado),
        evidence_id: podId,
        codigo: podCodigo,
        updated_at: isoDaysAgo(0, 17, i),
      },
    };
  }

  // Diálogos WA (no salen en mesa, pero cubren fases esperando_*)
  rows.push({
    id: "POP-DEMO-WAIT",
    type: "POP",
    codigo: null,
    estado: "esperando_foto",
    tenant_id: "tsb",
    trip_id: "viaje_demo_0011",
    telefono: "5491144556677",
    chofer_nombre: "Pereyra, Juan C.",
    receptor_nombre: null,
    responsable_nombre: null,
    imagen_url: null,
    attachments: [],
    viaje_ref: "VJ-20260909-011",
    origen: "CD Pilar",
    destino: "Av. Mitre 4500, Avellaneda",
    destino_id: "PD-DEMO-011",
    nota_chofer: null,
    texto_ocr: null,
    reported_quantities: null,
    expected_quantities: null,
    condition: null,
    observed: false,
    difference_notes: null,
    location: null,
    source: "whatsapp",
    nota_backoffice: null,
    aprobado_por: null,
    historial: [`${isoDaysAgo(0, 18)} · Creado POP (esperando_foto)`],
    received_at: null,
    approved_at: null,
    created_at: isoDaysAgo(0, 18),
    updated_at: isoDaysAgo(0, 18),
    _seed_demo: true,
  });
  rows.push({
    id: "POD-DEMO-WAIT",
    type: "POD",
    codigo: null,
    estado: "esperando_receptor",
    tenant_id: "tsb",
    trip_id: "viaje_demo_0012",
    telefono: "5491155667788",
    chofer_nombre: "Gómez, Martín",
    receptor_nombre: null,
    responsable_nombre: null,
    imagen_url: null,
    attachments: [],
    viaje_ref: "VJ-20260909-012",
    origen: "Planta Zárate",
    destino: "San Juan Capital",
    destino_id: "PD-DEMO-012",
    nota_chofer: null,
    texto_ocr: null,
    reported_quantities: null,
    expected_quantities: null,
    condition: null,
    observed: false,
    difference_notes: null,
    location: null,
    source: "whatsapp",
    nota_backoffice: null,
    aprobado_por: null,
    historial: [`${isoDaysAgo(0, 19)} · Creado POD (esperando_receptor)`],
    received_at: null,
    approved_at: null,
    created_at: isoDaysAgo(0, 19),
    updated_at: isoDaysAgo(0, 19),
    _seed_demo: true,
  });

  return { rows, milestones };
}

function buildReclamos() {
  const motivos = [
    "demora_entrega",
    "faltante",
    "averia",
    "producto_equivocado",
    "documentacion",
    "trato",
    "otro",
    "demora_entrega",
    "faltante",
    "averia",
    "documentacion",
    "demora_entrega",
    "producto_equivocado",
    "faltante",
    "averia",
    "trato",
    "demora_entrega",
    "otro",
  ];
  const estados = [
    "nuevo",
    "en_proceso",
    "escalado",
    "resuelto",
    "nuevo",
    "en_proceso",
    "resuelto",
    "escalado",
    "nuevo",
    "en_proceso",
    "resuelto",
    "nuevo",
    "en_proceso",
    "escalado",
    "resuelto",
    "nuevo",
    "en_proceso",
    "resuelto",
  ];
  const detalles = {
    demora_entrega: "La entrega prometida para la mañana llegó pasadas las 18 hs.",
    faltante: "Faltaron 3 cajas del pedido según remito.",
    averia: "Mercadería golpeada en una esquina del pallet.",
    producto_equivocado: "Llegó un SKU distinto al solicitado.",
    documentacion: "Remito sin firma / sello del receptor.",
    trato: "Atención poco clara al coordinar la descarga.",
    otro: "Consulta por reprogramación de ventana horaria.",
  };
  const abbr = {
    demora_entrega: "RT",
    faltante: "FA",
    averia: "PD",
    producto_equivocado: "PE",
    documentacion: "DO",
    trato: "TR",
    otro: "OT",
  };

  return motivos.map((motivo, i) => {
    const cli = CLIENTES[i % CLIENTES.length];
    const estado = estados[i];
    const day = String(now.getUTCDate()).padStart(2, "0");
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const year = now.getUTCFullYear();
    const codigo = `RC-${year}${month}${day}-${String(i + 1).padStart(4, "0")}-${abbr[motivo]}`;
    const created = isoDaysAgo(i % 6, 13, i);
    return {
      id: `RID-DEMO-${String(i + 1).padStart(4, "0")}`,
      codigo,
      telefono: cli.tel,
      nombre: cli.nombre,
      cliente: cli.nombre,
      canal: "whatsapp",
      estado,
      motivo,
      criticidad: i % 7 === 0 ? "alta" : i % 3 === 0 ? "baja" : "media",
      viaje_ref: `VJ-20260909-${String((i % 10) + 1).padStart(3, "0")}`,
      remito_ref: String(19600 + (i % 10)).padStart(8, "0"),
      pedido_ref: `PED-${4500 + i}`,
      resumen: detalles[motivo],
      detalle: `${detalles[motivo]} Destino: ${cli.destino}.`,
      imagen_url: ["averia", "producto_equivocado"].includes(motivo)
        ? `/api/media/demo/reclamo-${i + 1}.jpg`
        : null,
      mensajes: [
        { dir: "in", texto: detalles[motivo], at: created, imagen_url: null },
        {
          dir: "out",
          texto: `Hola ${cli.nombre.split(" ")[0]}, abrimos el caso ${codigo}. Te mantenemos al tanto.`,
          at: isoDaysAgo(i % 6, 13, i + 1),
        },
      ],
      historial: [
        `${created} · Creado (${estado} · seed demo)`,
        ...(estado === "resuelto" ? [`${isoDaysAgo(0, 15, i)} · resuelto`] : []),
        ...(estado === "escalado" ? [`${isoDaysAgo(1, 16, i)} · escalado a supervisor`] : []),
      ],
      nota_interna: estado === "escalado" ? "Escalar a operaciones" : null,
      created_at: created,
      updated_at: isoDaysAgo(0, 16, i),
      _seed_demo: true,
    };
  });
}

function buildRendiciones() {
  const cats = [
    "combustible",
    "peaje",
    "arreglo_menor",
    "llantas",
    "aceite",
    "remolque",
    "auxilio_mecanico",
    "otro",
    "combustible",
    "peaje",
    "combustible",
    "arreglo_menor",
    "peaje",
    "llantas",
    "aceite",
    "combustible",
    "peaje",
    "auxilio_mecanico",
  ];
  const estados = [
    "pendiente_aprobacion",
    "aprobado",
    "rechazado",
    "pendiente_aprobacion",
    "aprobado",
    "pendiente_aprobacion",
    "aprobado",
    "rechazado",
    "pendiente_aprobacion",
    "aprobado",
    "pendiente_aprobacion",
    "aprobado",
    "pendiente_aprobacion",
    "aprobado",
    "rechazado",
    "pendiente_aprobacion",
    "aprobado",
    "pendiente_aprobacion",
  ];
  const proveedores = {
    combustible: "YPF",
    peaje: "AUSA / Autopistas",
    arreglo_menor: "NEUMAX S.A.",
    llantas: "Fate / Bridgestone",
    aceite: "Lubricentro Sur",
    remolque: "Auxilio Ruta 9",
    auxilio_mecanico: "Grúa del Norte",
    otro: "Comercio varios",
  };
  const montos = {
    combustible: 58000,
    peaje: 4200,
    arreglo_menor: 12500,
    llantas: 89000,
    aceite: 9800,
    remolque: 35000,
    auxilio_mecanico: 45000,
    otro: 6500,
  };
  const desc = {
    combustible: "Carga gasoil full",
    peaje: "Peaje Acceso Norte ida/vuelta",
    arreglo_menor: "Parchado / reparación menor",
    llantas: "Cubierta de reposición",
    aceite: "Cambio de aceite motor",
    remolque: "Servicio de remolque corto",
    auxilio_mecanico: "Auxilio en ruta",
    otro: "Gasto operativo menor",
  };

  return cats.map((categoria, i) => {
    const ch = CHOFERES[i % CHOFERES.length];
    const estado = estados[i];
    const created = isoDaysAgo(i % 8, 10, i * 2);
    const fecha = dateDaysAgo(i % 8);
    const [y, m, d] = fecha.split("-");
    const fechaComp = `${d}/${m}/${y}`;
    return {
      id: `RG-DEMO-${String(i + 1).padStart(4, "0")}`,
      codigo: `RG-${String(i + 1).padStart(4, "0")}`,
      estado,
      categoria,
      monto: montos[categoria] + i * 150,
      moneda: "ARS",
      proveedor: proveedores[categoria],
      fecha_comprobante: fechaComp,
      descripcion: desc[categoria],
      viaje_ref: `VJ-20260909-${String((i % 12) + 1).padStart(3, "0")}`,
      telefono: ch.tel,
      chofer_nombre: ch.nombre,
      patente: ["AE123CD", "AF654KL", "AH111OP", "AD987FG", "AC456HJ", "AB321MN"][i % 6],
      imagen_url: `/api/media/demo/gasto-${i + 1}.jpg`,
      nota_chofer: "Comprobante adjunto",
      nota_aprobacion:
        estado === "aprobado"
          ? "OK liquidación"
          : estado === "rechazado"
            ? "Ticket ilegible / fuera de política"
            : null,
      aprobado_por: estado === "pendiente_aprobacion" ? null : "backoffice",
      texto_ocr: `${proveedores[categoria]} · ${desc[categoria]} · $${montos[categoria] + i * 150}`,
      historial: [
        `${created} · Creado (pendiente_aprobacion)`,
        ...(estado !== "pendiente_aprobacion" ? [`${isoDaysAgo(0, 12, i)} · ${estado}`] : []),
      ],
      created_at: created,
      updated_at: isoDaysAgo(0, 12, i),
      _seed_demo: true,
    };
  });
}

const files = [
  "transport-evidence.json",
  "pod-casos.json",
  "trip-evidence-milestones.json",
  "reclamos.json",
  "rendicion-gastos.json",
];
const backups = files.map(backup).filter(Boolean);

const { rows: evidence, milestones } = buildEvidence();
const pods = evidence.filter((r) => r.type === "POD");
const reclamos = buildReclamos();
const gastos = buildRendiciones();

writeJson("transport-evidence.json", evidence);
writeJson("pod-casos.json", pods);
writeJson("trip-evidence-milestones.json", milestones);
writeJson("reclamos.json", reclamos);
writeJson("rendicion-gastos.json", gastos);

console.log(
  JSON.stringify(
    {
      ok: true,
      dataDir: DATA_DIR,
      backups,
      counts: {
        evidence: evidence.length,
        pop: evidence.filter((r) => r.type === "POP").length,
        pod: pods.length,
        popFases: [...new Set(evidence.filter((r) => r.type === "POP").map((r) => r.estado))],
        podFases: [...new Set(pods.map((r) => r.estado))],
        milestones: Object.keys(milestones).length,
        reclamos: reclamos.length,
        gastos: gastos.length,
      },
    },
    null,
    2,
  ),
);
