import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "marketing.json");

const COLLECTIONS = [
  "catalog",
  "campaigns",
  "offers",
  "emails",
  "opportunities",
  "questions",
  "pieces",
  "growthOpportunities",
  "growthRuns",
];

function emptyDb() {
  const db = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  db.meta = {
    workspaceName: "TransitOne",
    cleexsSnapshot: null,
  };
  return db;
}

export function readDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    const empty = emptyDb();
    fs.writeFileSync(FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const db = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const c of COLLECTIONS) {
      if (!Array.isArray(db[c])) db[c] = [];
    }
    if (!db.meta || typeof db.meta !== "object") {
      db.meta = { workspaceName: "TransitOne", cleexsSnapshot: null };
    }
    return db;
  } catch {
    return emptyDb();
  }
}

export function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

/** Prefijos: cmp, ofr, eml, cat, opp, qst, pce, gop, grn */
export function mktId(prefix = "mkt") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function isoDaysFromNow(days, hours = 12) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
}

function stamp(row) {
  const now = new Date().toISOString();
  return {
    ...row,
    createdAt: row.createdAt ?? now,
    updatedAt: now,
  };
}

function isEmpty(db) {
  return COLLECTIONS.every((c) => !Array.isArray(db[c]) || db[c].length === 0);
}

