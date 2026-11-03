import {
  CAMPAIGN_GOALS,
  MKT_AGENTS,
  buildCampaignProposal,
  buildEmailDraft,
  campaignFromOpportunity,
  offerDerivedStatus,
} from "../lib/marketing/agents.mjs";
import {
  countCollection,
  ensureSeed,
  getItem,
  getMeta,
  insertItem,
  listCollection,
  mktId,
  removeItem,
  updateItem,
} from "../db/marketing-store.mjs";

const WORKSPACE_SLUG = "sol";
const SENDING_NOTE =
  "El envío real de email se habilita cuando el cliente conecta su dominio (SPF/DKIM) y su lista con consentimiento. Por ahora, el agente deja borradores aprobables.";

export function serializeOffer(o) {
  return { ...o, derivedStatus: offerDerivedStatus(o) };
}

function workspaceName() {
  const meta = getMeta();
  return meta.workspaceName || "TransitOne";
}

/**
 * Cleexs: usa meta.cleexsSnapshot del store; si CLEEXS_API_URL + CLEEXS_MARKETING_SERVICE_KEY
 * existen, intenta fetch live (fallback a seed).
 */
export async function fetchCleexsSnapshot() {
  ensureSeed();
  const meta = getMeta();
  const seeded = meta.cleexsSnapshot;

  const base = (process.env.CLEEXS_API_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.CLEEXS_MARKETING_SERVICE_KEY || "").trim();
  const domain =
    (process.env.CLEEXS_MARKETING_DOMAIN || "").trim() ||
    seeded?.snapshot?.brand?.domain ||
    "transitone.com.ar";

  if (base && key) {
    try {
      const res = await fetch(
        `${base}/api/marketing/snapshot?domain=${encodeURIComponent(domain)}`,
        {
          headers: { "x-cleexs-service-key": key },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (res.ok) {
        const snapshot = await res.json();
        return { configured: true, snapshot };
      }
    } catch {
      /* fallback a seed */
    }
  }

  if (seeded?.configured && seeded.snapshot) {
    return { configured: true, snapshot: seeded.snapshot };
  }
  if (seeded && seeded.configured === false) {
    return seeded;
  }
  return {
    configured: false,
    reason: "Falta configurar la conexión con Cleexs (CLEEXS_API_URL).",
  };
}

function enrichCampaigns(campaigns) {
  const offers = listCollection("offers");
  const emails = listCollection("emails");
  return campaigns.map((c) => ({
    ...c,
    _count: {
      offers: offers.filter((o) => o.campaignId === c.id).length,
      emails: emails.filter((e) => e.campaignId === c.id).length,
    },
  }));
}

export async function getOverview() {
  ensureSeed();
  const cleexs = await fetchCleexsSnapshot();
  const campaigns = enrichCampaigns(
    listCollection("campaigns", { take: 20, orderBy: "createdAt", order: "desc" }),
  );
  const offers = listCollection("offers", { take: 20, orderBy: "createdAt", order: "desc" });
  const emails = listCollection("emails", { take: 20, orderBy: "createdAt", order: "desc" });
  const opportunities = listCollection("opportunities", {
    take: 8,
    orderBy: "opportunityScore",
    order: "desc",
    filter: (o) => o.status === "idea" || o.status === "queued",
  });
  const pieces = countCollection("pieces");
  const publications = countCollection(
    "pieces",
    (p) => p.status === "published" || Boolean(p.publication?.url),
  );
  const growthOpps = countCollection("growthOpportunities");
  const now = new Date();

  const summary = {
    campaigns: campaigns.length,
    campaignsApprovedOrActive: campaigns.filter(
      (c) => c.status === "approved" || c.status === "active",
    ).length,
    offersActive: offers.filter((o) => {
      const d = offerDerivedStatus(o, now);
      return d === "active" || d === "approved";
    }).length,
    offersExpired: offers.filter((o) => offerDerivedStatus(o, now) === "expired").length,
    emailsDraft: emails.filter((e) => e.status === "draft").length,
    emailsApproved: emails.filter((e) => e.status === "approved").length,
    opportunitiesOpen: opportunities.length,
    pieces,
    publications,
    diffusionOpportunities: growthOpps,
  };

  return {
    workspace: WORKSPACE_SLUG,
    workspaceName: workspaceName(),
    product: "Cleexs Marketing",
    tagline:
      "Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron.",
    sendingEnabled: false,
    sendingNote: SENDING_NOTE,
    agents: MKT_AGENTS,
    cleexs,
    summary,
    campaigns,
    offers: offers.map(serializeOffer),
    emails,
    opportunities,
  };
}

export function getCatalog() {
  ensureSeed();
  const items = listCollection("catalog", { orderBy: "createdAt", order: "desc" });
  return { workspace: WORKSPACE_SLUG, goals: CAMPAIGN_GOALS, items };
}

export function createCatalogItem(body) {
  const name = String(body?.name || "").trim();
  const description = String(body?.description || "").trim();
  if (name.length < 2) {
    const err = new Error("El nombre es obligatorio (mín. 2 caracteres)");
    err.statusCode = 400;
    throw err;
  }
  if (description.length < 5) {
    const err = new Error("La descripción es obligatoria (mín. 5 caracteres)");
    err.statusCode = 400;
    throw err;
  }
  const kind = body.kind === "producto" ? "producto" : "servicio";
  const item = insertItem("catalog", {
    id: mktId("cat"),
    kind,
    name,
    description,
    priceText: body.priceText ?? null,
    audience: body.audience ?? null,
    active: true,
  });
  return { ok: true, item };
}

export function patchCatalogItem(id, body) {
  const existing = getItem("catalog", id);
  if (!existing) {
    const err = new Error("Ítem no encontrado");
    err.statusCode = 404;
    throw err;
  }
  const patch = {};
  if (body.kind !== undefined) patch.kind = body.kind === "producto" ? "producto" : "servicio";
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.description !== undefined) patch.description = String(body.description).trim();
  if (body.priceText !== undefined) patch.priceText = body.priceText;
  if (body.audience !== undefined) patch.audience = body.audience;
  if (body.active !== undefined) patch.active = Boolean(body.active);
  const item = updateItem("catalog", id, patch);
  return { ok: true, item };
}

export function deleteCatalogItem(id) {
  const existing = getItem("catalog", id);
  if (!existing) {
    const err = new Error("Ítem no encontrado");
    err.statusCode = 404;
    throw err;
  }
  removeItem("catalog", id);
  return { ok: true };
}

export async function proposeCampaign(body) {
  const catalogItemId = body?.catalogItemId;
  const goalKey = String(body?.goal || "").trim();
  if (!catalogItemId) {
    const err = new Error("Falta catalogItemId");
    err.statusCode = 400;
    throw err;
  }
  if (!goalKey) {
    const err = new Error("Falta el objetivo (goal)");
    err.statusCode = 400;
    throw err;
  }

  const product = getItem("catalog", catalogItemId);
  if (!product) {
    const err = new Error("Servicio/producto no encontrado");
    err.statusCode = 404;
    throw err;
  }

  const goal = CAMPAIGN_GOALS.find((g) => g.key === goalKey) ?? {
    key: goalKey,
    label: goalKey,
  };
  const terms = `${product.name} ${product.description}`.toLowerCase();
  const opportunities = listCollection("opportunities", {
    take: 30,
    orderBy: "opportunityScore",
    order: "desc",
    filter: (o) => ["idea", "queued", "in_progress"].includes(o.status),
  });
  const questions = listCollection("questions", {
    take: 30,
    orderBy: "priority",
    order: "desc",
  });
  const piecesCount = countCollection("pieces");
  const publicationsCount = countCollection(
    "pieces",
    (p) => p.status === "published" || Boolean(p.publication?.url),
  );

  const related = opportunities
    .map((o) => {
      const hay = `${o.keyword} ${o.cluster}`.toLowerCase();
      const hits = terms.split(/\s+/).filter((w) => w.length > 4 && hay.includes(w)).length;
      return { o, hits };
    })
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        (b.o.opportunityScore ?? b.o.priority) - (a.o.opportunityScore ?? a.o.priority),
    )
    .slice(0, 5)
    .map(({ o }) => ({
      keyword: o.keyword,
      cluster: o.cluster,
      stage: o.stage,
      monthlySearches: o.monthlySearches,
      opportunityScore: o.opportunityScore ?? o.priority,
    }));

  const relatedQuestions = questions
    .filter((q) => related.some((r) => r.cluster === q.cluster))
    .slice(0, 5)
    .map((q) => ({ question: q.question, cluster: q.cluster }));

  const proposal = buildCampaignProposal({
    product: {
      name: product.name,
      kind: product.kind,
      description: product.description,
      priceText: product.priceText,
      audience: product.audience,
    },
    goalLabel: goal.label,
    goalKey: goal.key,
    askedAudience: body.audience ?? null,
    askedNotes: body.notes ?? null,
    obtained: {
      opportunities: related,
      questions: relatedQuestions,
      piecesCount,
      publicationsCount,
    },
  });

  const cleexs = await fetchCleexsSnapshot();
  let objective = proposal.objective;
  let brief = { ...(proposal.brief || {}) };
  if (cleexs.configured) {
    const weak = cleexs.snapshot.latest?.weakPrompts?.slice(0, 3) ?? [];
    objective += ` Datos reales de Cleexs: Cleexs Score ${
      cleexs.snapshot.cleexsScore != null
        ? Math.round(cleexs.snapshot.cleexsScore)
        : "sin corrida"
    } para ${cleexs.snapshot.brand.name} (${cleexs.snapshot.brand.domain ?? "sin dominio"}), ${
      cleexs.snapshot.brand.competitors.length
    } competidores medidos${
      weak.length
        ? `; consultas donde la marca no aparece: ${weak
            .map((w) => `"${w.prompt.slice(0, 80)}"`)
            .join(", ")}`
        : ""
    }.`;
    brief = {
      ...brief,
      cleexs: {
        brand: cleexs.snapshot.brand.name,
        domain: cleexs.snapshot.brand.domain,
        cleexsScore: cleexs.snapshot.cleexsScore,
        competitors: cleexs.snapshot.brand.competitors.map((c) => c.name),
        weakPrompts: weak,
        scoreByIntention: cleexs.snapshot.latest?.scoreByIntention ?? [],
      },
    };
  } else {
    brief = { ...brief, cleexs: { configured: false, reason: cleexs.reason } };
  }

  const campaign = insertItem("campaigns", {
    id: mktId("cmp"),
    title: proposal.title,
    objective,
    audience: proposal.audience,
    sourceType: "catalog",
    sourceLabel: product.name,
    sourceRefId: product.id,
    status: "proposed",
    startsAt: null,
    endsAt: null,
    brief,
  });

  return { ok: true, campaign, proposal: { ...proposal, objective } };
}

