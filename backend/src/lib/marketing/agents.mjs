/** Los 7 agentes de Cleexs Marketing (producto standalone), portados a Andreu. */
export const MKT_AGENTS = [
  {
    key: "estrategia",
    slug: "marketing",
    name: "Planificador de campañas",
    origin: "Agente de Estrategia de Marketing",
    route: "/marketing/estrategia",
    description:
      "Propone campañas en base a tus servicios y productos: te pide objetivo y público, y obtiene solo las oportunidades, la demanda y el contenido que ya tenés.",
  },
  {
    key: "email",
    slug: "marketing-email",
    name: "Email Marketing",
    origin: "Agente de Email Marketing",
    route: "/marketing/email",
    description:
      "Crea campañas personalizadas de novedades, ofertas, seguimiento y reactivación. Deja borradores aprobables; el envío se habilita con el dominio del cliente.",
  },
  {
    key: "contenidos",
    slug: "teo",
    name: "Contenidos",
    origin: "Agente de Noticias y Contenidos",
    route: "/marketing/contenidos",
    description:
      "Genera y publica noticias, artículos y contenidos para la web y redes sociales a partir de novedades reales.",
  },
  {
    key: "ofertas",
    slug: "marketing-offers",
    name: "Promociones",
    origin: "Agente de Ofertas y Promociones",
    route: "/marketing/ofertas",
    description:
      "Crea y publica promociones adaptadas a cada canal, controlando precio, condiciones y vigencia.",
  },
  {
    key: "visibilidad",
    slug: "rankear",
    name: "Rankear",
    origin: "Agente de Posicionamiento y Visibilidad",
    route: "/marketing/visibilidad",
    description:
      "Monitorea la presencia de la marca en IA y Google, compara competidores y propone mejoras. Es el radar que alimenta a los demás agentes.",
  },
  {
    key: "difusion",
    slug: "growth",
    name: "Menciones",
    origin: "Agente de Difusión y Alianzas",
    route: "/marketing/difusion",
    description:
      "Identifica medios, blogs y directorios donde posicionar la marca y prepara propuestas de contacto.",
  },
  {
    key: "resultados",
    slug: "marketing-analytics",
    name: "Analítica",
    origin: "Agente de Análisis de Resultados",
    route: "/marketing/resultados",
    description:
      "Mide el desempeño de las acciones de marketing y recomienda ajustes para mejorar los resultados.",
  },
];

export function offerDerivedStatus(offer, now = new Date()) {
  const endsAt = offer.endsAt ? new Date(offer.endsAt) : null;
  if (
    (offer.status === "approved" || offer.status === "active") &&
    endsAt &&
    endsAt < now
  ) {
    return "expired";
  }
  return offer.status;
}

export function buildEmailDraft(input) {
  const offer = input.offer;
  const offerLines = offer
    ? [
        "",
        `Oferta vigente: ${offer.title}`,
        offer.description,
        offer.priceText ? `Precio: ${offer.priceText}` : "",
        offer.discountText ? `Beneficio: ${offer.discountText}` : "",
        offer.endsAt
          ? `Vigente hasta el ${new Date(offer.endsAt).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}.`
          : "",
        offer.terms ? `Condiciones: ${offer.terms}` : "",
      ].filter(Boolean)
    : [];
  return {
    segment: input.audience?.trim() || "Clientes y contactos interesados",
    subject: offer
      ? `${input.campaignTitle} — ${offer.discountText ?? offer.title}`
      : input.campaignTitle,
    preheader: input.objective.slice(0, 120),
    body: [
      "Hola,",
      "",
      `Desde ${input.workspaceName} queremos compartirte: ${input.campaignTitle}.`,
      "",
      input.objective,
      ...offerLines,
      "",
      "Si te interesa, respondé este correo y te ayudamos personalmente.",
      "",
      `— Equipo de ${input.workspaceName}`,
    ].join("\n"),
    ctaText: offer ? "Quiero aprovecharlo" : "Ver más",
    ctaUrl: null,
    source: "template",
  };
}

