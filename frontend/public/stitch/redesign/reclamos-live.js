(function () {
  var PAGE = 6;
  var SESION = "Hace falta una sesión para ver los reclamos reales.";
  var ABIERTOS = { nuevo: 1, en_proceso: 1, escalado: 1 };
  var rows = [];
  var byId = {};
  var resumen = null;
  var filtro = "abiertos";
  var page = 0;
  var selectedId = null;
  var primed = false;
  var busy = false;
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
  function hora(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return "—";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function media(url) {
    if (!url) return "";
    var u = String(url).trim();
    if (!u || u.indexOf("googleusercontent.com") >= 0) return "";
    if (u.indexOf("/backend/") === 0) return u;
    if (u.indexOf("/api/media/") === 0) return "/backend" + u;
    var m = u.match(/\/v1\/files\/([a-fA-F0-9]+)/i);
    if (m) return "/backend/api/media/bot/" + m[1];
    return u;
  }
  function abierto(g) { return !!(g && ABIERTOS[g.estado]); }
  function pasaCrit(g) {
    var sel = $("sol-rec-crit-filtro");
    var i = sel ? sel.selectedIndex : 0;
    if (!i) return true;
    var c = fold(g.criticidad || g.criticidadLabel);
    if (i === 1) return c.indexOf("alta") >= 0 || c.indexOf("crit") >= 0;
    if (i === 2) return c.indexOf("media") >= 0;
    return c.indexOf("baja") >= 0;
  }
  function pasa(g) {
    if (filtro === "abiertos" && !abierto(g)) return false;
    if (filtro !== "abiertos" && filtro !== "todos" && g.estado !== filtro) return false;
    if (!pasaCrit(g)) return false;
    var q = fold(($("sol-rec-buscar") || {}).value);
    if (!q) return true;
    return fold([g.codigo, g.cliente, g.viaje, g.motivoLabel, g.resumen, g.detalle, g.telefono, g.remito, g.pedido, g.estadoLabel, g.criticidadLabel].join(" ")).indexOf(q) >= 0;
  }

  function dash() {
    setText("sol-rec-kpi-abiertos", "—");
    setText("sol-rec-kpi-abiertos-sub", "sin cola");
    setText("sol-rec-kpi-sla", "—");
    setText("sol-rec-kpi-sla-hint", "sin medición");
    var bar = $("sol-rec-kpi-sla-bar");
    if (bar) bar.style.width = "0%";
    setText("sol-rec-kpi-tiempo", "—");
    setText("sol-rec-kpi-tiempo-hint", "sin medición");
    setText("sol-rec-kpi-tiempo-sub", "sin tiempo medido");
    setText("sol-rec-kpi-ia", "—");
    setText("sol-rec-kpi-ia-hint", "sin medición");
    setText("sol-rec-kpi-ia-sub", "sin porcentaje de diálogo");
    document.querySelectorAll("[data-filtro]").forEach(function (btn) {
      var badge = btn.querySelector("span");
      if (badge) badge.textContent = "—";
    });
    setText("sol-rec-conteo", "—");
    setText("sol-rec-clientes", "Sin clientes en la cola.");
    setText("sol-rec-sla-nota", "Sin minutos de SLA medidos.");
    setText("sol-rec-fecha", "Cola completa");
  }
  function fichaVacia(texto) {
    setText("sol-rec-codigo", "Sin reclamo");
    setText("sol-rec-estado", "—");
    setText("sol-rec-cliente", "Sin cliente");
    setText("sol-rec-canal", "—");
    setText("sol-rec-motivo", texto || "Elegí un reclamo de la cola.");
    setText("sol-rec-viaje", "Sin viaje");
    setText("sol-rec-crit", "—");
    setText("sol-rec-sla", "—");
    setText("sol-rec-sla-sub", "sin minutos medidos");
    setText("sol-rec-impacto", "—");
    setText("sol-rec-impacto-sub", "sin monto");
    setText("sol-rec-pop", "Sin cotejo de POP/POD en este reclamo.");
    setText("sol-rec-eta", "Sin ETA asociado.");
    setText("sol-rec-inc", "Sin incidencia vinculada.");
    setText("sol-rec-conclusion", texto || "Sin conclusión cargada.");
    setText("sol-rec-linea", "Sin operador asignado.");
    var hilo = $("sol-rec-hilo");
    if (hilo) hilo.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">' + esc(texto || "Sin diálogo.") + "</p>";
  }
  function vacio(texto) {
    var body = $("sol-rec-body");
    if (!body) return;
    body.innerHTML = '<tr><td class="py-6 px-4 text-on-surface-variant" colspan="9">' + esc(texto) + "</td></tr>";
    setText("sol-rec-pagina", "Mostrando 0 de 0");
    setText("sol-rec-activos", "0");
  }

  function pintarKpis() {
    var r = resumen || {};
    setText("sol-rec-kpi-abiertos", r.abiertos != null ? String(r.abiertos) : "—");
    setText("sol-rec-kpi-abiertos-sub", (r.nuevo || 0) + " nuevos · " + (r.en_proceso || 0) + " en proceso");
    setText("sol-rec-kpi-sla", "—");
    setText("sol-rec-kpi-sla-hint", "sin medición");
    var bar = $("sol-rec-kpi-sla-bar");
    if (bar) bar.style.width = "0%";
    setText("sol-rec-kpi-tiempo", "—");
    setText("sol-rec-kpi-tiempo-hint", "sin medición");
    setText("sol-rec-kpi-tiempo-sub", "sin tiempo medido");
    setText("sol-rec-kpi-ia", "—");
    setText("sol-rec-kpi-ia-hint", "sin medición");
    setText("sol-rec-kpi-ia-sub", "sin porcentaje de diálogo");
    var enSla = rows.filter(function (g) { return abierto(g) && fold(g.sla).indexOf("en sla") >= 0; }).length;
    var porVencer = rows.filter(function (g) { return abierto(g) && fold(g.sla).indexOf("vencer") >= 0; }).length;
    setText("sol-rec-conteo", (r.abiertos || 0) + " abiertos · " + (r.nuevo || 0) + " nuevos · " + (r.escalado || 0) + " escalados · " + (r.resuelto || 0) + " resueltos");
    setText("sol-rec-sla-nota", enSla + " abiertos en SLA · " + porVencer + " por vencer. Sin minutos medidos.");
    var clientes = {};
    rows.forEach(function (g) {
      var c = g.cliente && g.cliente !== "—" ? g.cliente : "";
      if (!c) return;
      clientes[c] = (clientes[c] || 0) + 1;
    });
    var top = Object.keys(clientes).sort(function (a, b) { return clientes[b] - clientes[a]; }).slice(0, 4);
    setText("sol-rec-clientes", top.length ? top.map(function (c) { return c + " (" + clientes[c] + ")"; }).join(", ") : "Sin clientes en la cola.");
    setText("sol-rec-fecha", "Cola completa");
  }
  function pintarFiltros() {
    var counts = {
      todos: rows.length,
      abiertos: rows.filter(abierto).length,
      nuevo: rows.filter(function (g) { return g.estado === "nuevo"; }).length,
      en_proceso: rows.filter(function (g) { return g.estado === "en_proceso"; }).length,
      escalado: rows.filter(function (g) { return g.estado === "escalado"; }).length,
      resuelto: rows.filter(function (g) { return g.estado === "resuelto"; }).length,
    };
    document.querySelectorAll("[data-filtro]").forEach(function (btn) {
      var on = btn.getAttribute("data-filtro") === filtro;
      btn.classList.remove("bg-primary-container", "text-on-primary", "shadow-sm", "bg-surface-container-lowest", "bg-surface-container-low", "text-on-surface", "hover:bg-surface-container", "hover:bg-surface-container-low", "shadow-xs");
      if (on) btn.classList.add("bg-primary-container", "text-on-primary", "shadow-sm");
      else btn.classList.add("bg-surface-container-lowest", "text-on-surface", "hover:bg-surface-container-low", "shadow-xs");
      var badge = btn.querySelector("span");
      var key = btn.getAttribute("data-filtro");
      if (badge && counts[key] != null) badge.textContent = String(counts[key]);
    });
  }
  function pintarHilo(g) {
    var box = $("sol-rec-hilo");
    if (!box) return;
    if (!g) {
      box.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">Elegí un reclamo.</p>';
      return;
    }
    var msgs = (g.mensajes || []).slice(-6);
    if (!msgs.length) {
      var txt = g.detalle || g.resumen || "Sin diálogo guardado.";
      var foto = media(g.imagenUrl);
      var img = foto ? '<img class="w-full h-36 object-cover rounded-lg" alt="Foto del reclamo" src="' + esc(foto) + '"/>' : "";
      box.innerHTML = '<div class="flex flex-col items-start max-w-[85%]"><span class="font-label-caps text-label-caps text-on-surface-variant mb-1 ml-1">' + esc(g.cliente || "Cliente") + " · " + esc(hora(g.createdAt)) + '</span><div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-xs font-body-sm text-body-sm text-on-surface space-y-2">' + img + "<p>" + esc(txt) + "</p></div></div>";
      return;
    }
    box.innerHTML = msgs.map(function (m) {
      var out = m.dir === "out" || m.dir === "bot";
      var quien = out ? "SOL" : (g.cliente || "Cliente");
      var align = out ? "items-end ml-auto" : "items-start";
      var bubble = out ? "bg-[#dcf8c6] rounded-tr-sm" : "bg-white rounded-tl-sm";
      var foto = media(m.imagen_url || m.imagenUrl);
      var img = foto ? '<img class="w-full h-36 object-cover rounded-lg" alt="Foto del reclamo" src="' + esc(foto) + '"/>' : "";
      return '<div class="flex flex-col ' + align + ' max-w-[85%]"><span class="font-label-caps text-label-caps text-on-surface-variant mb-1">' + esc(quien + " · " + hora(m.at)) + '</span><div class="' + bubble + ' p-3 rounded-2xl shadow-xs font-body-sm text-body-sm text-on-surface space-y-2">' + img + "<p>" + esc(m.texto || "—") + "</p></div></div>";
    }).join("");
  }
  function ver(g) {
    if (!g) {
      selectedId = null;
      fichaVacia("Elegí un reclamo de la cola.");
      return;
    }
    selectedId = g.id;
    setText("sol-rec-codigo", g.codigo || g.id || "—");
    setText("sol-rec-estado", g.estadoLabel || g.estado || "—");
    setText("sol-rec-cliente", g.cliente || "Sin cliente");
    setText("sol-rec-canal", g.canal || "WhatsApp");
    setText("sol-rec-motivo", g.motivoLabel && g.motivoLabel !== "—" ? g.motivoLabel : (g.resumen || "Sin motivo"));
    var viaje = g.viaje && g.viaje !== "—" ? g.viaje : "Sin viaje";
    if (g.remito) viaje += " · " + g.remito;
    setText("sol-rec-viaje", viaje);
    setText("sol-rec-crit", g.criticidadLabel || "—");
    setText("sol-rec-sla", g.sla || "—");
    setText("sol-rec-sla-sub", "sin minutos medidos");
    setText("sol-rec-impacto", "—");
    setText("sol-rec-impacto-sub", "sin monto");
    setText("sol-rec-pop", "Sin cotejo de POP/POD en este reclamo.");
    setText("sol-rec-eta", "Sin ETA asociado.");
    setText("sol-rec-inc", "Sin incidencia vinculada.");
    setText("sol-rec-conclusion", g.detalle || g.resumen || g.notaInterna || "Sin conclusión cargada.");
    if (g.estado === "resuelto") setText("sol-rec-linea", (g.codigo || "Reclamo") + " ya está resuelto.");
    else setText("sol-rec-linea", "Sin operador asignado. Escalar o resolver intenta avisar por WhatsApp.");
    pintarHilo(g);
  }

  function badgeCrit(g) {
    var c = fold(g.criticidad || g.criticidadLabel);
    var cls = c.indexOf("alta") >= 0 || c.indexOf("crit") >= 0
      ? "bg-red-100 text-red-800"
      : c.indexOf("baja") >= 0
        ? "bg-surface-container text-on-surface-variant"
        : "bg-amber-50 text-amber-800";
    return '<span class="px-2 py-0.5 rounded font-label-caps text-label-caps ' + cls + ' font-semibold">' + esc(g.criticidadLabel || "—") + "</span>";
  }
  function badgeEstado(g) {
    var map = {
      nuevo: "bg-secondary-fixed text-on-secondary-fixed-variant",
      en_proceso: "bg-amber-100 text-amber-900",
      escalado: "bg-red-100 text-red-800",
      resuelto: "bg-emerald-100 text-emerald-800",
    };
    var dot = {
      nuevo: "bg-secondary",
      en_proceso: "bg-amber-600",
      escalado: "bg-red-600",
      resuelto: "bg-emerald-600",
    };
    return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-caps text-label-caps ' + (map[g.estado] || "bg-surface-container text-on-surface-variant") + '"><span class="w-1.5 h-1.5 rounded-full ' + (dot[g.estado] || "bg-slate-400") + '"></span> ' + esc(g.estadoLabel || g.estado || "—") + "</span>";
  }
  function pintarTabla() {
    var body = $("sol-rec-body");
    if (!body) return;
    var list = rows.filter(pasa);
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    setText("sol-rec-activos", String(list.length));
    if (!list.length) {
      vacio(rows.length ? "Ningún reclamo coincide con el filtro o la búsqueda." : "No hay reclamos en la cola.");
      return;
    }
    body.innerHTML = slice.map(function (g) {
      var sel = g.id === selectedId ? " bg-secondary-fixed/10" : "";
      var accion = g.estado === "resuelto" ? "Ver detalle" : "Gestionar";
      return '<tr class="hover:bg-surface-container-low/50 transition-colors' + sel + '" data-id="' + esc(g.id) + '">' +
        '<td class="py-3 px-4 font-code-table text-code-table font-bold text-secondary">' + esc(g.codigo || "—") + "</td>" +
        '<td class="py-3 px-4 font-semibold">' + esc(g.cliente || "—") + "</td>" +
        '<td class="py-3 px-4 font-code-table text-code-table text-on-surface-variant">' + esc(g.viaje || "—") + "</td>" +
        '<td class="py-3 px-4">' + esc(g.motivoLabel && g.motivoLabel !== "—" ? g.motivoLabel : (g.resumen || "—")) + "</td>" +
        '<td class="py-3 px-4"><span class="inline-flex items-center gap-1 text-emerald-700"><span class="material-symbols-outlined text-sm">chat</span> ' + esc(g.canal || "WhatsApp") + "</span></td>" +
        '<td class="py-3 px-4">' + badgeCrit(g) + "</td>" +
        '<td class="py-3 px-4">' + badgeEstado(g) + "</td>" +
        '<td class="py-3 px-4 font-code-table text-code-table">' + esc(g.sla || "—") + "</td>" +
        '<td class="py-3 px-4 text-right"><button type="button" data-act="ver" class="px-2 py-1 bg-surface-container rounded font-label-md text-label-md hover:bg-surface-container-high transition-colors">' + accion + "</button></td>" +
        "</tr>";
    }).join("");
    setText("sol-rec-pagina", "Mostrando " + slice.length + " de " + list.length + " · Página " + (page + 1) + " de " + pages);
    var nav = $("sol-rec-paginacion");
    if (nav) {
      var btns = nav.querySelectorAll("button");
      if (btns[0]) btns[0].disabled = page <= 0;
      if (btns[1]) btns[1].disabled = page >= pages - 1;
    }
  }

  function sesion() {
    live = false;
    dash();
    fichaVacia(SESION);
    setText("sol-rec-chat", SESION);
    setText("sol-rec-linea", SESION);
    vacio(SESION);
  }
  function load() {
    return Promise.all([
      api("/api/reclamos?limit=200"),
      api("/api/reclamos/resumen"),
    ]).then(function (pair) {
      live = true;
      rows = asList(pair[0]);
      resumen = pair[1] || null;
      byId = {};
      rows.forEach(function (g) { if (g && g.id) byId[g.id] = g; });
      pintarKpis();
      pintarFiltros();
      if (!primed) {
        primed = true;
        var visibles = rows.filter(pasa);
        var primero = visibles[0];
        if (primero) ver(primero);
        else fichaVacia(rows.length ? "Ningún reclamo coincide con el filtro." : "No hay reclamos en la cola.");
      } else if (selectedId && byId[selectedId]) ver(byId[selectedId]);
      else ver(null);
      pintarTabla();
    }).catch(function (err) {
      if (err && err.status === 401) sesion();
      else {
        live = false;
        vacio((err && err.message) || "No pude leer los reclamos.");
        setText("sol-rec-linea", (err && err.message) || "No pude leer los reclamos.");
        setText("sol-rec-chat", (err && err.message) || "No pude consultar.");
      }
    });
  }

  function decidir(estado) {
    var g = byId[selectedId];
    if (!g || busy) {
      setText("sol-rec-linea", "Elegí un reclamo de la cola.");
      return;
    }
    if (g.estado === "resuelto") {
      setText("sol-rec-linea", (g.codigo || "Este reclamo") + " ya está resuelto.");
      return;
    }
    if (g.estado === estado) {
      setText("sol-rec-linea", (g.codigo || "Este reclamo") + " ya está " + (g.estadoLabel || estado) + ".");
      return;
    }
    var verbo = estado === "escalado" ? "Escalar" : estado === "resuelto" ? "Resolver y notificar" : "Tomar";
    var aviso = g.telefono
      ? "Se intenta avisar al cliente por WhatsApp. Esta pantalla no confirma el envío."
      : "No hay teléfono: no se avisa.";
    var ok = window.confirm(verbo + " " + (g.codigo || "") + "\n" + (g.cliente || "sin cliente") + " · " + (g.motivoLabel || "sin motivo") + "\n" + (g.viaje && g.viaje !== "—" ? g.viaje : "") + "\n\n" + aviso);
    if (!ok) {
      setText("sol-rec-linea", "No se cambió el reclamo.");
      return;
    }
    busy = true;
    setText("sol-rec-linea", "Guardando…");
    api("/api/reclamos/" + encodeURIComponent(g.id) + "/decidir", {
      method: "POST",
      body: JSON.stringify({ estado: estado, notificar: true }),
    }).then(function () {
      setText("sol-rec-linea", verbo + " registrado. " + aviso);
      return load();
    }).catch(function (err) {
      setText("sol-rec-linea", err && err.status === 401 ? SESION : ("No se guardó. " + ((err && err.message) || "")));
    }).then(function () { busy = false; });
  }

  function responder(q) {
    q = String(q || "").trim();
    if (!q) return;
    if (!live) {
      setText("sol-rec-chat", SESION);
      return;
    }
    var t = fold(q);
    if (t.indexOf("tiempo") >= 0 || t.indexOf("resolucion") >= 0 || t.indexOf("promedio") >= 0) {
      setText("sol-rec-chat", "No hay tiempo medio de resolución medido. El SLA de cada caso es solo En SLA, Por vencer o Cumplido.");
      return;
    }
    if (t.indexOf("abierto") >= 0 && t.indexOf("cuant") >= 0) {
      var r = resumen || {};
      setText("sol-rec-chat", "Hay " + (r.abiertos != null ? r.abiertos : "—") + " reclamos abiertos: " + (r.nuevo || 0) + " nuevos, " + (r.en_proceso || 0) + " en proceso y " + (r.escalado || 0) + " escalados.");
      return;
    }
    if (t.indexOf("escalad") >= 0) {
      var esc = rows.filter(function (g) { return g.estado === "escalado"; });
      setText("sol-rec-chat", esc.length
        ? esc.slice(0, 8).map(function (g) { return (g.codigo || g.id) + " · " + (g.cliente || "—") + " · " + (g.motivoLabel || "sin motivo"); }).join(" · ")
        : "No hay reclamos escalados.");
      return;
    }
    var palabras = t.split(" ").filter(function (w) {
      return w.length > 3 && ["mostrame", "ultimos", "cuales", "cuantos", "reclamos", "reclamo", "hay", "estan", "esta"].indexOf(w) < 0;
    });
    var hallados = rows.filter(function (g) {
      var blob = fold([g.codigo, g.cliente, g.viaje, g.motivoLabel, g.resumen, g.estadoLabel].join(" "));
      return palabras.every(function (w) { return blob.indexOf(w) >= 0; });
    });
    if (!palabras.length) {
      setText("sol-rec-chat", "Preguntame por abiertos, escalados o un cliente. El tiempo medio no está medido.");
      return;
    }
    setText("sol-rec-chat", hallados.length
      ? hallados.slice(0, 8).map(function (g) { return (g.codigo || g.id) + " · " + (g.cliente || "—") + " · " + (g.estadoLabel || g.estado); }).join(" · ")
      : "No hay reclamos que coincidan con esa consulta en la cola cargada.");
  }

  dash();
  fichaVacia("Cargando reclamos…");
  setText("sol-rec-chat", "Preguntame por abiertos, escalados o un cliente.");
  vacio("Cargando la cola…");
  load();
  setInterval(function () { if (!busy) load(); }, 12000);

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pill = t.closest("[data-filtro]");
    var act = t.closest("[data-act]");
    var row = t.closest("#sol-rec-body tr[data-id]");
    var textoBtn = t.closest("button");
    var texto = textoBtn ? labelOf(textoBtn) : "";
    var chatP = $("sol-rec-chat");
    var chatCard = chatP && chatP.closest(".rounded-xl");
    var chatChip = chatCard && textoBtn && textoBtn.closest(".rounded-xl") === chatCard && String(textoBtn.className).indexOf("rounded-full") >= 0 ? textoBtn : null;
    var input = $("sol-rec-pregunta");
    var consultar = input && textoBtn && input.parentElement && textoBtn.parentElement === input.parentElement.parentElement;
    var nav = t.closest("#sol-rec-paginacion");
    var exportBtn = textoBtn && textoBtn.getAttribute("title") === "Exportar reporte";
    var handled = pill || act || row || chatChip || consultar || exportBtn || t.closest("#sol-rec-escalar") || t.closest("#sol-rec-resolver") || t.closest("#sol-rec-chofer") || t.closest("#sol-rec-historial");
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("cargar reclamo") >= 0) handled = textoBtn;
    if (nav && (texto === "anterior" || texto.indexOf("siguiente") >= 0)) handled = textoBtn;
    if (!handled) return;
    ev.preventDefault();
    ev.stopPropagation();

    if (t.closest("#sol-rec-escalar")) { decidir("escalado"); return; }
    if (t.closest("#sol-rec-resolver")) { decidir("resuelto"); return; }
    if (t.closest("#sol-rec-chofer")) {
      setText("sol-rec-linea", "Esta pantalla no llama al chofer. El diálogo con el cliente es el de WhatsApp.");
      return;
    }
    if (t.closest("#sol-rec-historial")) {
      var g = byId[selectedId];
      var h = g && g.historial && g.historial.length ? g.historial.slice(-6).join(" · ") : "Sin historial cargado.";
      setText("sol-rec-conclusion", h);
      return;
    }
    if (texto.indexOf("sincronizar") >= 0) {
      setText("sol-rec-linea", "Actualizando…");
      load().then(function () { if (live) setText("sol-rec-linea", "Cola actualizada."); });
      return;
    }
    if (texto.indexOf("cargar reclamo") >= 0) {
      setText("sol-rec-linea", "El reclamo lo abre el cliente por WhatsApp. Esta pantalla no abre un formulario.");
      return;
    }
    if (exportBtn) {
      setText("sol-rec-linea", "Esta pantalla no exporta el reporte.");
      return;
    }
    if (pill) {
      filtro = pill.getAttribute("data-filtro") || "abiertos";
      page = 0;
      pintarFiltros();
      pintarTabla();
      return;
    }
    if (row || (act && act.getAttribute("data-act") === "ver")) {
      var id = (row && row.getAttribute("data-id")) || selectedId;
      if (id && byId[id]) ver(byId[id]);
      pintarTabla();
      return;
    }
    if (nav && texto === "anterior") { page = Math.max(0, page - 1); pintarTabla(); return; }
    if (nav && texto.indexOf("siguiente") >= 0) { page += 1; pintarTabla(); return; }
    if (chatChip || consultar) {
      var q = chatChip ? labelOf(chatChip) : (input.value || "");
      if (consultar && input) input.value = "";
      responder(q);
    }
  }, true);

  var buscar = $("sol-rec-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; pintarTabla(); });
  var crit = $("sol-rec-crit-filtro");
  if (crit) crit.addEventListener("change", function () { page = 0; pintarTabla(); });
  var cierre = $("sol-rec-cierre");
  if (cierre) cierre.addEventListener("change", function () {
    setText("sol-rec-linea", "Esa opción de cierre no se ejecuta acá. Usá Escalar o Resolver.");
  });
  var pregunta = $("sol-rec-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var q = pregunta.value;
    pregunta.value = "";
    responder(q);
  });
})();