export async function getVisibilidad() {
  ensureSeed();
  const cleexs = await fetchCleexsSnapshot();
  const opportunities = listCollection("opportunities", {
    take: 60,
    orderBy: "opportunityScore",
    order: "desc",
  });
  const questions = listCollection("questions", {
    take: 30,
    orderBy: "priority",
    order: "desc",
  });
  const all = listCollection("opportunities");
  const google = {
    impressions: all.reduce((a, o) => a + (o.gscImpressions ?? 0), 0),
    clicks: all.reduce((a, o) => a + (o.gscClicks ?? 0), 0),
    searches: all.reduce((a, o) => a + (o.monthlySearches ?? 0), 0),
  };
  return { workspace: WORKSPACE_SLUG, cleexs, google, opportunities, questions };
}

export function getContenidos() {
  ensureSeed();
  const pieces = listCollection("pieces", { take: 60, orderBy: "updatedAt", order: "desc" }).map(
    (p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      slug: p.slug ?? null,
      keyword: p.keyword ?? null,
      updatedAt: p.updatedAt,
      publication: p.publication ?? null,
      cluster: p.cluster ?? null,
    }),
  );
  const publications = countCollection(
    "pieces",
    (p) => p.status === "published" || Boolean(p.publication?.url),
  );
  const byStatus = pieces.reduce(
    (acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }),
    {},
  );
  return { workspace: WORKSPACE_SLUG, pieces, byStatus, publications };
}

