/**
 * Chat desk de Finanzas (mismo UI que Destinos/Remitos vía desk-agent-chat.js).
 * Modo local: responde con resumen real de /backend/api/finanzas/resumen cuando hay datos.
 */
(function (global) {
  var AVISO_SIN_AGENTE =
    "Puedo orientarte sobre este módulo de Finanzas. " +
    "Todavía no ejecuto cobros ni envíos de WhatsApp desde el chat — usá las acciones de la pantalla.";

  function fetchResumen() {
    return fetch("/backend/api/finanzas/resumen", { credentials: "include" })
      .then(function (r) {
        return r.json().catch(function () {
          return null;
        }).then(function (data) {
          if (!r.ok) return null;
          return data;
        });
      })
      .catch(function () {
        return null;
      });
  }

  function money(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return "—";
    try {
      return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
    } catch (_) {
      return "$ " + String(Math.round(v));
    }
  }

  function summarize(resumen, q) {
    if (!resumen || typeof resumen !== "object") {
      return AVISO_SIN_AGENTE;
    }
    var fold = String(q || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    var lines = [];
    if (resumen.carteraAbierta != null || resumen.totalCartera != null) {
      lines.push("Cartera abierta: " + money(resumen.carteraAbierta ?? resumen.totalCartera));
    }
    if (resumen.vencidas != null || resumen.facturasVencidas != null) {
      lines.push("Facturas vencidas: " + String(resumen.vencidas ?? resumen.facturasVencidas));
    }
    if (resumen.clientesConSaldo != null) {
      lines.push("Clientes con saldo: " + String(resumen.clientesConSaldo));
    }
    if (resumen.cobradoMes != null) {
      lines.push("Cobrado del mes: " + money(resumen.cobradoMes));
    }
    if (!lines.length) {
      var keys = Object.keys(resumen).slice(0, 8);
      if (keys.length) {
        lines.push("Resumen disponible (" + keys.join(", ") + "). Pedime un dato concreto (cartera, vencidas, cobrado).");
      }
    }
    if (fold.indexOf("vencid") >= 0 && (resumen.vencidas != null || resumen.facturasVencidas != null)) {
      return "Hay " + String(resumen.vencidas ?? resumen.facturasVencidas) + " factura(s) vencida(s). " + AVISO_SIN_AGENTE;
    }
    if (lines.length) {
      return lines.join("\n") + "\n\n" + AVISO_SIN_AGENTE;
    }
    return AVISO_SIN_AGENTE;
  }

  function handler(agentId) {
    return function (q) {
      return fetchResumen().then(function (resumen) {
        return summarize(resumen, q);
      });
    };
  }

  global.SolDeskChatLocal = global.SolDeskChatLocal || {};
  ["finanzas", "clientes", "facturas", "cobranzas", "conciliacion", "comunicacion"].forEach(function (id) {
    global.SolDeskChatLocal[id] = handler(id);
  });
})(window);