/** Siembra datos demo ricos de TransitOne / SOL si el store está vacío. */
export function ensureSeed() {
  const db = readDb();
  if (!isEmpty(db)) return { seeded: false, db };

  const now = new Date().toISOString();

  const cat1 = mktId("cat");
  const cat2 = mktId("cat");
  const cat3 = mktId("cat");

  const opp1 = mktId("opp");
  const opp2 = mktId("opp");
  const opp3 = mktId("opp");
  const opp4 = mktId("opp");
  const opp5 = mktId("opp");

  const cmp1 = mktId("cmp");
  const cmp2 = mktId("cmp");
  const cmp3 = mktId("cmp");

  const ofr1 = mktId("ofr");
  const ofr2 = mktId("ofr");
  const ofr3 = mktId("ofr");

  const eml1 = mktId("eml");
  const eml2 = mktId("eml");

  const pce1 = mktId("pce");
  const pce2 = mktId("pce");
  const pce3 = mktId("pce");
  const pce4 = mktId("pce");

  const gop1 = mktId("gop");
  const gop2 = mktId("gop");
  const gop3 = mktId("gop");

  const grn1 = mktId("grn");
  const grn2 = mktId("grn");

  db.catalog = [
    stamp({
      id: cat1,
      kind: "servicio",
      name: "Distribución urbana última milla",
      description:
        "Entregas door-to-door en AMBA y ciudades del interior con tracking en tiempo real, POD digital y ventanas horarias acordadas con el destinatario.",
      priceText: "Desde $18.500 / entrega",
      audience: "E-commerces, retail y laboratorios con entregas B2C/B2B en ciudad",
      active: true,
    }),
    stamp({
      id: cat2,
      kind: "servicio",
      name: "Cargas full truckload (FTL)",
      description:
        "Transporte de carga completa nacional e internacional con flota propia y terceros auditados. Incluye ETA predictivo y gestión de incidencias.",
      priceText: "Cotización por tramo",
      audience: "Industria, agro y operadores logísticos que necesitan FTL confiable",
      active: true,
    }),
    stamp({
      id: cat3,
      kind: "producto",
      name: "SOL Desk — torre de control",
      description:
        "Plataforma de monitoreo unificado: viajes, remitos, POD, ETA e incidencias en un solo escritorio para operaciones TransitOne.",
      priceText: "Licencia anual por flota",
      audience: "Gerentes de operaciones y planners de flota",
      active: true,
    }),
  ];

  db.opportunities = [
    stamp({
      id: opp1,
      keyword: "última milla buenos aires",
      cluster: "distribución urbana",
      stage: "bofu",
      status: "idea",
      priority: 90,
      opportunityScore: 88,
      demandScore: 82,
      monthlySearches: 2400,
      intentLabel: "contratación de operador",
      scoreReason: "Alta intención comercial y baja presencia de TransitOne en resultados IA",
      gscImpressions: 4200,
      gscClicks: 186,
    }),
    stamp({
      id: opp2,
      keyword: "tracking de envíos en tiempo real",
      cluster: "visibilidad de carga",
      stage: "mofu",
      status: "queued",
      priority: 78,
      opportunityScore: 76,
      demandScore: 80,
      monthlySearches: 3100,
      intentLabel: "comparar soluciones",
      scoreReason: "Competidores aparecen primero en prompts de evaluación",
      gscImpressions: 6800,
      gscClicks: 240,
    }),
    stamp({
      id: opp3,
      keyword: "transporte de carga refrigerada argentina",
      cluster: "cadena de frío",
      stage: "tofu",
      status: "idea",
      priority: 65,
      opportunityScore: 62,
      demandScore: 70,
      monthlySearches: 890,
      intentLabel: "descubrimiento",
      scoreReason: "Cluster adyacente con potencial de contenidos",
      gscImpressions: 1100,
      gscClicks: 42,
    }),
    stamp({
      id: opp4,
      keyword: "software torre de control logística",
      cluster: "software SOL",
      stage: "mofu",
      status: "in_progress",
      priority: 84,
      opportunityScore: 81,
      demandScore: 75,
      monthlySearches: 720,
      intentLabel: "evaluación de producto",
      scoreReason: "Alinea con SOL Desk y genera leads de alto valor",
      gscImpressions: 950,
      gscClicks: 61,
    }),
    stamp({
      id: opp5,
      keyword: "operador logístico e-commerce argentina",
      cluster: "distribución urbana",
      stage: "bofu",
      status: "idea",
      priority: 72,
      opportunityScore: 70,
      demandScore: 68,
      monthlySearches: 1600,
      intentLabel: "solicitud de cotización",
      scoreReason: "Solapamiento fuerte con catálogo última milla",
      gscImpressions: 2100,
      gscClicks: 98,
    }),
  ];

  db.questions = [
    stamp({
      id: mktId("qst"),
      question: "¿Cuánto demora una entrega de última milla en CABA?",
      cluster: "distribución urbana",
      stage: "bofu",
      priority: 88,
      businessFit: 90,
      status: "open",
    }),
    stamp({
      id: mktId("qst"),
      question: "¿TransitOne ofrece tracking en vivo para el destinatario?",
      cluster: "visibilidad de carga",
      stage: "mofu",
      priority: 85,
      businessFit: 92,
      status: "open",
    }),
    stamp({
      id: mktId("qst"),
      question: "¿Qué diferencia hay entre FTL y consolidado para pymes?",
      cluster: "transporte FTL",
      stage: "tofu",
      priority: 60,
      businessFit: 70,
      status: "open",
    }),
    stamp({
      id: mktId("qst"),
      question: "¿SOL Desk se integra con WhatsApp del chofer?",
      cluster: "software SOL",
      stage: "mofu",
      priority: 80,
      businessFit: 95,
      status: "open",
    }),
  ];

  db.campaigns = [
    stamp({
      id: cmp1,
      title: "Distribución urbana última milla: última milla buenos aires",
      objective:
        "Conseguir más consultas con Distribución urbana última milla. Público: E-commerces y retail en AMBA. Acción: contenidos + oferta de onboarding + email a lista de prospectos.",
      audience: "E-commerces y retail con entregas en AMBA",
      sourceType: "catalog",
      sourceLabel: "Distribución urbana última milla",
      sourceRefId: cat1,
      status: "active",
      startsAt: isoDaysFromNow(-14),
      endsAt: isoDaysFromNow(30),
      brief: {
        product: { name: "Distribución urbana última milla", kind: "servicio" },
        goal: { key: "consultas", label: "Conseguir más consultas" },
      },
    }),
    stamp({
      id: cmp2,
      title: "Campaña: tracking de envíos en tiempo real",
      objective:
        "Mejorar la visibilidad de la marca en consultas de evaluación sobre tracking de envíos en tiempo real (cluster visibilidad de carga).",
      audience: "Personas en etapa de evaluación interesadas en visibilidad de carga",
      sourceType: "opportunity",
      sourceLabel: "tracking de envíos en tiempo real",
      sourceRefId: opp2,
      status: "approved",
      startsAt: isoDaysFromNow(-3),
      endsAt: isoDaysFromNow(45),
      brief: null,
    }),
    stamp({
      id: cmp3,
      title: "SOL Desk — torre de control: software torre de control logística",
      objective:
        "Ser más visible en IA y Google con SOL Desk. Posicionar TransitOne como referente en torre de control logística.",
      audience: "Gerentes de operaciones y planners de flota",
      sourceType: "catalog",
      sourceLabel: "SOL Desk — torre de control",
      sourceRefId: cat3,
      status: "proposed",
      startsAt: null,
      endsAt: null,
      brief: {
        product: { name: "SOL Desk — torre de control", kind: "producto" },
        goal: { key: "visibilidad", label: "Ser más visible en IA y Google" },
      },
    }),
  ];

  db.offers = [
    stamp({
      id: ofr1,
      campaignId: cmp1,
      title: "Onboarding última milla sin costo de setup",
      description:
        "Primeras 50 entregas con setup de rutas, app de choferes y POD digital incluidos. Ideal para e-commerces que migran de un operador actual.",
      priceText: "Setup $0 + tarifa estándar",
      discountText: "Setup gratis (valor $180.000)",
      terms: "Válido para cuentas nuevas en AMBA. Cupo limitado a 10 clientes/mes.",
      channels: ["email", "web", "whatsapp"],
      status: "active",
      startsAt: isoDaysFromNow(-10),
      endsAt: isoDaysFromNow(20),
    }),
    stamp({
      id: ofr2,
      campaignId: cmp2,
      title: "Demo tracking 30 días",
      description:
        "Acceso a la vista de tracking y ETA predictivo de TransitOne durante 30 días sin compromiso.",
      priceText: "Sin cargo",
      discountText: "Prueba gratuita 30 días",
      terms: "Requiere CUIT y al menos 5 viajes activos en el período.",
      channels: ["email", "web"],
      status: "approved",
      startsAt: isoDaysFromNow(-2),
      endsAt: isoDaysFromNow(40),
    }),
    stamp({
      id: ofr3,
      campaignId: cmp1,
      title: "Pack invierno e-commerce (vencida)",
      description: "Descuento estacional en entregas de temporada alta de invierno.",
      priceText: "15% off en entregas",
      discountText: "15% OFF",
      terms: "Venció al cierre de temporada.",
      channels: ["email", "web"],
      status: "active",
      startsAt: isoDaysFromNow(-60),
      endsAt: isoDaysFromNow(-5),
    }),
  ];

  db.emails = [
    stamp({
      id: eml1,
      campaignId: cmp1,
      offerId: ofr1,
      segment: "E-commerces y retail con entregas en AMBA",
      subject: "Distribución urbana última milla — Setup gratis (valor $180.000)",
      preheader: "Onboarding sin costo de setup para tus primeras 50 entregas",
      body: [
        "Hola,",
        "",
        "Desde TransitOne queremos compartirte: Distribución urbana última milla.",
        "",
        "Onboarding última milla sin costo de setup para cuentas nuevas en AMBA.",
        "",
        "Si te interesa, respondé este correo y te ayudamos personalmente.",
        "",
        "— Equipo de TransitOne",
      ].join("\n"),
      ctaText: "Quiero aprovecharlo",
      ctaUrl: null,
      status: "approved",
      source: "template",
    }),
    stamp({
      id: eml2,
      campaignId: cmp2,
      offerId: ofr2,
      segment: "Personas en etapa de evaluación interesadas en visibilidad de carga",
      subject: "Campaña: tracking de envíos en tiempo real — Prueba gratuita 30 días",
      preheader: "Probá el tracking y ETA predictivo de TransitOne",
      body: [
        "Hola,",
        "",
        "Desde TransitOne queremos compartirte nuestra demo de tracking.",
        "",
        "Si te interesa, respondé este correo y te ayudamos personalmente.",
        "",
        "— Equipo de TransitOne",
      ].join("\n"),
      ctaText: "Quiero aprovecharlo",
      ctaUrl: null,
      status: "draft",
      source: "template",
    }),
  ];

  db.pieces = [
    stamp({
      id: pce1,
      title: "Cómo elegir un operador de última milla en AMBA",
      type: "article",
      status: "published",
      slug: "operador-ultima-milla-amba",
      keyword: "última milla buenos aires",
      cluster: { name: "distribución urbana" },
      publication: {
        url: "https://transitone.com.ar/blog/operador-ultima-milla-amba",
        publishedAt: isoDaysFromNow(-20),
      },
    }),
    stamp({
      id: pce2,
      title: "Tracking en tiempo real: qué mirar antes de contratar",
      type: "article",
      status: "draft",
      slug: "tracking-tiempo-real-checklist",
      keyword: "tracking de envíos en tiempo real",
      cluster: { name: "visibilidad de carga" },
      publication: null,
    }),
    stamp({
      id: pce3,
      title: "SOL Desk: torre de control para flotas argentinas",
      type: "landing",
      status: "approved",
      slug: "sol-desk-torre-control",
      keyword: "software torre de control logística",
      cluster: { name: "software SOL" },
      publication: null,
    }),
    stamp({
      id: pce4,
      title: "Caso: e-commerce con 98% de POD en 24 hs",
      type: "case_study",
      status: "published",
      slug: "caso-ecommerce-pod-24hs",
      keyword: "operador logístico e-commerce argentina",
      cluster: { name: "distribución urbana" },
      publication: {
        url: "https://transitone.com.ar/casos/ecommerce-pod",
        publishedAt: isoDaysFromNow(-45),
      },
    }),
  ];

  db.growthOpportunities = [
    stamp({
      id: gop1,
      opportunityScore: 86,
      editorialStatus: "ready",
      conversation: {
        url: "https://logistica360.com.ar/directorio/operadores",
        domain: "logistica360.com.ar",
        title: "Directorio de operadores logísticos 2026",
        topic: "directorio industria",
      },
      drafts: [
        { id: mktId("dft"), status: "draft" },
        { id: mktId("dft"), status: "approved" },
      ],
    }),
    stamp({
      id: gop2,
      opportunityScore: 74,
      editorialStatus: "review",
      conversation: {
        url: "https://www.infologistica.com/menciones/tracking",
        domain: "infologistica.com",
        title: "Especial tracking y visibilidad de carga",
        topic: "tracking",
      },
      drafts: [{ id: mktId("dft"), status: "draft" }],
    }),
    stamp({
      id: gop3,
      opportunityScore: 68,
      editorialStatus: "new",
      conversation: {
        url: "https://comunidad.ecommerce.org.ar/partners",
        domain: "ecommerce.org.ar",
        title: "Partners logísticos para e-commerce",
        topic: "alianzas",
      },
      drafts: [],
    }),
  ];

  db.growthRuns = [
    stamp({
      id: grn1,
      status: "completed",
      opportunityCount: 3,
      createdAt: isoDaysFromNow(-7),
    }),
    stamp({
      id: grn2,
      status: "running",
      opportunityCount: 0,
      createdAt: isoDaysFromNow(-1),
    }),
  ];

  db.meta = {
    workspaceName: "TransitOne",
    cleexsSnapshot: {
      configured: true,
      snapshot: {
        source: "cleexs",
        generatedAt: now,
        brand: {
          id: "brand_transitone_sol",
          tenantId: "tenant_sol",
          name: "TransitOne",
          domain: "transitone.com.ar",
          industry: "Logística y transporte",
          productType: "Operador logístico + software",
          country: "AR",
          category: "Logística",
          objective: "Ser la marca más mencionada en consultas de última milla y torre de control",
          description:
            "TransitOne opera distribución urbana, FTL y la plataforma SOL Desk para torres de control logísticas.",
          aliases: ["Transit One", "SOL TransitOne", "TransitOne SOL"],
          competitors: [
            {
              id: "comp_andreani",
              name: "Andreani",
              domain: "andreani.com",
              category: "última milla",
              validated: true,
            },
            {
              id: "comp_oca",
              name: "OCA",
              domain: "oca.com.ar",
              category: "última milla",
              validated: true,
            },
            {
              id: "comp_cruzdelsur",
              name: "Cruz del Sur",
              domain: "cruzdelsur.com.ar",
              category: "FTL",
              validated: true,
            },
          ],
        },
        cleexsScore: 42.5,
        latest: {
          runId: "run_sol_demo_001",
          createdAt: isoDaysFromNow(-2),
          cleexsScore: 42.5,
          promptsAnalyzed: 24,
          brandInTop3: 7,
          brandInTop3Pct: 29.2,
          brandPosition1: 2,
          competitorMentions: [
            { name: "Andreani", appearances: 18, averagePosition: 1.6 },
            { name: "OCA", appearances: 14, averagePosition: 2.1 },
            { name: "Cruz del Sur", appearances: 9, averagePosition: 2.4 },
          ],
          scoreByIntention: [
            { intention: "última milla", score: 38 },
            { intention: "tracking", score: 45 },
            { intention: "software logística", score: 51 },
            { intention: "FTL nacional", score: 36 },
          ],
          weakPrompts: [
            {
              prompt: "Mejor operador de última milla en Buenos Aires para e-commerce",
              intention: "última milla",
              score: 12,
              top: ["Andreani", "OCA", "Mercado Envíos"],
            },
            {
              prompt: "Software de torre de control logística en Argentina",
              intention: "software logística",
              score: 22,
              top: ["Drivin", "Beetrack", "Samsara"],
            },
            {
              prompt: "Tracking de cargas en tiempo real con ETA confiable",
              intention: "tracking",
              score: 28,
              top: ["Andreani", "Uber Freight", "Onfleet"],
            },
          ],
        },
        history: [
          {
            runId: "run_sol_demo_001",
            status: "completed",
            runType: "primary",
            createdAt: isoDaysFromNow(-2),
            cleexsScore: 42.5,
            resultsCount: 24,
          },
          {
            runId: "run_sol_demo_000",
            status: "completed",
            runType: "primary",
            createdAt: isoDaysFromNow(-30),
            cleexsScore: 39.1,
            resultsCount: 20,
          },
        ],
      },
    },
  };

  writeDb(db);
  return { seeded: true, db };
}

