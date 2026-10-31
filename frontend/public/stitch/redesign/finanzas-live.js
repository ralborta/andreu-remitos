/**
 * Finanzas Stitch — 100% operable con datos de prueba (API demo + estado local).
 * Menú ⋮, detalle, filtros, búsqueda, comunicar/conciliar/cobrar/pagar en modo demo.
 */
(function () {
  var STORE_KEY = "sol-finanzas-demo-v1";
  var filter = "todas";
  var query = "";
  var live = false;
  var apiRows = [];
  var cobros = [];
  var selectedId = null;
  var selectedClienteKey = null;
  var menuEl = null;
  var drawerEl = null;
  var fichaEl = null;

  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

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
    if (file.indexOf("finanzas-clientes") === 0 || p.indexOf("/finanzas/clientes") === 0) return "clientes";
    if (file.indexOf("finanzas-facturas") === 0 || p.indexOf("/finanzas/facturas/pagos") === 0) return "facturas";
    if (file.indexOf("finanzas-cobranza") === 0 || p.indexOf("/cobranzas") >= 0) return "cobranza";
    if (file.indexOf("finanzas-conciliacion") === 0 || p.indexOf("/conciliacion") >= 0) return "conciliacion";
    if (file.indexOf("finanzas-comunicacion") === 0 || p.indexOf("/comunicacion") >= 0) return "comunicacion";
    return "dashboard";
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveStore(st) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(st || {}));
    } catch (e) {}
  }

  function patchLocal(id, patch) {
    var st = loadStore();
    st.facturas = st.facturas || {};
    st.facturas[id] = Object.assign({}, st.facturas[id] || {}, patch || {}, { updated_at: new Date().toISOString() });
    saveStore(st);
    return st.facturas[id];
  }

  function localOf(row) {
    var st = loadStore();
    return Object.assign({}, row || {}, (st.facturas && st.facturas[row && row.id]) || {});
  }

  function toast(msg, tone) {
    var el = document.getElementById("sol-fin-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sol-fin-toast";
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
    }, 3400);
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

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", credentials: "include" };
    if (opts.body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = opts.body;
    }
    return fetch("/backend" + path, init).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!r.ok) {
            var err = new Error((data && (data.error || data.message)) || "HTTP " + r.status);
            err.status = r.status;
            throw err;
          }
          return data;
        });
    });
  }

  function saldo(row) {
    return Math.max(0, Number(row.monto || 0) - Number(row.monto_aplicado || 0));
  }

  function estadoFactura(row) {
    row = localOf(row);
    if (row.demo_flag === "discrepancia") return { key: "discrepancias", label: "Discrepancia", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    if (row.demo_flag === "observada") return { key: "pendientes", label: "Observada", cls: "bg-slate-100 text-slate-700 border-slate-200" };
    var s = saldo(row);
    var aplicado = Number(row.monto_aplicado || 0);
    // Al día / Pagada = sin saldo (no confundir con “aún no vence”)
    if (s <= 0.009 || row.estado === "saldada" || row.demo_pagada) {
      return {
        key: "al_dia",
        label: row.tipo === "pagar" ? "Pagada" : "Al día",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    var vto = row.fecha_vto ? new Date(row.fecha_vto) : null;
    var now = new Date();
    var vencida = vto && !isNaN(vto) && vto < now;
    // Parcial: cobro/pago imputado pero sigue con saldo
    if (aplicado > 0.009 || row.demo_comunicada) {
      return {
        key: "en_gestion",
        label: row.demo_comunicada && aplicado <= 0.009 ? "En gestión" : "Parcial",
        cls: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (vencida) return { key: "vencidas", label: "Vencida", cls: "bg-red-50 text-red-700 border-red-200" };
    // Con saldo y no vencida → por vencer (corriente)
    return { key: "por_vencer", label: "Por vencer", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  }

  function findRow(id) {
    for (var i = 0; i < apiRows.length; i++) if (apiRows[i].id === id) return localOf(apiRows[i]);
    return null;
  }

  function clienteKeyOf(row) {
    if (!row) return "";
    if (row._cliente_key) return row._cliente_key;
    var cuit = String(row.cuit || row.cuit_emisor || "").replace(/\D/g, "");
    var rz = String(row.razon_social || "").trim();
    return cuit || fold(rz) || String(row.id || "");
  }

  function rowsOfCliente(key) {
    var k = String(key || "");
    if (!k) return [];
    return apiRows
      .map(localOf)
      .filter(function (r) {
        return clienteKeyOf(r) === k;
      });
  }

  function buildClienteProfile(keyOrRow) {
    var key = typeof keyOrRow === "string" ? keyOrRow : clienteKeyOf(keyOrRow);
    var rows = rowsOfCliente(key);
    if (!rows.length && keyOrRow && typeof keyOrRow === "object") {
      rows = [localOf(keyOrRow)];
      key = clienteKeyOf(rows[0]);
    }
    var first = rows[0] || {};
    var saldoTotal = 0;
    var abiertas = 0;
    var vencidas = 0;
    var aplicadas = 0;
    var facturado = 0;
    var ultimoPago = null;
    var plazos = [];
    var timeline = [];
    var today = new Date();
    rows.forEach(function (r) {
      var s = saldo(r);
      var monto = Number(r.monto || 0);
      var aplicado = Number(r.monto_aplicado || 0);
      facturado += monto;
      aplicadas += aplicado;
      saldoTotal += s;
      if (s > 0.009) abiertas += 1;
      var vto = r.fecha_vto ? new Date(r.fecha_vto) : null;
      if (s > 0.009 && vto && !isNaN(vto) && vto < today) vencidas += 1;
      if (vto && r.fecha) {
        var em = new Date(r.fecha);
        if (!isNaN(em) && !isNaN(vto)) plazos.push(Math.round((vto - em) / 86400000));
      }
      if (aplicado > 0) {
        var payAt = r.updated_at || r.fecha;
        if (payAt && (!ultimoPago || payAt > ultimoPago)) ultimoPago = payAt;
      }
      (r.pasos || []).forEach(function (p) {
        timeline.push({
          at: p.at || r.updated_at || r.fecha || "",
          label: p.label || "Evento",
          agente: p.agente || "",
          canal: p.canal || "",
          factura: r.numero || r.id,
          factura_id: r.id,
        });
      });
    });
    timeline.sort(function (a, b) {
      return String(b.at).localeCompare(String(a.at));
    });
    var plazoMedio =
      plazos.length > 0
        ? Math.round(plazos.reduce(function (a, b) {
            return a + b;
          }, 0) / plazos.length)
        : 30;
    var criticidad = vencidas >= 2 || saldoTotal > 1000000 ? "ALTA" : vencidas >= 1 || abiertas >= 2 ? "MEDIA" : "BAJA";
    return {
      key: key,
      razon_social: first.razon_social || "Cliente",
      cuit: first.cuit || first.cuit_emisor || "—",
      telefono: first.telefono || "",
      email: first.email || "",
      facturas: rows,
      metrics: {
        saldoPendiente: saldoTotal,
        facturado: facturado,
        aplicado: aplicadas,
        facturasTotal: rows.length,
        facturasAbiertas: abiertas,
        facturasVencidas: vencidas,
        plazoMedio: plazoMedio,
        ultimoPagoAt: ultimoPago,
        criticidad: criticidad,
      },
      timeline: timeline.slice(0, 20),
    };
  }

  function buildAiAnalisis(profile, mode) {
    var m = profile.metrics || {};
    var pagar = mode === "proveedor";
    var nombre = profile.razon_social || (pagar ? "El proveedor" : "El cliente");
    var keyPoints = [];
    var nextSteps = [];
    var sentiment = "neutral";
    var summary = "";
    if (m.facturasVencidas > 0) {
      sentiment = "negative";
      summary = pagar
        ? nombre +
          " tiene " +
          money(m.saldoPendiente) +
          " pendientes de pago, con " +
          m.facturasVencidas +
          " factura(s) vencida(s). Criticidad " +
          String(m.criticidad || "MEDIA").toLowerCase() +
          ": priorizar autorización de pago o renegociar fecha con el proveedor."
        : nombre +
          " concentra " +
          money(m.saldoPendiente) +
          " de saldo abierto, con " +
          m.facturasVencidas +
          " factura(s) vencida(s) sobre " +
          m.facturasAbiertas +
          " abierta(s). El riesgo de mora es " +
          String(m.criticidad || "MEDIA").toLowerCase() +
          "; conviene priorizar gestión comercial y acordar fecha cierta de pago.";
      keyPoints.push(m.facturasVencidas + " factura(s) en mora · saldo " + money(m.saldoPendiente));
      keyPoints.push("Plazo contractual medio ≈ " + m.plazoMedio + " días");
      if (profile.timeline && profile.timeline.length) {
        keyPoints.push("Última gestión: " + (profile.timeline[0].label || "sin detalle"));
      } else {
        keyPoints.push("Sin gestiones recientes registradas en el timeline");
      }
      if (pagar) {
        nextSteps.push("Autorizar pago de las facturas vencidas o pedir prórroga formal");
        nextSteps.push("Conciliar con extracto / OC-remito antes de liberar fondos");
        nextSteps.push("Avisar a mesa de pagos el impacto de caja de esta semana");
      } else {
        nextSteps.push("Contactar hoy por WhatsApp/email con detalle de facturas vencidas");
        nextSteps.push("Pedir promesa de pago con fecha y canal (transferencia / DEBIN)");
        nextSteps.push("Si no hay respuesta en 48 hs, escalar a intimación formal");
      }
    } else if (m.facturasAbiertas > 0) {
      sentiment = "neutral";
      summary = pagar
        ? nombre +
          " tiene " +
          m.facturasAbiertas +
          " factura(s) a pagar por " +
          money(m.saldoPendiente) +
          ", dentro de plazo. Programar autorización antes del vencimiento para evitar mora con el proveedor."
        : nombre +
          " tiene " +
          m.facturasAbiertas +
          " factura(s) abierta(s) por " +
          money(m.saldoPendiente) +
          ", todavía dentro de plazo. Cartera sana si se anticipa el recordatorio antes del vencimiento.";
      keyPoints.push("Saldo corriente " + money(m.saldoPendiente) + " · sin mora detectada");
      keyPoints.push((pagar ? "Plazo medio de pago ≈ " : "Plazo medio de cobro ≈ ") + m.plazoMedio + " días");
      keyPoints.push("Aplicado acumulado " + money(m.aplicado) + " de " + money(m.facturado));
      if (pagar) {
        nextSteps.push("Agendar autorización 2–3 días antes del vencimiento");
        nextSteps.push("Validar matching con remito/OC y retenciones");
        nextSteps.push("Confirmar CBU / medio de pago del proveedor");
      } else {
        nextSteps.push("Programar recordatorio suave 3–5 días antes del vencimiento");
        nextSteps.push("Confirmar contacto de cuentas a pagar actualizado");
        nextSteps.push("Ofrecer link DEBIN si el monto es operativo de un solo pago");
      }
    } else {
      sentiment = "positive";
      summary = pagar
        ? nombre +
          " no tiene saldo pendiente a pagar en la demo. Relación al día; monitorear próximas cargas OCR/AFIP."
        : nombre +
          " figura al día: no hay saldo pendiente en la cartera demo. Mantener relación comercial y monitorear nuevas emisiones.";
      keyPoints.push("Sin facturas abiertas en este momento");
      keyPoints.push("Histórico " + money(m.facturado));
      nextSteps.push(pagar ? "Mantener seguimiento pasivo de nuevas facturas del proveedor" : "Archivar gestiones abiertas y dejar seguimiento pasivo");
      nextSteps.push(pagar ? "Revisar al ingresar la próxima factura OCR" : "Revisar al emitir la próxima factura del cliente");
    }
    return {
      summary: summary,
      keyPoints: keyPoints,
      nextSteps: nextSteps,
      sentiment: sentiment,
      generatedAt: new Date().toISOString(),
    };
  }

  function criticidadBadge(c) {
    var map = {
      ALTA: "bg-rose-50 text-rose-700 border-rose-200",
      MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
      BAJA: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return map[c] || "bg-slate-50 text-slate-700 border-slate-200";
  }

  function fmtDate(v, withTime) {
    if (!v) return "—";
    var d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    try {
      return d.toLocaleString("es-AR", withTime ? undefined : { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (_) {
      return String(v).slice(0, withTime ? 16 : 10);
    }
  }

  function rowFromEl(el) {
    var tr = el && el.closest ? el.closest("tr[data-sol-fin-cliente], tr[data-sol-fin-id], tr") : null;
    if (!tr) return null;
    var ck = tr.getAttribute("data-sol-fin-cliente");
    if (ck) {
      var prof = buildClienteProfile(ck);
      return Object.assign({}, prof.facturas[0] || {}, {
        _cliente_key: ck,
        razon_social: prof.razon_social,
        cuit: prof.cuit,
        id: (prof.facturas[0] && prof.facturas[0].id) || ck,
      });
    }
    var id = tr.getAttribute("data-sol-fin-id");
    if (id) return findRow(id);
    return {
      id: null,
      numero: ((tr.querySelector("td:nth-child(2)") || {}).textContent || "").replace(/\s+/g, " ").trim(),
      razon_social: ((tr.querySelector("td:nth-child(3)") || {}).textContent || "").replace(/\s+/g, " ").trim(),
      _tr: tr,
    };
  }

  function closeMenu() {
    if (menuEl) menuEl.classList.add("hidden");
  }

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.id = "sol-fin-menu";
    menuEl.className = "hidden fixed z-[10040] w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-1 overflow-hidden";
    menuEl.setAttribute("role", "menu");
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function openMenu(anchor, row) {
    var menu = ensureMenu();
    selectedId = row && row.id ? row.id : null;
    var key = pageKey();
    var items = [];
    if (key === "facturas") {
      items = [
        { id: "ficha_proveedor", label: "Ver proveedor / historial" },
        { id: "pagar", label: "Pagar / Autorizar (demo)" },
        { id: "export_row", label: "Copiar N° factura" },
        { id: "ir_conciliacion", label: "Ir a conciliación" },
      ];
    } else if (key === "clientes") {
      items = [
        { id: "detalle", label: "Ver cliente" },
        { id: "ver_cobranza", label: "Ver cobranza" },
        { id: "comunicar", label: "Comunicar" },
        { id: "export_row", label: "Copiar razón social" },
      ];
    } else if (key === "conciliacion") {
      items = [
        { id: "detalle", label: "Ver movimiento" },
        { id: "conciliar", label: "Conciliar (demo)" },
        { id: "discrepancia", label: "Marcar discrepancia" },
        { id: "comunicar", label: "Avisar a cobranza" },
      ];
    } else {
      items = [
        { id: "detalle", label: "Ver detalle" },
        { id: "cobrar", label: "Registrar cobro (demo)" },
        { id: "comunicar", label: "Comunicar / WhatsApp" },
        { id: "ir_conciliacion", label: "Ir a conciliación" },
        { id: "export_row", label: "Copiar N° factura" },
      ];
    }
    menu.innerHTML = items
      .map(function (it) {
        return (
          '<button type="button" role="menuitem" data-sol-fin-menu-act="' +
          esc(it.id) +
          '" class="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">' +
          esc(it.label) +
          "</button>"
        );
      })
      .join("");
    menu.querySelectorAll("[data-sol-fin-menu-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var act = btn.getAttribute("data-sol-fin-menu-act");
        closeMenu();
        handleAction(act, anchor, row);
      });
    });
    var rect = anchor.getBoundingClientRect();
    menu.classList.remove("hidden");
    var top = rect.bottom + 6;
    var left = Math.min(window.innerWidth - 240, Math.max(8, rect.right - 224));
    if (top + 220 > window.innerHeight) top = Math.max(8, rect.top - 220);
    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }

  function ensureDrawer() {
    if (drawerEl) return drawerEl;
    drawerEl = document.createElement("div");
    drawerEl.id = "sol-fin-drawer";
    drawerEl.className = "hidden fixed inset-0 z-[10030]";
    drawerEl.innerHTML =
      '<div data-sol-fin-drawer-bg class="absolute inset-0 bg-slate-900/30"></div>' +
      '<aside class="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">' +
      '<div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">' +
      '<div><p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Detalle</p>' +
      '<h2 class="text-base font-extrabold text-slate-900" data-sol-fin-drawer-title>—</h2></div>' +
      '<button type="button" data-sol-fin-drawer-close class="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><span class="material-symbols-outlined text-[20px]">close</span></button>' +
      "</div>" +
      '<div class="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm" data-sol-fin-drawer-body></div>' +
      '<div class="border-t border-slate-100 p-4 flex flex-wrap gap-2" data-sol-fin-drawer-actions></div>' +
      "</aside>";
    document.body.appendChild(drawerEl);
    drawerEl.querySelector("[data-sol-fin-drawer-bg]").addEventListener("click", closeDrawer);
    drawerEl.querySelector("[data-sol-fin-drawer-close]").addEventListener("click", closeDrawer);
    return drawerEl;
  }

  function closeDrawer() {
    if (drawerEl) drawerEl.classList.add("hidden");
  }

  function closeFicha() {
    if (fichaEl) fichaEl.classList.add("hidden");
    selectedClienteKey = null;
  }

  function ensureFicha() {
    if (fichaEl) return fichaEl;
    fichaEl = document.createElement("div");
    fichaEl.id = "sol-fin-ficha";
    fichaEl.className = "hidden fixed inset-0 z-[10035]";
    fichaEl.innerHTML =
      '<div data-sol-fin-ficha-bg class="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"></div>' +
      '<aside class="absolute right-0 top-0 h-full w-full max-w-3xl bg-[#f8f9ff] shadow-2xl border-l border-slate-200 flex flex-col">' +
      '<div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white">' +
      '<div class="min-w-0">' +
      '<button type="button" data-sol-fin-ficha-back class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 mb-1">' +
      '<span class="material-symbols-outlined text-[16px]">arrow_back</span> Volver</button>' +
      '<p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400" data-sol-fin-ficha-eyebrow>Historia clínica</p>' +
      '<h2 class="text-lg font-extrabold text-slate-900 truncate" data-sol-fin-ficha-title>—</h2>' +
      '<p class="text-xs text-slate-500 mt-0.5" data-sol-fin-ficha-sub></p>' +
      "</div>" +
      '<div class="flex items-center gap-2 shrink-0">' +
      '<span data-sol-fin-ficha-crit class="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border"></span>' +
      '<button type="button" data-sol-fin-ficha-close class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">' +
      '<span class="material-symbols-outlined text-[20px]">close</span></button>' +
      "</div></div>" +
      '<div class="flex-1 overflow-y-auto px-5 py-4 space-y-4" data-sol-fin-ficha-body></div>' +
      '<div class="border-t border-slate-200 bg-white p-4 flex flex-wrap gap-2" data-sol-fin-ficha-actions></div>' +
      "</aside>";
    document.body.appendChild(fichaEl);
    fichaEl.querySelector("[data-sol-fin-ficha-bg]").addEventListener("click", closeFicha);
    fichaEl.querySelector("[data-sol-fin-ficha-close]").addEventListener("click", closeFicha);
    fichaEl.querySelector("[data-sol-fin-ficha-back]").addEventListener("click", closeFicha);
    return fichaEl;
  }

  function openClienteFicha(keyOrRow) {
    openCuentaFicha(keyOrRow, "cliente");
  }

  function openProveedorFicha(keyOrRow) {
    openCuentaFicha(keyOrRow, "proveedor");
  }

  function openCuentaFicha(keyOrRow, mode) {
    mode = mode || (pageKey() === "facturas" ? "proveedor" : "cliente");
    var pagar = mode === "proveedor";
    var profile = buildClienteProfile(keyOrRow);
    if (!profile || !profile.facturas || !profile.facturas.length) {
      toast(pagar ? "No hay facturas a pagar para este proveedor." : "No hay cobranzas cargadas para este cliente.", "err");
      return;
    }
    selectedClienteKey = profile.key;
    selectedId = profile.facturas[0].id || null;
    closeDrawer();
    closeMenu();
    var el = ensureFicha();
    var m = profile.metrics;
    var ai = buildAiAnalisis(profile, mode);
    var back = el.querySelector("[data-sol-fin-ficha-back]");
    if (back) {
      back.innerHTML =
        '<span class="material-symbols-outlined text-[16px]">arrow_back</span> Volver a ' +
        (pagar ? "facturas" : "clientes");
    }
    var eyebrow = el.querySelector("[data-sol-fin-ficha-eyebrow]");
    if (eyebrow) {
      eyebrow.textContent = pagar ? "Historia clínica del proveedor" : "Historia clínica del cliente";
    }
    el.querySelector("[data-sol-fin-ficha-title]").textContent = profile.razon_social;
    el.querySelector("[data-sol-fin-ficha-sub]").textContent =
      "CUIT " + (profile.cuit || "—") +
      (profile.email ? " · " + profile.email : "") +
      (profile.telefono ? " · " + profile.telefono : "");
    var crit = el.querySelector("[data-sol-fin-ficha-crit]");
    crit.className = "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border " + criticidadBadge(m.criticidad);
    crit.textContent = "Criticidad " + m.criticidad;

    var sentimentLabel =
      ai.sentiment === "positive" ? "Positivo" : ai.sentiment === "negative" ? "Negativo" : "Neutral";
    var sentimentCls =
      ai.sentiment === "positive"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : ai.sentiment === "negative"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-slate-100 text-slate-700 border-slate-200";

    var facturasHtml = profile.facturas
      .map(function (f) {
        var st = estadoFactura(f);
        var label = st.key === "al_dia" && pagar ? "Pagada" : st.label;
        return (
          '<tr class="border-t border-slate-100 hover:bg-slate-50/80" data-sol-fin-id="' +
          esc(f.id) +
          '">' +
          '<td class="py-2.5 px-3"><button type="button" data-sol-fin-ficha-fac="' +
          esc(f.id) +
          '" class="font-semibold text-blue-600 hover:underline text-left">' +
          esc(f.numero || f.id) +
          "</button></td>" +
          '<td class="py-2.5 px-3 font-mono text-right">' +
          esc(money(f.monto)) +
          "</td>" +
          '<td class="py-2.5 px-3 font-mono text-right">' +
          esc(money(f.monto_aplicado || 0)) +
          "</td>" +
          '<td class="py-2.5 px-3 font-mono text-right font-bold">' +
          esc(money(saldo(f))) +
          "</td>" +
          '<td class="py-2.5 px-3">' +
          esc(fmtDate(f.fecha_vto)) +
          "</td>" +
          '<td class="py-2.5 px-3 text-center"><span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ' +
          st.cls +
          '">' +
          esc(label) +
          "</span></td></tr>"
        );
      })
      .join("");

    var timelineHtml = profile.timeline.length
      ? profile.timeline
          .map(function (ev) {
            return (
              '<div class="relative flex gap-3 pl-1">' +
              '<div class="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 shrink-0"></div>' +
              '<div class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">' +
              '<div class="flex flex-wrap items-start justify-between gap-2">' +
              '<p class="text-sm font-semibold text-slate-900">' +
              esc(ev.label) +
              "</p>" +
              '<span class="text-[11px] text-slate-400">' +
              esc(fmtDate(ev.at, true)) +
              "</span></div>" +
              '<p class="mt-1 text-[11px] text-slate-500">' +
              esc(ev.factura || "") +
              (ev.agente ? " · " + ev.agente : "") +
              (ev.canal ? " · " + ev.canal : "") +
              "</p></div></div>"
            );
          })
          .join("")
      : '<p class="py-6 text-center text-sm text-slate-500">Sin gestiones registradas todavía.</p>';

    el.querySelector("[data-sol-fin-ficha-body]").innerHTML =
      '<div class="grid gap-3 sm:grid-cols-4">' +
      '<div class="rounded-xl border border-slate-200 bg-white p-3"><p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">' +
      (pagar ? "Saldo a pagar" : "Saldo pendiente") +
      '</p><p class="mt-1 text-xl font-black text-slate-900 font-mono">' +
      esc(money(m.saldoPendiente)) +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-white p-3"><p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facturas abiertas</p><p class="mt-1 text-xl font-black text-slate-900">' +
      m.facturasAbiertas +
      '</p><p class="text-[11px] text-rose-600 font-semibold">' +
      m.facturasVencidas +
      " vencidas</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-white p-3"><p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">' +
      (pagar ? "Cargado / pagado" : "Facturado / aplicado") +
      '</p><p class="mt-1 text-sm font-bold text-slate-900 font-mono">' +
      esc(money(m.facturado)) +
      " / " +
      esc(money(m.aplicado)) +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-white p-3"><p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">' +
      (pagar ? "Último pago" : "Último cobro") +
      '</p><p class="mt-1 text-sm font-bold text-slate-900">' +
      esc(fmtDate(m.ultimoPagoAt, true)) +
      "</p></div></div>" +
      '<section class="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">' +
      '<header class="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">' +
      '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">auto_awesome</span>' +
      '<h3 class="text-sm font-bold">Análisis IA · ' +
      (pagar ? "cuentas a pagar" : "cobranza") +
      "</h3></div>" +
      '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ' +
      sentimentCls +
      ' bg-white/15 border-white/30 text-white">' +
      esc(sentimentLabel) +
      "</span></header>" +
      '<div class="p-4 space-y-3">' +
      '<div class="rounded-lg border-l-4 border-indigo-500 bg-indigo-50/80 py-3 px-3"><p class="text-sm leading-relaxed text-slate-800">' +
      esc(ai.summary) +
      "</p></div>" +
      '<div class="grid gap-4 sm:grid-cols-2">' +
      "<div><p class=\"text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5\">Puntos clave</p><ul class=\"space-y-1.5\">" +
      ai.keyPoints
        .map(function (p) {
          return (
            '<li class="flex items-start gap-2 text-sm text-slate-700"><span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>' +
            esc(p) +
            "</li>"
          );
        })
        .join("") +
      "</ul></div>" +
      "<div><p class=\"text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5\">Próximos pasos</p><ul class=\"space-y-1.5\">" +
      ai.nextSteps
        .map(function (p) {
          return (
            '<li class="flex items-start gap-2 text-sm text-slate-700"><span class="text-indigo-600 font-bold shrink-0">→</span>' +
            esc(p) +
            "</li>"
          );
        })
        .join("") +
      "</ul></div></div>" +
      '<p class="text-[10px] text-slate-400">Generado ' +
      esc(fmtDate(ai.generatedAt, true)) +
      " · patrón Constanza (resumen + puntos clave + próximos pasos)</p>" +
      "</div></section>" +
      '<section class="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">' +
      '<header class="px-4 py-3 border-b border-slate-100 bg-white"><h3 class="text-sm font-bold text-slate-900">' +
      (pagar ? "Facturas a pagar del proveedor" : "Cobranzas / facturas del cliente") +
      "</h3>" +
      '<p class="text-[11px] text-slate-500">' +
      (pagar
        ? "Comprobantes cargados (OCR/AFIP) imputados a este proveedor"
        : "Listado de comprobantes a cobrar imputados a esta cuenta") +
      "</p></header>" +
      '<div class="overflow-x-auto"><table class="w-full text-left text-xs">' +
      "<thead><tr class=\"bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]\">" +
      "<th class=\"py-2.5 px-3\">Factura</th><th class=\"py-2.5 px-3 text-right\">Monto</th><th class=\"py-2.5 px-3 text-right\">Aplicado</th>" +
      "<th class=\"py-2.5 px-3 text-right\">Saldo</th><th class=\"py-2.5 px-3\">Vencimiento</th><th class=\"py-2.5 px-3 text-center\">Estado</th>" +
      "</tr></thead><tbody>" +
      facturasHtml +
      "</tbody></table></div></section>" +
      '<section class="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">' +
      '<header class="px-4 py-3 border-b border-slate-100"><h3 class="text-sm font-bold text-slate-900">Timeline de gestiones</h3></header>' +
      '<div class="p-4 space-y-3 relative">' +
      timelineHtml +
      "</div></section>";

    var first = profile.facturas[0];
    var unpaid = profile.facturas.find(function (f) {
      return saldo(f) > 0.009;
    }) || first;
    var acts = el.querySelector("[data-sol-fin-ficha-actions]");
    if (pagar) {
      acts.innerHTML =
        '<button type="button" data-sol-fin-ficha-act="pagar" class="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white">Pagar / Autorizar</button>' +
        '<button type="button" data-sol-fin-ficha-act="ir_conciliacion" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Ir a conciliación</button>' +
        '<button type="button" data-sol-fin-ficha-act="comunicar" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Comunicar</button>';
    } else {
      acts.innerHTML =
        '<button type="button" data-sol-fin-ficha-act="comunicar" class="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white">Comunicar</button>' +
        '<button type="button" data-sol-fin-ficha-act="cobrar" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Registrar cobro</button>' +
        '<button type="button" data-sol-fin-ficha-act="ir_conciliacion" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Ir a conciliación</button>';
    }
    acts.querySelectorAll("[data-sol-fin-ficha-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleAction(btn.getAttribute("data-sol-fin-ficha-act"), btn, unpaid);
      });
    });
    el.querySelectorAll("[data-sol-fin-ficha-fac]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fac = findRow(btn.getAttribute("data-sol-fin-ficha-fac"));
        if (fac) openDrawer(fac);
      });
    });
    el.classList.remove("hidden");
  }

  function openDrawer(row) {
    if (!row) return;
    if (pageKey() === "clientes" && (row._cliente_key || (!row.numero && row.razon_social))) {
      openCuentaFicha(row, "cliente");
      return;
    }
    if (pageKey() === "facturas" && row._cliente_key) {
      openCuentaFicha(row, "proveedor");
      return;
    }
    row = localOf(row);
    selectedId = row.id || null;
    var d = ensureDrawer();
    var st = estadoFactura(row);
    d.querySelector("[data-sol-fin-drawer-title]").textContent = row.numero || row.razon_social || "Registro";
    d.querySelector("[data-sol-fin-drawer-body]").innerHTML =
      '<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">' +
      '<div class="flex justify-between gap-3"><span class="text-slate-500">Cliente</span><strong class="text-slate-800 text-right">' +
      esc(row.razon_social || "—") +
      "</strong></div>" +
      '<div class="flex justify-between gap-3"><span class="text-slate-500">CUIT</span><span class="font-mono text-slate-700">' +
      esc(row.cuit || row.cuit_emisor || row.cuit_receptor || "—") +
      "</span></div>" +
      '<div class="flex justify-between gap-3"><span class="text-slate-500">Vencimiento</span><span>' +
      esc(row.fecha_vto || "—") +
      "</span></div>" +
      '<div class="flex justify-between gap-3"><span class="text-slate-500">Saldo</span><strong class="font-mono">' +
      esc(money(saldo(row))) +
      "</strong></div>" +
      '<div class="flex justify-between gap-3"><span class="text-slate-500">Estado</span><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ' +
      st.cls +
      '">' +
      esc(st.label) +
      "</span></div>" +
      (row.demo_comunicada
        ? '<div class="text-[11px] text-indigo-600 font-semibold">Comunicación demo registrada ' +
          esc(row.demo_comunicada_at || "") +
          "</div>"
        : "") +
      (row.demo_nota ? '<div class="text-[11px] text-slate-500">' + esc(row.demo_nota) + "</div>" : "") +
      "</div>" +
      '<p class="text-[11px] text-slate-400">Datos de prueba · las acciones demuestran el flujo sin inventar cobros bancarios reales.</p>';
    var acts = d.querySelector("[data-sol-fin-drawer-actions]");
    var key = pageKey();
    var buttons =
      key === "facturas"
        ? [
            { id: "pagar", label: "Pagar / Autorizar", primary: true },
            { id: "comunicar", label: "Comunicar" },
          ]
        : [
            { id: "cobrar", label: "Registrar cobro", primary: true },
            { id: "comunicar", label: "Comunicar" },
            { id: "ir_conciliacion", label: "Conciliación" },
          ];
    acts.innerHTML = buttons
      .map(function (b) {
        return (
          '<button type="button" data-sol-fin-drawer-act="' +
          esc(b.id) +
          '" class="px-3 py-2 rounded-lg text-xs font-bold ' +
          (b.primary ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50") +
          '">' +
          esc(b.label) +
          "</button>"
        );
      })
      .join("");
    acts.querySelectorAll("[data-sol-fin-drawer-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleAction(btn.getAttribute("data-sol-fin-drawer-act"), btn, row);
      });
    });
    d.classList.remove("hidden");
  }

  function mainTables() {
    return Array.prototype.slice.call(document.querySelectorAll("main table tbody"));
  }

  function rowStatus(tr) {
    var id = tr.getAttribute("data-sol-fin-id");
    if (id) {
      var row = findRow(id);
      if (row) return estadoFactura(row).key;
    }
    var t = fold(tr.textContent || "");
    if (t.indexOf("discrepan") >= 0) return "discrepancias";
    if (t.indexOf("vencida") >= 0 || t.indexOf("mora") >= 0) return "vencidas";
    if (t.indexOf("por vencer") >= 0 || t.indexOf("vence en") >= 0) return "por_vencer";
    if (t.indexOf("en gestion") >= 0 || t.indexOf("parcial") >= 0) return "en_gestion";
    if (t.indexOf("al dia") >= 0 || t.indexOf("pagad") >= 0 || t.indexOf("conciliad") >= 0) return "al_dia";
    if (t.indexOf("pendiente") >= 0 || t.indexOf("observad") >= 0) return "pendientes";
    return "otras";
  }

  function chipCountFor(key, counts) {
    if (key === "parciales") return counts.en_gestion || 0;
    if (key === "pagadas_mes") return counts.pagadas_mes || counts.al_dia || 0;
    if (key === "en_gestion") return counts.en_gestion || 0;
    if (counts[key] != null) return counts[key];
    return 0;
  }

  function applyFilters() {
    var q = fold(query);
    var total = 0;
    var shown = 0;
    var counts = {
      todas: 0,
      por_vencer: 0,
      vencidas: 0,
      pagadas_mes: 0,
      al_dia: 0,
      en_gestion: 0,
      parciales: 0,
      pendientes: 0,
      otras: 0,
    };
    mainTables().forEach(function (tbody) {
      Array.prototype.forEach.call(tbody.rows, function (tr) {
        if (tr.querySelector("td[colspan]")) return;
        total += 1;
        var st = rowStatus(tr);
        counts.todas += 1;
        if (counts[st] != null) counts[st] += 1;
        else counts.otras += 1;
        if (st === "al_dia") counts.pagadas_mes += 1;
        if (st === "en_gestion") counts.parciales += 1;
        var okFilter =
          filter === "todas" ||
          filter === "todos" ||
          filter === st ||
          (filter === "pagadas_mes" && st === "al_dia") ||
          (filter === "parciales" && st === "en_gestion") ||
          (filter === "en_gestion" && st === "en_gestion") ||
          (filter === "con_saldo" && (st === "vencidas" || st === "por_vencer" || st === "en_gestion")) ||
          (filter === "conciliados" && st === "al_dia");
        var okQuery = !q || fold(tr.textContent).indexOf(q) >= 0;
        var show = okFilter && okQuery;
        tr.style.display = show ? "" : "none";
        if (show) shown += 1;
      });
    });
    document.querySelectorAll("main").forEach(function (root) {
      root.querySelectorAll("*").forEach(function (el) {
        if (el.children && el.children.length) return;
        var txt = String(el.textContent || "");
        if (/Mostrando\s+\d+(\s+de\s+\d+)?(\s+filas|\s+registros)?/i.test(txt)) {
          el.textContent = "Mostrando " + shown + " de " + total + " registros";
        }
      });
    });
    paintChipCounts(counts);
    updateSelectedLabel();
  }

  function paintChipCounts(counts) {
    document.querySelectorAll("[data-sol-fin-chip]").forEach(function (b) {
      var key = b.getAttribute("data-sol-fin-chip");
      var n = chipCountFor(key, counts);
      var label = b.getAttribute("data-sol-fin-chip-label") || "";
      if (!label) {
        var first = b.querySelector("span:first-child");
        label = String((first && first.textContent) || b.textContent || "")
          .replace(/\s+\d+\s*$/, "")
          .replace(/\s+/g, " ")
          .trim();
        b.setAttribute("data-sol-fin-chip-label", label);
      }
      var on = b.getAttribute("aria-pressed") === "true";
      var badgeCls =
        key === "vencidas"
          ? on
            ? "bg-white/20 text-rose-200"
            : "bg-red-50 text-red-700 border border-red-200"
          : key === "por_vencer"
            ? on
              ? "bg-white/20 text-amber-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
            : key === "parciales" || key === "en_gestion"
              ? on
                ? "bg-white/20 text-sky-200"
                : "bg-sky-50 text-sky-800 border border-sky-200"
              : key === "al_dia" || key === "pagadas_mes"
                ? on
                  ? "bg-white/20 text-emerald-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : on
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600";
      b.innerHTML =
        "<span>" +
        esc(label) +
        '</span><span class="' +
        badgeCls +
        ' px-1.5 py-0.5 rounded-full text-[10px] font-bold">' +
        n +
        "</span>";
    });
  }

  function paintChipActive(btn) {
    var cobranzaStyle = pageKey() === "cobranza";
    document.querySelectorAll("[data-sol-fin-chip]").forEach(function (b) {
      var on = b === btn;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (cobranzaStyle) {
        b.className = on
          ? "px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs shrink-0"
          : "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors border border-transparent shrink-0";
      } else if (on) {
        b.className =
          "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs shrink-0 inline-flex items-center gap-1";
      } else {
        b.className =
          "px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 shrink-0 inline-flex items-center gap-1";
      }
    });
  }

  function classifyChip(label) {
    var t = fold(label);
    if (t.indexOf("todas") === 0 || t.indexOf("todos") === 0) return "todas";
    if (t.indexOf("pagadas este mes") === 0 || t.indexOf("pagadas del mes") === 0 || t.indexOf("pagad") === 0) {
      return "pagadas_mes";
    }
    if (t.indexOf("vencid") === 0) return "vencidas";
    if (t.indexOf("por vencer") === 0) return "por_vencer";
    if (t.indexOf("en gestion") === 0) return "en_gestion";
    if (t.indexOf("parcial") === 0) return "parciales";
    if (t.indexOf("al dia") === 0) return "al_dia";
    if (t.indexOf("pendiente") === 0) return "pendientes";
    if (t.indexOf("conciliad") === 0) return "conciliados";
    if (t.indexOf("discrepan") === 0) return "discrepancias";
    if (t.indexOf("rechaz") === 0) return "rechazados";
    if (t.indexOf("con saldo") === 0) return "con_saldo";
    return null;
  }

  function wireChips() {
    document.querySelectorAll("main button").forEach(function (btn) {
      if (btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif]")) return;
      if (btn.getAttribute("data-sol-fin-chip-wired")) return;
      var key = classifyChip(btn.textContent || "");
      if (!key) return;
      btn.setAttribute("data-sol-fin-chip", key);
      btn.setAttribute("data-sol-fin-chip-wired", "1");
      btn.setAttribute(
        "data-sol-fin-chip-label",
        String(btn.textContent || "")
          .replace(/\s+\d+\s*$/, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        filter = key;
        paintChipActive(btn);
        applyFilters();
      });
    });
    var active = document.querySelector('[data-sol-fin-chip="' + filter + '"]') || document.querySelector('[data-sol-fin-chip="todas"]');
    if (active) paintChipActive(active);
  }

  function wireSearch() {
    document.querySelectorAll("main input[type='search'], main input[placeholder*='Buscar'], main input[placeholder*='buscar']").forEach(function (input) {
      if (input.getAttribute("data-sol-fin-search")) return;
      input.setAttribute("data-sol-fin-search", "1");
      input.addEventListener("input", function () {
        query = input.value || "";
        applyFilters();
      });
    });
  }

  function selectedCount() {
    return document.querySelectorAll("main tbody input[type='checkbox']:checked").length;
  }

  function selectedIds() {
    var ids = [];
    document.querySelectorAll("main tbody tr").forEach(function (tr) {
      var chk = tr.querySelector('input[type="checkbox"]');
      if (chk && chk.checked && tr.getAttribute("data-sol-fin-id")) ids.push(tr.getAttribute("data-sol-fin-id"));
    });
    return ids;
  }

  function updateSelectedLabel() {
    var n = selectedCount();
    document.querySelectorAll("main button").forEach(function (btn) {
      var t = fold(btn.textContent || "");
      if (t.indexOf("comunicar seleccionadas") >= 0) {
        btn.innerHTML = '<span class="material-symbols-outlined text-[16px] align-middle">mark_chat_unread</span> Comunicar seleccionadas (' + n + ")";
      }
      if (t.indexOf("enviar recordatorio a seleccionado") >= 0) {
        btn.textContent = "Enviar Recordatorio a Seleccionados (" + n + " destinatario" + (n === 1 ? "" : "s") + ")";
      }
    });
    var kpi = document.getElementById("kpi-monto-seleccionado");
    if (kpi) kpi.textContent = n + " seleccionados";
  }

  function wireCheckboxes() {
    document.querySelectorAll("main tbody input[type='checkbox']").forEach(function (chk) {
      if (chk.getAttribute("data-sol-fin-chk")) return;
      chk.setAttribute("data-sol-fin-chk", "1");
      chk.addEventListener("change", function () {
        var tr = chk.closest("tr");
        if (tr) tr.classList.toggle("bg-indigo-50/40", chk.checked);
        updateSelectedLabel();
      });
    });
    var head = document.querySelector("main thead input[type='checkbox']");
    if (head && !head.getAttribute("data-sol-fin-chk-all")) {
      head.setAttribute("data-sol-fin-chk-all", "1");
      head.addEventListener("change", function () {
        document.querySelectorAll("main tbody tr").forEach(function (tr) {
          if (tr.style.display === "none") return;
          var c = tr.querySelector('input[type="checkbox"]');
          if (!c) return;
          c.checked = head.checked;
          tr.classList.toggle("bg-indigo-50/40", head.checked);
        });
        updateSelectedLabel();
      });
    }
  }

  function copyText(text) {
    var v = String(text || "").trim();
    if (!v) {
      toast("No hay texto para copiar.", "err");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(
        function () {
          toast("Copiado: " + v.slice(0, 60), "ok");
        },
        function () {
          toast("No se pudo copiar.", "err");
        },
      );
    } else {
      toast("Copiá manualmente: " + v.slice(0, 80), "ok");
    }
  }

  function demoComunicar(ids) {
    ids = ids || [];
    if (!ids.length && selectedId) ids = [selectedId];
    if (!ids.length) {
      toast("Seleccioná al menos una factura.", "err");
      return;
    }
    ids.forEach(function (id) {
      patchLocal(id, {
        demo_comunicada: true,
        demo_comunicada_at: new Date().toLocaleString("es-AR"),
        demo_nota: "Recordatorio demo (sin envío WhatsApp real)",
      });
      api("/api/finanzas/facturas/" + encodeURIComponent(id) + "/comunicar", {
        method: "POST",
        body: JSON.stringify({ canal: "whatsapp", mensaje: "" }),
      }).catch(function () {});
    });
    toast("Comunicación demo registrada en " + ids.length + " factura(s).", "ok");
    refreshTables();
  }

  function demoCobrar(row) {
    if (!row || !row.id) {
      go("/finanzas/facturas/cobranzas");
      return;
    }
    var s = saldo(localOf(row));
    if (s <= 0) {
      toast("Esa factura ya figura saldada en la demo.", "ok");
      return;
    }
    var apply = Math.max(1, Math.round(s));
    patchLocal(row.id, {
      monto_aplicado: Number(row.monto_aplicado || 0) + apply,
      demo_pagada: true,
      estado: "saldada",
      demo_nota: "Cobro demo imputado " + money(apply),
    });
    // intentar pasarela demo
    api("/api/finanzas/pasarela", {
      method: "POST",
      body: JSON.stringify({
        monto: apply,
        numero_factura: row.numero,
        cuit: row.cuit || row.cuit_emisor,
        external_ref: "demo-" + row.id + "-" + Date.now(),
      }),
    })
      .then(function () {
        toast("Cobro demo registrado e imputado a " + (row.numero || row.id) + ".", "ok");
        return reloadData();
      })
      .catch(function () {
        toast("Cobro demo local en " + (row.numero || row.id) + " (API pasarela no disponible).", "ok");
        refreshTables();
      });
  }

  function demoPagar(row) {
    if (!row || !row.id) {
      toast("Elegí una factura a pagar.", "err");
      return;
    }
    patchLocal(row.id, {
      demo_pagada: true,
      estado: "pagada",
      monto_aplicado: Number(row.monto || 0),
      demo_nota: "Pago/autorización demo",
    });
    api("/api/finanzas/facturas/" + encodeURIComponent(row.id), {
      method: "PATCH",
      body: JSON.stringify({ estado: "confirmada" }),
    }).catch(function () {});
    toast("Factura " + (row.numero || "") + " marcada como autorizada (demo).", "ok");
    refreshTables();
  }

  function demoConciliar(row) {
    var pending = cobros.filter(function (c) {
      return c.estado !== "aplicado";
    });
    if (row && row.id && pending[0]) {
      api("/api/finanzas/cobros/" + encodeURIComponent(pending[0].id) + "/conciliar", {
        method: "POST",
        body: JSON.stringify({ factura_id: row.id }),
      })
        .then(function () {
          toast("Conciliación demo aplicada.", "ok");
          return reloadData();
        })
        .catch(function () {
          patchLocal(row.id, { demo_nota: "Match demo local", monto_aplicado: Number(row.monto || 0), demo_pagada: true, estado: "saldada" });
          toast("Conciliación demo local aplicada.", "ok");
          refreshTables();
        });
      return;
    }
    if (row && row.id) {
      patchLocal(row.id, { demo_nota: "Auto-match demo", monto_aplicado: Number(row.monto || 0), demo_pagada: true, estado: "saldada" });
      toast("Simulación de ingreso + auto-match en " + (row.numero || "fila") + ".", "ok");
      refreshTables();
      return;
    }
    toast("Elegí un movimiento o factura para conciliar.", "err");
  }

  function handleAction(kind, btn, row) {
    row = row || (selectedId ? findRow(selectedId) : null) || rowFromEl(btn);
    if (kind === "more") {
      openMenu(btn, row);
      return;
    }
    if (kind === "detalle") {
      if (pageKey() === "clientes") {
        openCuentaFicha(row || selectedClienteKey, "cliente");
        return;
      }
      if (pageKey() === "facturas") {
        openCuentaFicha(row || selectedClienteKey, "proveedor");
        return;
      }
      openDrawer(row || { numero: "Sin ID", razon_social: "Fila de demostración" });
      return;
    }
    if (kind === "ver_cobranza" || kind === "ficha_cliente") {
      openCuentaFicha(row || selectedClienteKey, "cliente");
      return;
    }
    if (kind === "ficha_proveedor") {
      openCuentaFicha(row || selectedClienteKey, "proveedor");
      return;
    }
    if (kind === "nuevo_cobro") {
      go("/finanzas/facturas/cobranzas");
      return;
    }
    if (kind === "cobrar") {
      demoCobrar(row);
      return;
    }
    if (kind === "pagar") {
      demoPagar(row);
      return;
    }
    if (kind === "chat" || kind === "comunicar") {
      if (row && row.id) demoComunicar([row.id]);
      else go("/finanzas/comunicacion");
      return;
    }
    if (kind === "comunicar_masivo" || kind === "enviar_seleccion") {
      var ids = selectedIds();
      if (!ids.length) {
        toast("Seleccioná al menos una factura.", "err");
        return;
      }
      demoComunicar(ids);
      return;
    }
    if (kind === "enviar_prueba") {
      if (row && row.id) demoComunicar([row.id]);
      else if (apiRows[0]) demoComunicar([apiRows[0].id]);
      else toast("No hay factura demo para prueba.", "err");
      return;
    }
    if (kind === "programar") {
      toast("Envío programado en demo para mañana 09:00 (no dispara WhatsApp real).", "ok");
      return;
    }
    if (kind === "ir_conciliacion") {
      go("/finanzas/conciliacion");
      return;
    }
    if (kind === "conciliar") {
      if (pageKey() !== "conciliacion" && !(row && row.id)) {
        go("/finanzas/conciliacion");
        return;
      }
      demoConciliar(row);
      return;
    }
    if (kind === "discrepancia") {
      if (row && row.id) patchLocal(row.id, { demo_flag: "discrepancia", demo_nota: "Discrepancia marcada en demo" });
      toast("Discrepancia marcada para revisión (demo).", "ok");
      refreshTables();
      return;
    }
    if (kind === "debin") {
      if (row && row.id) patchLocal(row.id, { demo_nota: "Link DEBIN demo generado" });
      toast("Link DEBIN/QR de prueba generado (no cobra en banco real).", "ok");
      return;
    }
    if (kind === "sync") {
      toast("Sincronización demo OK · datos de prueba refrescardos.", "ok");
      reloadData();
      return;
    }
    if (kind === "export") {
      var lines = ["numero,cliente,saldo,estado"];
      apiRows.map(localOf).forEach(function (r) {
        lines.push([r.numero, r.razon_social, saldo(r), estadoFactura(r).label].map(function (x) {
          return '"' + String(x || "").replace(/"/g, '""') + '"';
        }).join(","));
      });
      var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "finanzas-demo.csv";
      a.click();
      toast("Export CSV demo descargado.", "ok");
      return;
    }
    if (kind === "export_row") {
      copyText((row && (row.numero || row.razon_social)) || "");
      return;
    }
    if (kind === "cargar_factura") {
      toast("En demo las facturas a pagar se cargan por API/OCR. Usá las filas de prueba ya listadas.", "ok");
      return;
    }
    if (kind === "nuevo_cliente") {
      toast("Alta de cliente: en esta demo los clientes salen de las facturas a cobrar.", "ok");
      go("/finanzas/clientes");
      return;
    }
    if (kind === "plantilla") {
      toast("Plantilla demo activa. Podés editar el texto en Comunicación y enviar prueba demo.", "ok");
      return;
    }
    if (kind === "filtros") {
      toast("Usá chips de estado + buscador. Filtro actual: " + filter + ".", "ok");
      return;
    }
    if (kind === "pager") {
      toast("Listado demo completo en una página (filtros aplican sobre todas las filas).", "ok");
      return;
    }
  }

  function actionKind(btn) {
    var t = fold(btn.textContent || "");
    var title = fold(btn.getAttribute("title") || btn.getAttribute("aria-label") || "");
    var all = (t + " " + title).trim();
    if (btn.closest("[data-sol-fin-menu], #sol-fin-menu, #sol-fin-drawer")) return null;
    if (btn.getAttribute("data-sol-fin-chip")) return null;
    if (/notifications/.test(btn.textContent || "") && btn.querySelector(".material-symbols-outlined")) return null;
    if (all.indexOf("nuevo cobro") >= 0) return "nuevo_cobro";
    if (all.indexOf("ver cobranza") >= 0 || all.indexOf("ver cobranzas") >= 0) return "ver_cobranza";
    if (all.indexOf("ver cliente") >= 0 || all.indexOf("historia clinica") >= 0) return "ficha_cliente";
    if (all.indexOf("ver proveedor") >= 0 || all.indexOf("ver recibo") >= 0) return pageKey() === "facturas" ? "ficha_proveedor" : "detalle";
    if (all === "cobrar" || all.indexOf("registrar pago") >= 0) return "cobrar";
    if (all.indexOf("pagadas") >= 0) return null;
    if (/(^|\s)pagar(\s|\/|$)/.test(all) || all.indexOf("autorizar") >= 0) return "pagar";
    if (all.indexOf("comunicar seleccionadas") >= 0 || all.indexOf("enviar recordatorio a seleccionado") >= 0) return "enviar_seleccion";
    if (all.indexOf("recordatorio masivo") >= 0 || all.indexOf("emitir reclamo") >= 0 || all.indexOf("comunicar masivo") >= 0) return "comunicar_masivo";
    if (all.indexOf("comunicar") >= 0 || all.indexOf("reclamar") >= 0 || all.indexOf("intimar") >= 0 || all.indexOf("recordar") >= 0 || all.indexOf("anticipar") >= 0) return "comunicar";
    if ((all === "chat" || title.indexOf("whatsapp") >= 0) && btn.querySelector(".material-symbols-outlined, .fa-solid, i, svg")) return "chat";
    if (all.indexOf("enviar prueba") >= 0) return "enviar_prueba";
    if (all.indexOf("programar envio") >= 0) return "programar";
    if (all.indexOf("enviar recordatorio") >= 0) return "comunicar_masivo";
    if (all.indexOf("conciliacion con extracto") >= 0) return "ir_conciliacion";
    if (all.indexOf("simular ingreso") >= 0 || all.indexOf("aprobar conciliacion") >= 0 || all.indexOf("conciliar") === 0) return "conciliar";
    if (all.indexOf("observar discrepancia") >= 0 || all === "ajustar" || all === "auditar") return "discrepancia";
    if (all.indexOf("generar link") >= 0 || all.indexOf("debin") >= 0) return "debin";
    if (all.indexOf("sincronizar") >= 0) return "sync";
    if (all.indexOf("exportar") >= 0 || all.indexOf("descargar informe") >= 0) return "export";
    if (all.indexOf("cargar factura") >= 0 || all.indexOf("ocr") >= 0) return "cargar_factura";
    if (all.indexOf("registrar nuevo cliente") >= 0) return "nuevo_cliente";
    if (all.indexOf("nueva plantilla") >= 0 || all.indexOf("editar plantilla") >= 0) return "plantilla";
    if (all.indexOf("detalle") >= 0 || all.indexOf("ver detalle") >= 0) return "detalle";
    if (all.indexOf("filtros") >= 0) return "filtros";
    if (all === "anterior" || all === "siguiente" || /^\d+$/.test(t)) return "pager";
    if (all === "more_vert" || all.indexOf("mas opciones") >= 0 || all.indexOf("más opciones") >= 0) return "more";
    if (btn.querySelector(".material-symbols-outlined") && /more_vert/.test(btn.textContent || "")) return "more";
    return null;
  }

  function wireActions() {
    if (document.documentElement.getAttribute("data-sol-fin-actions")) return;
    document.documentElement.setAttribute("data-sol-fin-actions", "1");
    document.addEventListener(
      "click",
      function (e) {
        if (e.target.closest && e.target.closest("#sol-fin-menu")) return;
        var nameHit = e.target.closest("[data-sol-fin-open-cliente]");
        if (nameHit) {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          openCuentaFicha(
            rowFromEl(nameHit) || nameHit.getAttribute("data-sol-fin-open-cliente"),
            pageKey() === "facturas" ? "proveedor" : "cliente",
          );
          return;
        }
        var rowHit = e.target.closest("tr[data-sol-fin-cliente]");
        if (rowHit && !e.target.closest("button, a, input, label") && pageKey() === "clientes") {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          openCuentaFicha(rowFromEl(rowHit) || rowHit.getAttribute("data-sol-fin-cliente"), "cliente");
          return;
        }
        var facRow = e.target.closest("tr[data-sol-fin-id]");
        if (
          facRow &&
          pageKey() === "facturas" &&
          !e.target.closest("button, a, input, label") &&
          !e.target.closest("#sol-fin-ficha, #sol-fin-drawer")
        ) {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          openCuentaFicha(rowFromEl(facRow), "proveedor");
          return;
        }
        var btn = e.target.closest("button");
        if (!btn) {
          closeMenu();
          return;
        }
        if (btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif]")) return;
        if (!btn.closest("main, aside, [data-purpose], #sol-fin-drawer, #sol-fin-ficha")) return;
        var kind = actionKind(btn);
        if (!kind) {
          if (!btn.closest("#sol-fin-menu")) closeMenu();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleAction(kind, btn, rowFromEl(btn));
      },
      true,
    );
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMenu();
        closeDrawer();
        closeFicha();
      }
    });
  }

  function setKpiByLabel(labelPart, value) {
    var want = fold(labelPart);
    document.querySelectorAll("main .font-label-caps, main span, main div, main p").forEach(function (el) {
      var txt = fold(el.textContent || "");
      if (txt !== want && txt.indexOf(want) !== 0) return;
      if ((el.textContent || "").length > 48) return;
      var card = el.closest(".bg-surface-container-lowest, .rounded-xl, .rounded-2xl, .border, .bg-white");
      if (!card) return;
      var metric = card.querySelector(".font-code-table, .text-metric-stat, .text-2xl, .text-3xl, .font-black, .font-extrabold, .text-xl");
      if (metric && metric !== el) metric.textContent = value;
    });
  }

  function paintResumen(res) {
    if (!res || typeof res !== "object") return;
    if (res.cartera_abierta != null) {
      setKpiByLabel("Deuda Pendiente", money(res.cartera_abierta));
      setKpiByLabel("Cartera abierta", money(res.cartera_abierta));
      setKpiByLabel("Cartera Total a Cobrar", money(res.cartera_abierta));
    }
    if (res.cobrado != null) setKpiByLabel("Monto Total Cobrado", money(res.cobrado));
    if (res.eficiencia != null) setKpiByLabel("Eficiencia de Cobro", String(res.eficiencia) + "%");
    if (res.vencidas != null) setKpiByLabel("Facturas vencidas", String(res.vencidas));
    if (res.pendiente_conciliar != null) setKpiByLabel("Pendiente de conciliar", money(res.pendiente_conciliar));
    if (res.facturas_cobrar != null) setKpiByLabel("Clientes con saldo", String(res.facturas_cobrar));
  }

  function actionsHtml(row) {
    var key = pageKey();
    if (key === "facturas") {
      return (
        '<button type="button" class="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-semibold">Pagar / Autorizar</button>' +
        '<button type="button" class="p-1 text-outline hover:text-on-surface rounded" title="Más opciones"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>'
      );
    }
    if (key === "clientes") {
      return (
        '<button type="button" class="px-2 py-1 border border-slate-200 rounded text-xs font-semibold">Ver cobranza</button>' +
        '<button type="button" class="p-1 text-slate-400 hover:text-slate-700 rounded" aria-label="Más opciones" title="Más opciones"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>'
      );
    }
    return (
      '<button type="button" class="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded text-xs font-semibold" title="Registrar Pago">Cobrar</button>' +
      '<button type="button" class="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Enviar Recordatorio WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>' +
      '<button type="button" class="p-1 text-outline hover:text-on-surface rounded" title="Más opciones"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>'
    );
  }

  function isoOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function demoPaso(days, agente, label, extra) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(11, 0, 0, 0);
    return Object.assign({ at: d.toISOString(), agente: agente, label: label }, extra || {});
  }

  /** Asegura variedad de estados en Cobranza para que los chips filtren con sentido. */
  function enrichCobrarDemo(rows) {
    var list = (rows || []).map(localOf);
    var byId = {};
    list.forEach(function (r) {
      byId[r.id] = r;
    });
    // Parcial: si MYE no tiene aplicado, forzar demo local
    if (byId["FAC-SYS-0003"] && Number(byId["FAC-SYS-0003"].monto_aplicado || 0) < 1) {
      byId["FAC-SYS-0003"] = Object.assign({}, byId["FAC-SYS-0003"], {
        monto_aplicado: 120000,
        estado: "parcial",
      });
    }
    var extras = [
      {
        id: "FAC-SYS-0004",
        tipo: "cobrar",
        numero: "A-0002-00005501",
        razon_social: "Andes Cargo SRL",
        cuit_emisor: "30-74444444-1",
        fecha: isoOffset(-45),
        fecha_vto: isoOffset(-15),
        monto: 540000,
        monto_aplicado: 540000,
        estado: "saldada",
        demo_pagada: true,
        pasos: [demoPaso(-14, "conciliacion", "Cobro total conciliado · factura al día")],
      },
      {
        id: "FAC-SYS-0005",
        tipo: "cobrar",
        numero: "A-0005-00001220",
        razon_social: "Cuyo Express",
        cuit_emisor: "30-75555555-8",
        fecha: isoOffset(-2),
        fecha_vto: isoOffset(12),
        monto: 275000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [demoPaso(-2, "facturas", "Emitida · flete Cuyo Express")],
      },
    ];
    extras.forEach(function (ex) {
      if (!byId[ex.id]) byId[ex.id] = ex;
    });
    return Object.keys(byId).map(function (k) {
      return byId[k];
    });
  }

  function demoPagarRows() {
    return [
      {
        id: "FAC-PAY-001",
        tipo: "pagar",
        numero: "FA-0003-00112",
        razon_social: "YPF Distribución",
        cuit_emisor: "30-54667674-9",
        fecha: isoOffset(-12),
        fecha_vto: isoOffset(3),
        monto: 2180000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [
          demoPaso(-12, "facturas", "OCR + validación CUIT AFIP"),
          demoPaso(-2, "facturas", "Matching remito/OC OK · pendiente autorización"),
        ],
      },
      {
        id: "FAC-PAY-002",
        tipo: "pagar",
        numero: "FA-0003-00118",
        razon_social: "Neumáticos del Sur",
        cuit_emisor: "30-71112223-4",
        fecha: isoOffset(-20),
        fecha_vto: isoOffset(-8),
        monto: 420000,
        monto_aplicado: 420000,
        estado: "saldada",
        demo_pagada: true,
        pasos: [
          demoPaso(-20, "facturas", "Factura cargada por OCR"),
          demoPaso(-9, "conciliacion", "Pago autorizado y conciliado"),
        ],
      },
      {
        id: "FAC-PAY-003",
        tipo: "pagar",
        numero: "FA-0001-000884",
        razon_social: "Shell Argentina",
        cuit_emisor: "30-50123456-9",
        fecha: isoOffset(-5),
        fecha_vto: isoOffset(5),
        monto: 980000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [demoPaso(-5, "facturas", "Ingreso manual · pendiente de pago")],
      },
      {
        id: "FAC-PAY-004",
        tipo: "pagar",
        numero: "FA-0002-000441",
        razon_social: "Mercado Libre Logistic",
        cuit_emisor: "30-70987654-1",
        fecha: isoOffset(-40),
        fecha_vto: isoOffset(-15),
        monto: 312000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [
          demoPaso(-40, "facturas", "Factura ingresada"),
          demoPaso(-10, "facturas", "Alerta de vencimiento · sin autorización"),
        ],
      },
      {
        id: "FAC-PAY-005",
        tipo: "pagar",
        numero: "FA-0004-000210",
        razon_social: "Pirelli Neumáticos",
        cuit_emisor: "30-69874512-3",
        fecha: isoOffset(-10),
        fecha_vto: isoOffset(2),
        monto: 756000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [demoPaso(-10, "facturas", "OCR OK · retenciones estimadas")],
      },
      {
        id: "FAC-PAY-006",
        tipo: "pagar",
        numero: "FA-0005-000099",
        razon_social: "Telecom Arg.",
        cuit_emisor: "30-65432109-8",
        fecha: isoOffset(-25),
        fecha_vto: isoOffset(-2),
        monto: 145000,
        monto_aplicado: 145000,
        estado: "saldada",
        demo_pagada: true,
        pasos: [
          demoPaso(-25, "facturas", "Servicios · factura cargada"),
          demoPaso(-3, "conciliacion", "Debitado y conciliado"),
        ],
      },
      {
        id: "FAC-PAY-007",
        tipo: "pagar",
        numero: "FA-0006-000333",
        razon_social: "Axion Energy",
        cuit_emisor: "30-61234567-0",
        fecha: isoOffset(-3),
        fecha_vto: isoOffset(10),
        monto: 1540000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [demoPaso(-3, "facturas", "Combustible · en revisión")],
      },
      {
        id: "FAC-PAY-008",
        tipo: "pagar",
        numero: "FA-0007-000512",
        razon_social: "Iveco Argentina",
        cuit_emisor: "30-58765432-2",
        fecha: isoOffset(-18),
        fecha_vto: isoOffset(-1),
        monto: 890000,
        monto_aplicado: 0,
        estado: "abierta",
        pasos: [
          demoPaso(-18, "facturas", "Repuestos · cargada"),
          demoPaso(-1, "facturas", "Vencida · pendiente de caja"),
        ],
      },
    ];
  }

  function renderRows(rows) {
    var tbody = document.querySelector("main table tbody");
    if (!tbody) return;
    var key = pageKey();
    rows = (rows || []).map(localOf);
    if (!rows.length && key === "facturas") {
      rows = demoPagarRows().map(localOf);
      apiRows = rows.slice();
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr><td class="py-6 px-4 text-sm text-slate-500" colspan="8">Sin datos de prueba en este listado.</td></tr>';
      return;
    }
    if (key === "clientes") {
      var byClient = {};
      rows.forEach(function (r) {
        var k = clienteKeyOf(r);
        if (!byClient[k]) {
          byClient[k] = {
            key: k,
            razon_social: r.razon_social,
            cuit: r.cuit || r.cuit_emisor,
            saldo: 0,
            n: 0,
            abiertas: 0,
            vencidas: 0,
            id: r.id,
            ultimo: null,
            plazo: 30,
          };
        }
        var s = saldo(r);
        byClient[k].saldo += s;
        byClient[k].n += 1;
        if (s > 0.009) byClient[k].abiertas += 1;
        var st = estadoFactura(r);
        if (st.key === "vencidas") byClient[k].vencidas += 1;
        var payAt = Number(r.monto_aplicado || 0) > 0 ? r.updated_at || r.fecha : null;
        if (payAt && (!byClient[k].ultimo || payAt > byClient[k].ultimo)) byClient[k].ultimo = payAt;
        if (r.fecha && r.fecha_vto) {
          var em = new Date(r.fecha);
          var vt = new Date(r.fecha_vto);
          if (!isNaN(em) && !isNaN(vt)) byClient[k].plazo = Math.max(1, Math.round((vt - em) / 86400000));
        }
      });
      var clients = Object.keys(byClient).map(function (k) {
        return byClient[k];
      });
      tbody.innerHTML = clients
        .map(function (c) {
          var inicial = String(c.razon_social || "?").trim().charAt(0).toUpperCase() || "?";
          var estadoLabel = c.vencidas > 0 ? "Vencido" : c.saldo > 0 ? "Saldo corriente" : "Al día";
          var estadoCls =
            c.vencidas > 0
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : c.saldo > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";
          var dot =
            c.vencidas > 0 ? "bg-rose-500" : c.saldo > 0 ? "bg-amber-500" : "bg-emerald-500";
          return (
            '<tr class="hover:bg-slate-50/90 transition-colors cursor-pointer" data-sol-fin-cliente="' +
            esc(c.key) +
            '" data-sol-fin-id="' +
            esc(c.id) +
            '">' +
            '<td class="py-3.5 px-4">' +
            '<div class="flex items-center gap-2.5">' +
            '<div class="w-8 h-8 rounded-md bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">' +
            esc(inicial) +
            "</div><div>" +
            '<span data-sol-fin-open-cliente="' +
            esc(c.key) +
            '" class="font-bold text-slate-900 block hover:text-blue-600 cursor-pointer">' +
            esc(c.razon_social || "—") +
            '</span><span class="text-[10px] text-slate-400 font-mono">' +
            esc(c.cuit || "") +
            "</span></div></div></td>" +
            '<td class="py-3.5 px-4 font-mono text-slate-600">' +
            esc(c.cuit || "—") +
            "</td>" +
            '<td class="py-3.5 px-4 text-center"><span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">' +
            c.abiertas +
            "</span></td>" +
            '<td class="py-3.5 px-4 font-mono font-bold text-slate-900">' +
            esc(money(c.saldo)) +
            "</td>" +
            '<td class="py-3.5 px-4 text-center text-slate-500">' +
            c.plazo +
            " días</td>" +
            '<td class="py-3.5 px-4 font-mono text-slate-600">' +
            esc(c.ultimo ? fmtDate(c.ultimo) : "—") +
            "</td>" +
            '<td class="py-3.5 px-4 text-center"><span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ' +
            estadoCls +
            '"><span class="w-1.5 h-1.5 rounded-full ' +
            dot +
            '"></span> ' +
            esc(estadoLabel) +
            "</span></td>" +
            '<td class="py-3.5 px-4 text-right pr-6"><div class="inline-flex items-center justify-end gap-2">' +
            actionsHtml(c) +
            "</div></td></tr>"
          );
        })
        .join("");
    } else if (key === "facturas") {
      tbody.innerHTML = rows
        .slice(0, 40)
        .map(function (r) {
          var st = estadoFactura(r);
          var paid = st.key === "al_dia";
          var ck = clienteKeyOf(r);
          return (
            '<tr class="hover:bg-slate-50/80 transition-colors cursor-pointer" data-sol-fin-id="' +
            esc(r.id) +
            '" data-sol-fin-cliente="' +
            esc(ck) +
            '">' +
            '<td class="py-3.5 px-4 whitespace-nowrap"><span class="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">' +
            esc(r.numero || r.id) +
            "</span></td>" +
            '<td class="py-3.5 px-4"><div data-sol-fin-open-cliente="' +
            esc(ck) +
            '" class="font-bold text-slate-900 hover:text-blue-600 cursor-pointer">' +
            esc(r.razon_social || "—") +
            '</div><div class="text-[11px] text-slate-400 font-normal">' +
            esc(r.descripcion || r.concepto || (r.tipo === "pagar" ? "Factura a pagar" : "Factura a cobrar")) +
            "</div></td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600 text-[11px]">' +
            esc(r.cuit || r.cuit_emisor || r.cuit_receptor || "—") +
            "</td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap text-slate-600">' +
            esc(fmtDate(r.fecha)) +
            "</td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap">' +
            esc(fmtDate(r.fecha_vto)) +
            "</td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap text-right font-bold text-slate-900 font-mono text-sm">' +
            esc(money(r.monto != null ? r.monto : saldo(r))) +
            "</td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap text-center"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ' +
            st.cls +
            '">' +
            esc(paid && r.tipo === "pagar" ? "Pagada" : st.label) +
            "</span></td>" +
            '<td class="py-3.5 px-4 whitespace-nowrap text-right"><div class="inline-flex items-center gap-1.5 justify-end">' +
            (paid
              ? '<button type="button" class="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded">Ver Recibo</button>'
              : '<button type="button" class="px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded shadow-xs">Pagar / Autorizar</button>') +
            '<button type="button" class="p-1 text-slate-400 hover:text-slate-700 rounded" title="Más opciones"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>' +
            "</div></td></tr>"
          );
        })
        .join("");
    } else {
      tbody.innerHTML = rows
        .slice(0, 40)
        .map(function (r) {
          var st = estadoFactura(r);
          return (
            '<tr class="hover:bg-surface-container-low transition-colors group" data-sol-fin-id="' +
            esc(r.id) +
            '">' +
            '<td class="py-3 px-4"><input class="rounded border-outline-variant h-4 w-4" type="checkbox"/></td>' +
            '<td class="py-3 px-4 font-code-table font-semibold text-sm">' +
            esc(r.numero || r.id) +
            "</td>" +
            '<td class="py-3 px-4"><div class="font-semibold text-sm">' +
            esc(r.razon_social || "—") +
            '</div><div class="text-[11px] text-slate-400 font-mono">' +
            esc(r.cuit || r.cuit_emisor || r.cuit_receptor || "") +
            "</div></td>" +
            '<td class="py-3 px-4 text-sm">' +
            esc(r.fecha_vto || r.fecha || "—") +
            "</td>" +
            '<td class="py-3 px-4 text-right font-code-table font-bold text-sm">' +
            esc(money(saldo(r))) +
            "</td>" +
            '<td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ' +
            st.cls +
            '">' +
            esc(st.label) +
            "</span></td>" +
            '<td class="py-3 px-4 text-right"><div class="inline-flex items-center gap-1 justify-end">' +
            actionsHtml(r) +
            "</div></td></tr>"
          );
        })
        .join("");
    }
    // marcar more buttons explicitly
    tbody.querySelectorAll('button[title="Más opciones"], button[aria-label="Más opciones"]').forEach(function (b) {
      b.setAttribute("data-sol-fin-more", "1");
    });
    wireCheckboxes();
    applyFilters();
  }

  function renderConciliacion() {
    var tbody = document.querySelector("main table tbody");
    if (!tbody) return;
    var rows = cobros.length
      ? cobros
      : apiRows.slice(0, 8).map(function (f, i) {
          return {
            id: "demo-cobro-" + i,
            monto: Math.round(saldo(localOf(f)) * 0.4) || 1000,
            estado: i % 3 === 0 ? "pendiente" : "aplicado",
            factura_id: f.id,
            factura_numero: f.numero,
            external_ref: "DEMO-" + (1000 + i),
            created_at: f.fecha || "",
          };
        });
    tbody.innerHTML = rows
      .map(function (c) {
        var fac = c.factura_id ? findRow(c.factura_id) : null;
        var label = c.estado === "aplicado" ? "Conciliado" : "Pendiente";
        var cls = c.estado === "aplicado" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200";
        return (
          '<tr data-sol-fin-id="' +
          esc(fac ? fac.id : "") +
          '" data-sol-fin-cobro="' +
          esc(c.id) +
          '">' +
          '<td class="py-3 px-4 font-mono text-sm">' +
          esc(c.external_ref || c.id) +
          "</td>" +
          '<td class="py-3 px-4 text-sm">' +
          esc((fac && fac.razon_social) || c.cuit || "Pasarela demo") +
          "</td>" +
          '<td class="py-3 px-4 text-right font-mono font-bold">' +
          esc(money(c.monto)) +
          "</td>" +
          '<td class="py-3 px-4 text-sm">' +
          esc(c.factura_numero || (fac && fac.numero) || "—") +
          "</td>" +
          '<td class="py-3 px-4 text-center"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ' +
          cls +
          '">' +
          label +
          "</span></td>" +
          '<td class="py-3 px-4 text-right"><div class="inline-flex gap-1">' +
          '<button type="button" class="px-2 py-1 rounded text-xs font-semibold border border-slate-200">Conciliar</button>' +
          '<button type="button" class="p-1 rounded" title="Más opciones"><span class="material-symbols-outlined text-[16px]">more_vert</span></button>' +
          "</div></td></tr>"
        );
      })
      .join("");
    wireCheckboxes();
    applyFilters();
  }

  function renderComunicacion() {
    var tbody = document.querySelector("main table tbody");
    if (!tbody) return;
    renderRows(apiRows.filter(function (r) {
      return saldo(localOf(r)) > 0;
    }));
  }

  function refreshTables() {
    var key = pageKey();
    if (key === "conciliacion") renderConciliacion();
    else if (key === "comunicacion") renderComunicacion();
    else renderRows(apiRows);
    if (selectedId) {
      var row = findRow(selectedId);
      if (row && drawerEl && !drawerEl.classList.contains("hidden")) openDrawer(row);
    }
  }

  function bannerDemo() {
    if (document.getElementById("sol-fin-demo-banner")) return;
    var b = document.createElement("div");
    b.id = "sol-fin-demo-banner";
    b.className =
      "mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-8 pt-3";
    b.innerHTML =
      '<div class="rounded-xl border border-indigo-100 bg-indigo-50/70 text-indigo-800 text-[11px] font-semibold px-3 py-2">Modo demo Finanzas · datos de prueba. Menú ⋮, detalle, cobro/pago/comunicación y conciliación operan sobre esta cartera.</div>';
    var main = document.querySelector("main");
    if (main && main.parentNode) main.parentNode.insertBefore(b, main);
  }

  function reloadData() {
    var key = pageKey();
    var tipo = key === "facturas" ? "pagar" : "cobrar";
    return Promise.all([
      api("/api/finanzas/resumen").catch(function (e) {
        return { __err: e };
      }),
      api("/api/finanzas/facturas?tipo=" + encodeURIComponent(tipo) + "&limit=100").catch(function (e) {
        return { __err: e };
      }),
      api("/api/finanzas/cobros?limit=100").catch(function () {
        return [];
      }),
    ]).then(function (pair) {
      var resumen = pair[0];
      var facturas = pair[1];
      cobros = Array.isArray(pair[2]) ? pair[2] : [];
      if (resumen && !resumen.__err) {
        live = true;
        paintResumen(resumen);
      }
      if (Array.isArray(facturas)) {
        live = true;
        apiRows = facturas.length ? facturas : key === "facturas" ? demoPagarRows() : [];
      } else {
        apiRows = apiRows.length ? apiRows : key === "facturas" ? demoPagarRows() : [];
      }
      if (key === "cobranza" || key === "clientes" || key === "comunicacion" || key === "dashboard") {
        apiRows = enrichCobrarDemo(apiRows);
      }
      refreshTables();
      wireChips();
      applyFilters();
    });
  }

  function boot() {
    bannerDemo();
    if (pageKey() === "facturas" || pageKey() === "cobranza") filter = "todas";
    wireChips();
    wireSearch();
    wireCheckboxes();
    wireActions();
    applyFilters();
    reloadData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
