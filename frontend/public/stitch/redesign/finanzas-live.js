/**
 * Interactividad operativa del módulo Finanzas (Stitch).
 * Filtros, búsqueda, CTAs y toasts. Si la API responde, actualiza KPIs/tablas.
 */
(function () {
  var filter = "todas";
  var query = "";
  var live = false;
  var apiRows = [];

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

  function toast(msg, tone) {
    var el = document.getElementById("sol-fin-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sol-fin-toast";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:9999;max-width:360px;padding:12px 14px;border-radius:12px;font:600 12px/1.4 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 10px 30px rgba(15,23,42,.18);border:1px solid #e2e8f0;background:#fff;color:#0f172a;opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;pointer-events:none;";
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

  function mainTables() {
    return Array.prototype.slice.call(document.querySelectorAll("main table tbody"));
  }

  function rowStatus(tr) {
    var t = fold(tr.textContent || "");
    if (t.indexOf("vencida") >= 0 || t.indexOf("mora") >= 0 || t.indexOf("exigible") >= 0) return "vencidas";
    if (t.indexOf("por vencer") >= 0 || t.indexOf("vence en") >= 0) return "por_vencer";
    if (t.indexOf("en gestion") >= 0 || t.indexOf("parcial") >= 0) return "en_gestion";
    if (t.indexOf("al dia") >= 0 || t.indexOf("pagad") >= 0 || t.indexOf("conciliad") >= 0) return "al_dia";
    if (t.indexOf("discrepan") >= 0 || t.indexOf("pendiente") >= 0) return "pendientes";
    return "otras";
  }

  function applyFilters() {
    var q = fold(query);
    var total = 0;
    var shown = 0;
    mainTables().forEach(function (tbody) {
      Array.prototype.forEach.call(tbody.rows, function (tr) {
        total += 1;
        var st = rowStatus(tr);
        var okFilter =
          filter === "todas" ||
          filter === "todos" ||
          (filter === "vencidas" && st === "vencidas") ||
          (filter === "por_vencer" && st === "por_vencer") ||
          (filter === "en_gestion" && (st === "en_gestion" || st === "parciales")) ||
          (filter === "parciales" && st === "en_gestion") ||
          (filter === "al_dia" && st === "al_dia") ||
          (filter === "pendientes" && (st === "pendientes" || st === "vencidas" || st === "en_gestion")) ||
          (filter === "conciliados" && st === "al_dia") ||
          (filter === "discrepancias" && fold(tr.textContent).indexOf("discrepan") >= 0) ||
          (filter === "rechazados" && fold(tr.textContent).indexOf("rechaz") >= 0) ||
          (filter === "con_saldo" && (st === "vencidas" || st === "por_vencer" || st === "en_gestion"));
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
        if (/Mostrando\s+\d+\s+de\s+\d+/i.test(txt)) {
          el.textContent = "Mostrando " + shown + " de " + total + (live ? " facturas" : " filas");
        }
      });
    });
  }

  function paintChipActive(btn) {
    document.querySelectorAll("[data-sol-fin-chip]").forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      var on = b === btn;
      if (b.getAttribute("data-sol-fin-chip-style") === "pill") {
        b.classList.toggle("bg-indigo-600", on);
        b.classList.toggle("text-white", on);
        b.classList.toggle("bg-white", !on);
        b.classList.toggle("text-slate-600", !on);
      }
    });
  }

  function classifyChip(label) {
    var t = fold(label);
    if (t.indexOf("todas") === 0 || t.indexOf("todos") === 0) return "todas";
    if (t.indexOf("vencid") === 0) return "vencidas";
    if (t.indexOf("por vencer") === 0) return "por_vencer";
    if (t.indexOf("en gestion") === 0) return "en_gestion";
    if (t.indexOf("parcial") === 0) return "parciales";
    if (t.indexOf("al dia") === 0 || t.indexOf("pagad") === 0) return "al_dia";
    if (t.indexOf("pendiente") === 0) return "pendientes";
    if (t.indexOf("conciliad") === 0) return "conciliados";
    if (t.indexOf("discrepan") === 0) return "discrepancias";
    if (t.indexOf("rechaz") === 0) return "rechazados";
    if (t.indexOf("con saldo") === 0) return "con_saldo";
    return null;
  }

  function wireChips() {
    document.querySelectorAll("main button, [data-purpose] button").forEach(function (btn) {
      if (btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif]")) return;
      var key = classifyChip(btn.textContent || "");
      if (!key) return;
      btn.setAttribute("data-sol-fin-chip", key);
      btn.setAttribute("data-sol-fin-chip-style", "pill");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        filter = key;
        paintChipActive(btn);
        applyFilters();
      });
    });
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

  function wireCheckboxes() {
    document.querySelectorAll("main tbody input[type='checkbox']").forEach(function (chk) {
      chk.addEventListener("change", function () {
        var tr = chk.closest("tr");
        if (tr) tr.classList.toggle("bg-indigo-50/40", chk.checked);
        var n = selectedCount();
        document.querySelectorAll("main button").forEach(function (btn) {
          var t = fold(btn.textContent || "");
          if (t.indexOf("comunicar seleccionadas") >= 0 || t.indexOf("enviar recordatorio a seleccionados") >= 0) {
            btn.textContent = btn.textContent.replace(/\(\d+[^)]*\)/, "(" + n + (t.indexOf("destinatario") >= 0 ? " destinatario" + (n === 1 ? "" : "s") : "") + ")");
            if (/\(\d+/.test(btn.textContent) === false && n >= 0) {
              /* keep label; count shown elsewhere */
            }
          }
        });
        var kpi = document.getElementById("kpi-monto-seleccionado");
        if (kpi) kpi.textContent = String(n) + " seleccionados";
      });
    });
  }

  function actionKind(btn) {
    var t = fold(btn.textContent || "");
    var title = fold(btn.getAttribute("title") || "");
    var all = t + " " + title;
    if (btn.querySelector(".fa-bell, .material-symbols-outlined") && /notifications/.test(btn.textContent || "")) return null;
    if (all.indexOf("nuevo cobro") >= 0) return "nuevo_cobro";
    if (all.indexOf("ver cobranza") >= 0) return "ver_cobranza";
    if (all === "cobrar" || all.indexOf("registrar pago") >= 0) return "cobrar";
    if (all.indexOf("pagar") >= 0 || all.indexOf("autorizar") >= 0) return "pagar";
    if (all.indexOf("comunicar") >= 0 || all.indexOf("reclamar") >= 0 || all.indexOf("intimar") >= 0 || all.indexOf("recordar") >= 0 || all.indexOf("anticipar") >= 0) return "comunicar";
    if (all.indexOf("recordatorio masivo") >= 0 || all.indexOf("enviar recordatorio") >= 0 || all.indexOf("emitir reclamo") >= 0) return "comunicar_masivo";
    if ((all === "chat" || title.indexOf("whatsapp") >= 0) && btn.querySelector(".material-symbols-outlined, .fa-solid, i")) return "chat";
    if (all.indexOf("enviar prueba") >= 0) return "enviar_prueba";
    if (all.indexOf("programar envio") >= 0) return "programar";
    if (all.indexOf("enviar recordatorio a seleccionados") >= 0 || all.indexOf("enviar recordatorio a seleccionado") >= 0) return "enviar_seleccion";
    if (all.indexOf("conciliacion con extracto") >= 0 || all.indexOf("ver detalle") >= 0 && pageKey() === "conciliacion") return "ir_conciliacion";
    if (all.indexOf("conciliar") === 0 || all.indexOf("aprobar conciliacion") >= 0 || all.indexOf("simular ingreso") >= 0) return "conciliar";
    if (all.indexOf("observar discrepancia") >= 0 || all.indexOf("ajustar") === 0 || all.indexOf("auditar") === 0) return "discrepancia";
    if (all.indexOf("generar link") >= 0 || all.indexOf("debin") >= 0) return "debin";
    if (all.indexOf("sincronizar") >= 0) return "sync";
    if (all.indexOf("exportar") >= 0 || all.indexOf("descargar informe") >= 0 || all.indexOf("download") >= 0) return "export";
    if (all.indexOf("cargar factura") >= 0 || all.indexOf("ocr") >= 0) return "cargar_factura";
    if (all.indexOf("registrar nuevo cliente") >= 0) return "nuevo_cliente";
    if (all.indexOf("nueva plantilla") >= 0 || all.indexOf("editar plantilla") >= 0) return "plantilla";
    if (all.indexOf("detalle") >= 0 || all.indexOf("ver recibo") >= 0 || all.indexOf("ver detalle de comprobante") >= 0) return "detalle";
    if (all.indexOf("filtros") >= 0) return "filtros";
    if (all === "anterior" || all === "siguiente" || /^\d+$/.test(t)) return "pager";
    if (all === "more_vert" || title.indexOf("mas opciones") >= 0) return "more";
    return null;
  }

  function handleAction(kind, btn) {
    if (kind === "nuevo_cobro" || kind === "ver_cobranza" || kind === "cobrar") {
      go("/finanzas/facturas/cobranzas");
      return;
    }
    if (kind === "chat" || kind === "comunicar" || kind === "comunicar_masivo" || kind === "enviar_seleccion") {
      var n = selectedCount();
      if ((kind === "enviar_seleccion" || kind === "comunicar_masivo") && n === 0) {
        toast("Seleccioná al menos una factura para comunicar.", "err");
        return;
      }
      go("/finanzas/comunicacion");
      return;
    }
    if (kind === "ir_conciliacion" || kind === "conciliar") {
      if (pageKey() !== "conciliacion") {
        go("/finanzas/conciliacion");
        return;
      }
      toast("Conciliación marcada en la vista (demo). El match definitivo lo confirma la pasarela cuando está conectada.", "ok");
      return;
    }
    if (kind === "pagar") {
      toast("Para autorizar el pago usá el flujo de Facturas a pagar. No se registró un pago inventado.", "err");
      return;
    }
    if (kind === "debin") {
      toast("Link DEBIN/QR: pendiente de conexión con la pasarela. No se generó un cobro falso.", "err");
      return;
    }
    if (kind === "sync") {
      toast("Sincronización AFIP/ERP/Banco: el conector no está activo en este ambiente.", "err");
      return;
    }
    if (kind === "export") {
      toast("Exportación disponible cuando hay sesión y datos reales de Finanzas en la API.", live ? "ok" : "err");
      return;
    }
    if (kind === "cargar_factura") {
      toast("Carga OCR: usá el panel operativo de Facturas con archivo cuando la API de Finanzas esté online.", "err");
      return;
    }
    if (kind === "nuevo_cliente") {
      toast("Alta de cliente: todavía no hay formulario de escritura en este borrador.", "err");
      return;
    }
    if (kind === "plantilla") {
      toast("Editor de plantillas: próxima iteración. Podés previsualizar el mensaje en esta pantalla.", "err");
      return;
    }
    if (kind === "enviar_prueba" || kind === "programar") {
      toast("No envío WhatsApp/email real desde el borrador. Usá Contactos si necesitás un mensaje operativo.", "err");
      return;
    }
    if (kind === "discrepancia") {
      toast("Discrepancia registrada en la vista para revisión (demo).", "ok");
      return;
    }
    if (kind === "detalle") {
      var tr = btn.closest("tr");
      var cell = tr ? tr.querySelector("td:nth-child(2), td") : null;
      var label = cell ? String(cell.textContent || "").replace(/\s+/g, " ").trim() : "";
      toast(label ? "Detalle: " + label.slice(0, 80) : "Abrí la fila en Cobranza o Facturas para ver el comprobante.", "ok");
      return;
    }
    if (kind === "filtros") {
      toast("Usá los chips de estado y el buscador para filtrar la tabla.", "ok");
      return;
    }
    if (kind === "pager") {
      toast("Paginación demostrativa sobre el listado visible.", "ok");
      return;
    }
    if (kind === "more") {
      toast("Acciones: Cobrar · Comunicar · Ver en Conciliación", "ok");
      return;
    }
  }

  function wireActions() {
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target.closest("button");
        if (!btn || btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif], [data-sol-fin-chip]")) return;
        if (!btn.closest("main, aside, [data-purpose]")) return;
        var kind = actionKind(btn);
        if (!kind) return;
        e.preventDefault();
        e.stopPropagation();
        handleAction(kind, btn);
      },
      true,
    );
  }

  function setKpiByLabel(labelPart, value) {
    var want = fold(labelPart);
    document.querySelectorAll("main .font-label-caps, main span, main div").forEach(function (el) {
      if (fold(el.textContent || "") !== want) return;
      var card = el.closest(".bg-surface-container-lowest, .rounded-xl, .rounded-2xl, .border");
      if (!card) return;
      var metric = card.querySelector(".font-code-table, .text-metric-stat, .text-2xl, .text-3xl, .font-black, .font-extrabold");
      if (metric && metric !== el) metric.textContent = value;
    });
  }

  function paintResumen(res) {
    if (!res || typeof res !== "object") return;
    if (res.cartera_abierta != null) setKpiByLabel("Deuda Pendiente", money(res.cartera_abierta));
    if (res.cobrado_mes != null) setKpiByLabel("Monto Total Cobrado", money(res.cobrado_mes));
    if (res.facturas_vencidas != null) {
      /* keep design; toast only if needed */
    }
  }

  function estadoFactura(row) {
    var saldo = Number(row.monto || 0) - Number(row.monto_aplicado || 0);
    if (saldo <= 0) return { key: "al_dia", label: "Al día", cls: "bg-surface-container-high text-on-surface-variant border-outline-variant" };
    var vto = row.fecha_vto ? new Date(row.fecha_vto) : null;
    var now = new Date();
    if (vto && vto < now) return { key: "vencidas", label: "Vencida", cls: "bg-red-50 text-red-700 border-red-200" };
    if (vto && (vto - now) / 86400000 <= 7) return { key: "por_vencer", label: "Por vencer", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    if (Number(row.monto_aplicado || 0) > 0) return { key: "en_gestion", label: "Parcial", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    return { key: "al_dia", label: "Al día", cls: "bg-surface-container-high text-on-surface-variant border-outline-variant" };
  }

  function renderDashboardRows(rows) {
    var tbody = document.querySelector("main table tbody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td class="py-6 px-4 text-sm text-slate-500" colspan="7">No hay facturas a cobrar en la API.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .slice(0, 12)
      .map(function (r) {
        var st = estadoFactura(r);
        var saldo = Number(r.monto || 0) - Number(r.monto_aplicado || 0);
        return (
          '<tr class="hover:bg-surface-container-low transition-colors group" data-sol-fin-id="' +
          esc(r.id) +
          '">' +
          '<td class="py-3 px-4"><input class="rounded border-outline-variant text-primary-container focus:ring-secondary h-4 w-4" type="checkbox"/></td>' +
          '<td class="py-3 px-4 font-code-table text-on-surface font-semibold text-body-sm">' +
          esc(r.numero || r.id) +
          "</td>" +
          '<td class="py-3 px-4"><div class="font-semibold text-on-surface text-body-sm">' +
          esc(r.razon_social || "—") +
          '</div><div class="text-[11px] text-outline font-code-table">' +
          esc(r.cuit || "") +
          "</div></td>" +
          '<td class="py-3 px-4 text-body-sm">' +
          esc(r.fecha_vto || "—") +
          "</td>" +
          '<td class="py-3 px-4 text-right font-code-table font-bold text-on-surface text-body-sm">' +
          esc(money(saldo)) +
          "</td>" +
          '<td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ' +
          st.cls +
          '">' +
          esc(st.label) +
          "</span></td>" +
          '<td class="py-3 px-4 text-right"><div class="inline-flex items-center gap-1">' +
          '<button type="button" class="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded text-xs font-semibold" title="Registrar Pago">Cobrar</button>' +
          '<button type="button" class="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Enviar Recordatorio WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>' +
          '<button type="button" class="p-1 text-outline hover:text-on-surface rounded" title="Más opciones"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>' +
          "</div></td></tr>"
        );
      })
      .join("");
    wireCheckboxes();
    applyFilters();
  }

  function loadLive() {
    var key = pageKey();
    var tipo = key === "facturas" ? "pagar" : "cobrar";
    return Promise.all([
      api("/api/finanzas/resumen").catch(function (e) {
        return { __err: e };
      }),
      api("/api/finanzas/facturas?tipo=" + encodeURIComponent(tipo) + "&limit=100").catch(function (e) {
        return { __err: e };
      }),
    ]).then(function (pair) {
      var resumen = pair[0];
      var facturas = pair[1];
      if (resumen && !resumen.__err) {
        live = true;
        paintResumen(resumen);
      }
      if (Array.isArray(facturas)) {
        live = true;
        apiRows = facturas;
        if (key === "dashboard" || key === "cobranza" || key === "facturas" || key === "clientes") {
          renderDashboardRows(facturas);
        }
      } else if (facturas && facturas.__err && facturas.__err.status === 401) {
        toast("Sesión requerida para datos reales de Finanzas. Los botones de navegación siguen activos.", "err");
        document.querySelectorAll("main .font-code-table.text-metric-stat, main .text-metric-stat").forEach(function (el) {
          el.textContent = "—";
        });
      }
      // 404: API aún no desplegada — UI mock operable
    });
  }

  function boot() {
    wireChips();
    wireSearch();
    wireCheckboxes();
    wireActions();
    applyFilters();
    loadLive();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