export function getDifusion() {
  ensureSeed();
  const opportunities = listCollection("growthOpportunities", {
    take: 40,
    orderBy: "opportunityScore",
    order: "desc",
  });
  const runs = listCollection("growthRuns", {
    take: 10,
    orderBy: "createdAt",
    order: "desc",
  }).map((r) => ({
    id: r.id,
    status: r.status,
    opportunityCount: r.opportunityCount,
    createdAt: r.createdAt,
  }));
  return { workspace: WORKSPACE_SLUG, opportunities, runs };
}

export async function getResultados() {
  ensureSeed();
  const campaigns = listCollection("campaigns");
  const offers = listCollection("offers");
  const emails = listCollection("emails");
  const pieces = listCollection("pieces");
  const publications = countCollection(
    "pieces",
    (p) => p.status === "published" || Boolean(p.publication?.url),
  );
  const openOpps = countCollection(
    "opportunities",
    (o) => o.status === "idea" || o.status === "queued",
  );
  const growthOpps = countCollection("growthOpportunities");
  const cleexs = await fetchCleexsSnapshot();
  const now = new Date();
  const expired = offers.filter((o) => offerDerivedStatus(o, now) === "expired").length;

  const recommendations = [];
  if (openOpps > 0) {
    recommendations.push({
      level: "alta",
      text: `Hay ${openOpps} oportunidades de visibilidad sin campaña. Convertí las de mayor puntaje en campañas desde Visibilidad.`,
      route: "/marketing/visibilidad",
    });
  }
  if (expired > 0) {
    recommendations.push({
      level: "media",
      text: `${expired} oferta(s) vencida(s): renovalas o archivalas para no comunicar precios viejos.`,
      route: "/marketing/ofertas",
    });
  }
  if (emails.filter((e) => e.status === "approved").length > 0) {
    recommendations.push({
      level: "media",
      text: "Hay emails aprobados esperando: se enviarán cuando el cliente conecte su dominio.",
      route: "/marketing/email",
    });
  }
  if (pieces.filter((p) => p.status === "published").length === 0 && pieces.length > 0) {
    recommendations.push({
      level: "alta",
      text: "Hay contenido creado pero nada publicado: revisá aprobaciones y publicá la primera pieza.",
      route: "/marketing/contenidos",
    });
  }
  if (growthOpps > 0) {
    recommendations.push({
      level: "baja",
      text: `${growthOpps} oportunidades de difusión detectadas: prepará propuestas de contacto desde Difusión.`,
      route: "/marketing/difusion",
    });
  }
  if (cleexs.configured && cleexs.snapshot.latest && cleexs.snapshot.latest.weakPrompts.length > 0) {
    const weak = cleexs.snapshot.latest.weakPrompts[0];
    recommendations.unshift({
      level: "alta",
      text: `Cleexs Score ${
        cleexs.snapshot.cleexsScore != null ? Math.round(cleexs.snapshot.cleexsScore) : "—"
      }: tu marca no aparece en "${weak.prompt.slice(0, 90)}" (ganan: ${
        weak.top.join(", ") || "otros"
      }). Rankear recomienda una campaña sobre esa consulta.`,
      route: "/marketing/visibilidad",
    });
  }
  if (!cleexs.configured) {
    recommendations.push({
      level: "alta",
      text: `Datos de Cleexs sin conectar: ${cleexs.reason}`,
      route: "/marketing/visibilidad",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      level: "baja",
      text: "Sin alertas: el sistema está al día. Revisá Rankear para detectar nuevas oportunidades.",
      route: "/marketing/visibilidad",
    });
  }

  return {
    workspace: WORKSPACE_SLUG,
    cleexs,
    counts: {
      campaigns: campaigns.length,
      campaignsByStatus: campaigns.reduce(
        (a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }),
        {},
      ),
      offers: offers.length,
      offersExpired: expired,
      emailsByStatus: emails.reduce(
        (a, e) => ({ ...a, [e.status]: (a[e.status] ?? 0) + 1 }),
        {},
      ),
      pieces: pieces.length,
      piecesByStatus: pieces.reduce(
        (a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }),
        {},
      ),
      publications,
      diffusionOpportunities: growthOpps,
    },
    recommendations,
  };
}

