(function () {
  var LABELS = {
    "torre de control": "/",
    "monitor": "/monitor",
    "monitor de servicios": "/monitor",
    "whatsapp": "/contactos",
    "metricas": "/backoffice",
    "gestion de viajes": "/agentes/viajes",
    "tracking express": "/agentes/tracking",
    "remitos": "/agentes/remitos",
    "destinos": "/agentes/destinos",
    "incidencias": "/agentes/incidencias",
    "rendicion": "/agentes/rendicion",
    "eta": "/agentes/eta",
    "pop/pod": "/agentes/pod",
    "reclamos": "/agentes/reclamos",
    "analitica": "/agentes/analitica",
    "chat central": "/agentes/commander",
    "finanzas": "/finanzas",
    "modulo de finanzas": "/finanzas",
    "dashboard de cobranzas": "/finanzas",
    "clientes": "/finanzas/clientes",
    "facturas": "/finanzas/facturas/pagos",
    "cobranza": "/finanzas/facturas/cobranzas",
    "conciliacion": "/finanzas/conciliacion",
    "enviar mensaje": "/finanzas/comunicacion",
    "configuracion": "/parametros",
  };

  function go(href) {
    try {
      window.top.location.href = href;
    } catch (e) {
      window.location.href = href;
    }
  }

  function norm(s) {
    return String(s || "")
      .replace(/\bNuevo\b/gi, " ")
      .replace(/[▾▼˅]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function labelOf(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll("svg, i, img, button, .material-symbols-outlined").forEach(function (n) {
      n.remove();
    });
    return norm(clone.textContent);
  }

  function routeFor(el) {
    var path = norm(el.getAttribute("data-path") || "");
    if (LABELS[path]) return LABELS[path];
    var href = el.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//") && href !== "/") {
      return href;
    }
    var label = labelOf(el);
    if (LABELS[label]) return LABELS[label];
    if (label.indexOf("torre") === 0) return "/";
    if (label.indexOf("whatsapp") >= 0) return "/contactos";
    if (label.indexOf("finanza") >= 0) return "/finanzas";
    return null;
  }

  function bind(el) {
    var href = routeFor(el);
    if (!href) return;
    if (el.tagName === "A") {
      el.setAttribute("href", href);
      el.setAttribute("target", "_parent");
    }
    el.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      go(href);
    });
  }

  function injectFinanzas() {
    if (document.querySelector("[data-sol-finanzas]")) return;

    var anal = null;
    document.querySelectorAll("a").forEach(function (a) {
      if (labelOf(a) === "analitica") anal = a;
    });

    var aside = document.querySelector("aside");
    if (aside && aside.querySelector("nav") && aside.offsetWidth > 120) {
      var block = document.createElement("div");
      block.setAttribute("data-sol-finanzas", "1");
      block.innerHTML =
        '<h3 class="px-5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-2">Finanzas</h3>' +
        '<nav class="space-y-0.5 px-3">' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas"><span>Dashboard</span></a>' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas/clientes"><span>Clientes</span></a>' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas/facturas/pagos"><span>Facturas</span></a>' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas/facturas/cobranzas"><span>Cobranza</span></a>' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas/conciliacion"><span>Conciliación</span></a>' +
        '<a class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900" href="/finanzas/comunicacion"><span>Enviar Mensaje</span></a>' +
        "</nav>";
      var footer = aside.querySelector(".border-t");
      if (footer && footer.parentNode === aside) aside.insertBefore(block, footer);
      else aside.appendChild(block);
      block.querySelectorAll("a").forEach(bind);
      return;
    }

    if (anal && anal.parentNode) {
      var exists = false;
      Array.prototype.forEach.call(anal.parentNode.children, function (kid) {
        if (norm(kid.textContent).indexOf("finanzas") >= 0) exists = true;
      });
      if (exists) return;
      var a = document.createElement("a");
      a.setAttribute("data-sol-finanzas", "1");
      a.className = anal.className;
      a.href = "/finanzas";
      a.target = "_parent";
      a.innerHTML = '<span class="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-800 rounded mr-1">Nuevo</span>Finanzas';
      anal.parentNode.insertBefore(a, anal.nextSibling);
      bind(a);
    }
  }

  var MENU_ICONS = {
    "gestion de viajes": "local_shipping",
    "tracking express": "share_location",
    "remitos": "description",
    "destinos": "pin_drop",
    "incidencias": "warning",
    "rendicion": "account_balance_wallet",
    "eta": "schedule",
    "pop/pod": "inventory_2",
    "reclamos": "support_agent",
    "analitica": "monitoring",
    "finanzas": "account_balance",
    "dashboard": "dashboard",
    "clientes": "corporate_fare",
    "facturas": "receipt_long",
    "cobranza": "handshake",
    "conciliacion": "balance",
    "enviar mensaje": "send",
  };

  function ensureIconFont() {
    if (document.querySelector("link[href*='Material+Symbols'], link[href*='Material%20Symbols']")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,500,0,0&display=swap";
    document.head.appendChild(link);
  }

  function menuBar(el) {
    var n = el.parentElement;
    for (var i = 0; i < 4 && n && n !== document.body; i++, n = n.parentElement) {
      var text = n.textContent || "";
      if (text.length > 1200) continue;
      if (/AGENTES|FINANZAS|Agentes/i.test(text)) return n;
    }
    return null;
  }

  function decorateMenus() {
    ensureIconFont();
    document.querySelectorAll("a, button, span").forEach(function (el) {
      if (el.tagName === "SPAN" && (el.closest("a, button") || labelOf(el) !== "finanzas")) return;
      if (el.querySelector(".material-symbols-outlined, .sol-menu-icon")) return;
      var label = labelOf(el);
      var icon = MENU_ICONS[label];
      if (!icon) return;
      var bar = menuBar(el);
      if (!bar) return;
      if (label === "finanzas" && !/AGENTES|Agentes/i.test(bar.textContent || "")) return;
      var span = document.createElement("span");
      span.className = "material-symbols-outlined sol-menu-icon";
      span.textContent = icon;
      span.style.fontSize = "17px";
      span.style.lineHeight = "1";
      span.style.color = "inherit";
      el.insertBefore(span, el.firstChild);
      if (!/\bflex\b/.test(el.className)) el.classList.add("inline-flex", "items-center", "gap-1.5");
      else el.classList.add("items-center", "gap-1.5");
    });
  }

  document.querySelectorAll("a, button").forEach(bind);
  injectFinanzas();
  decorateMenus();
})();
