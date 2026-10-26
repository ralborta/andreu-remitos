(function () {
  var LABELS = {
    "torre de control": "/",
    "monitor": "/monitor",
    "monitor flota": "/monitor",
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
    if (document.querySelector('[data-sol-shell="agents"] a[href="/finanzas"]')) return;
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
    if (document.getElementById("sol-icon-style")) return;
    document.querySelectorAll("link[href*='Material+Symbols'], link[href*='Material%20Symbols']").forEach(function (link) {
      link.remove();
    });
    var face = document.createElement("link");
    face.rel = "stylesheet";
    face.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block";
    document.head.appendChild(face);
    var style = document.createElement("style");
    style.id = "sol-icon-style";
    style.textContent = [
      ".material-symbols-outlined {",
      "font-family: 'Material Symbols Outlined';",
      "font-weight: normal;",
      "font-style: normal;",
      "line-height: 1;",
      "letter-spacing: normal;",
      "text-transform: none;",
      "display: inline-block;",
      "white-space: nowrap;",
      "word-wrap: normal;",
      "direction: ltr;",
      "-webkit-font-smoothing: antialiased;",
      "font-feature-settings: 'liga';",
      "-webkit-font-feature-settings: 'liga';",
      "font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;",
      "}",
    ].join("");
    document.head.appendChild(style);
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

  function enRemitos() {
    var path = location.pathname || "";
    try { path = (window.top.location.pathname || "") + " " + path; } catch (e) {}
    return path.indexOf("/agentes/remitos") >= 0 || path.indexOf("remitos.html") >= 0;
  }

  function aplicarBusquedaRemito(value) {
    var q = String(value || "").trim();
    if (enRemitos()) {
      var local = document.getElementById("sol-rem-buscar");
      if (local) {
        local.value = q;
        local.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    go("/agentes/remitos" + (q ? "?q=" + encodeURIComponent(q) : ""));
  }

  function wireHeaderSearch() {
    document.querySelectorAll("input[placeholder*='⌘K']").forEach(function (input) {
      if (input.getAttribute("data-sol-search")) return;
      input.setAttribute("data-sol-search", "1");
      try {
        var q0 = new URLSearchParams(window.top.location.search).get("q");
        if (q0 && enRemitos()) input.value = q0;
      } catch (e) {}
      var timer = null;
      input.addEventListener("input", function () {
        clearTimeout(timer);
        var value = input.value;
        timer = setTimeout(function () { aplicarBusquedaRemito(value); }, 400);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        clearTimeout(timer);
        aplicarBusquedaRemito(input.value);
      });
    });
  }

  var TOP_LINKS = [
    { label: "Torre de Control", href: "/" },
    { label: "Monitor", href: "/monitor" },
    { label: "WhatsApp", href: "/contactos", badge: "Nuevo" },
    { label: "Métricas", href: "/backoffice" },
    { label: "Finanzas", href: "/finanzas" },
  ];
  var AGENT_LINKS = [
    { label: "Gestión de Viajes", href: "/agentes/viajes", icon: "local_shipping" },
    { label: "Tracking Express", href: "/agentes/tracking", icon: "share_location" },
    { label: "Remitos", href: "/agentes/remitos", icon: "description", caret: true },
    { label: "Destinos", href: "/agentes/destinos", icon: "pin_drop" },
    { label: "Incidencias", href: "/agentes/incidencias", icon: "warning" },
    { label: "Rendición", href: "/agentes/rendicion", icon: "account_balance_wallet" },
    { label: "ETA", href: "/agentes/eta", icon: "schedule" },
    { label: "POP/POD", href: "/agentes/pod", icon: "inventory_2" },
    { label: "Reclamos", href: "/agentes/reclamos", icon: "support_agent" },
    { label: "Analítica", href: "/agentes/analitica", icon: "monitoring" },
    { label: "Finanzas", href: "/finanzas", icon: "account_balance", nuevo: true },
  ];
  var FILE_ROUTES = {
    "torre.html": "/",
    "monitor.html": "/monitor",
    "whatsapp.html": "/contactos",
    "metricas.html": "/backoffice",
    "viajes.html": "/agentes/viajes",
    "tracking.html": "/agentes/tracking",
    "remitos.html": "/agentes/remitos",
    "destinos.html": "/agentes/destinos",
    "incidencias.html": "/agentes/incidencias",
    "rendicion.html": "/agentes/rendicion",
    "eta.html": "/agentes/eta",
    "pod.html": "/agentes/pod",
    "reclamos.html": "/agentes/reclamos",
    "analitica.html": "/agentes/analitica",
    "finanzas.html": "/finanzas",
    "finanzas-clientes.html": "/finanzas/clientes",
    "finanzas-facturas.html": "/finanzas/facturas/pagos",
    "finanzas-cobranza.html": "/finanzas/facturas/cobranzas",
    "finanzas-conciliacion.html": "/finanzas/conciliacion",
    "finanzas-comunicacion.html": "/finanzas/comunicacion",
  };

  function here() {
    var path = location.pathname || "";
    try { path = window.top.location.pathname || path; } catch (e) {}
    var file = path.split("/").pop();
    if (FILE_ROUTES[file]) return FILE_ROUTES[file];
    return path || "/";
  }

  function isActive(href, path) {
    if (href === "/") return path === "/" || path === "";
    if (href === "/finanzas") return path === "/finanzas" || path.indexOf("/finanzas/") === 0;
    return path === href;
  }

  function linkHtml(item, active, agent) {
    var icon = item.icon
      ? '<span class="material-symbols-outlined text-[17px] leading-none">' + item.icon + "</span>"
      : "";
    var badge = item.badge
      ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">Nuevo</span>'
      : "";
    var nuevo = item.nuevo
      ? '<span class="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-200 text-emerald-900 rounded">Nuevo</span>'
      : "";
    var caret = item.caret ? " ▾" : "";
    var cls;
    if (agent) {
      cls = active
        ? "inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0e1738] text-white font-semibold rounded-lg shadow-sm whitespace-nowrap"
        : item.nuevo
          ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-lg transition-colors whitespace-nowrap"
          : "inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium rounded-lg transition-colors whitespace-nowrap";
    } else {
      cls = active
        ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0e1738] text-white whitespace-nowrap"
        : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap";
    }
    return '<a data-sol-menu="1" class="' + cls + '" href="' + item.href + '">' + icon + nuevo + item.label + caret + badge + "</a>";
  }

  function shortest(pred) {
    var best = null;
    var bestLen = Infinity;
    document.querySelectorAll("nav, div").forEach(function (el) {
      if (el.closest("main, footer")) return;
      if (el.getAttribute("data-sol-shell")) return;
      var text = el.textContent || "";
      if (text.length < 24 || text.length > 1600) return;
      if (!pred(norm(text))) return;
      if (text.length < bestLen) {
        best = el;
        bestLen = text.length;
      }
    });
    return best;
  }

  function agentHost(el) {
    var nav = el.closest("nav");
    if (!nav || nav.closest("main, footer")) return el;
    var text = norm(nav.textContent || "");
    if (text.indexOf("torre de control") >= 0) return el;
    if (text.indexOf("dashboard") >= 0 && text.indexOf("conciliacion") >= 0) return el;
    return nav;
  }

  function unifyShell() {
    var path = here();
    var top = document.querySelector('[data-sol-shell="top"]') || shortest(function (text) {
      return text.indexOf("torre de control") >= 0 && text.indexOf("metricas") >= 0 && text.indexOf("gestion de viajes") < 0;
    });
    if (top) {
      top.setAttribute("data-sol-shell", "top");
      top.className = "flex items-center space-x-1 overflow-x-auto";
      top.innerHTML = TOP_LINKS.map(function (item) {
        return linkHtml(item, isActive(item.href, path), false);
      }).join("");
      top.querySelectorAll("a").forEach(bind);
    }

    var foundAgents = shortest(function (text) {
      return text.indexOf("agente") >= 0 && text.indexOf("gestion de viajes") >= 0 && text.indexOf("analitica") >= 0 && text.indexOf("dashboard") < 0;
    });
    var agents = document.querySelector('[data-sol-shell="agents"]') || (foundAgents ? agentHost(foundAgents) : null);
    if (!agents) {
      var main = document.querySelector("main");
      if (!main || !main.parentNode) return;
      agents = document.createElement("nav");
      main.parentNode.insertBefore(agents, main);
    }
    agents.setAttribute("data-sol-shell", "agents");
    agents.className = "flex items-center space-x-1 overflow-x-auto py-2 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200 text-xs";
    agents.innerHTML =
      '<span class="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 mr-2 inline-flex items-center gap-1 shrink-0">' +
      '<span class="material-symbols-outlined text-xs">smart_toy</span> AGENTES:</span>' +
      AGENT_LINKS.map(function (item) {
        return linkHtml(item, isActive(item.href, path), true);
      }).join("");
    agents.querySelectorAll("a").forEach(bind);
  }

  function parkAfter(el, after) {
    if (!el || !after || !after.parentNode || el === after) return;
    after.parentNode.insertBefore(el, after.nextSibling);
  }

  function financeRow() {
    var best = null;
    var bestLen = Infinity;
    document.querySelectorAll("div").forEach(function (el) {
      if (el.closest("main, footer, [data-sol-shell='chrome']")) return;
      var text = norm(el.textContent || "");
      if (text.indexOf("dashboard") < 0 || text.indexOf("conciliacion") < 0) return;
      if (text.indexOf("gestion de viajes") >= 0) return;
      if (text.length < 40 || text.length > 1400) return;
      if (text.length < bestLen) {
        best = el;
        bestLen = text.length;
      }
    });
    while (best && best.parentElement && best.parentElement.tagName !== "HEADER" && best.parentElement.tagName !== "BODY") {
      var parentText = norm(best.parentElement.textContent || "");
      if (parentText.indexOf("gestion de viajes") >= 0 || parentText.length > 1600) break;
      if (parentText.indexOf("dashboard") < 0 || parentText.indexOf("conciliacion") < 0) break;
      best = best.parentElement;
    }
    return best;
  }

  function installChrome() {
    var path = here();
    var chrome = document.querySelector('[data-sol-shell="chrome"]');
    if (!chrome) {
      chrome = document.createElement("header");
      chrome.setAttribute("data-sol-shell", "chrome");
      chrome.className = "bg-white border-b border-slate-200 sticky top-0 z-50";
      chrome.innerHTML =
        '<div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">' +
        '<div class="flex items-center justify-between h-16 gap-4">' +
        '<div class="flex items-center gap-6 min-w-0">' +
        '<a class="flex items-center gap-2.5 shrink-0" href="/" target="_parent">' +
        '<div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm ring-2 ring-indigo-100 font-black text-lg">E</div>' +
        '<div class="flex flex-col">' +
        '<span class="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">EMPLIADOS</span>' +
        '<span class="text-[10px] uppercase font-bold tracking-widest text-indigo-600 leading-tight">Logistics Cloud</span>' +
        "</div></a>" +
        '<div class="relative w-80 hidden md:block">' +
        '<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><span class="material-symbols-outlined text-base">search</span></div>' +
        '<input class="w-full pl-9 pr-12 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-700 placeholder-slate-400 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium outline-none" placeholder="Buscar remito, chofer o patente... ⌘K" type="text"/>' +
        '<div class="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"><kbd class="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400 shadow-xs">⌘K</kbd></div>' +
        "</div></div>" +
        '<nav data-sol-shell="top" class="flex items-center space-x-1 overflow-x-auto"></nav>' +
        '<div class="flex items-center gap-4 shrink-0">' +
        '<div class="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[11px] font-medium">' +
        '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>' +
        "<span>Sistemas activos</span></div>" +
        '<button class="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" type="button" title="Notificaciones operativas">' +
        '<span class="material-symbols-outlined text-lg">notifications</span>' +
        '<span class="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">5</span>' +
        "</button>" +
        '<div class="flex items-center gap-2.5 pl-2 border-l border-slate-200">' +
        '<div class="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center ring-2 ring-indigo-100">GD</div>' +
        '<div class="hidden lg:flex flex-col text-left"><span class="text-xs font-bold text-slate-900 leading-tight">Gonzalo Demo</span><span class="text-[10px] text-slate-400 font-medium leading-tight">Administrador</span></div>' +
        '<span class="material-symbols-outlined text-slate-400 text-xs hidden lg:block">expand_more</span>' +
        "</div></div></div></div>";
      document.body.insertBefore(chrome, document.body.firstChild);
    }
    var top = chrome.querySelector('[data-sol-shell="top"]');
    if (top) {
      top.className = "flex items-center space-x-1 overflow-x-auto";
      top.innerHTML = TOP_LINKS.map(function (item) {
        return linkHtml(item, isActive(item.href, path), false);
      }).join("");
      top.querySelectorAll("a").forEach(bind);
    }

    var agents = document.querySelector('[data-sol-shell="agents"]');
    if (agents && !chrome.contains(agents)) parkAfter(agents, chrome);
    var finance = document.querySelector('[data-sol-shell="finance"]') || financeRow();
    if (finance) {
      finance.setAttribute("data-sol-shell", "finance");
      parkAfter(finance, agents || chrome);
    }

    document.querySelectorAll('[data-sol-shell="top"]').forEach(function (el) {
      if (!chrome.contains(el)) el.style.display = "none";
    });
    document.querySelectorAll("header").forEach(function (header) {
      if (header === chrome) return;
      if (header.querySelector("[data-sol-shell='agents'], [data-sol-shell='finance']")) return;
      header.style.display = "none";
    });
    document.querySelectorAll("nav").forEach(function (nav) {
      if (chrome.contains(nav) || nav.closest("main, footer")) return;
      if (nav.getAttribute("data-sol-shell") === "agents") return;
      if (nav.querySelector("[data-sol-shell='agents'], [data-sol-shell='finance']")) return;
      var text = norm(nav.textContent || "");
      if (text.indexOf("torre de control") >= 0 || text.indexOf("agente") >= 0) nav.style.display = "none";
    });
  }

  function paintShell() {
    unifyShell();
    installChrome();
  }

  document.querySelectorAll("a, button").forEach(bind);
  paintShell();
  injectFinanzas();
  decorateMenus();
  wireHeaderSearch();
  document.addEventListener("DOMContentLoaded", paintShell);
})();