export function listCollection(name, { take, orderBy = "createdAt", order = "desc", filter } = {}) {
  ensureSeed();
  let rows = [...(readDb()[name] || [])];
  if (typeof filter === "function") rows = rows.filter(filter);
  rows.sort((a, b) => {
    const av = a[orderBy];
    const bv = b[orderBy];
    if (typeof av === "number" && typeof bv === "number") {
      return order === "desc" ? bv - av : av - bv;
    }
    const at = new Date(av || 0).getTime();
    const bt = new Date(bv || 0).getTime();
    return order === "desc" ? bt - at : at - bt;
  });
  if (take != null) rows = rows.slice(0, take);
  return rows;
}

export function getItem(name, id) {
  ensureSeed();
  return (readDb()[name] || []).find((r) => r.id === id) ?? null;
}

export function insertItem(name, row) {
  ensureSeed();
  const db = readDb();
  if (!Array.isArray(db[name])) db[name] = [];
  const saved = stamp({ id: row.id || mktId(name.slice(0, 3)), ...row });
  db[name].unshift(saved);
  writeDb(db);
  return saved;
}

export function updateItem(name, id, patch) {
  ensureSeed();
  const db = readDb();
  const i = (db[name] || []).findIndex((r) => r.id === id);
  if (i < 0) return null;
  db[name][i] = stamp({ ...db[name][i], ...patch, id });
  writeDb(db);
  return db[name][i];
}

export function removeItem(name, id) {
  ensureSeed();
  const db = readDb();
  const before = (db[name] || []).length;
  db[name] = (db[name] || []).filter((r) => r.id !== id);
  if (db[name].length === before) return false;
  writeDb(db);
  return true;
}

export function getMeta() {
  ensureSeed();
  return { ...readDb().meta };
}

export function setMeta(patch) {
  ensureSeed();
  const db = readDb();
  db.meta = { ...db.meta, ...patch };
  writeDb(db);
  return db.meta;
}

export function countCollection(name, filter) {
  ensureSeed();
  let rows = readDb()[name] || [];
  if (typeof filter === "function") rows = rows.filter(filter);
  return rows.length;
}
