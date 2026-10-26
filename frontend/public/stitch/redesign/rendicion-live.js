(function () {
  var PAGE = 6;
  var SESION = "Hace falta una sesión para ver las rendiciones reales.";
  var TAB_ON = "px-3 py-1 rounded-md bg-white text-slate-900 font-bold shadow-sm font-label-md text-label-md";
  var TAB_OFF = "px-3 py-1 rounded-md text-slate-600 hover:text-slate-900 font-medium font-label-md text-label-md transition-colors";
  var PAGE_ON = "px-2.5 py-1 rounded bg-slate-900 text-white font-bold";
  var PAGE_OFF = "px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100";
  var CATS = [
    { id: "", label: "Todas las categorías ▾" },
    { id: "combustible", label: "Combustible ▾" },
    { id: "peaje", label: "Peajes ▾" },
    { id: "mecanica", label: "Mecánica / auxilio ▾" },
    { id: "otro", label: "Otros ▾" },
  ];
  var FECHAS = [
    { id: "", label: "Todas las fechas" },
    { id: "mes", label: "Este mes" },
    { id: "hoy", label: "Hoy" },
  ];
  var MECANICA = { arreglo_menor: 1, llantas: 1, aceite: 1, remolque: 1, auxilio_mecanico: 1 };

  var rows = [];
  var byId = {};
  var resumen = null;
  var rules = null;
  var filtro = "pendiente_aprobacion";
  var catIdx = 0;
  var fechaIdx = 0;
  var page = 0;
  var selectedId = null;
  var primed = false;
  var busy = false;
  var conv = null;
  var chatLog = [];
  var live = false;

  function $(id) { return document.getElementById(id); }
  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null || value === "" ? "—" : String(value);
  }
  function labelOf(el) {
    return fold((el && (el.innerText || el.textContent)) || "");
  }
  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }
  function api(path, opts) {
    opts = opts || {};
    return fetch("/backend" + path, {
      method: opts.method || "GET",
      credentials: "include",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body || undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error(data.message || data.error || ("HTTP " + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);
  }
  function mismoDia(iso) {
    if (!iso) return false;
    var t = new Date(iso);
    if (!isFinite(t.getTime())) return false;
    var h = new Date();
    return t.getFullYear() === h.getFullYear() && t.getMonth() === h.getMonth() && t.getDate() === h.getDate();
  }
  function mismoMes(iso) {
    if (!iso) return false;
    var t = new Date(iso);
    if (!isFinite(t.getTime())) return false;
    var h = new Date();
    return t.getFullYear() === h.getFullYear() && t.getMonth() === h.getMonth();
  }
  function mediaUrl(u) {
    if (!u) return "";
    u = String(u).trim();
    if (u.indexOf("/backend/") === 0) return u;
    if (u.indexOf("/api/media/") === 0) return "/backend" + u;
    var m = u.match(/\/v1\/files\/([a-fA-F0-9]+)/i);
    if (m) return "/backend/api/media/bot/" + m[1];
    return u;
  }
  function nota(texto) { setText("sol-ren-estado", texto); }
  function cola(texto) { setText("sol-ren-cola", texto); }

  function dash() {
    ["sol-ren-kpi-mes", "sol-ren-kpi-leidos", "sol-ren-kpi-tiempo", "sol-ren-kpi-monto", "sol-ren-pill-ok", "sol-ren-pill-no", "sol-ren-pill-erp", "sol-ren-pill-total", "sol-ren-pie-monto", "sol-ren-bar-total"].forEach(function (id) { setText(id, "—"); });
    setText("sol-ren-kpi-mes-hint", "sin dato");
    setText("sol-ren-kpi-mes-sub", "—");
    setText("sol-ren-kpi-leidos-hint", "sin dato");
    setText("sol-ren-kpi-leidos-sub", "sin % de OCR");
    setText("sol-ren-kpi-tiempo-hint", "sin medición");
    setText("sol-ren-kpi-tiempo-sub", "no está medido");
    setText("sol-ren-kpi-monto-hint", "—");
    setText("sol-ren-kpi-monto-sub", "sin dato");
    setText("sol-ren-pill-pend", "Pendientes (—)");
    setText("sol-ren-pill-monto", "—");
    setText("sol-ren-erp-estado", "Simulado");
    for (var i = 1; i <= 5; i++) {
      setText("sol-ren-bar-" + i + "-monto", "—");
      setText("sol-ren-bar-" + i + "-pct", "—");
      var w = $("sol-ren-bar-" + i + "-w");
      if (w) w.style.width = "0%";
    }
  }

  function chk(id, text) {
    setText(id, text);
    var el = $(id);
    var row = el && el.parentElement;
    if (!row) return;
    row.className = "flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700";
    var icon = row.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = "info";
      icon.className = "material-symbols-outlined text-[16px] text-slate-400";
    }
  }

  function fechaCorta(g) {
    var raw = g.fechaComprobante || g.createdAt;
    if (!raw) return "—";
    var d = new Date(raw);
    if (!isFinite(d.getTime())) return String(raw).slice(0, 16);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    if (g.fechaComprobante && String(g.fechaComprobante).length <= 10) return dd + "/" + mm;
    return dd + "/" + mm + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function catCls(cat) {
    if (cat === "combustible") return "bg-blue-50 text-blue-700";
    if (cat === "peaje") return "bg-cyan-50 text-cyan-700";
    if (MECANICA[cat]) return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-700";
  }

  function estadoCls(est) {
    if (est === "aprobado") return "bg-emerald-50 text-emerald-800";
    if (est === "rechazado") return "bg-rose-50 text-rose-800";
    if (est === "borrador") return "bg-slate-100 text-slate-700";
    return "bg-amber-50 text-amber-800";
  }

  function pasa(g) {
    if (filtro !== "todos" && g.estado !== filtro) return false;
    var cat = CATS[catIdx].id;
    if (cat === "mecanica") {
      if (!MECANICA[g.categoria]) return false;
    } else if (cat && g.categoria !== cat) return false;
    var modo = FECHAS[fechaIdx].id;
    var iso = g.fechaComprobante || g.createdAt;
    if (modo === "hoy" && !mismoDia(iso)) return false;
    if (modo === "mes" && !mismoMes(iso)) return false;
    var q = fold(($("sol-ren-buscar") || {}).value);
    if (!q) return true;
    return fold([g.codigo, g.choferNombre, g.telefono, g.viajeRef, g.nroViajeDelfos, g.cuitProveedor, g.proveedor, g.patente, g.descripcion, g.remitoRef].join(" ")).indexOf(q) >= 0;
  }

  function visibles() { return rows.filter(pasa); }

  function pintarTabs() {
    var counts = {
      pendiente_aprobacion: resumen ? resumen.pendientes : rows.filter(function (g) { return g.estado === "pendiente_aprobacion"; }).length,
      aprobado: resumen ? resumen.aprobados : rows.filter(function (g) { return g.estado === "aprobado"; }).length,
      rechazado: resumen ? resumen.rechazados : rows.filter(function (g) { return g.estado === "rechazado"; }).length,
      todos: resumen ? resumen.total : rows.length,
    };
    var names = { pendiente_aprobacion: "Pendientes", aprobado: "Aprobados", rechazado: "Rechazados", todos: "Todos" };
    var buttons = document.querySelectorAll("[data-filtro]");
    for (var i = 0; i < buttons.length; i++) {
      var kind = buttons[i].getAttribute("data-filtro");
      buttons[i].className = kind === filtro ? TAB_ON : TAB_OFF;
      if (names[kind]) buttons[i].textContent = names[kind] + " (" + (counts[kind] == null ? "—" : counts[kind]) + ")";
    }
    setText("sol-ren-pill-pend", "Pendientes (" + counts.pendiente_aprobacion + ")");
    setText("sol-ren-pill-ok", String(counts.aprobado));
    setText("sol-ren-pill-no", String(counts.rechazado));
    setText("sol-ren-pill-total", String(counts.todos));
    setText("sol-ren-pill-erp", "—");
    setText("sol-ren-pill-monto", resumen ? money(resumen.monto_pendiente) : "—");
  }

  function pintarKpis() {
    var delMes = rows.filter(function (g) { return mismoMes(g.createdAt); }).length;
    var leidos = rows.filter(function (g) { return g.imagenUrl || (g.textoOcr && String(g.textoOcr).trim()); }).length;
    var pend = resumen ? resumen.pendientes : rows.filter(function (g) { return g.estado === "pendiente_aprobacion"; }).length;
    setText("sol-ren-kpi-mes", String(delMes));
    setText("sol-ren-kpi-mes-hint", "sin comparación");
    setText("sol-ren-kpi-mes-sub", (resumen ? resumen.total : rows.length) + " en total");
    setText("sol-ren-kpi-leidos", String(leidos));
    setText("sol-ren-kpi-leidos-hint", "con foto o lectura");
    setText("sol-ren-kpi-leidos-sub", "sin % de OCR");
    setText("sol-ren-kpi-tiempo", "—");
    setText("sol-ren-kpi-tiempo-hint", "sin medición");
    setText("sol-ren-kpi-tiempo-sub", "no está medido");
    setText("sol-ren-kpi-monto", resumen ? money(resumen.monto_pendiente) : "—");
    setText("sol-ren-kpi-monto-hint", pend + " tickets");
    setText("sol-ren-kpi-monto-sub", pend ? "Acción requerida" : "Sin pendientes");
    setText("sol-ren-erp-estado", "Simulado");
  }

  function pintarBarras() {
    var sums = [0, 0, 0, 0, 0, 0];
    rows.forEach(function (g) {
      var n = Number(g.monto);
      if (!isFinite(n)) return;
      var b = g.categoria === "combustible" ? 1 : g.categoria === "peaje" ? 2 : MECANICA[g.categoria] ? 3 : 5;
      sums[b] += n;
      sums[0] += n;
    });
    setText("sol-ren-bar-total", sums[0] ? money(sums[0]) : "—");
    for (var i = 1; i <= 5; i++) {
      var pct = sums[0] ? Math.round((sums[i] / sums[0]) * 100) : 0;
      setText("sol-ren-bar-" + i + "-monto", money(sums[i]));
      setText("sol-ren-bar-" + i + "-pct", pct + "%");
      var w = $("sol-ren-bar-" + i + "-w");
      if (w) w.style.width = pct + "%";
    }
  }

  function ver(g) {
    if (!g) return;
    selectedId = g.id;
    setText("sol-ren-ticket", "Inspección de Ticket Activo " + (g.codigo || g.id));
    setText("sol-ren-ticket-sub", g.estadoLabel || "Gasto");
    setText("sol-ren-confianza", "sin score");
    setText("sol-ren-ocr-prov", g.proveedor || "Sin proveedor");
    setText("sol-ren-ocr-dir", g.descripcion || "Sin domicilio en el comprobante");
    setText("sol-ren-ocr-cuit", g.cuitProveedor ? "CUIT: " + g.cuitProveedor : "Sin CUIT");
    setText("sol-ren-ocr-fecha", g.fechaComprobante || fechaCorta(g));
    setText("sol-ren-ocr-concepto", g.categoriaLabel || "—");
    setText("sol-ren-ocr-vol", "—");
    setText("sol-ren-ocr-pago", "—");
    setText("sol-ren-ocr-total", g.montoLabel || money(g.monto));
    setText("sol-ren-escaneo", g.imagenUrl ? "Hay foto" : "Sin foto");
    setText("sol-ren-det-chofer", g.choferNombre || g.telefono || "—");
    var viaje = g.viajeRef && g.viajeRef !== "—" ? g.viajeRef : (g.nroViajeDelfos || g.remitoRef || "Sin viaje vinculado");
    setText("sol-ren-det-viaje", viaje);
    setText("sol-ren-det-cat", g.categoriaLabel || "—");
    setText("sol-ren-det-canal", g.origenCarga === "administracion" ? "Cargado por administración" : "Chofer");
    chk("sol-ren-chk-1", g.cuitProveedor ? "CUIT en el comprobante: " + g.cuitProveedor : "Sin CUIT en el comprobante");
    chk("sol-ren-chk-2", g.fechaComprobante ? "Fecha del comprobante: " + g.fechaComprobante : "Sin fecha de comprobante");
    chk("sol-ren-chk-3", "Sin validación de geocerca");
    chk("sol-ren-chk-4", g.monto != null ? "Importe " + (g.montoLabel || money(g.monto)) + ". Sin tope de tramo cargado." : "Sin importe");
    nota(g.estado === "pendiente_aprobacion" ? "Pendiente de aprobación humana." : (g.estadoLabel || "Gasto"));
  }

  function acciones(g) {
    if (g.estado !== "pendiente_aprobacion") {
      return '<button type="button" data-act="ver" class="px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors">Ver detalle</button>';
    }
    return '<div class="flex items-center justify-center gap-1.5">' +
      '<button type="button" data-act="ver" title="Revisar ticket" class="p-1 rounded hover:bg-white text-indigo-600 transition-colors"><span class="material-symbols-outlined text-[17px]">visibility</span></button>' +
      '<button type="button" data-act="aprobar" title="Aprobar" class="p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"><span class="material-symbols-outlined text-[17px]">check_circle</span></button>' +
      '<button type="button" data-act="rechazar" title="Rechazar" class="p-1 rounded hover:bg-rose-100 text-rose-600 transition-colors"><span class="material-symbols-outlined text-[17px]">cancel</span></button>' +
      "</div>";
  }

  function fila(g) {
    var on = g.id === selectedId;
    var sub = g.patente || g.telefono || "—";
    var viaje = g.viajeRef && g.viajeRef !== "—" ? g.viajeRef : "—";
    var viajeSub = g.remitoRef || g.nroViajeDelfos || "";
    return '<tr data-id="' + esc(g.id) + '" class="' + (on ? "bg-indigo-50/40 " : "") + 'hover:bg-slate-50 transition-colors cursor-pointer">' +
      '<td class="py-3.5 px-4 font-code-table text-code-table font-bold text-indigo-700">' + esc(g.codigo || g.id) + "</td>" +
      '<td class="py-3.5 px-4 font-code-table text-code-table text-slate-600">' + esc(fechaCorta(g)) + "</td>" +
      '<td class="py-3.5 px-4"><div class="font-bold text-slate-900">' + esc(g.choferNombre || "—") + '</div><div class="text-[11px] text-slate-400 font-code-table text-code-table">' + esc(sub) + "</div></td>" +
      '<td class="py-3.5 px-4"><span class="font-code-table text-code-table font-semibold text-slate-900">' + esc(viaje) + "</span>" +
      (viajeSub ? '<div class="text-[11px] text-slate-500">' + esc(viajeSub) + "</div>" : "") + "</td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-caps text-label-caps font-semibold ' + catCls(g.categoria) + '">' + esc(g.categoriaLabel || "—") + "</span></td>" +
      '<td class="py-3.5 px-4"><div class="font-semibold text-slate-800">' + esc(g.proveedor || "—") + '</div><div class="text-[10px] text-slate-400 font-code-table text-code-table">' + esc(g.cuitProveedor || "—") + "</div></td>" +
      '<td class="py-3.5 px-4 text-right font-code-table text-code-table font-bold text-slate-900">' + esc(g.montoLabel || money(g.monto)) + "</td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>' + esc(g.origenCarga === "administracion" ? "Administración" : "Chofer") + "</span></td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold ' + estadoCls(g.estado) + '">' + esc(g.estadoLabel || g.estado || "—") + "</span></td>" +
      '<td class="py-3.5 px-4 text-center">' + acciones(g) + "</td></tr>";
  }

  function vacio(texto) {
    var body = $("sol-ren-body");
    if (body) body.innerHTML = '<tr><td colspan="10" class="py-8 px-4 text-center text-sm text-slate-500">' + esc(texto) + "</td></tr>";
    setText("sol-ren-pie", texto);
    setText("sol-ren-pie-monto", "—");
  }

  function pintarTabla() {
    var list = visibles();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    var body = $("sol-ren-body");
    if (!body) return;
    if (!slice.length) {
      vacio(rows.length ? "No hay gastos con este filtro." : "No hay gastos.");
    } else {
      body.innerHTML = slice.map(fila).join("");
      var suma = list.reduce(function (a, g) { return a + (Number(g.monto) || 0); }, 0);
      setText("sol-ren-pie", "Mostrando " + (page * PAGE + 1) + "–" + (page * PAGE + slice.length) + " de " + list.length);
      setText("sol-ren-pie-monto", money(suma));
    }
    var footer = $("sol-ren-pie") && $("sol-ren-pie").closest(".p-4");
    var grupos = footer ? footer.querySelectorAll(".flex.items-center.gap-1") : [];
    var box = grupos.length ? grupos[grupos.length - 1] : null;
    if (!box) return;
    var buttons = box.querySelectorAll("button");
    var nums = [];
    for (var i = 0; i < buttons.length; i++) {
      var t = labelOf(buttons[i]);
      if (t === "anterior" || t.indexOf("siguiente") >= 0) continue;
      nums.push(buttons[i]);
    }
    for (var j = 0; j < nums.length; j++) {
      var n = pages <= 3 ? j : page - 1 + j;
      if (n < 0 || n >= pages) {
        nums[j].style.visibility = "hidden";
        continue;
      }
      nums[j].style.visibility = "";
      nums[j].textContent = String(n + 1);
      nums[j].className = n === page ? PAGE_ON : PAGE_OFF;
      nums[j].setAttribute("data-page", String(n));
    }
  }

  function sesion() {
    live = false;
    rows = [];
    dash();
    vacio(SESION);
    if (!conv) setText("sol-ren-chat", SESION);
    nota(SESION);
    cola(SESION);
  }

  function load() {
    return Promise.all([
      api("/api/rendicion?limit=200"),
      api("/api/rendicion/resumen").catch(function () { return null; }),
      api("/api/rendicion/meta").catch(function () { return null; }),
    ]).then(function (pack) {
      live = true;
      rows = asList(pack[0]);
      resumen = pack[1];
      rules = pack[2] && pack[2].rules ? pack[2].rules : rules;
      byId = {};
      rows.forEach(function (g) { byId[g.id] = g; });
      pintarKpis();
      pintarTabs();
      pintarBarras();
      if (!primed) {
        primed = true;
        var primero = rows.filter(function (g) { return g.estado === "pendiente_aprobacion"; })[0] || rows[0];
        if (primero) ver(primero);
      } else if (selectedId && !byId[selectedId]) selectedId = null;
      pintarTabla();
    }).catch(function (err) {
      if (err && err.status === 401) sesion();
      else {
        vacio((err && err.message) || "No pude leer las rendiciones.");
        nota((err && err.message) || "No pude leer las rendiciones.");
      }
    });
  }

  function aprobar(g) {
    if (!g || busy) return;
    if (g.estado !== "pendiente_aprobacion") {
      nota("Solo se aprueba un gasto pendiente.");
      return;
    }
    var nro = "";
    if (rules && rules.requireNroViajeDelfosOnApprove) {
      var pedido = window.prompt(rules.labelNroViaje || "Nº viaje Delfos", g.nroViajeDelfos || "");
      if (pedido == null) { nota("No se aprobó."); return; }
      nro = String(pedido).trim();
      if (!nro) { nota("Falta el número de viaje para aprobar."); return; }
    }
    var ok = window.confirm("Aprobar " + (g.codigo || g.id) + " · " + (g.categoriaLabel || "") + " · " + (g.montoLabel || "") + "\n" + (g.choferNombre || g.telefono || "") + "\nSi el chofer tiene teléfono, se le avisa por WhatsApp.");
    if (!ok) { nota("No se aprobó."); return; }
    busy = true;
    nota("Aprobando…");
    api("/api/rendicion/" + encodeURIComponent(g.id) + "/decidir", {
      method: "POST",
      body: JSON.stringify({ estado: "aprobado", nro_viaje_delfos: nro || undefined, remito_ref: g.remitoRef || undefined }),
    }).then(function () {
      nota("Gasto aprobado.");
      return load();
    }).catch(function (err) {
      nota(err.status === 401 ? SESION : (err.message || "No se aprobó."));
    }).then(function () { busy = false; });
  }

  function rechazar(g) {
    if (!g || busy) return;
    if (g.estado !== "pendiente_aprobacion") {
      nota("Solo se rechaza un gasto pendiente.");
      return;
    }
    var motivo = window.prompt("Motivo del rechazo de " + (g.codigo || g.id) + " (obligatorio). Si hay teléfono, se avisa por WhatsApp.", "");
    if (motivo == null) { nota("No se rechazó."); return; }
    if (!String(motivo).trim()) { nota("El rechazo pide un comentario."); return; }
    busy = true;
    nota("Rechazando…");
    api("/api/rendicion/" + encodeURIComponent(g.id) + "/decidir", {
      method: "POST",
      body: JSON.stringify({ estado: "rechazado", nota: String(motivo).trim() }),
    }).then(function () {
      nota("Gasto rechazado.");
      return load();
    }).catch(function (err) {
      nota(err.status === 401 ? SESION : (err.message || "No se rechazó."));
    }).then(function () { busy = false; });
  }

  function bajar(formato) {
    var estado = filtro === "todos" ? "" : filtro;
    if (formato === "erp" && estado === "pendiente_aprobacion") estado = "aprobado";
    var q = new URLSearchParams();
    q.set("formato", formato);
    q.set("limit", "500");
    if (estado) q.set("estado", estado);
    var buscar = ($("sol-ren-buscar") || {}).value || "";
    if (buscar.trim()) q.set("q", buscar.trim());
    cola(formato === "erp" ? "Descargando Excel ERP…" : "Descargando Excel…");
    fetch("/backend/api/rendicion/export?" + q.toString(), { credentials: "include" }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (data) {
        throw new Error(data.error || data.message || ("HTTP " + r.status));
      });
      var cd = r.headers.get("Content-Disposition") || "";
      var match = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      var name = match && match[1] ? decodeURIComponent(match[1]) : ("Rendiciones_" + formato + ".xlsx");
      return r.blob().then(function (blob) { return { blob: blob, name: name }; });
    }).then(function (file) {
      var url = URL.createObjectURL(file.blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      cola("Excel listo.");
    }).catch(function (err) {
      cola(err.message || "No se pudo descargar el Excel.");
    });
  }

  function enviarErp() {
    if (busy) return;
    var estado = filtro === "todos" || filtro === "pendiente_aprobacion" ? "aprobado" : filtro;
    var ok = window.confirm("Esto simula el envío al ERP de los gastos " + (estado === "aprobado" ? "aprobados" : estado) + ".\nNo conecta con Tango ni SAP.");
    if (!ok) { cola("No se envió al ERP."); return; }
    busy = true;
    cola("Simulando envío…");
    var body = { estado: estado, limit: 500 };
    var buscar = ($("sol-ren-buscar") || {}).value || "";
    if (buscar.trim()) body.q = buscar.trim();
    api("/api/rendicion/enviar-erp", { method: "POST", body: JSON.stringify(body) }).then(function (res) {
      cola((res.mensaje || "Simulación lista.") + (res.enviados != null ? " Enviados: " + res.enviados + "." : ""));
    }).catch(function (err) {
      cola(err.status === 401 ? SESION : (err.message || "No se simuló el envío."));
    }).then(function () { busy = false; });
  }

  function preguntar(q) {
    q = String(q || "").trim();
    if (!q) return;
    setText("sol-ren-chat", "Consultando…");
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({ agentId: "rendicion", message: q, conversationId: conv || undefined }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      var text = (res.message && res.message.text) || "Sin respuesta.";
      chatLog.push(q + " — " + text);
      setText("sol-ren-chat", text);
    }).catch(function (err) {
      setText("sol-ren-chat", err.status === 401 ? SESION : (err.message || "No pude consultar."));
    });
  }

  dash();
  setText("sol-ren-fecha", FECHAS[0].label);
  setText("sol-ren-cat", CATS[0].label);
  setText("sol-ren-regla", "La aprobación humana es siempre requerida. El envío al ERP desde esta pantalla es una simulación: no liquida en Tango ni SAP.");
  setText("sol-ren-confianza", "sin score");
  setText("sol-ren-ocr-vol", "—");
  setText("sol-ren-ocr-pago", "—");
  chk("sol-ren-chk-1", "Sin validación de CUIT en AFIP");
  chk("sol-ren-chk-2", "Sin ventana de viaje medida");
  chk("sol-ren-chk-3", "Sin validación de geocerca");
  chk("sol-ren-chk-4", "Sin tope de tramo cargado");
  nota("Elegí un gasto. Todavía no se aprobó ni se rechazó nada.");
  vacio("Cargando rendiciones…");
  load();
  setInterval(function () { if (!busy) load(); }, 12000);

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pill = t.closest("[data-filtro]");
    var act = t.closest("[data-act]");
    var row = t.closest("#sol-ren-body tr[data-id]");
    var pageBtn = t.closest("[data-page]");
    var textoBtn = t.closest("button");
    var texto = textoBtn ? labelOf(textoBtn) : "";
    var chipBtn = t.closest("button");
    var chatChip = chipBtn && $("sol-ren-chat") && chipBtn.closest(".bg-white") === $("sol-ren-chat").closest(".bg-white") && String(chipBtn.className).indexOf("rounded-full") >= 0;
    var consultar = $("sol-ren-pregunta") && textoBtn && textoBtn.parentElement === $("sol-ren-pregunta").parentElement && textoBtn !== $("sol-ren-pregunta");
    var chipBox = t.closest(".inline-flex");
    var fecha = chipBox && chipBox.querySelector("#sol-ren-fecha");
    var cat = chipBox && chipBox.querySelector("#sol-ren-cat");
    var preview = t.closest("#sol-ren-preview");
    var handled = pill || act || row || pageBtn || chatChip || consultar || fecha || cat || preview || t.closest("#sol-ren-aprobar") || t.closest("#sol-ren-rechazar") || t.closest("#sol-ren-observar");
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("cargar comprobante") >= 0 || texto.indexOf("actualizar") >= 0 || texto.indexOf("enviar al erp") >= 0 || texto.indexOf("excel") >= 0 || texto === "anterior" || texto.indexOf("siguiente") >= 0 || texto === "historial" || texto.indexOf("nueva conversacion") >= 0) handled = textoBtn;
    if (!handled) return;
    ev.preventDefault();
    ev.stopPropagation();

    if (t.closest("#sol-ren-aprobar") || (act && act.getAttribute("data-act") === "aprobar")) {
      aprobar(act ? byId[row && row.getAttribute("data-id")] : byId[selectedId]);
      return;
    }
    if (t.closest("#sol-ren-rechazar") || (act && act.getAttribute("data-act") === "rechazar")) {
      rechazar(act ? byId[row && row.getAttribute("data-id")] : byId[selectedId]);
      return;
    }
    if (t.closest("#sol-ren-observar")) {
      nota("Pedir más info no sale de esta pantalla. El chofer carga el comprobante por WhatsApp.");
      return;
    }
    if (preview) {
      var g = byId[selectedId];
      var url = g && mediaUrl(g.imagenUrl);
      if (url) window.open(url, "_blank", "noopener");
      else nota("Este gasto no tiene foto del comprobante.");
      return;
    }
    if (texto.indexOf("cargar comprobante") >= 0) {
      nota("El comprobante lo carga el chofer por WhatsApp. Esta pantalla no abre un formulario nuevo.");
      return;
    }
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("actualizar") >= 0) {
      cola("Actualizando…");
      load().then(function () { if (live) cola("Lista actualizada."); });
      return;
    }
    if (texto.indexOf("enviar al erp") >= 0) { enviarErp(); return; }
    if (texto.indexOf("excel erp") >= 0) { bajar("erp"); return; }
    if (texto.indexOf("excel") >= 0) { bajar("mesa"); return; }
    if (pill) {
      filtro = pill.getAttribute("data-filtro");
      page = 0;
      pintarTabs();
      pintarTabla();
      return;
    }
    if (fecha) {
      fechaIdx = (fechaIdx + 1) % FECHAS.length;
      setText("sol-ren-fecha", FECHAS[fechaIdx].label);
      page = 0;
      pintarTabla();
      return;
    }
    if (cat) {
      catIdx = (catIdx + 1) % CATS.length;
      setText("sol-ren-cat", CATS[catIdx].label);
      page = 0;
      pintarTabla();
      return;
    }
    if (act && act.getAttribute("data-act") === "ver" && row) {
      ver(byId[row.getAttribute("data-id")]);
      pintarTabla();
      return;
    }
    if (row) {
      ver(byId[row.getAttribute("data-id")]);
      pintarTabla();
      return;
    }
    if (pageBtn) {
      page = Number(pageBtn.getAttribute("data-page")) || 0;
      pintarTabla();
      return;
    }
    if (texto === "anterior") { page = Math.max(0, page - 1); pintarTabla(); return; }
    if (texto.indexOf("siguiente") >= 0) { page += 1; pintarTabla(); return; }
    if (texto === "historial") {
      setText("sol-ren-chat", chatLog.length ? chatLog.slice(-3).join(" · ") : "Todavía no hay preguntas en esta charla.");
      return;
    }
    if (texto.indexOf("nueva conversacion") >= 0) {
      conv = null;
      chatLog = [];
      setText("sol-ren-chat", "Charla nueva. Preguntá sobre los gastos cargados.");
      return;
    }
    if (chatChip || consultar) {
      var q = consultar ? ($("sol-ren-pregunta").value || "") : labelOf(chipBtn);
      if (consultar) $("sol-ren-pregunta").value = "";
      preguntar(q);
    }
  }, true);

  var buscar = $("sol-ren-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; pintarTabla(); });
  var pregunta = $("sol-ren-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    preguntar(pregunta.value);
    pregunta.value = "";
  });
})();