export function createCampaign(body) {
  let title = body?.title;
  let objective = body?.objective;
  let audience = body?.audience;
  let sourceType = "manual";
  let sourceLabel = null;
  let sourceRefId = null;

  if (body?.opportunityId) {
    const opp = getItem("opportunities", body.opportunityId);
    if (!opp) {
      const err = new Error("Oportunidad no encontrada");
      err.statusCode = 404;
      throw err;
    }
    const built = campaignFromOpportunity(opp);
    title = title ?? built.title;
    objective = objective ?? built.objective;
    audience = audience ?? built.audience;
    sourceType = "opportunity";
    sourceLabel = opp.keyword;
    sourceRefId = opp.id;
  }

  if (!title || !objective) {
    const err = new Error("title y objective son requeridos (u opportunityId)");
    err.statusCode = 400;
    throw err;
  }

  const campaign = insertItem("campaigns", {
    id: mktId("cmp"),
    title,
    objective,
    audience: audience ?? null,
    sourceType,
    sourceLabel,
    sourceRefId,
    status: "proposed",
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
    brief: null,
  });
  return { ok: true, campaign };
}

const CAMPAIGN_STATUSES = new Set([
  "proposed",
  "approved",
  "active",
  "finished",
  "archived",
]);

export function patchCampaign(id, body) {
  const existing = getItem("campaigns", id);
  if (!existing) {
    const err = new Error("Campaña no encontrada");
    err.statusCode = 404;
    throw err;
  }
  if (body.status !== undefined && !CAMPAIGN_STATUSES.has(body.status)) {
    const err = new Error("Estado de campaña inválido");
    err.statusCode = 400;
    throw err;
  }
  const patch = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.objective !== undefined) patch.objective = body.objective;
  if (body.audience !== undefined) patch.audience = body.audience;
  if (body.status !== undefined) patch.status = body.status;
  if (body.startsAt !== undefined) patch.startsAt = body.startsAt;
  if (body.endsAt !== undefined) patch.endsAt = body.endsAt;
  const campaign = updateItem("campaigns", id, patch);
  return { ok: true, campaign };
}

