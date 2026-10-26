(function () {
  var PAGE = 6;
  var SESION = "Hace falta una sesión para ver las incidencias reales.";
  var PINS = [
    { id: "pana", label: "Panamericana km 35", query: "Autopista Panamericana km 35, Buenos Aires" },
    { id: "ezeiza", label: "Acceso Ezeiza", query: "Autopista Riccheri, Ezeiza, Buenos Aires" },
    { id: "puerto", label: "Puerto Madero", query: "Puerto Madero, CABA" },
    { id: "pacheco", label: "Pacheco", query: "General Pacheco, Buenos Aires" },
    { id: "lujan", label: "Acceso Luján", query: "Acceso Oeste Luján, Buenos Aires" },
  ];
  var TIPOS = [
    { id: "parada_no_prevista", label: "Parada no prevista" },
    { id: "desvio_ruta", label: "Desvío de ruta" },
    { id: "demora", label: "Demora" },
    { id: "anomalia", label: "Anomalía" },
  ];
  var PILL_ON = "px-3.5 py-1.5 rounded-lg bg-[#0e1738] text-white font-semibold flex items-center gap-2 shadow-xs whitespace-nowrap";
  var PILL_OFF = "px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium flex items-center gap-2 shadow-xs whitespace-nowrap transition-colors";
  var PILL_ALTA = "px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-colors";
  var PIN_ON = "px-3 py-1.5 rounded-lg bg-[#0e1738] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs";
  var PIN_OFF = "px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1";
  var TAB_ON = "pb-3 border-b-2 border-indigo-600 text-indigo-700 font-bold flex items-center gap-2";
  var TAB_OFF = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors";
  var PAGE_ON = "px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold shadow-xs";
  var PAGE_OFF = "px-3 py-1 rounded-lg hover:bg-white text-slate-600";

  var rows = [];
  var byId = {};
  var choferes = [];
  var filtro = "abiertas";
  var page = 0;
  var pinId = "pana";
  var tipoIdx = 0;
  var chofer = null;
  var ubic = null;
  var menuOpen = false;
  var busy = false;
  var conv = null;
  var live = false;
  var ultimoPunto = null;

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
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function mismoDia(iso) {
    if (!iso) return false;
    var t = new Date(iso);
    if (!isFinite(t.getTime())) return false;
    var h = new Date();
    return t.getFullYear() === h.getFullYear() && t.getMonth() === h.getMonth() && t.getDate() === h.getDate();
  }
  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.destinos)) return data.destinos;
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
  function labelOf(el) {
    return fold((el && (el.innerText || el.textContent)) || "");
  }

  function telemetriaVacia() {
    setText("sol-inc-vel", "—");
    setText("sol-inc-motor", "—");
    setText("sol-inc-bat", "—");
    setText("sol-inc-senal", "—");
  }

  function dashKpis() {
    setText("sol-inc-kpi-hoy", "—");
    setText("sol-inc-kpi-hoy-hint", "sin dato");
    setText("sol-inc-kpi-hoy-sub", "Hace falta una sesión");
    setText("sol-inc-kpi-causa", "—");
    setText("sol-inc-kpi-causa-hint", "sin dato");
    setText("sol-inc-kpi-tiempo", "—");
    setText("sol-inc-kpi-tiempo-hint", "sin medición");
    setText("sol-inc-kpi-alta", "—");
    setText("sol-inc-kpi-alta-hint", "sin dato");
    setText("sol-inc-kpi-alta-sub", "sin temporizador medido");
    setText("sol-inc-vivos", "—");
    setText("sol-inc-alta-chip", "— en criticidad alta");
    var donut = $("sol-inc-donut");
    if (donut) donut.setAttribute("stroke-dasharray", "0, 100");
    setText("sol-inc-donut-label", "—");
  }

  function nota(texto) {
    setText("sol-inc-espera", texto);
  }

  function postPunto(lat, lng) {
    ultimoPunto = { lat: lat, lng: lng };
    var frame = $("sol-inc-map");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "sol-incidencias", action: "point", lat: lat, lng: lng }, "*");
    }
    setText("sol-inc-lat", "Lat: " + Number(lat).toFixed(4) + " · Lng: " + Number(lng).toFixed(4));
  }

  function pinActual() {
    for (var i = 0; i < PINS.length; i++) if (PINS[i].id === pinId) return PINS[i];
    return PINS[0];
  }

  function pintarPin() {
    var buttons = document.querySelectorAll("[data-pin]");
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute("data-pin") === pinId;
      buttons[i].className = on ? PIN_ON : PIN_OFF;
      var icon = buttons[i].querySelector(".material-symbols-outlined");
      if (icon) icon.className = "material-symbols-outlined " + (on ? "text-sm text-amber-400" : "text-xs text-slate-400");
    }
  }

  function pintarTipo() {
    setText("sol-inc-tipo-label", TIPOS[tipoIdx].label);
  }

  function pintarChofer() {
    if (!chofer) {
      setText("sol-inc-chofer-nombre", "Elegí un chofer");
      setText("sol-inc-chofer-sub", choferes.length ? "Flota de Viajes" : "Sin choferes con teléfono");
    } else {
      setText("sol-inc-chofer-nombre", chofer.nombre);
      setText("sol-inc-chofer-sub", chofer.tel);
    }
  }

  function pintarPreview() {
    var el = $("sol-inc-preview");
    if (!el) return;
    var nombre = chofer ? chofer.nombre.split(" ")[0] : "chofer";
    var lugar = ubic ? ubic.formattedAddress : pinActual().label;
    el.innerHTML = "Hola <strong class=\"text-slate-900\">" + esc(nombre) + "</strong>, detectamos una parada en <strong class=\"text-slate-900\">" + esc(lugar) + "</strong>. ¿Nos confirmás la causa?";
  }

  function origen(o) {
    if (o === "agente") return "Agente";
    if (o === "destinos_demora") return "Destinos";
    if (o === "tracking_express") return "Tracking";
    return "Chofer";
  }

  function tipoCls(tipo) {
    if (tipo === "desvio_ruta") return "bg-blue-50 text-blue-800 border border-blue-200";
    if (tipo === "demora") return "bg-amber-50 text-amber-800 border border-amber-200";
    if (tipo === "parada_no_prevista") return "bg-rose-50 text-rose-800 border border-rose-200";
    if (tipo === "anomalia") return "bg-purple-50 text-purple-800 border border-purple-200";
    return "bg-slate-50 text-slate-800 border border-slate-200";
  }

  function esAbierta(g) {
    return g.estado === "nueva" || g.estado === "en_gestion" || g.estado === "esperando_causa";
  }

  function pasa(g) {
    if (filtro === "abiertas") return esAbierta(g);
    if (filtro === "nueva" || filtro === "en_gestion" || filtro === "esperando_causa") return g.estado === filtro;
    if (filtro === "resuelta") return g.estado === "resuelta" && (mismoDia(g.updatedAt) || mismoDia(g.createdAt));
    if (filtro === "alta") return g.criticidad === "alta" && esAbierta(g);
    if (filtro === "desvio") return g.tipo === "desvio_ruta";
    return true;
  }

  function visibles() {
    var q = fold(($("sol-inc-buscar") || {}).value);
    return rows.filter(function (g) {
      if (!pasa(g)) return false;
      if (!q) return true;
      return fold([g.codigo, g.chofer, g.telefono, g.viaje, g.causa, g.resumen, g.tipoLabel, g.estadoLabel].join(" ")).indexOf(q) >= 0;
    });
  }

  function contar(kind) {
    var prev = filtro;
    filtro = kind;
    var n = rows.filter(pasa).length;
    filtro = prev;
    return n;
  }

  function pintarPills() {
    var counts = {
      abiertas: contar("abiertas"),
      nueva: contar("nueva"),
      esperando_causa: contar("esperando_causa"),
      alta: contar("alta"),
      en_gestion: contar("en_gestion"),
      resuelta: contar("resuelta"),
    };
    var buttons = document.querySelectorAll("[data-filtro]");
    for (var i = 0; i < buttons.length; i++) {
      var kind = buttons[i].getAttribute("data-filtro");
      var on = kind === filtro;
      if (kind === "alta") buttons[i].className = PILL_ALTA + (on ? " ring-2 ring-rose-400" : "");
      else buttons[i].className = on ? PILL_ON : PILL_OFF;
      var badge = buttons[i].querySelector("span:last-child");
      if (badge && counts[kind] != null) badge.textContent = String(counts[kind]);
    }
    setText("sol-inc-vivos", String(counts.abiertas));
    setText("sol-inc-alta-chip", counts.alta + " en criticidad alta");
  }

  function pintarKpis(resumen) {
    var hoy = rows.filter(function (g) { return mismoDia(g.createdAt); }).length;
    var abiertas = resumen && resumen.abiertas != null ? resumen.abiertas : contar("abiertas");
    var alta = resumen && resumen.alta != null ? resumen.alta : contar("alta");
    var conCausa = rows.filter(function (g) { return g.causa && String(g.causa).trim(); }).length;
    var pct = rows.length ? Math.round((conCausa / rows.length) * 1000) / 10 : null;
    setText("sol-inc-kpi-hoy", String(hoy));
    setText("sol-inc-kpi-hoy-hint", abiertas + " abiertas");
    setText("sol-inc-kpi-hoy-sub", rows.length + " en la cola");
    setText("sol-inc-kpi-causa", pct == null ? "—" : String(pct).replace(".", ",") + "%");
    setText("sol-inc-kpi-causa-hint", conCausa + " con causa declarada");
    setText("sol-inc-kpi-tiempo", "—");
    setText("sol-inc-kpi-tiempo-hint", "sin medición");
    setText("sol-inc-kpi-alta", String(alta));
    setText("sol-inc-kpi-alta-hint", "abiertas");
    setText("sol-inc-kpi-alta-sub", "sin temporizador medido");
    var donut = $("sol-inc-donut");
    if (donut) donut.setAttribute("stroke-dasharray", (pct == null ? 0 : pct) + ", 100");
    setText("sol-inc-donut-label", pct == null ? "—" : Math.round(pct) + "%");
  }

  function accion(g) {
    var blanca = "px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-md border border-slate-200 shadow-xs transition-colors";
    var rosa = "px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition-colors";
    if (g.estado === "nueva") return '<button type="button" data-act="tomar" class="' + blanca + '">Tomar</button>';
    if (g.estado === "en_gestion") return '<button type="button" data-act="resolver" class="' + (g.criticidad === "alta" ? rosa : blanca) + '">Resolver</button>';
    var txt = g.estado === "esperando_causa" ? "Esperando" : "Ver";
    return '<button type="button" data-act="ver" class="' + blanca + '">' + txt + "</button>";
  }

  function fila(g) {
    var causa = g.causa || g.resumen || "Sin causa declarada";
    var viaje = g.viaje && g.viaje !== "—" ? g.viaje : "—";
    var crit = String(g.criticidad || "").toLowerCase();
    var critCls = crit === "alta" ? "bg-rose-100 text-rose-700" : crit === "media" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
    var dot = g.estado === "resuelta" ? "bg-emerald-500" : g.estado === "en_gestion" ? "bg-indigo-500" : g.estado === "esperando_causa" ? "bg-amber-500" : "bg-purple-500";
    return '<tr data-id="' + esc(g.id) + '" class="hover:bg-slate-50/80 transition-colors cursor-pointer">' +
      '<td class="py-3.5 px-4"><div class="font-bold font-mono text-slate-900 text-xs">' + esc(g.codigo || g.id) + "</div>" +
      '<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> ' + esc(origen(g.origen)) + "</span></td>" +
      '<td class="py-3.5 px-4"><div class="font-bold text-slate-900">' + esc(g.chofer || "—") + '</div><div class="text-[11px] text-slate-500 font-mono">' + esc(g.telefono || "—") + "</div></td>" +
      '<td class="py-3.5 px-4"><div class="font-mono font-medium text-slate-800">' + esc(viaje) + "</div></td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ' + tipoCls(g.tipo) + '">' + esc(g.tipoLabel || "—") + "</span></td>" +
      '<td class="py-3.5 px-4 max-w-xs text-slate-700">' + esc(causa) + "</td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">' + esc(origen(g.origen)) + "</span></td>" +
      '<td class="py-3.5 px-4"><span class="px-2 py-0.5 rounded text-[11px] font-bold ' + critCls + '">' + esc((g.criticidadLabel || "—").toUpperCase()) + "</span></td>" +
      '<td class="py-3.5 px-4"><span class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700"><span class="w-1.5 h-1.5 rounded-full ' + dot + '"></span> ' + esc(g.estadoLabel || g.estado || "—") + "</span></td>" +
      '<td class="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">' + esc(g.sla || "—") + "</td>" +
      '<td class="py-3.5 px-4 text-right"><div class="flex items-center justify-end gap-1.5">' + accion(g) +
      '<button type="button" data-act="ver" class="p-1 text-slate-400 hover:text-slate-600"><span class="material-symbols-outlined text-base">more_vert</span></button></div></td></tr>';
  }

  function vacio(texto) {
    var body = $("sol-inc-body");
    if (body) body.innerHTML = '<tr><td colspan="10" class="py-8 px-4 text-center text-sm text-slate-500">' + esc(texto) + "</td></tr>";
    setText("sol-inc-pie", texto);
  }

  function pintarTabla() {
    var list = visibles();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    var body = $("sol-inc-body");
    if (!body) return;
    if (!slice.length) {
      vacio(rows.length ? "No hay incidencias con este filtro." : "No hay incidencias.");
    } else {
      body.innerHTML = slice.map(fila).join("");
      var desde = page * PAGE + 1;
      var hasta = page * PAGE + slice.length;
      var pie = $("sol-inc-pie");
      if (pie) pie.innerHTML = "Mostrando <strong class=\"text-slate-700 font-mono\">" + desde + "–" + hasta + "</strong> de <strong class=\"text-slate-700 font-mono\">" + list.length + "</strong>";
    }
    var box = $("sol-inc-pie") && $("sol-inc-pie").parentElement && $("sol-inc-pie").parentElement.querySelector(".flex.items-center.gap-1");
    if (!box) return;
    var buttons = box.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if (i === buttons.length - 1) continue;
      var n = page - 1 + i;
      if (pages <= 3) n = i;
      if (n < 0 || n >= pages) {
        buttons[i].style.visibility = "hidden";
        continue;
      }
      buttons[i].style.visibility = "";
      buttons[i].textContent = String(n + 1);
      buttons[i].className = n === page ? PAGE_ON : PAGE_OFF;
      buttons[i].setAttribute("data-page", String(n));
    }
  }

  function verCaso(g) {
    if (!g) return;
    setText("sol-inc-unidad", (g.chofer && g.chofer !== "—" ? g.chofer : "Incidencia") + " · " + (g.codigo || g.id));
    setText("sol-inc-lugar", g.causa || g.resumen || g.tipoLabel || "Sin ubicación declarada");
    if (g.lat != null && g.lng != null && isFinite(Number(g.lat)) && isFinite(Number(g.lng))) postPunto(Number(g.lat), Number(g.lng));
    else setText("sol-inc-lat", "Sin coordenadas");
    nota((g.estadoLabel || g.estado || "Incidencia") + (g.sla ? " · " + g.sla : ""));
    setText("sol-inc-repregunta", g.sla || "—");
  }

  function sesion() {
    live = false;
    rows = [];
    dashKpis();
    vacio(SESION);
    var chat = $("sol-inc-chat");
    if (chat && !conv) chat.textContent = SESION;
    nota(SESION);
  }

  function cargarChoferes(flota, destinos) {
    var map = {};
    var order = [];
    asList(flota).forEach(function (c) {
      if (c.activo === false) return;
      var tel = digits(c.telefono);
      if (tel.length < 8 || map[tel]) return;
      map[tel] = { tel: tel, nombre: c.nombre || tel, fuente: "viajes" };
      order.push(tel);
    });
    asList(destinos).forEach(function (d) {
      var tel = digits(d.telefonoChofer || d.telefono_chofer);
      if (tel.length < 8 || map[tel]) return;
      map[tel] = { tel: tel, nombre: "Chofer Destinos", fuente: "destinos" };
      order.push(tel);
    });
    choferes = order.map(function (tel) { return map[tel]; });
    if (chofer && !map[chofer.tel]) chofer = null;
    pintarChofer();
    pintarPreview();
  }

  function load() {
    return Promise.all([
      api("/api/incidencias?limit=100"),
      api("/api/incidencias/resumen").catch(function () { return null; }),
      api("/api/viajes/flota/choferes").catch(function () { return []; }),
      api("/api/destinos?limit=40").catch(function () { return []; }),
    ]).then(function (pack) {
      live = true;
      rows = asList(pack[0]);
      byId = {};
      rows.forEach(function (g) { byId[g.id] = g; });
      cargarChoferes(pack[2], pack[3]);
      pintarKpis(pack[1]);
      pintarPills();
      pintarTabla();
    }).catch(function (err) {
      if (err && err.status === 401) sesion();
      else {
        vacio(err.message || "No pude leer las incidencias.");
        nota(err.message || "No pude leer las incidencias.");
      }
    });
  }

  function geocodePin(id) {
    pinId = id;
    pintarPin();
    ubic = null;
    var pin = pinActual();
    setText("sol-inc-lugar", pin.label);
    setText("sol-inc-unidad", pin.label);
    nota("Ubicando " + pin.label + "…");
    pintarPreview();
    return api("/api/destinos/geocode", {
      method: "POST",
      body: JSON.stringify({ query: pin.query, mode: "direccion" }),
    }).then(function (geo) {
      if (pinId !== id) return;
      ubic = geo;
      setText("sol-inc-lugar", geo.formattedAddress || pin.label);
      setText("sol-inc-unidad", pin.label);
      if (geo.lat != null && geo.lng != null) postPunto(geo.lat, geo.lng);
      nota("Punto listo. El WhatsApp se envía con el botón verde.");
      setText("sol-inc-repregunta", "—");
      pintarPreview();
    }).catch(function (err) {
      ubic = null;
      nota(err.status === 401 ? SESION : (err.message || "No pude ubicar el punto."));
    });
  }

  function enviar() {
    if (busy) return;
    var tel = chofer ? digits(chofer.tel) : "";
    if (tel.length < 8) {
      nota("Elegí un chofer de la flota antes de enviar.");
      return;
    }
    var listo = ubic ? Promise.resolve(ubic) : geocodePin(pinId).then(function () { return ubic; });
    listo.then(function (geo) {
      if (!geo) return;
      var lugar = geo.formattedAddress || pinActual().label;
      var ok = window.confirm("Se va a enviar un WhatsApp a " + (chofer.nombre || tel) + " por una parada en " + lugar + ".");
      if (!ok) {
        nota("No se envió el WhatsApp.");
        return;
      }
      busy = true;
      nota("Enviando consulta…");
      return api("/api/incidencias/consultar-chofer", {
        method: "POST",
        body: JSON.stringify({
          telefono: tel,
          tipo: TIPOS[tipoIdx].id,
          nombre: chofer.nombre,
          lat: geo.lat,
          lng: geo.lng,
          direccion: lugar,
        }),
      }).then(function (res) {
        nota(res.mensaje || "Consulta enviada.");
        filtro = "esperando_causa";
        page = 0;
        return load().then(function () {
          if (res.incidencia) verCaso(res.incidencia);
        });
      });
    }).catch(function (err) {
      nota(err && err.status === 401 ? SESION : ((err && err.message) || "No se envió el WhatsApp."));
    }).then(function () { busy = false; });
  }

  function decidir(id, estado) {
    var g = byId[id];
    if (!g || busy) return;
    var titulo = estado === "resuelta" ? "Marcar resuelta" : "Tomar en gestión";
    var ok = window.confirm(titulo + "\n" + (g.codigo || g.id) + " · " + (g.chofer || "") + "\n" + (g.causa || g.resumen || ""));
    if (!ok) return;
    busy = true;
    nota(titulo + "…");
    api("/api/incidencias/" + encodeURIComponent(id) + "/decidir", {
      method: "POST",
      body: JSON.stringify({ estado: estado }),
    }).then(function () {
      nota(estado === "resuelta" ? "Incidencia resuelta." : "Incidencia en gestión.");
      return load();
    }).catch(function (err) {
      nota(err.status === 401 ? SESION : (err.message || "No pude actualizar la incidencia."));
    }).then(function () { busy = false; });
  }

  function menuChofer(open) {
    var box = $("sol-inc-chofer");
    if (!box) return;
    var menu = $("sol-inc-chofer-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "sol-inc-chofer-menu";
      menu.className = "absolute left-0 right-0 top-full z-30 mt-1 hidden max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg";
      box.appendChild(menu);
    }
    menuOpen = open && choferes.length > 0;
    if (!menuOpen) {
      menu.classList.add("hidden");
      return;
    }
    menu.innerHTML = choferes.map(function (c, i) {
      return '<button type="button" data-chofer="' + i + '" class="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"><span class="font-semibold text-slate-900">' + esc(c.nombre) + '</span><span class="ml-2 font-mono text-slate-500">' + esc(c.tel) + "</span></button>";
    }).join("");
    menu.classList.remove("hidden");
  }

  function prepararSelect() {
    var sel = $("sol-inc-estado");
    if (!sel) return;
    var values = ["todos", "en_gestion", "alta", "desvio", "esperando_causa"];
    for (var i = 0; i < sel.options.length && i < values.length; i++) sel.options[i].value = values[i];
  }

  function tabs() {
    return document.querySelectorAll("#sol-inc-tabs a");
  }

  function marcarTab(idx) {
    var links = tabs();
    for (var i = 0; i < links.length; i++) links[i].className = i === idx ? TAB_ON : TAB_OFF;
  }

  telemetriaVacia();
  dashKpis();
  pintarPin();
  pintarTipo();
  pintarChofer();
  pintarPreview();
  nota("Elegí chofer y punto. Todavía no se envió nada.");
  setText("sol-inc-repregunta", "—");
  setText("sol-inc-unidad", pinActual().label);
  setText("sol-inc-lugar", pinActual().label);
  setText("sol-inc-lat", "Sin coordenadas");
  prepararSelect();
  vacio("Cargando incidencias…");
  load();
  setInterval(function () {
    if (!busy && !menuOpen) load();
  }, 12000);

  window.addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.type !== "sol-incidencias" || data.action !== "ready" || !ultimoPunto) return;
    postPunto(ultimoPunto.lat, ultimoPunto.lng);
  });

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pin = t.closest("[data-pin]");
    var pill = t.closest("[data-filtro]");
    var choferBtn = t.closest("[data-chofer]");
    var act = t.closest("[data-act]");
    var row = t.closest("#sol-inc-body tr[data-id]");
    var tab = t.closest("#sol-inc-tabs a");
    var pageBtn = t.closest("[data-page]");
    var textoBtn = t.closest("button");
    var texto = textoBtn ? labelOf(textoBtn) : "";
    var siguiente = texto.indexOf("siguiente") >= 0;
    var chipBtn = t.closest("button");
    var chatChip = chipBtn && $("sol-inc-chat") && chipBtn.closest("section") === $("sol-inc-chat").closest("section") && (String(chipBtn.className).indexOf("sol-chat-chip") >= 0 || String(chipBtn.className).indexOf("rounded-full") >= 0);
    var consultar = t.closest("button") && $("sol-inc-pregunta") && t.closest("button").parentElement === $("sol-inc-pregunta").parentElement;
    var handled = pin || pill || choferBtn || act || t.closest("#sol-inc-chofer") || t.closest("#sol-inc-tipo") || t.closest("#sol-inc-enviar") || tab || pageBtn || siguiente || chatChip || consultar;
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("reportar") >= 0 || texto.indexOf("modificar regla") >= 0) handled = textoBtn;
    if (!handled) {
      if (menuOpen && !t.closest("#sol-inc-chofer")) menuChofer(false);
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();

    if (pin) {
      geocodePin(pin.getAttribute("data-pin"));
      return;
    }
    if (t.closest("#sol-inc-chofer") && !choferBtn) {
      menuChofer(!menuOpen);
      return;
    }
    if (choferBtn) {
      chofer = choferes[Number(choferBtn.getAttribute("data-chofer"))] || null;
      menuChofer(false);
      pintarChofer();
      pintarPreview();
      return;
    }
    if (t.closest("#sol-inc-tipo")) {
      tipoIdx = (tipoIdx + 1) % TIPOS.length;
      pintarTipo();
      return;
    }
    if (t.closest("#sol-inc-enviar")) {
      enviar();
      return;
    }
    if (texto.indexOf("modificar regla") >= 0) {
      nota("La regla de minutos no se edita en esta pantalla.");
      return;
    }
    if (texto.indexOf("sincronizar") >= 0) {
      nota("Sincronizando…");
      load().then(function () { if (live) nota("Lista actualizada."); });
      return;
    }
    if (texto.indexOf("reportar") >= 0) {
      var form = document.querySelector("[data-pin]");
      if (form && form.scrollIntoView) form.scrollIntoView({ behavior: "smooth", block: "center" });
      nota("Elegí chofer, punto y tipo. El envío es el botón verde.");
      return;
    }
    if (pill) {
      filtro = pill.getAttribute("data-filtro");
      page = 0;
      pintarPills();
      pintarTabla();
      return;
    }
    if (tab) {
      var links = Array.prototype.slice.call(tabs());
      var idx = links.indexOf(tab);
      marcarTab(idx);
      if (idx === 0) { filtro = "abiertas"; page = 0; pintarPills(); pintarTabla(); }
      if (idx === 1) { filtro = "todos"; page = 0; pintarPills(); pintarTabla(); }
      if (idx === 2) nota("Las reglas de minutos no se editan en esta pantalla.");
      if (idx === 3) {
        var ancla = document.querySelector("[data-pin]");
        if (ancla && ancla.scrollIntoView) ancla.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (act && row) {
      var id = row.getAttribute("data-id");
      var modo = act.getAttribute("data-act");
      if (modo === "tomar") decidir(id, "en_gestion");
      else if (modo === "resolver") decidir(id, "resuelta");
      else verCaso(byId[id]);
      return;
    }
    if (row) {
      verCaso(byId[row.getAttribute("data-id")]);
      return;
    }
    if (pageBtn) {
      page = Number(pageBtn.getAttribute("data-page")) || 0;
      pintarTabla();
      return;
    }
    if (siguiente) {
      page += 1;
      pintarTabla();
      return;
    }
    if (chatChip || consultar) {
      var q = consultar ? ($("sol-inc-pregunta").value || "") : labelOf(chipBtn);
      q = String(q || "").trim();
      if (!q) return;
      if (consultar) $("sol-inc-pregunta").value = "";
      setText("sol-inc-chat", "Consultando…");
      api("/api/agents/chat", {
        method: "POST",
        body: JSON.stringify({ agentId: "incidencias", message: q, conversationId: conv || undefined }),
      }).then(function (res) {
        conv = res.conversationId || conv;
        setText("sol-inc-chat", (res.message && res.message.text) || "Sin respuesta.");
      }).catch(function (err) {
        setText("sol-inc-chat", err.status === 401 ? SESION : (err.message || "No pude consultar."));
      });
    }
  }, true);

  var buscar = $("sol-inc-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; pintarTabla(); });
  var estado = $("sol-inc-estado");
  if (estado) estado.addEventListener("change", function () {
    filtro = estado.value || "todos";
    page = 0;
    pintarPills();
    pintarTabla();
  });
  var pregunta = $("sol-inc-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var btn = pregunta.parentElement && pregunta.parentElement.querySelector("button");
    if (btn) btn.click();
  });
})();
