/**
 * Inserta previews HD de cada pantalla Stitch en las cards del hub.
 */
(function () {
  var TITLE_TO_SLUG = {
    "Torre de Control": "torre",
    "Monitor de Servicios": "monitor",
    Monitor: "monitor",
    "Tracking Express": "tracking",
    "WhatsApp Contactos": "whatsapp",
    WhatsApp: "whatsapp",
    "Gestión de Viajes": "viajes",
    "Remitos TransitOne": "remitos",
    Remitos: "remitos",
    Destinos: "destinos",
    "Confirmación de Destinos": "destinos",
    Incidencias: "incidencias",
    Rendición: "rendicion",
    "Rendición de Viajes": "rendicion",
    ETA: "eta",
    "ETA y Notificación Proactiva": "eta",
    "POP/POD": "pod",
    "Evidencias de Transporte POP/POD": "pod",
    Reclamos: "reclamos",
    "Reclamos Logísticos": "reclamos",
    Analítica: "analitica",
    "Analítica de Performance": "analitica",
    Métricas: "metricas",
    "Métricas Operativas y Backoffice": "metricas",
  };

  function slugFor(title) {
    if (!title) return null;
    if (TITLE_TO_SLUG[title]) return TITLE_TO_SLUG[title];
    for (var k in TITLE_TO_SLUG) {
      if (title.indexOf(k) !== -1) return TITLE_TO_SLUG[k];
    }
    return null;
  }

  document.querySelectorAll(".screen-card").forEach(function (card) {
    if (card.querySelector("img.sol-screen-thumb")) return;
    var h3 = card.querySelector("h3");
    var title = (h3 && h3.textContent ? h3.textContent : "").trim();
    var slug = slugFor(title);
    if (!slug) return;

    var wrap = document.createElement("div");
    wrap.className =
      "mb-3 -mx-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm";
    var img = document.createElement("img");
    img.className = "sol-screen-thumb block h-44 w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]";
    img.alt = title;
    img.loading = "lazy";
    img.src = "/stitch-screens/" + slug + ".png";
    img.onerror = function () {
      wrap.remove();
    };
    wrap.appendChild(img);

    var body = card.children[1] || card;
    var insertBefore = body.querySelector(".flex.items-start") || body.firstChild;
    if (insertBefore && insertBefore.parentNode) {
      insertBefore.parentNode.insertBefore(wrap, insertBefore);
    } else {
      card.insertBefore(wrap, card.firstChild.nextSibling);
    }

    card.style.cursor = "pointer";
  });
})();
