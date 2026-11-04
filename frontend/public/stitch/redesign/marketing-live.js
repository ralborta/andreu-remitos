/**
 * Cleexs Marketing — UI operable contra /backend/api/marketing/*
 * Un solo IIFE, vanilla JS. Reemplaza el <main> según pageKey.
 */
(function () {
  var CARD = "rounded-2xl border border-slate-200 bg-white p-5";
  var BTN =
    "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[12px] font-semibold transition-colors";
  var BTN_PRIMARY = BTN + " bg-blue-600 hover:bg-blue-700 text-white";
  var BTN_SECONDARY = BTN + " border border-slate-200 bg-white hover:bg-slate-50 text-slate-800";
  var BTN_DANGER = BTN + " border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700";
  var INPUT =
    "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";
  var LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1";
  var TEXTAREA =
    "w-full min-h-[72px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function go(href) {
    try {
      window.top.location.href = href;
    } catch (e) {
      window.location.href = href;
    }
  }

  function pageKey() {
    var p = "";
    try {
      p = window.top.location.pathname || "";
    } catch (e) {
      p = location.pathname || "";
    }
    var file = (location.pathname || "").split("/").pop() || "";
    if (file.indexOf("marketing-estrategia") === 0 || p.indexOf("/marketing/estrategia") === 0)
      return "estrategia";
    if (file.indexOf("marketing-email") === 0 || p.indexOf("/marketing/email") === 0) return "email";
    if (file.indexOf("marketing-contenidos") === 0 || p.indexOf("/marketing/contenidos") === 0)
      return "contenidos";
    if (file.indexOf("marketing-ofertas") === 0 || p.indexOf("/marketing/ofertas") === 0)
      return "ofertas";
    if (file.indexOf("marketing-visibilidad") === 0 || p.indexOf("/marketing/visibilidad") === 0)
      return "visibilidad";
    if (file.indexOf("marketing-difusion") === 0 || p.indexOf("/marketing/difusion") === 0)
      return "difusion";
    if (file.indexOf("marketing-resultados") === 0 || p.indexOf("/marketing/resultados") === 0)
      return "resultados";
    return "dashboard";
  }

  function toast(msg, tone) {
    var el = document.getElementById("sol-mkt-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sol-mkt-toast";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:10050;max-width:380px;padding:12px 14px;border-radius:12px;font:600 12px/1.45 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 12px 32px rgba(15,23,42,.2);border:1px solid #e2e8f0;background:#fff;color:#0f172a;opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.style.borderColor = tone === "err" ? "#fecaca" : tone === "ok" ? "#bbf7d0" : "#e2e8f0";
    el.style.background = tone === "err" ? "#fff1f2" : tone === "ok" ? "#f0fdf4" : "#fff";
    el.textContent = msg;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
    }, 3200);
  }

  function notice(msg, tone) {
    return (
      '<div class="rounded-xl border px-3 py-2 text-[12px] font-semibold ' +
      (tone === "err"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-700") +
      '">' +
      esc(msg) +
      "</div>"
    );
  }

  function api(path, init) {
    init = init || {};
    var method = String(init.method || "GET").toUpperCase();
    var opts = {
      method: method,
      credentials: "include",
      headers: Object.assign({}, init.headers || {}),
    };
    // Fastify rechaza DELETE/GET con Content-Type application/json y body vacío (400).
    if (init.body != null) {
      opts.headers["Content-Type"] = opts.headers["Content-Type"] || "application/json";
      opts.body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    }
    return fetch("/backend" + path, opts).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!r.ok) {
            var err = new Error((data && (data.error || data.message)) || "HTTP " + r.status);
            err.status = r.status;
            err.data = data;
            throw err;
          }
          return data;
        });
    });
  }

  function reload() {
    try {
      window.location.reload();
    } catch (e) {
      location.reload();
    }
  }

  function mut(path, init, okMsg) {
    return api(path, init)
      .then(function () {
        toast(okMsg || "Listo", "ok");
        setTimeout(reload, 350);
      })
      .catch(function (err) {
        toast(err.message || "Error", "err");
      });
  }

  var MONTHS_ES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];

  /** Fecha calendario sin corrimiento UTC (input type=date / ISO date-only). */
  function dateInputToIso(ymd) {
    var s = String(ymd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s + "T12:00:00.000Z";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var s = String(iso);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return Number(m[3]) + " " + MONTHS_ES[Number(m[2]) - 1] + " " + m[1];
    }
    var d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    } catch (e) {
      return s.slice(0, 10);
    }
  }

  function truncate(str, max) {
    var t = String(str == null ? "" : str);
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)) + "…";
  }

  var STATUS_ES = {
    proposed: "Propuesta",
    approved: "Aprobada",
    active: "Activa",
    finished: "Finalizada",
    archived: "Archivada",
    draft: "Borrador",
    discarded: "Descartada",
    expired: "Vencida",
    published: "Publicada",
    pending_approval: "En aprobación",
    idea: "Idea",
    queued: "En cola",
    in_progress: "En curso",
    covered: "Cubierta",
    candidate: "Candidata",
    recommended: "Recomendada",
    servicio: "Servicio",
    producto: "Producto",
  };

  function fmtNum(n) {
    if (n == null || n === "") return "—";
    var v = Number(n);
    if (!Number.isFinite(v)) return esc(String(n));
    try {
      return v.toLocaleString("es-AR");
    } catch (e) {
      return String(v);
    }
  }

  function badge(status) {
    var raw = String(status || "—");
    var s = raw.toLowerCase();
    var label = STATUS_ES[s] || raw;
    var cls = "bg-slate-100 text-slate-700 border-slate-200";
    if (s === "active" || s === "approved" || s === "published" || s === "completed")
      cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (s === "proposed" || s === "draft" || s === "queued" || s === "idea" || s === "running")
      cls = "bg-amber-50 text-amber-800 border-amber-200";
    else if (s === "finished" || s === "archived" || s === "discarded" || s === "expired")
      cls = "bg-slate-100 text-slate-600 border-slate-200";
    else if (s === "alta") cls = "bg-rose-50 text-rose-700 border-rose-200";
    else if (s === "media") cls = "bg-amber-50 text-amber-800 border-amber-200";
    else if (s === "baja") cls = "bg-sky-50 text-sky-700 border-sky-200";
    return (
      '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ' +
      cls +
      '">' +
      esc(label) +
      "</span>"
    );
  }

  function icon(name, size) {
    return (
      '<span class="material-symbols-outlined" style="font-size:' +
      (size || 18) +
      'px;line-height:1">' +
      esc(name) +
      "</span>"
    );
  }

  function statCard(label, value, hint) {
    return (
      '<div class="' +
      CARD +
      '">' +
      '<div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">' +
      esc(label) +
      "</div>" +
      '<div class="mt-1 text-[28px] font-bold tracking-tight text-slate-900">' +
      esc(String(value == null ? "—" : value)) +
      "</div>" +
      (hint
        ? '<div class="mt-1 text-[12px] text-slate-500">' + esc(hint) + "</div>"
        : "") +
      "</div>"
    );
  }

  function pageHeader(title, subtitle, iconName) {
    return (
      '<div class="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-4 border-b border-slate-200">' +
      "<div>" +
      '<h1 class="text-[24px] font-bold tracking-tight text-slate-900 flex items-center gap-2">' +
      (iconName ? icon(iconName, 26) : "") +
      esc(title) +
      "</h1>" +
      (subtitle
        ? '<p class="mt-1 text-[14px] text-slate-500 max-w-2xl">' + esc(subtitle) + "</p>"
        : "") +
      "</div></div>"
    );
  }

  function emptyState(msg) {
    return (
      '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500">' +
      esc(msg) +
      "</div>"
    );
  }

  function cleexsScoreBlock(cleexs) {
    if (!cleexs || !cleexs.configured || !cleexs.snapshot) {
      return (
        '<div class="' +
        CARD +
        ' border-amber-200 bg-amber-50/50">' +
        '<div class="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Cleexs</div>' +
        '<p class="mt-1 text-[13px] text-amber-900">' +
        esc((cleexs && cleexs.reason) || "Cleexs no configurado.") +
        "</p></div>"
      );
    }
    var snap = cleexs.snapshot;
    var score = snap.cleexsScore != null ? Math.round(snap.cleexsScore) : "—";
    var brand = (snap.brand && snap.brand.name) || "—";
    var domain = (snap.brand && snap.brand.domain) || "";
    var latest = snap.latest || {};
    var top3 = latest.brandInTop3Pct != null ? Math.round(latest.brandInTop3Pct) + "%" : "—";
    return (
      '<div class="' +
      CARD +
      ' bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-800">' +
      '<div class="flex flex-wrap items-start justify-between gap-4">' +
      "<div>" +
      '<div class="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Cleexs Score</div>' +
      '<div class="mt-1 text-[40px] font-bold tracking-tight leading-none">' +
      esc(String(score)) +
      "</div>" +
      '<div class="mt-2 text-[13px] text-slate-300">' +
      esc(brand) +
      (domain ? " · " + esc(domain) : "") +
      "</div></div>" +
      '<div class="grid grid-cols-2 gap-3 text-right">' +
      '<div><div class="text-[10px] uppercase tracking-wide text-slate-400">Top 3</div><div class="text-[18px] font-bold">' +
      esc(String(top3)) +
      "</div></div>" +
      '<div><div class="text-[10px] uppercase tracking-wide text-slate-400">Prompts</div><div class="text-[18px] font-bold">' +
      esc(String(latest.promptsAnalyzed != null ? latest.promptsAnalyzed : "—")) +
      "</div></div>" +
      "</div></div></div>"
    );
  }

  function opsBanner(ok, errMsg, workspaceName) {
    if (!ok) {
      return notice(
        errMsg || "No se pudo cargar la API de Marketing. Revisá el backend.",
        "err",
      );
    }
    return notice(
      "Marketing operativo · datos " +
        (workspaceName || "TransitOne") +
        " (API). Envío de email deshabilitado hasta conectar dominio.",
      "ok",
    );
  }

  function errorMain(err) {
    var main = document.querySelector("main");
    if (!main) return;
    main.innerHTML =
      '<div class="space-y-4">' +
      opsBanner(false, err && err.message) +
      '<div class="' +
      CARD +
      '">' +
      "<h2 class=\"text-[16px] font-bold text-slate-900\">No hay datos de Marketing</h2>" +
      '<p class="mt-2 text-[13px] text-slate-600">La API falló; no se muestran KPIs inventados. Reintentá cuando el backend esté disponible.</p>' +
      '<button type="button" data-mkt="reload" class="' +
      BTN_PRIMARY +
      ' mt-4">Reintentar</button>' +
      "</div></div>";
    main.querySelector('[data-mkt="reload"]').addEventListener("click", reload);
  }

  /* ─── Dashboard ─── */
  function renderDashboard(data) {
    var s = data.summary || {};
    var agents = data.agents || [];
    var campaigns = (data.campaigns || []).slice(0, 5);
    var agentIcons = {
      estrategia: "calendar_month",
      email: "mail",
      contenidos: "newspaper",
      ofertas: "percent",
      visibilidad: "visibility",
      difusion: "campaign",
      resultados: "monitoring",
    };

    var agentsHtml = agents
      .map(function (a) {
        return (
          '<button type="button" data-mkt-go="' +
          esc(a.route) +
          '" class="' +
          CARD +
          ' text-left hover:border-blue-300 hover:shadow-sm transition-all group">' +
          '<div class="flex items-center gap-2 text-blue-600">' +
          icon(agentIcons[a.key] || "campaign", 22) +
          '<span class="text-[14px] font-bold text-slate-900 group-hover:text-blue-700">' +
          esc(a.name) +
          "</span></div>" +
          '<p class="mt-2 text-[12px] text-slate-500 leading-relaxed">' +
          esc(a.description) +
          "</p></button>"
        );
      })
      .join("");

    var campsHtml = campaigns.length
      ? campaigns
          .map(function (c) {
            return (
              '<div class="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(truncate(c.title, 120)) +
              "</div>" +
              '<div class="mt-0.5 text-[11px] text-slate-500">' +
              esc(c.audience || c.sourceLabel || "") +
              "</div></div>" +
              badge(c.status) +
              "</div>"
            );
          })
          .join("")
      : emptyState("Todavía no hay campañas.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Hub de Marketing",
        data.tagline ||
          "Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron.",
        "campaign",
      ) +
      cleexsScoreBlock(data.cleexs) +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
      statCard("Campañas", s.campaigns, (s.campaignsApprovedOrActive || 0) + " activas/aprobadas") +
      statCard("Ofertas", s.offersActive, (s.offersExpired || 0) + " vencidas") +
      statCard("Emails", s.emailsDraft, (s.emailsApproved || 0) + " aprobados") +
      statCard("Oportunidades", s.opportunitiesOpen, (s.pieces || 0) + " piezas") +
      "</div>" +
      '<div><h2 class="text-[15px] font-bold text-slate-900 mb-3">Agentes</h2>' +
      '<div class="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">' +
      agentsHtml +
      "</div></div>" +
      '<div class="grid lg:grid-cols-2 gap-4">' +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Últimas campañas</h2>' +
      campsHtml +
      '<button type="button" data-mkt-go="/marketing/estrategia" class="' +
      BTN_SECONDARY +
      ' mt-3 w-full">Ir al Planificador</button></div>' +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Cómo trabaja</h2>' +
      '<ol class="space-y-3 text-[13px] text-slate-600 list-decimal list-inside">' +
      "<li><strong class=\"text-slate-900\">Rankear</strong> detecta oportunidades de visibilidad en IA y Google.</li>" +
      "<li><strong class=\"text-slate-900\">Planificador</strong> propone campañas desde el catálogo y esas oportunidades.</li>" +
      "<li><strong class=\"text-slate-900\">Email y Promociones</strong> dejan borradores aprobables (sin envío hasta dominio).</li>" +
      "<li><strong class=\"text-slate-900\">Contenidos y Menciones</strong> preparan piezas y contactos.</li>" +
      "<li><strong class=\"text-slate-900\">Analítica</strong> recomienda el próximo movimiento.</li>" +
      "</ol></div></div></div>"
    );
  }

  /* ─── Estrategia ─── */
  function renderEstrategia(overview, catalog) {
    var opps = overview.opportunities || [];
    var campaigns = overview.campaigns || [];
    var items = (catalog && catalog.items) || [];
    var goals = (catalog && catalog.goals) || [];

    var oppHtml = opps.length
      ? opps
          .map(function (o) {
            return (
              '<div class="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-slate-100 last:border-0">' +
              "<div class=\"min-w-0 flex-1\">" +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(o.keyword) +
              "</div>" +
              '<div class="text-[11px] text-slate-500">' +
              esc(o.cluster || "") +
              " · score " +
              esc(String(o.opportunityScore ?? o.priority ?? "—")) +
              (o.monthlySearches != null ? " · " + fmtNum(o.monthlySearches) + "/mes" : "") +
              "</div></div>" +
              '<button type="button" data-mkt-camp-from-opp="' +
              esc(o.id) +
              '" class="' +
              BTN_PRIMARY +
              '">Crear campaña</button></div>'
            );
          })
          .join("")
      : emptyState("No hay oportunidades abiertas.");

    var catOpts = items
      .map(function (it) {
        return (
          '<option value="' +
          esc(it.id) +
          '">' +
          esc(it.name) +
          " (" +
          esc(it.kind) +
          ")</option>"
        );
      })
      .join("");

    var goalOpts = goals
      .map(function (g) {
        return '<option value="' + esc(g.key) + '">' + esc(g.label) + "</option>";
      })
      .join("");

    var catalogList = items.length
      ? items
          .map(function (it) {
            return (
              '<div class="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="flex items-center gap-2">' +
              '<span class="text-[13px] font-semibold text-slate-900 break-words">' +
              esc(truncate(it.name, 120)) +
              "</span>" +
              badge(it.kind) +
              "</div>" +
              '<p class="mt-1 text-[12px] text-slate-500 break-words">' +
              esc(truncate(it.description, 240)) +
              "</p>" +
              (it.priceText
                ? '<div class="mt-1 text-[11px] font-semibold text-slate-700">' +
                  esc(it.priceText) +
                  "</div>"
                : "") +
              "</div>" +
              '<button type="button" data-mkt-del-cat="' +
              esc(it.id) +
              '" class="' +
              BTN_DANGER +
              ' shrink-0">Eliminar</button></div>'
            );
          })
          .join("")
      : emptyState("Catálogo vacío. Agregá un servicio o producto.");

    var campList = campaigns.length
      ? campaigns
          .map(function (c) {
            var actions = [];
            if (c.status === "proposed") {
              actions.push(
                '<button type="button" data-mkt-camp-status="' +
                  esc(c.id) +
                  '" data-status="approved" class="' +
                  BTN_PRIMARY +
                  '">Aprobar</button>',
              );
            }
            if (c.status === "approved") {
              actions.push(
                '<button type="button" data-mkt-camp-status="' +
                  esc(c.id) +
                  '" data-status="active" class="' +
                  BTN_PRIMARY +
                  '">Activar</button>',
              );
            }
            if (c.status === "active") {
              actions.push(
                '<button type="button" data-mkt-camp-status="' +
                  esc(c.id) +
                  '" data-status="finished" class="' +
                  BTN_SECONDARY +
                  '">Finalizar</button>',
              );
            }
            actions.push(
              '<button type="button" data-mkt-gen-email="' +
                esc(c.id) +
                '" class="' +
                BTN_SECONDARY +
                '">Generar email</button>',
            );
            actions.push(
              '<button type="button" data-mkt-del-camp="' +
                esc(c.id) +
                '" class="' +
                BTN_DANGER +
                '">Eliminar</button>',
            );
            return (
              '<div class="' +
              CARD +
              ' space-y-3">' +
              '<div class="flex flex-wrap items-start justify-between gap-2">' +
              "<div>" +
              '<div class="text-[14px] font-bold text-slate-900">' +
              esc(truncate(c.title, 120)) +
              "</div>" +
              '<div class="mt-1 text-[12px] text-slate-500">' +
              esc(c.objective || "") +
              "</div>" +
              '<div class="mt-2 flex flex-wrap gap-2 items-center">' +
              badge(c.status) +
              (c.sourceLabel
                ? '<span class="text-[11px] text-slate-500">Fuente: ' +
                  esc(c.sourceLabel) +
                  "</span>"
                : "") +
              (c._count
                ? '<span class="text-[11px] text-slate-500">' +
                  (c._count.offers || 0) +
                  " ofertas · " +
                  (c._count.emails || 0) +
                  " emails</span>"
                : "") +
              "</div></div></div>" +
              '<div class="flex flex-wrap gap-2">' +
              actions.join("") +
              "</div></div>"
            );
          })
          .join("")
      : emptyState("Sin campañas todavía.");

    var calItems = campaigns
      .filter(function (c) {
        return c.startsAt || c.endsAt;
      })
      .map(function (c) {
        return (
          '<div class="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-[12px]">' +
          '<span class="font-semibold text-slate-800 truncate">' +
          esc(truncate(c.title, 120)) +
          "</span>" +
          '<span class="text-slate-500 shrink-0">' +
          esc(fmtDate(c.startsAt)) +
          " → " +
          esc(fmtDate(c.endsAt)) +
          "</span></div>"
        );
      })
      .join("");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, overview.workspaceName) +
      pageHeader(
        "Planificador de campañas",
        "Propone campañas desde el catálogo y las oportunidades de Rankear.",
        "calendar_month",
      ) +
      '<div class="grid lg:grid-cols-2 gap-4">' +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Oportunidades → campaña</h2>' +
      oppHtml +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Proponer desde catálogo</h2>' +
      '<form id="mkt-propose" class="space-y-3">' +
      '<div><label class="' +
      LABEL +
      '">Servicio / producto</label><select name="catalogItemId" class="' +
      INPUT +
      '" required><option value="">Elegí uno</option>' +
      catOpts +
      "</select></div>" +
      '<div><label class="' +
      LABEL +
      '">Objetivo</label><select name="goal" class="' +
      INPUT +
      '" required><option value="">Elegí objetivo</option>' +
      goalOpts +
      "</select></div>" +
      '<div><label class="' +
      LABEL +
      '">Público (opcional)</label><input name="audience" class="' +
      INPUT +
      '" placeholder="Ej. e-commerces en AMBA"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Notas</label><textarea name="notes" class="' +
      TEXTAREA +
      '" placeholder="Contexto adicional"></textarea></div>' +
      '<button type="submit" class="' +
      BTN_PRIMARY +
      '">Proponer campaña</button></form></div></div>' +
      '<div class="grid lg:grid-cols-2 gap-4">' +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Catálogo</h2>' +
      '<form id="mkt-catalog" class="grid sm:grid-cols-2 gap-3 mb-4" autocomplete="off">' +
      '<div><label class="' +
      LABEL +
      '">Tipo</label><select name="catKind" class="' +
      INPUT +
      '"><option value="servicio">Servicio</option><option value="producto">Producto</option></select></div>' +
      '<div><label class="' +
      LABEL +
      '">Nombre</label><input name="catName" class="' +
      INPUT +
      '" required minlength="2" maxlength="200" placeholder="Ej: Distribución urbana"/></div>' +
      '<div class="sm:col-span-2"><label class="' +
      LABEL +
      '">Descripción</label><textarea name="catDescription" class="' +
      TEXTAREA +
      '" required minlength="5" maxlength="4000" placeholder="Qué es, para quién y qué lo hace distinto"></textarea></div>' +
      '<div><label class="' +
      LABEL +
      '">Precio</label><input name="catPrice" class="' +
      INPUT +
      '" maxlength="200" placeholder="Ej: Desde $18.500"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Audiencia</label><input name="catAudience" class="' +
      INPUT +
      '" maxlength="1000" placeholder="Público típico"/></div>' +
      '<div class="sm:col-span-2"><button type="submit" class="' +
      BTN_PRIMARY +
      '">Agregar al catálogo</button></div></form>' +
      catalogList +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Nueva campaña manual</h2>' +
      '<form id="mkt-campaign" class="space-y-3">' +
      '<div><label class="' +
      LABEL +
      '">Título</label><input name="title" class="' +
      INPUT +
      '" required/></div>' +
      '<div><label class="' +
      LABEL +
      '">Objetivo</label><textarea name="objective" class="' +
      TEXTAREA +
      '" required></textarea></div>' +
      '<div><label class="' +
      LABEL +
      '">Audiencia</label><input name="audience" class="' +
      INPUT +
      '"/></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="' +
      LABEL +
      '">Desde</label><input type="date" name="startsAt" class="' +
      INPUT +
      '"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Hasta</label><input type="date" name="endsAt" class="' +
      INPUT +
      '"/></div></div>' +
      '<button type="submit" class="' +
      BTN_PRIMARY +
      '">Crear campaña</button></form>' +
      '<h3 class="text-[13px] font-bold text-slate-900 mt-6 mb-2">Calendario</h3>' +
      (calItems || emptyState("Sin fechas de vigencia.")) +
      "</div></div>" +
      '<div><h2 class="text-[15px] font-bold text-slate-900 mb-3">Campañas</h2>' +
      '<div class="space-y-3">' +
      campList +
      "</div></div></div>"
    );
  }

  function wireEstrategia(root) {
    var propose = root.querySelector("#mkt-propose");
    if (propose) {
      propose.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(propose);
        mut(
          "/api/marketing/campaigns/propose",
          {
            method: "POST",
            body: {
              catalogItemId: fd.get("catalogItemId"),
              goal: fd.get("goal"),
              audience: fd.get("audience") || undefined,
              notes: fd.get("notes") || undefined,
            },
          },
          "Campaña propuesta",
        );
      });
    }
    var cat = root.querySelector("#mkt-catalog");
    if (cat) {
      cat.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(cat);
        var name = String(fd.get("catName") || "").trim();
        var description = String(fd.get("catDescription") || "").trim();
        var priceText = String(fd.get("catPrice") || "").trim();
        var audience = String(fd.get("catAudience") || "").trim();
        if (name.length < 2 || description.length < 5) {
          toast("Completá nombre y descripción.", "err");
          return;
        }
        if (priceText && !/\d/.test(priceText)) {
          toast("El precio debe incluir un número (ej: $ 18.500).", "err");
          return;
        }
        mut(
          "/api/marketing/catalog",
          {
            method: "POST",
            body: {
              kind: String(fd.get("catKind") || "servicio"),
              name: name,
              description: description,
              priceText: priceText || undefined,
              audience: audience || undefined,
            },
          },
          "Ítem agregado",
        );
      });
    }
    var camp = root.querySelector("#mkt-campaign");
    if (camp) {
      camp.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(camp);
        var body = {
          title: String(fd.get("title") || "").trim().slice(0, 200),
          objective: String(fd.get("objective") || "").trim(),
          audience: String(fd.get("audience") || "").trim() || undefined,
        };
        if (!body.title || body.title.length < 3 || !body.objective || body.objective.length < 5) {
          toast("Completá título y objetivo.", "err");
          return;
        }
        var starts = dateInputToIso(fd.get("startsAt"));
        var ends = dateInputToIso(fd.get("endsAt"));
        if (starts) body.startsAt = starts;
        if (ends) body.endsAt = ends;
        mut("/api/marketing/campaigns", { method: "POST", body: body }, "Campaña creada");
      });
    }
    root.querySelectorAll("[data-mkt-camp-from-opp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/campaigns",
          { method: "POST", body: { opportunityId: btn.getAttribute("data-mkt-camp-from-opp") } },
          "Campaña desde oportunidad",
        );
      });
    });
    root.querySelectorAll("[data-mkt-del-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("¿Eliminar este ítem del catálogo?")) return;
        mut(
          "/api/marketing/catalog/" + encodeURIComponent(btn.getAttribute("data-mkt-del-cat")),
          { method: "DELETE" },
          "Eliminado",
        );
      });
    });
    root.querySelectorAll("[data-mkt-camp-status]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/campaigns/" + encodeURIComponent(btn.getAttribute("data-mkt-camp-status")),
          { method: "PATCH", body: { status: btn.getAttribute("data-status") } },
          "Estado actualizado",
        );
      });
    });
    root.querySelectorAll("[data-mkt-gen-email]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/campaigns/" +
            encodeURIComponent(btn.getAttribute("data-mkt-gen-email")) +
            "/generate-email",
          { method: "POST" },
          "Borrador de email creado",
        );
      });
    });
    root.querySelectorAll("[data-mkt-del-camp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("¿Eliminar esta campaña?")) return;
        mut(
          "/api/marketing/campaigns/" + encodeURIComponent(btn.getAttribute("data-mkt-del-camp")),
          { method: "DELETE" },
          "Campaña eliminada",
        );
      });
    });
  }

  /* ─── Email ─── */
  function renderEmail(data) {
    var emails = data.emails || [];
    var campaigns = (data.campaigns || []).filter(function (c) {
      return c.status === "approved" || c.status === "active" || c.status === "proposed";
    });

    var genBtns = campaigns.length
      ? campaigns
          .map(function (c) {
            return (
              '<button type="button" data-mkt-gen-email="' +
              esc(c.id) +
              '" class="' +
              BTN_SECONDARY +
              '">' +
              icon("mail", 16) +
              " " +
              esc(c.title.slice(0, 42)) +
              (c.title.length > 42 ? "…" : "") +
              "</button>"
            );
          })
          .join("")
      : emptyState("No hay campañas para generar emails.");

    var list = emails.length
      ? emails
          .map(function (em) {
            var actions = [];
            if (em.status === "draft") {
              actions.push(
                '<button type="button" data-mkt-email-status="' +
                  esc(em.id) +
                  '" data-status="approved" class="' +
                  BTN_PRIMARY +
                  '">Aprobar</button>',
              );
              actions.push(
                '<button type="button" data-mkt-email-status="' +
                  esc(em.id) +
                  '" data-status="discarded" class="' +
                  BTN_SECONDARY +
                  '">Descartar</button>',
              );
            }
            actions.push(
              '<button type="button" data-mkt-del-email="' +
                esc(em.id) +
                '" class="' +
                BTN_DANGER +
                '">Eliminar</button>',
            );
            return (
              '<div class="' +
              CARD +
              ' space-y-3">' +
              '<div class="flex flex-wrap items-start justify-between gap-2">' +
              "<div>" +
              '<div class="text-[14px] font-bold text-slate-900">' +
              esc(em.subject) +
              "</div>" +
              '<div class="mt-1 text-[12px] text-slate-500">Preheader: ' +
              esc(em.preheader || "—") +
              " · Segmento: " +
              esc(em.segment || "—") +
              "</div>" +
              '<div class="mt-2">' +
              badge(em.status) +
              "</div></div></div>" +
              '<pre class="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-56 overflow-auto">' +
              esc(em.body || "") +
              "</pre>" +
              (em.ctaText
                ? '<div class="text-[12px] text-slate-600">CTA: <strong>' +
                  esc(em.ctaText) +
                  "</strong>" +
                  (em.ctaUrl ? " → " + esc(em.ctaUrl) : "") +
                  "</div>"
                : "") +
              '<div class="flex flex-wrap gap-2">' +
              actions.join("") +
              "</div></div>"
            );
          })
          .join("")
      : emptyState("Sin borradores de email.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Email Marketing",
        "Borradores aprobables. El envío se habilita cuando el cliente conecta su dominio.",
        "mail",
      ) +
      notice(
        data.sendingEnabled
          ? "Envío habilitado."
          : data.sendingNote ||
              "El envío real de email está deshabilitado hasta conectar dominio (SPF/DKIM) y lista con consentimiento.",
        data.sendingEnabled ? "ok" : "err",
      ) +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Generar desde campañas</h2>' +
      '<div class="flex flex-wrap gap-2">' +
      genBtns +
      "</div></div>" +
      '<div><h2 class="text-[15px] font-bold text-slate-900 mb-3">Emails</h2><div class="space-y-3">' +
      list +
      "</div></div></div>"
    );
  }

  function wireEmail(root) {
    root.querySelectorAll("[data-mkt-gen-email]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/campaigns/" +
            encodeURIComponent(btn.getAttribute("data-mkt-gen-email")) +
            "/generate-email",
          { method: "POST" },
          "Borrador creado",
        );
      });
    });
    root.querySelectorAll("[data-mkt-email-status]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/emails/" + encodeURIComponent(btn.getAttribute("data-mkt-email-status")),
          { method: "PATCH", body: { status: btn.getAttribute("data-status") } },
          "Email actualizado",
        );
      });
    });
    root.querySelectorAll("[data-mkt-del-email]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("¿Eliminar este email?")) return;
        mut(
          "/api/marketing/emails/" + encodeURIComponent(btn.getAttribute("data-mkt-del-email")),
          { method: "DELETE" },
          "Email eliminado",
        );
      });
    });
  }

  /* ─── Ofertas ─── */
  function renderOfertas(data) {
    var offers = data.offers || [];
    var campaigns = data.campaigns || [];
    var campOpts = campaigns
      .map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(truncate(c.title, 80)) + "</option>";
      })
      .join("");

    var list = offers.length
      ? offers
          .map(function (o) {
            var st = o.derivedStatus || o.status;
            var actions = [];
            if (o.status === "draft") {
              actions.push(
                '<button type="button" data-mkt-offer-status="' +
                  esc(o.id) +
                  '" data-status="approved" class="' +
                  BTN_PRIMARY +
                  '">Aprobar</button>',
              );
            }
            if (o.status === "approved") {
              actions.push(
                '<button type="button" data-mkt-offer-status="' +
                  esc(o.id) +
                  '" data-status="active" class="' +
                  BTN_PRIMARY +
                  '">Activar</button>',
              );
            }
            if (o.status === "active" || o.status === "approved") {
              actions.push(
                '<button type="button" data-mkt-offer-status="' +
                  esc(o.id) +
                  '" data-status="archived" class="' +
                  BTN_SECONDARY +
                  '">Archivar</button>',
              );
            }
            actions.push(
              '<button type="button" data-mkt-del-offer="' +
                esc(o.id) +
                '" class="' +
                BTN_DANGER +
                '">Eliminar</button>',
            );
            var channels = (o.channels || [])
              .map(function (ch) {
                return badge(ch);
              })
              .join(" ");
            return (
              '<div class="' +
              CARD +
              ' space-y-3">' +
              '<div class="flex flex-wrap items-start justify-between gap-2">' +
              "<div>" +
              '<div class="text-[14px] font-bold text-slate-900">' +
              esc(truncate(o.title, 120)) +
              "</div>" +
              '<p class="mt-1 text-[12px] text-slate-600">' +
              esc(o.description) +
              "</p>" +
              '<div class="mt-2 flex flex-wrap gap-2 items-center">' +
              badge(st) +
              channels +
              "</div>" +
              '<div class="mt-2 text-[11px] text-slate-500">' +
              (o.priceText ? esc(o.priceText) + " · " : "") +
              (o.discountText ? esc(o.discountText) + " · " : "") +
              esc(fmtDate(o.startsAt)) +
              " → " +
              esc(fmtDate(o.endsAt)) +
              "</div></div></div>" +
              '<div class="flex flex-wrap gap-2">' +
              actions.join("") +
              "</div></div>"
            );
          })
          .join("")
      : emptyState("Sin ofertas.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Promociones",
        "Creá y publicá ofertas por canal, con vigencia y condiciones.",
        "percent",
      ) +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Nueva oferta</h2>' +
      '<form id="mkt-offer" class="grid sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="' +
      LABEL +
      '">Título</label><input name="title" class="' +
      INPUT +
      '" required minlength="3"/></div>' +
      '<div class="sm:col-span-2"><label class="' +
      LABEL +
      '">Descripción</label><textarea name="description" class="' +
      TEXTAREA +
      '" required minlength="5"></textarea></div>' +
      '<div><label class="' +
      LABEL +
      '">Precio</label><input name="priceText" class="' +
      INPUT +
      '"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Descuento / beneficio</label><input name="discountText" class="' +
      INPUT +
      '"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Campaña</label><select name="campaignId" class="' +
      INPUT +
      '"><option value="">Sin campaña</option>' +
      campOpts +
      "</select></div>" +
      '<div><label class="' +
      LABEL +
      '">Canales (coma)</label><input name="channels" class="' +
      INPUT +
      '" value="email, web" placeholder="email, web, whatsapp"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Desde</label><input type="date" name="startsAt" class="' +
      INPUT +
      '"/></div>' +
      '<div><label class="' +
      LABEL +
      '">Hasta</label><input type="date" name="endsAt" class="' +
      INPUT +
      '"/></div>' +
      '<div class="sm:col-span-2"><label class="' +
      LABEL +
      '">Condiciones</label><textarea name="terms" class="' +
      TEXTAREA +
      '"></textarea></div>' +
      '<div class="sm:col-span-2"><button type="submit" class="' +
      BTN_PRIMARY +
      '">Crear oferta</button></div></form></div>' +
      '<div><h2 class="text-[15px] font-bold text-slate-900 mb-3">Ofertas</h2><div class="space-y-3">' +
      list +
      "</div></div></div>"
    );
  }

  function wireOfertas(root) {
    var form = root.querySelector("#mkt-offer");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var channels = String(fd.get("channels") || "")
          .split(",")
          .map(function (x) {
            return x.trim();
          })
          .filter(Boolean);
        var priceText = String(fd.get("priceText") || "").trim();
        if (priceText && !/\d/.test(priceText)) {
          toast("El precio debe incluir un número (ej: $ 49.900).", "err");
          return;
        }
        var body = {
          title: String(fd.get("title") || "").trim().slice(0, 200),
          description: String(fd.get("description") || "").trim(),
          priceText: priceText || undefined,
          discountText: String(fd.get("discountText") || "").trim() || undefined,
          terms: String(fd.get("terms") || "").trim() || undefined,
          campaignId: String(fd.get("campaignId") || "").trim() || undefined,
          channels: channels.length ? channels : ["email", "web"],
        };
        if (!body.title || body.title.length < 3 || !body.description || body.description.length < 5) {
          toast("Completá título y descripción.", "err");
          return;
        }
        var starts = dateInputToIso(fd.get("startsAt"));
        var ends = dateInputToIso(fd.get("endsAt"));
        if (starts) body.startsAt = starts;
        if (ends) body.endsAt = ends;
        mut("/api/marketing/offers", { method: "POST", body: body }, "Oferta creada");
      });
    }
    root.querySelectorAll("[data-mkt-offer-status]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/offers/" + encodeURIComponent(btn.getAttribute("data-mkt-offer-status")),
          { method: "PATCH", body: { status: btn.getAttribute("data-status") } },
          "Oferta actualizada",
        );
      });
    });
    root.querySelectorAll("[data-mkt-del-offer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("¿Eliminar esta oferta?")) return;
        mut(
          "/api/marketing/offers/" + encodeURIComponent(btn.getAttribute("data-mkt-del-offer")),
          { method: "DELETE" },
          "Oferta eliminada",
        );
      });
    });
  }

  /* ─── Visibilidad ─── */
  function renderVisibilidad(data) {
    var google = data.google || {};
    var opps = data.opportunities || [];
    var questions = data.questions || [];
    var weak =
      (data.cleexs &&
        data.cleexs.configured &&
        data.cleexs.snapshot &&
        data.cleexs.snapshot.latest &&
        data.cleexs.snapshot.latest.weakPrompts) ||
      [];

    var weakHtml = weak.length
      ? weak
          .map(function (w) {
            return (
              '<div class="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(w.prompt) +
              "</div>" +
              '<div class="text-[11px] text-slate-500">Score ' +
              esc(String(w.score != null ? w.score : "—")) +
              " · Ganan: " +
              esc((w.top || []).join(", ") || "otros") +
              "</div></div>" +
              '<button type="button" data-mkt-weak-camp="' +
              esc(w.prompt) +
              '" class="' +
              BTN_PRIMARY +
              '">Crear campaña</button></div>'
            );
          })
          .join("")
      : emptyState("Sin prompts débiles o Cleexs sin datos.");

    var oppRows = opps.length
      ? '<div class="overflow-x-auto"><table class="w-full text-left text-[12px]">' +
        "<thead><tr class=\"text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200\">" +
        "<th class=\"py-2 pr-3\">Keyword</th><th class=\"py-2 pr-3\">Cluster</th><th class=\"py-2 pr-3\">Score</th>" +
        "<th class=\"py-2 pr-3\">Búsquedas</th><th class=\"py-2 pr-3\">GSC</th><th class=\"py-2\">Acción</th></tr></thead><tbody>" +
        opps
          .map(function (o) {
            return (
              "<tr class=\"border-b border-slate-100\">" +
              '<td class="py-2.5 pr-3 font-semibold text-slate-900">' +
              esc(o.keyword) +
              "</td>" +
              '<td class="py-2.5 pr-3 text-slate-600">' +
              esc(o.cluster || "—") +
              "</td>" +
              '<td class="py-2.5 pr-3">' +
              esc(String(o.opportunityScore ?? o.priority ?? "—")) +
              "</td>" +
              '<td class="py-2.5 pr-3">' +
              fmtNum(o.monthlySearches) +
              "</td>" +
              '<td class="py-2.5 pr-3">' +
              fmtNum(o.gscImpressions) +
              " / " +
              fmtNum(o.gscClicks) +
              "</td>" +
              '<td class="py-2.5"><button type="button" data-mkt-camp-from-opp="' +
              esc(o.id) +
              '" class="' +
              BTN_PRIMARY +
              '">Campaña</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table></div>"
      : emptyState("Sin oportunidades.");

    var qHtml = questions.length
      ? questions
          .map(function (q) {
            return (
              '<div class="py-2.5 border-b border-slate-100 last:border-0">' +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(q.question) +
              "</div>" +
              '<div class="text-[11px] text-slate-500">' +
              esc(q.cluster || "") +
              " · prioridad " +
              esc(String(q.priority ?? "—")) +
              "</div></div>"
            );
          })
          .join("")
      : emptyState("Sin preguntas.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Rankear",
        "Presencia de marca en IA y Google, oportunidades y preguntas reales.",
        "visibility",
      ) +
      cleexsScoreBlock(data.cleexs) +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
      statCard("Impresiones GSC", fmtNum(google.impressions)) +
      statCard("Clicks GSC", fmtNum(google.clicks)) +
      statCard("Búsquedas/mes", fmtNum(google.searches)) +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Prompts débiles → campaña</h2>' +
      weakHtml +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-3">Oportunidades</h2>' +
      oppRows +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Preguntas</h2>' +
      qHtml +
      "</div></div>"
    );
  }

  function wireVisibilidad(root) {
    root.querySelectorAll("[data-mkt-camp-from-opp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mut(
          "/api/marketing/campaigns",
          { method: "POST", body: { opportunityId: btn.getAttribute("data-mkt-camp-from-opp") } },
          "Campaña creada",
        );
      });
    });
    root.querySelectorAll("[data-mkt-weak-camp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var prompt = btn.getAttribute("data-mkt-weak-camp") || "";
        mut(
          "/api/marketing/campaigns",
          {
            method: "POST",
            body: {
              title: "Cleexs: " + prompt.slice(0, 80),
              objective:
                "Mejorar la aparición de la marca en la consulta: \"" +
                prompt +
                "\". Contenidos + Rankear + email a prospectos.",
              audience: "Personas que consultan a IAs sobre este tema",
            },
          },
          "Campaña desde prompt débil",
        );
      });
    });
  }

  /* ─── Contenidos ─── */
  function renderContenidos(data) {
    var pieces = data.pieces || [];
    var byStatus = data.byStatus || {};
    var statusKeys = Object.keys(byStatus);
    var stats =
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
      statCard("Piezas", pieces.length) +
      statCard("Publicadas", data.publications || 0) +
      statusKeys
        .slice(0, 2)
        .map(function (k) {
          return statCard(k, byStatus[k]);
        })
        .join("") +
      "</div>";

    var list = pieces.length
      ? pieces
          .map(function (p) {
            var clusterLabel =
              typeof p.cluster === "string"
                ? p.cluster
                : p.cluster && p.cluster.name
                  ? p.cluster.name
                  : "";
            return (
              '<div class="flex flex-wrap items-start justify-between gap-2 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(p.title) +
              "</div>" +
              '<div class="mt-1 text-[11px] text-slate-500">' +
              esc(p.type || "") +
              (p.keyword ? " · " + esc(p.keyword) : "") +
              (clusterLabel ? " · " + esc(clusterLabel) : "") +
              " · " +
              esc(fmtDate(p.updatedAt)) +
              "</div>" +
              (p.publication && p.publication.url
                ? '<a class="mt-1 inline-block text-[12px] text-blue-600 font-semibold" href="' +
                  esc(p.publication.url) +
                  '" target="_blank" rel="noopener">Ver publicación</a>'
                : "") +
              "</div>" +
              badge(p.status) +
              "</div>"
            );
          })
          .join("")
      : emptyState("Sin piezas de contenido.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Contenidos",
        "Piezas generadas y publicadas (solo lectura en esta vista).",
        "newspaper",
      ) +
      stats +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Piezas</h2>' +
      list +
      "</div></div>"
    );
  }

  /* ─── Difusión ─── */
  function renderDifusion(data) {
    var opps = data.opportunities || [];
    var runs = data.runs || [];

    var media = opps.length
      ? opps
          .map(function (o) {
            var conv = o.conversation || {};
            var title =
              o.title ||
              conv.title ||
              o.outlet ||
              o.name ||
              conv.domain ||
              o.domain ||
              "Medio";
            var topic = o.type || o.channel || o.category || conv.topic || "";
            var url = o.url || conv.url || "";
            var domain = conv.domain || o.domain || "";
            return (
              '<div class="flex flex-wrap items-start justify-between gap-2 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="text-[13px] font-semibold text-slate-900">' +
              esc(title) +
              "</div>" +
              '<div class="mt-1 text-[11px] text-slate-500">' +
              esc(topic) +
              (domain ? " · " + esc(domain) : "") +
              (url ? " · " + esc(url) : "") +
              (o.opportunityScore != null
                ? " · score " + esc(String(o.opportunityScore))
                : "") +
              "</div>" +
              (o.pitch || o.notes
                ? '<p class="mt-1 text-[12px] text-slate-600">' +
                  esc(o.pitch || o.notes) +
                  "</p>"
                : "") +
              "</div>" +
              badge(o.editorialStatus || o.status || "idea") +
              "</div>"
            );
          })
          .join("")
      : emptyState("Sin oportunidades de difusión.");

    var runsHtml = runs.length
      ? runs
          .map(function (r) {
            return (
              '<div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-[12px]">' +
              "<span>" +
              badge(r.status) +
              ' <span class="text-slate-600 ml-2">' +
              esc(String(r.opportunityCount ?? 0)) +
              " oportunidades</span></span>" +
              '<span class="text-slate-500">' +
              esc(fmtDate(r.createdAt)) +
              "</span></div>"
            );
          })
          .join("")
      : emptyState("Sin corridas.");

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Menciones",
        "Medios, blogs y directorios donde posicionar la marca (solo lectura).",
        "campaign",
      ) +
      '<div class="grid grid-cols-2 gap-3">' +
      statCard("Medios / oportunidades", opps.length) +
      statCard("Corridas", runs.length) +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Medios</h2>' +
      media +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Corridas</h2>' +
      runsHtml +
      "</div></div>"
    );
  }

  /* ─── Resultados ─── */
  function renderResultados(data) {
    var c = data.counts || {};
    var recs = data.recommendations || [];

    var recHtml = recs.length
      ? recs
          .map(function (r) {
            return (
              '<div class="flex flex-wrap items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">' +
              "<div>" +
              '<div class="mb-1">' +
              badge(r.level) +
              "</div>" +
              '<p class="text-[13px] text-slate-700">' +
              esc(r.text) +
              "</p></div>" +
              (r.route
                ? '<button type="button" data-mkt-go="' +
                  esc(r.route) +
                  '" class="' +
                  BTN_SECONDARY +
                  ' shrink-0">Abrir</button>'
                : "") +
              "</div>"
            );
          })
          .join("")
      : emptyState("Sin recomendaciones.");

    function breakdown(obj, title) {
      obj = obj || {};
      var keys = Object.keys(obj);
      if (!keys.length) return "";
      return (
        '<div class="' +
        CARD +
        '"><h3 class="text-[13px] font-bold text-slate-900 mb-2">' +
        esc(title) +
        "</h3>" +
        keys
          .map(function (k) {
            return (
              '<div class="flex justify-between text-[12px] py-1.5 border-b border-slate-50 last:border-0">' +
              "<span class=\"text-slate-600\">" +
              esc(k) +
              '</span><span class="font-semibold text-slate-900">' +
              esc(String(obj[k])) +
              "</span></div>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    return (
      '<div class="space-y-5">' +
      opsBanner(true, null, data.workspaceName) +
      pageHeader(
        "Analítica",
        "Desempeño del motor de marketing y próximos movimientos.",
        "monitoring",
      ) +
      cleexsScoreBlock(data.cleexs) +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
      statCard("Campañas", c.campaigns) +
      statCard("Ofertas", c.offers, (c.offersExpired || 0) + " vencidas") +
      statCard("Piezas", c.pieces, (c.publications || 0) + " publicadas") +
      statCard("Difusión", c.diffusionOpportunities) +
      "</div>" +
      '<div class="' +
      CARD +
      '"><h2 class="text-[15px] font-bold text-slate-900 mb-2">Recomendaciones</h2>' +
      recHtml +
      "</div>" +
      '<div class="grid md:grid-cols-3 gap-3">' +
      breakdown(c.campaignsByStatus, "Campañas por estado") +
      breakdown(c.emailsByStatus, "Emails por estado") +
      breakdown(c.piecesByStatus, "Piezas por estado") +
      "</div></div>"
    );
  }

  function wireNav(root) {
    root.querySelectorAll("[data-mkt-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(btn.getAttribute("data-mkt-go"));
      });
    });
  }

  function mount(html, wireFn) {
    var main = document.querySelector("main");
    if (!main) {
      toast("No se encontró <main>", "err");
      return;
    }
    main.innerHTML = html;
    wireNav(main);
    if (typeof wireFn === "function") wireFn(main);
  }

  function boot() {
    var key = pageKey();
    var main = document.querySelector("main");
    if (main) {
      main.innerHTML =
        '<div class="flex items-center justify-center py-20 text-[13px] font-semibold text-slate-500">' +
        icon("progress_activity", 20) +
        ' <span class="ml-2">Cargando Marketing…</span></div>';
    }

    if (key === "dashboard") {
      api("/api/marketing/overview")
        .then(function (data) {
          mount(renderDashboard(data), null);
        })
        .catch(errorMain);
      return;
    }

    if (key === "estrategia") {
      Promise.all([api("/api/marketing/overview"), api("/api/marketing/catalog")])
        .then(function (pair) {
          mount(renderEstrategia(pair[0], pair[1]), wireEstrategia);
        })
        .catch(errorMain);
      return;
    }

    if (key === "email") {
      api("/api/marketing/overview")
        .then(function (data) {
          mount(renderEmail(data), wireEmail);
        })
        .catch(errorMain);
      return;
    }

    if (key === "ofertas") {
      api("/api/marketing/overview")
        .then(function (data) {
          mount(renderOfertas(data), wireOfertas);
        })
        .catch(errorMain);
      return;
    }

    if (key === "visibilidad") {
      api("/api/marketing/visibilidad")
        .then(function (data) {
          mount(renderVisibilidad(data), wireVisibilidad);
        })
        .catch(errorMain);
      return;
    }

    if (key === "contenidos") {
      api("/api/marketing/contenidos")
        .then(function (data) {
          mount(renderContenidos(data), null);
        })
        .catch(errorMain);
      return;
    }

    if (key === "difusion") {
      api("/api/marketing/difusion")
        .then(function (data) {
          mount(renderDifusion(data), null);
        })
        .catch(errorMain);
      return;
    }

    if (key === "resultados") {
      api("/api/marketing/resultados")
        .then(function (data) {
          mount(renderResultados(data), null);
        })
        .catch(errorMain);
      return;
    }

    errorMain(new Error("Página de Marketing desconocida."));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
