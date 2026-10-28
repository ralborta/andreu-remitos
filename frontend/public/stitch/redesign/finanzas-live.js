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
  var menuEl = null;
  var drawerEl = null;

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
    if (s <= 0 || row.estado === "saldada" || row.demo_pagada) return { key: "al_dia", label: row.tipo === "pagar" ? "Pagada" : "Al día", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    var vto = row.fecha_vto ? new Date(row.fecha_vto) : null;
    var now = new Date();
    if (vto && !isNaN(vto) && vto < now) return { key: "vencidas", label: "Vencida", cls: "bg-red-50 text-red-700 border-red-200" };
    if (vto && !isNaN(vto) && (vto - now) / 86400000 <= 7) return { key: "por_vencer", label: "Por vencer", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    if (Number(row.monto_aplicado || 0) > 0 || row.demo_comunicada) return { key: "en_gestion", label: row.demo_comunicada ? "En gestión" : "Parcial", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    return { key: "al_dia", label: "Al día", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  function findRow(id) {
    for (var i = 0; i < apiRows.length; i++) if (apiRows[i].id === id) return localOf(apiRows[i]);
    return null;
  }

  function rowFromEl(el) {
    var tr = el && el.closest ? el.closest("tr[data-sol-fin-id], tr") : null;
    if (!tr) return null;
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
        { id: "detalle", label: "Ver detalle" },
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

  function openDrawer(row) {
    if (!row) return;
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
          filter === st ||
          (filter === "parciales" && st === "en_gestion") ||
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
        if (/Mostrando\s+\d+\s+de\s+\d+/i.test(txt)) {
          el.textContent = "Mostrando " + shown + " de " + total + " filas";
        }
      });
    });
    updateSelectedLabel();
  }

  function paintChipActive(btn) {
    document.querySelectorAll("[data-sol-fin-chip]").forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
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
    document.querySelectorAll("main button").forEach(function (btn) {
      if (btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif]")) return;
      var key = classifyChip(btn.textContent || "");
      if (!key) return;
      btn.setAttribute("data-sol-fin-chip", key);
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
      openDrawer(row || { numero: "Sin ID", razon_social: "Fila de demostración" });
      return;
    }
    if (kind === "nuevo_cobro" || kind === "ver_cobranza") {
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
    if (all.indexOf("ver cobranza") >= 0) return "ver_cobranza";
    if (all === "cobrar" || all.indexOf("registrar pago") >= 0) return "cobrar";
    if (all.indexOf("pagar") >= 0 || all.indexOf("autorizar") >= 0) return "pagar";
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
    if (all.indexOf("detalle") >= 0 || all.indexOf("ver recibo") >= 0 || all.indexOf("ver detalle") >= 0) return "detalle";
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
        var btn = e.target.closest("button");
        if (!btn) {
          closeMenu();
          return;
        }
        if (btn.closest("[data-sol-desk-chat], [data-sol-shell='chrome'], [data-sol-notif]")) return;
        if (!btn.closest("main, aside, [data-purpose], #sol-fin-drawer")) return;
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

  function renderRows(rows) {
    var tbody = document.querySelector("main table tbody");
    if (!tbody) return;
    rows = (rows || []).map(localOf);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td class="py-6 px-4 text-sm text-slate-500" colspan="8">Sin datos de prueba en este listado.</td></tr>';
      return;
    }
    var key = pageKey();
    if (key === "clientes") {
      var byClient = {};
      rows.forEach(function (r) {
        var k = r.razon_social || r.cuit || r.id;
        if (!byClient[k]) byClient[k] = { razon_social: r.razon_social, cuit: r.cuit || r.cuit_emisor, saldo: 0, n: 0, id: r.id };
        byClient[k].saldo += saldo(r);
        byClient[k].n += 1;
      });
      var clients = Object.keys(byClient).map(function (k) {
        return byClient[k];
      });
      tbody.innerHTML = clients
        .map(function (c) {
          return (
            '<tr class="hover:bg-slate-50" data-sol-fin-id="' +
            esc(c.id) +
            '">' +
            '<td class="py-3 px-4"><div class="font-semibold text-slate-800">' +
            esc(c.razon_social || "—") +
            '</div><div class="text-[11px] text-slate-400 font-mono">' +
            esc(c.cuit || "") +
            "</div></td>" +
            '<td class="py-3 px-4 text-sm">' +
            c.n +
            " factura(s)</td>" +
            '<td class="py-3 px-4 text-right font-mono font-bold">' +
            esc(money(c.saldo)) +
            "</td>" +
            '<td class="py-3 px-4 text-right"><div class="inline-flex items-center gap-1">' +
            actionsHtml(c) +
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
        apiRows = facturas;
      } else {
        apiRows = apiRows.length ? apiRows : [];
      }
      refreshTables();
    });
  }

  function boot() {
    bannerDemo();
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
