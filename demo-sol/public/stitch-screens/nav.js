/**
 * Menú interactivo entre pantallas Stitch (proyecto Interactive Navigation Menu).
 * Enlaza sidebar + cards del hub con las réplicas HTML exportadas vía MCP.
 */
(function () {
  var MAP = {
    "Torre de Control": "torre",
    Monitor: "monitor",
    "Tracking Express": "tracking",
    WhatsApp: "whatsapp",
    Métricas: "metricas",
    "Gestión de Viajes": "viajes",
    Remitos: "remitos",
    "Remitos TransitOne": "remitos",
    Destinos: "destinos",
    "Confirmación de Destinos": "destinos",
    Incidencias: "incidencias",
    Rendición: "rendicion",
    "Rendición de Viajes": "rendicion",
    ETA: "eta",
    "ETA y Notificación": "eta",
    "POP/POD": "pod",
    "Evidencias": "pod",
    Reclamos: "reclamos",
    Analítica: "analitica",
    "Analítica de Performance": "analitica",
    "Chat Central": "torre",
    Usuarios: "metricas",
    "Parámetros maestros": "metricas",
    "Menú Interactivo": "menu",
    "Menú interactivo": "menu",
    Menú: "menu",
  };

  var HASH = {
    torre: "torre",
    monitor: "monitor",
    tracking: "tracking",
    "tracking-express": "tracking",
    whatsapp: "whatsapp",
    metricas: "metricas",
    viajes: "viajes",
    remitos: "remitos",
    "remitos-resumen": "remitos",
    "remitos-planilla": "remitos",
    "remitos-subir": "remitos",
    destinos: "destinos",
    incidencias: "incidencias",
    rendicion: "rendicion",
    eta: "eta",
    pod: "pod",
    reclamos: "reclamos",
    analitica: "analitica",
    "chat-central": "torre",
    usuarios: "metricas",
    parametros: "metricas",
    menu: "menu",
  };

  function currentSlug() {
    var m = location.pathname.match(/\/stitch-screens\/([^/.]+)/);
    return m ? m[1] : "menu";
  }

  function go(slug) {
    if (!slug) return;
    var q = location.search || "";
    var next = "/stitch-screens/" + slug + ".html" + q;
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "sol-demo-nav", slug: slug }, "*");
      } catch (e) {}
    }
    if (currentSlug() === slug) return;
    location.href = next;
  }

  function slugFromHref(href) {
    if (!href) return null;
    var hash = href.replace(/^.*#/, "").replace(/^\//, "");
    if (HASH[hash]) return HASH[hash];
    if (HASH[href.replace("#", "")]) return HASH[href.replace("#", "")];
    return null;
  }

  function labelOf(el) {
    var h3 = el.querySelector && el.querySelector("h3");
    if (h3) {
      var ht = (h3.textContent || "").trim();
      if (ht) return ht;
    }
    var spans = el.querySelectorAll ? el.querySelectorAll("span") : [];
    for (var i = 0; i < spans.length; i++) {
      var t = (spans[i].textContent || "").trim();
      if (MAP[t]) return t;
    }
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function slugFromLabel(label) {
    if (!label) return null;
    if (MAP[label]) return MAP[label];
    for (var key in MAP) {
      if (label.indexOf(key) !== -1) return MAP[key];
    }
    return null;
  }

  document.addEventListener(
    "click",
    function (ev) {
      var a = ev.target.closest && ev.target.closest("a");
      if (a) {
        var fromHref = slugFromHref(a.getAttribute("href") || "");
        var fromLabel = slugFromLabel(labelOf(a));
        var slug = fromHref || fromLabel;
        if (slug) {
          ev.preventDefault();
          ev.stopPropagation();
          go(slug);
          return;
        }
      }
      var card = ev.target.closest && ev.target.closest(".screen-card");
      if (card) {
        var cslug = slugFromLabel(labelOf(card));
        if (cslug) {
          ev.preventDefault();
          ev.stopPropagation();
          go(cslug);
        }
      }
    },
    true,
  );

  var slug = currentSlug();
  document.querySelectorAll("aside a, nav a").forEach(function (a) {
    var target = slugFromHref(a.getAttribute("href") || "") || slugFromLabel(labelOf(a));
    if (!target) return;
    if (target === slug) {
      a.style.background = "rgba(243,232,255,0.7)";
      a.style.color = "#7c3aed";
      a.style.fontWeight = "600";
    }
  });
})();
