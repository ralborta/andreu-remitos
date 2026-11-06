/**
 * Chat desk de Finanzas — un handler por pantalla, solo su dominio.
 * Modo local vía SolDeskChatLocal[agentId].
 */
(function (global) {
  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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

  var OFFTOPIC = {
    finanzas: /(viaje|remito|destino|incidencia|eta|pod|chofer|camión|camion|marketing|campaña|campana)/,
    clientes: /(viaje|remito|destino|incidencia|ocr|pago a proveedor|pagar factura|marketing)/,
    facturas: /(viaje|remito|destino|incidencia|cobrar cliente|reclamo whatsapp|marketing|campaña|campana|cartera a cobrar)/,
    "facturas-cobro": /(viaje|remito|destino|incidencia|ocr|factura a pagar|proveedor pdf|marketing)/,
    cobranzas: /(viaje|remito|destino|incidencia|ocr|factura a pagar|proveedor|marketing|conciliar extracto)/,
    conciliacion: /(viaje|remito|destino|incidencia|ocr|whatsapp|reclamo|marketing)/,
    comunicacion: /(viaje|remito|destino|incidencia|ocr|conciliar|marketing)/,
  };

  var SCOPE = {
    finanzas: "el dashboard de Finanzas (cartera, vencidas, cobrado)",
    clientes: "Clientes de Finanzas (saldos y vencidos)",
    facturas: "Facturas de pago / CxP (OCR → sistema → ERP)",
    "facturas-cobro": "Facturas de cobranza / CxC (cartera e historial por factura)",
    cobranzas: "Gestión de cobranza (reclamos, WhatsApp, promesas)",
    conciliacion: "Conciliación de cobros",
    comunicacion: "Comunicación / envío de mensajes de cobranza",
  };

  function refuse(agentId) {
    return (
      "Solo atiendo " +
      (SCOPE[agentId] || "este módulo de Finanzas") +
      ". Para otros temas usá la pantalla o el chat de ese módulo."
    );
  }

  function isOfftopic(agentId, q) {
    var re = OFFTOPIC[agentId];
    return re ? re.test(fold(q)) : false;
  }

  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.facturas)) return data.facturas;
    if (data && Array.isArray(data.cobros)) return data.cobros;
    return [];
  }

  function resumenLines(resumen) {
    if (!resumen || typeof resumen !== "object") return [];
    var lines = [];
    var cartera = resumen.cartera_abierta ?? resumen.carteraAbierta ?? resumen.totalCartera;
    var vencidas = resumen.vencidas ?? resumen.facturasVencidas;
    var clientes = resumen.clientes_con_saldo ?? resumen.clientesConSaldo;
    var cobrado = resumen.cobrado_mes ?? resumen.cobradoMes;
    if (cartera != null) lines.push("Cartera abierta: " + money(cartera));
    if (vencidas != null) lines.push("Facturas vencidas: " + String(vencidas));
    if (clientes != null) lines.push("Clientes con saldo: " + String(clientes));
    if (cobrado != null) lines.push("Cobrado del mes: " + money(cobrado));
    return lines;
  }

  function handlerFinanzas(q) {
    if (isOfftopic("finanzas", q)) return Promise.resolve(refuse("finanzas"));
    return api("/api/finanzas/resumen").then(function (resumen) {
      var lines = resumenLines(resumen);
      if (!lines.length) {
        return "Todavía no tengo un resumen cargado del dashboard. Pedime cartera, vencidas o cobrado del mes cuando haya datos.";
      }
      var f = fold(q);
      if (f.indexOf("vencid") >= 0) {
        return lines.filter(function (l) { return /vencid/i.test(l); }).join("\n") || lines.join("\n");
      }
      if (f.indexOf("cobrad") >= 0) {
        return lines.filter(function (l) { return /Cobrado/i.test(l); }).join("\n") || lines.join("\n");
      }
      return "Resumen del dashboard:\n" + lines.join("\n");
    });
  }

  function handlerClientes(q) {
    if (isOfftopic("clientes", q)) return Promise.resolve(refuse("clientes"));
    return Promise.all([api("/api/finanzas/resumen"), api("/api/finanzas/facturas?tipo=cobrar&limit=100")]).then(function (pair) {
      var resumen = pair[0];
      var rows = asList(pair[1]);
      var by = {};
      rows.forEach(function (r) {
        var k = String(r.razon_social || r.cuit_emisor || r.cuit || "Sin nombre");
        if (!by[k]) by[k] = { name: k, saldo: 0, n: 0 };
        by[k].saldo += Number(r.saldo != null ? r.saldo : r.monto) || 0;
        by[k].n += 1;
      });
      var ranked = Object.keys(by)
        .map(function (k) { return by[k]; })
        .sort(function (a, b) { return b.saldo - a.saldo; });
      var lines = resumenLines(resumen);
      var top = ranked.slice(0, 5).map(function (c) {
        return "· " + c.name + " — " + money(c.saldo) + " (" + c.n + " fact.)";
      });
      if (!top.length && !lines.length) {
        return "No hay clientes con cartera cargada todavía.";
      }
      return (
        (lines.length ? lines.join("\n") + "\n\n" : "") +
        (top.length ? "Top clientes con saldo:\n" + top.join("\n") : "")
      ).trim();
    });
  }

  function handlerFacturasPago(q) {
    if (isOfftopic("facturas", q)) return Promise.resolve(refuse("facturas"));
    return api("/api/finanzas/facturas?tipo=pagar&limit=100").then(function (data) {
      var rows = asList(data);
      var f = fold(q);
      var pendientes = rows.filter(function (r) {
        return String(r.estado || "").toLowerCase() !== "confirmada";
      });
      if (!rows.length) {
        return "No hay Facturas de pago cargadas. En CxP entran por email / WhatsApp / repo / upload → OCR → sistema → ERP.";
      }
      if (f.indexOf("pendient") >= 0 || f.indexOf("confirmar") >= 0) {
        return "Pendientes de confirmar: " + pendientes.length + " de " + rows.length + " facturas a pagar.";
      }
      if (f.indexOf("ultima") >= 0 || f.indexOf("últim") >= 0 || f.indexOf("ultim") >= 0) {
        return (
          "Últimas facturas a pagar:\n" +
          rows.slice(0, 5).map(function (r) {
            return "· " + (r.numero || r.id) + " — " + (r.razon_social || "—") + " — " + money(r.monto);
          }).join("\n")
        );
      }
      return (
        "Facturas de pago (CxP): " +
        rows.length +
        " en sistema (" +
        pendientes.length +
        " pendientes de confirmar).\nSolo digitalizo y empujo al ERP; no gestiono cobranza."
      );
    });
  }

  function handlerFacturasCobro(q) {
    if (isOfftopic("facturas-cobro", q)) return Promise.resolve(refuse("facturas-cobro"));
    return api("/api/finanzas/facturas?tipo=cobrar&limit=100").then(function (data) {
      var rows = asList(data);
      var f = fold(q);
      var vencidas = rows.filter(function (r) {
        var st = String(r.estado_cobranza || r.estado || "").toLowerCase();
        return st.indexOf("vencid") >= 0 || Number(r.dias_vencido || 0) > 0;
      });
      if (!rows.length) {
        return "No hay Facturas de cobranza (CxC) cargadas. Entran desde ERP / Excel o alta manual.";
      }
      if (f.indexOf("vencid") >= 0) {
        return "Facturas a cobrar vencidas: " + vencidas.length + " de " + rows.length + ".";
      }
      if (f.indexOf("historial") >= 0 || f.indexOf("contacto") >= 0) {
        return (
          "Cartera CxC con " +
          rows.length +
          " facturas. El historial de contactos/gestiones se ve factura por factura en esta pantalla (no en Gestión de cobranza)."
        );
      }
      var cartera = rows.reduce(function (acc, r) {
        return acc + (Number(r.saldo != null ? r.saldo : r.monto) || 0);
      }, 0);
      return (
        "Facturas de cobranza (CxC): " +
        rows.length +
        " · cartera aprox. " +
        money(cartera) +
        " · vencidas: " +
        vencidas.length +
        ".\nEsto es la cartera/historial; la operativa de reclamos está en Gestión de cobranza."
      );
    });
  }

  function handlerCobranzas(q) {
    if (isOfftopic("cobranzas", q)) return Promise.resolve(refuse("cobranzas"));
    return api("/api/finanzas/facturas?tipo=cobrar&limit=100").then(function (data) {
      var rows = asList(data);
      var conPromesa = rows.filter(function (r) {
        return r.promesa_pago || r.promesa || String(r.estado_cobranza || "").toLowerCase().indexOf("promesa") >= 0;
      });
      return (
        "Gestión de cobranza: operativa de reclamos / WhatsApp / promesas sobre la cartera CxC.\n" +
        "Facturas en seguimiento: " +
        rows.length +
        " · con promesa visible: " +
        conPromesa.length +
        ".\nNo soy la pantalla de Facturas de cobranza (cartera); acá gestionamos el cobro."
      );
    });
  }

  function handlerConciliacion(q) {
    if (isOfftopic("conciliacion", q)) return Promise.resolve(refuse("conciliacion"));
    return api("/api/finanzas/cobros?limit=100").then(function (data) {
      var rows = asList(data);
      var pend = rows.filter(function (r) {
        var st = String(r.estado || "").toLowerCase();
        return !st || st.indexOf("concili") < 0 && st.indexOf("imput") < 0;
      });
      if (!rows.length) {
        return "No hay cobros de pasarela para conciliar todavía.";
      }
      return (
        "Conciliación: " +
        rows.length +
        " cobros · pendientes de imputar (aprox.): " +
        pend.length +
        ".\nSolo emparejo cobros con facturas a cobrar; no hago OCR ni reclamos."
      );
    });
  }

  function handlerComunicacion(q) {
    if (isOfftopic("comunicacion", q)) return Promise.resolve(refuse("comunicacion"));
    return Promise.resolve(
      "Comunicación de cobranza: acá se arman y envían recordatorios/mensajes.\n" +
        "No ejecuto el envío desde el chat — usá las acciones de la pantalla. " +
        "Para cartera/historial andá a Facturas de cobranza; para reclamos masivos, a Gestión de cobranza."
    );
  }

  global.SolDeskChatLocal = global.SolDeskChatLocal || {};
  global.SolDeskChatLocal.finanzas = handlerFinanzas;
  global.SolDeskChatLocal.clientes = handlerClientes;
  global.SolDeskChatLocal.facturas = handlerFacturasPago;
  global.SolDeskChatLocal["facturas-cobro"] = handlerFacturasCobro;
  global.SolDeskChatLocal.cobranzas = handlerCobranzas;
  global.SolDeskChatLocal.conciliacion = handlerConciliacion;
  global.SolDeskChatLocal.comunicacion = handlerComunicacion;
})(window);