export function campaignFromOpportunity(opp) {
  const stageLabel =
    opp.stage === "bofu"
      ? "decisión de compra"
      : opp.stage === "mofu"
        ? "evaluación"
        : "descubrimiento";
  return {
    title: `Campaña: ${opp.keyword}`,
    objective:
      `Mejorar la visibilidad de la marca en consultas de ${stageLabel} sobre "${opp.keyword}" (cluster ${opp.cluster}).` +
      (opp.intentLabel ? ` Intención detectada: ${opp.intentLabel}.` : "") +
      (opp.scoreReason ? ` Motivo: ${opp.scoreReason}` : ""),
    audience: `Personas en etapa de ${stageLabel} interesadas en ${opp.cluster}`,
  };
}

/** Objetivos que el Planificador le pide a la empresa. */
export const CAMPAIGN_GOALS = [
  { key: "visibilidad", label: "Ser más visible en IA y Google" },
  { key: "consultas", label: "Conseguir más consultas" },
  { key: "ventas", label: "Vender más" },
  { key: "lanzamiento", label: "Lanzar un servicio o producto" },
  { key: "reactivacion", label: "Reactivar clientes dormidos" },
  { key: "autoridad", label: "Posicionarme como referente" },
];

/**
 * Arma la propuesta del Planificador:
 * - base: el servicio/producto elegido
 * - datos que pide: objetivo, público (si no viene, sale del producto)
 * - datos que obtiene: oportunidades de Rankear, preguntas reales y contenido existente
 */
export function buildCampaignProposal(input) {
  const top = input.obtained.opportunities[0];
  const audience =
    input.askedAudience?.trim() ||
    input.product?.audience ||
    "Clientes actuales y potenciales interesados";
  const obtainedSummary = [
    top
      ? `Rankear detectó demanda en "${top.keyword}"${
          top.monthlySearches
            ? ` (${Number(top.monthlySearches).toLocaleString("es-AR")} búsquedas/mes)`
            : ""
        }`
      : "Rankear todavía no detectó una oportunidad dominante para este tema",
    input.obtained.questions.length > 0
      ? `${input.obtained.questions.length} preguntas reales de usuarios para responder`
      : null,
    `Ya existen ${input.obtained.piecesCount} piezas de contenido (${input.obtained.publicationsCount} publicadas) para apoyarse`,
  ]
    .filter(Boolean)
    .join(". ");

  const title = top
    ? `${input.product.name}: ${top.keyword}`
    : `Campaña de ${input.product.name}`;

  const objective = [
    `${input.goalLabel} con ${input.product.name} (${input.product.kind === "producto" ? "producto" : "servicio"}).`,
    input.product.description,
    `Público: ${audience}.`,
    `Datos que el sistema ya obtuvo: ${obtainedSummary}.`,
    input.askedNotes?.trim()
      ? `Indicaciones de la empresa: ${input.askedNotes.trim()}`
      : null,
    top
      ? `Acción sugerida: Contenidos crea la pieza sobre "${top.keyword}"${
          input.product.priceText
            ? `, Promociones suma la oferta vigente (${input.product.priceText})`
            : ""
        } y Email Marketing la adapta al segmento.`
      : "Acción sugerida: Contenidos crea la primera pieza y Email Marketing prepara la secuencia.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    objective,
    audience,
    brief: {
      product: input.product,
      goal: { key: input.goalKey, label: input.goalLabel },
      asked: {
        audience: input.askedAudience ?? null,
        notes: input.askedNotes ?? null,
      },
      obtained: {
        opportunities: input.obtained.opportunities.slice(0, 5),
        questions: input.obtained.questions.slice(0, 5),
        piecesCount: input.obtained.piecesCount,
        publicationsCount: input.obtained.publicationsCount,
      },
    },
  };
}
