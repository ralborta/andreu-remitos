(function () {
  var ROUTES = {
    "torre-de-control": "/",
    torre: "/",
    monitor: "/monitor",
    "monitor-flota": "/monitor",
    whatsapp: "/contactos",
    contactos: "/contactos",
    metricas: "/backoffice",
    "gestion-de-viajes": "/agentes/viajes",
    viajes: "/agentes/viajes",
    "tracking-express": "/agentes/tracking",
    tracking: "/agentes/tracking",
    remitos: "/agentes/remitos",
    destinos: "/agentes/destinos",
    incidencias: "/agentes/incidencias",
    rendicion: "/agentes/rendicion",
    eta: "/agentes/eta",
    "eta-predictivo": "/agentes/eta",
    analitica: "/agentes/analitica",
    "analitica-flota": "/agentes/analitica",
    "chat-central": "/agentes/commander",
    commander: "/agentes/commander",
    configuracion: "/parametros",
    parametros: "/parametros",
    finanzas: "/finanzas",
    "pop-pod": "/agentes/pod",
    pod: "/agentes/pod",
    reclamos: "/agentes/reclamos",
  };

  function go(href) {
    try {
      window.top.location.href = href;
    } catch {
      window.location.href = href;
    }
  }

  function routeFor(a) {
    var path = (a.getAttribute("data-path") || "").toLowerCase().trim();
    if (ROUTES[path]) return ROUTES[path];
    var href = a.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    return null;
  }

  document.querySelectorAll("a").forEach(function (a) {
    var href = routeFor(a);
    if (!href) return;
    a.setAttribute("href", href);
    a.setAttribute("target", "_parent");
    a.addEventListener("click", function (e) {
      e.preventDefault();
      go(href);
    });
  });
})();