export function deleteCampaign(id) {
  const existing = getItem("campaigns", id);
  if (!existing) {
    const err = new Error("Campaña no encontrada");
    err.statusCode = 404;
    throw err;
  }
  removeItem("campaigns", id);
  return { ok: true };
}

export function createOffer(body) {
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  if (title.length < 3) {
    const err = new Error("El título es obligatorio (mín. 3 caracteres)");
    err.statusCode = 400;
    throw err;
  }
  if (description.length < 5) {
    const err = new Error("La descripción es obligatoria (mín. 5 caracteres)");
    err.statusCode = 400;
    throw err;
  }
  if (body.startsAt && body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt)) {
    const err = new Error('La vigencia "hasta" debe ser posterior a "desde"');
    err.statusCode = 400;
    throw err;
  }
  if (body.campaignId) {
    const c = getItem("campaigns", body.campaignId);
    if (!c) {
      const err = new Error("Campaña no encontrada");
      err.statusCode = 404;
      throw err;
    }
  }
  const offer = insertItem("offers", {
    id: mktId("ofr"),
    campaignId: body.campaignId ?? null,
    title,
    description,
    priceText: body.priceText ?? null,
    discountText: body.discountText ?? null,
    terms: body.terms ?? null,
    channels: body.channels ?? ["email", "web"],
    status: "draft",
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
  });
  return { ok: true, offer: serializeOffer(offer) };
}

const OFFER_STATUSES = new Set(["draft", "approved", "active", "archived"]);

export function patchOffer(id, body) {
  const existing = getItem("offers", id);
  if (!existing) {
    const err = new Error("Oferta no encontrada");
    err.statusCode = 404;
    throw err;
  }
  if (body.status !== undefined && !OFFER_STATUSES.has(body.status)) {
    const err = new Error("Estado de oferta inválido");
    err.statusCode = 400;
    throw err;
  }
  const patch = {};
  for (const key of [
    "title",
    "description",
    "priceText",
    "discountText",
    "terms",
    "channels",
    "status",
    "campaignId",
    "startsAt",
    "endsAt",
  ]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const offer = updateItem("offers", id, patch);
  return { ok: true, offer: serializeOffer(offer) };
}

export function deleteOffer(id) {
  const existing = getItem("offers", id);
  if (!existing) {
    const err = new Error("Oferta no encontrada");
    err.statusCode = 404;
    throw err;
  }
  removeItem("offers", id);
  return { ok: true };
}

export function generateEmail(campaignId) {
  const campaign = getItem("campaigns", campaignId);
  if (!campaign) {
    const err = new Error("Campaña no encontrada");
    err.statusCode = 404;
    throw err;
  }
  const offer =
    listCollection("offers", {
      orderBy: "createdAt",
      order: "desc",
      filter: (o) =>
        o.campaignId === campaign.id &&
        (o.status === "approved" || o.status === "active"),
    })[0] ?? null;

  const draft = buildEmailDraft({
    workspaceName: workspaceName(),
    campaignTitle: campaign.title,
    objective: campaign.objective,
    audience: campaign.audience,
    offer,
  });
  const email = insertItem("emails", {
    id: mktId("eml"),
    campaignId: campaign.id,
    offerId: offer?.id ?? null,
    ...draft,
    status: "draft",
  });
  return {
    ok: true,
    email,
    sent: false,
    note: "Borrador creado. El envío requiere el dominio del cliente conectado.",
  };
}

const EMAIL_STATUSES = new Set(["draft", "approved", "discarded"]);

export function patchEmail(id, body) {
  const existing = getItem("emails", id);
  if (!existing) {
    const err = new Error("Email no encontrado");
    err.statusCode = 404;
    throw err;
  }
  if (body.status !== undefined && !EMAIL_STATUSES.has(body.status)) {
    const err = new Error("Estado de email inválido");
    err.statusCode = 400;
    throw err;
  }
  const patch = {};
  for (const key of [
    "segment",
    "subject",
    "preheader",
    "body",
    "ctaText",
    "ctaUrl",
    "status",
  ]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const email = updateItem("emails", id, patch);
  return { ok: true, email, sent: false };
}

export function deleteEmail(id) {
  const existing = getItem("emails", id);
  if (!existing) {
    const err = new Error("Email no encontrado");
    err.statusCode = 404;
    throw err;
  }
  removeItem("emails", id);
  return { ok: true };
}
