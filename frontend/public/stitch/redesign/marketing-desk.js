/**
 * Chat desk de Marketing — un handler por pantalla, solo su dominio.
 */
(function (global) {
  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function api(path) {
    return fetch("/backend" + path, { credentials: "include" })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          if (!r.ok) return null;
          return data;
        });
      })
      .catch(function () { return null; });
  }

  var OFFTOPIC =
    /(viaje|remito|destino|incidencia|factura|cobranza|finanzas|chofer|eta|pod|conciliacion)/;

  function refuse(label) {
    return (
      "Solo atiendo " +
      label +
      " de Marketing. Para operaciones o finanzas usá el chat de ese módulo."
    );
  }

  function asArr(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function overview() {
    return api("/api/marketing/overview");
  }

  function handler(agentId, label, answerFn) {
    return function (q) {
      if (OFFTOPIC.test(fold(q))) return Promise.resolve(refuse(label));
      return Promise.resolve(answerFn(q)).then(function (text) {
        return text || "Todavía no tengo datos de " + label + ".";
      });
    };
  }

  global.SolDeskChatLocal = global.SolDeskChatLocal || {};

  global.SolDeskChatLocal.marketing = handler("marketing", "el dashboard de Marketing", function () {
    return overview().then(function (ov) {
      if (!ov) return "No pude leer el overview de Marketing.";
      var camps = asArr(ov.campaigns || ov.campañas || ov, "campaigns");
      var emails = asArr(ov.emails, "emails");
      var offers = asArr(ov.offers || ov.ofertas, "offers");
      return (
        "Marketing — resumen:\n" +
        "· Campañas: " +
        (ov.campaignsCount != null ? ov.campaignsCount : camps.length) +
        "\n· Emails: " +
        (ov.emailsCount != null ? ov.emailsCount : emails.length) +
        "\n· Ofertas: " +
        (ov.offersCount != null ? ov.offersCount : offers.length) +
        (ov.kpis ? "\n· KPIs disponibles en Analítica." : "")
      );
    });
  });

  global.SolDeskChatLocal["marketing-estrategia"] = handler(
    "marketing-estrategia",
    "el Planificador de campañas",
    function () {
      return overview().then(function (ov) {
        var camps = asArr(ov && (ov.campaigns || ov.campañas), "campaigns");
        if (!camps.length && ov && typeof ov === "object") {
          return "Planificador: pedime propuestas o el estado de campañas desde esta pantalla.";
        }
        var borrador = camps.filter(function (c) {
          return String(c.status || c.estado || "").toLowerCase().indexOf("borrador") >= 0 ||
            String(c.status || "").toLowerCase() === "draft";
        });
        return (
          "Planificador: " +
          camps.length +
          " campañas · en borrador: " +
          borrador.length +
          ".\nAcá se proponen y organizan campañas; no envío emails ni mido Rankear."
        );
      });
    }
  );

  global.SolDeskChatLocal["marketing-email"] = handler("marketing-email", "Email marketing", function () {
    return overview().then(function (ov) {
      var emails = asArr(ov && ov.emails, "emails");
      var draft = emails.filter(function (e) {
        return String(e.status || e.estado || "").toLowerCase().indexOf("borrador") >= 0 ||
          String(e.status || "").toLowerCase() === "draft";
      });
      return (
        "Email: " +
        emails.length +
        " piezas · borradores: " +
        draft.length +
        ".\nSolo email marketing; campañas/ofertas están en sus pantallas."
      );
    });
  });

  global.SolDeskChatLocal["marketing-contenidos"] = handler(
    "marketing-contenidos",
    "Contenidos",
    function () {
      return api("/api/marketing/contenidos").then(function (data) {
        var rows = asArr(data, "items");
        return "Contenidos: " + (rows.length || (data && data.total) || 0) + " ítems en cola/publicados.";
      });
    }
  );

  global.SolDeskChatLocal["marketing-ofertas"] = handler("marketing-ofertas", "Promociones / ofertas", function () {
    return overview().then(function (ov) {
      var offers = asArr(ov && (ov.offers || ov.ofertas), "offers");
      return "Promociones: " + offers.length + " ofertas. Acá se crean/activan; no planifico campañas ni Rankear.";
    });
  });

  global.SolDeskChatLocal["marketing-visibilidad"] = handler(
    "marketing-visibilidad",
    "Rankear / visibilidad",
    function () {
      return api("/api/marketing/visibilidad").then(function (data) {
        if (!data) return "No pude leer Rankear todavía.";
        var opps = asArr(data.opportunities || data.oportunidades, "opportunities");
        return (
          "Rankear: " +
          (data.score != null ? "score " + data.score + " · " : "") +
          opps.length +
          " oportunidades."
        );
      });
    }
  );

  global.SolDeskChatLocal["marketing-difusion"] = handler("marketing-difusion", "Menciones / difusión", function () {
    return api("/api/marketing/difusion").then(function (data) {
      var rows = asArr(data, "items");
      return "Menciones: " + (rows.length || (data && data.total) || 0) + " registradas.";
    });
  });

  global.SolDeskChatLocal["marketing-resultados"] = handler(
    "marketing-resultados",
    "Analítica de Marketing",
    function () {
      return api("/api/marketing/resultados").then(function (data) {
        if (!data) return "Sin resultados de marketing todavía.";
        var keys = Object.keys(data).slice(0, 6);
        return "Analítica Marketing — campos: " + keys.join(", ") + ". Pedime un KPI concreto de esta pantalla.";
      });
    }
  );
})(window);
