(function () {
  var PAGE = 6;
  var SESION = "Hace falta una sesión para ver la cola ETA real.";
  var ON = "px-2.5 py-1 text-xs font-semibold rounded-md bg-white text-on-surface shadow-xs";
  var OFF = "px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface";
  var DEM_ON = "px-2.5 py-1 text-xs font-semibold rounded-md bg-white text-error shadow-xs";
  var DEM_OFF = "px-2.5 py-1 text-xs font-medium text-error hover:text-red-700";
  var PAGE_ON = "px-2.5 py-1 rounded border border-outline-variant/40 bg-primary-container text-white font-semibold";
  var PAGE_OFF = "px-2.5 py-1 rounded border border-outline-variant/40 bg-white hover:bg-surface-container text-on-surface";

  var rows = [];
  var byId = {};
  var avisos = {};
  var resumen = null;
  var filtro = "todos";
  var page = 0;
  var selectedId = null;
  var primed = false;
  var busy = false;
  var conv = null;
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
    if (!iso) return "";
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return "";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function nota(texto) { setText("sol-eta-aviso", texto); }

  function telemetriaVacia() {
    setText("sol-eta-vel", "—");
    setText("sol-eta-vel-sub", "sin telemetría");
    setText("sol-eta-trafico", "—");
    setText("sol-eta-trafico-min", "—");
    setText("sol-eta-trafico-sub", "sin reporte de tráfico");
    setText("sol-eta-clima", "—");
    setText("sol-eta-clima-sub", "sin clima");
    setText("sol-eta-bat", "—");
    setText("sol-eta-gps", "sin dato");
    setText("sol-eta-ping", "sin ping");
    setText("sol-eta-corredor", "sin corredor");
    setText("sol-eta-origen", "—");
    setText("sol-eta-punto", "—");
    setText("sol-eta-llegada", "—");
    setText("sol-eta-partida", "—");
    setText("sol-eta-recorrido", "sin recorrido");
    setText("sol-eta-resta", "—");
    var barra = $("sol-eta-barra");
    if (barra) barra.style.width = "0%";
  }

  function dash() {
    setText("sol-eta-kpi-prom", "—");
    setText("sol-eta-kpi-prom-hint", "sin medición");
    setText("sol-eta-kpi-prom-sub", "sin precisión medida");
    setText("sol-eta-kpi-demora", "—");
    setText("sol-eta-kpi-demora-badge", "sin desglose");
    setText("sol-eta-kpi-demora-sub", "—");
    setText("sol-eta-kpi-demora-sub2", "—");
    setText("sol-eta-kpi-hoy", "—");
    setText("sol-eta-kpi-hoy-hint", "sin dato");
    setText("sol-eta-kpi-hoy-sub", "sin % de entrega");
    setText("sol-eta-kpi-sla", "—");
    setText("sol-eta-kpi-sla-hint", "sin medición");
    setText("sol-eta-kpi-sla-sub", "sin tolerancia medida");
    telemetriaVacia();
  }

  function esDemora(g) { return g.fuente === "incidencia"; }
  function enTiempo(g) {
    return g.fuente === "destino" && g.etaTexto && g.estado !== "esperando_eta_chofer";
  }
  function pasa(g) {
    if (filtro === "demora") return esDemora(g);
    if (filtro === "tiempo") return enTiempo(g);
    if (filtro === "reprogramado") return false;
    var q = fold(($("sol-eta-buscar") || {}).value);
    if (!q) return true;
    return fold([g.viaje, g.cliente, g.chofer, g.destino, g.estadoLabel, g.causa, g.codigoIncidencia, g.telefonoCliente].join(" ")).indexOf(q) >= 0;
  }
  function visibles() {
    return rows.filter(function (g) {
      if (filtro === "demora" && !esDemora(g)) return false;
      if (filtro === "tiempo" && !enTiempo(g)) return false;
      if (filtro === "reprogramado") return false;
      var q = fold(($("sol-eta-buscar") || {}).value);
      if (!q) return true;
      return fold([g.viaje, g.cliente, g.chofer, g.destino, g.estadoLabel, g.causa, g.codigoIncidencia, g.telefonoCliente].join(" ")).indexOf(q) >= 0;
    });
  }

  function pintarKpis() {
    var enCola = resumen ? resumen.enCola : rows.length;
    var demoras = resumen ? resumen.demorasAbiertas : rows.filter(esDemora).length;
    var esperando = resumen ? resumen.esperandoChofer : rows.filter(function (g) { return g.estado === "esperando_eta_chofer"; }).length;
    var hoy = resumen ? resumen.notificacionesHoy : "—";
    var demHoy = resumen ? resumen.demorasNotificadasHoy : "—";
    setText("sol-eta-kpi-prom", "—");
    setText("sol-eta-kpi-prom-hint", "sin medición");
    setText("sol-eta-kpi-prom-sub", "sin precisión medida");
    setText("sol-eta-kpi-demora", String(demoras));
    setText("sol-eta-kpi-demora-badge", "sin desglose >45m");
    setText("sol-eta-kpi-demora-sub", enCola + " en cola");
    setText("sol-eta-kpi-demora-sub2", esperando + " esperando chofer");
    setText("sol-eta-kpi-hoy", String(hoy));
    setText("sol-eta-kpi-hoy-hint", demHoy + " demoras");
    setText("sol-eta-kpi-hoy-sub", "sin % de entrega");
    setText("sol-eta-kpi-sla", "—");
    setText("sol-eta-kpi-sla-hint", "sin medición");
    setText("sol-eta-kpi-sla-sub", "sin tolerancia medida");
  }

  function pintarFiltros() {
    var counts = {
      todos: rows.length,
      tiempo: rows.filter(enTiempo).length,
      demora: rows.filter(esDemora).length,
      reprogramado: 0,
    };
    var names = { todos: "Todos", tiempo: "En tiempo", demora: "Con demora", reprogramado: "Reprogramados" };
    var buttons = document.querySelectorAll("[data-filtro]");
    for (var i = 0; i < buttons.length; i++) {
      var kind = buttons[i].getAttribute("data-filtro");
      buttons[i].className = kind === "demora" ? (kind === filtro ? DEM_ON : DEM_OFF) : (kind === filtro ? ON : OFF);
      if (names[kind]) buttons[i].textContent = names[kind] + " (" + counts[kind] + ")";
    }
  }

  function pintarSelect() {
    var sel = $("sol-eta-viaje");
    if (!sel) return;
    if (!rows.length) {
      sel.innerHTML = "<option value=\"\">Sin casos en la cola</option>";
      return;
    }
    sel.innerHTML = rows.map(function (g) {
      var viaje = g.viaje && g.viaje !== "—" ? g.viaje : (g.codigoIncidencia || g.refId);
      return "<option value=\"" + esc(g.id) + "\">" + esc(viaje + " | " + (g.cliente || "Cliente")) + "</option>";
    }).join("");
    if (selectedId && byId[selectedId]) sel.value = selectedId;
  }

  function ver(g) {
    if (!g) return;
    selectedId = g.id;
    pintarSelect();
    var aviso = avisos[g.refId];
    setText("sol-eta-alerta", esDemora(g) ? (g.causa || g.estadoLabel || "Demora") : (g.estadoLabel || "En cola"));
    setText("sol-eta-alerta-sub", (g.destino || "Sin destino") + (g.cliente ? " · " + g.cliente : ""));
    setText("sol-eta-pactado", "—");
    setText("sol-eta-ventana", "Sin ventana pactada");
    setText("sol-eta-nuevo", g.etaTexto || "Sin ETA");
    setText("sol-eta-delta", g.etaMinutos != null ? g.etaMinutos + " min" : "—");
    setText("sol-eta-chofer", "Chofer: " + (g.chofer || "—") + (g.telefonoChofer ? " · " + g.telefonoChofer : ""));
    var preview = $("sol-eta-preview");
    if (preview) {
      preview.innerHTML = "Hola <strong class=\"font-semibold\">" + esc(g.cliente || "cliente") + "</strong>, el viaje <strong class=\"font-semibold\">" + esc(g.viaje && g.viaje !== "—" ? g.viaje : "sin viaje") + "</strong> con " + esc(g.chofer || "el chofer") + " tiene ETA <strong>" + esc(g.etaTexto || "sin estimado") + "</strong> hacia " + esc(g.destino || "el destino") + ".";
    }
    setText("sol-eta-preview-hora", "—");
    setText("sol-eta-corredor", esDemora(g) ? "Demora" : "Destino");
    setText("sol-eta-origen", "—");
    setText("sol-eta-punto", g.destino || "—");
    setText("sol-eta-llegada", g.cliente || "—");
    telemetriaVacia();
    setText("sol-eta-punto", g.destino || "—");
    setText("sol-eta-llegada", g.cliente || "—");
    if (aviso) {
      nota("Avisado " + (hora(aviso.created_at) || ""));
      setText("sol-eta-aviso-sub", aviso.mensaje || aviso.eta_texto || "Aviso registrado. Sin texto de confirmación del cliente.");
    } else {
      nota(g.notificado ? "Hay ETA cargado. El aviso al cliente todavía no figura en el historial." : "Todavía no se envió un aviso.");
      setText("sol-eta-aviso-sub", g.puedeNotificar ? "El WhatsApp sale con el botón verde, después de confirmar." : "Falta teléfono del cliente o el ETA del chofer.");
    }
  }

  function badge(g) {
    if (esDemora(g)) return "bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]";
    if (g.estado === "esperando_eta_chofer") return "bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]";
    return "bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]";
  }

  function fila(g) {
    var aviso = avisos[g.refId];
    var viaje = g.viaje && g.viaje !== "—" ? g.viaje : (g.codigoIncidencia || "—");
    var avisoTxt = aviso ? "Avisado " + (hora(aviso.created_at) || "") : "Sin aviso";
    return "<tr data-id=\"" + esc(g.id) + "\" class=\"" + (g.id === selectedId ? "bg-indigo-50/40 " : esDemora(g) ? "bg-red-50/20 " : "") + "hover:bg-surface-container-low/40 transition-colors cursor-pointer\">" +
      "<td class=\"py-3 px-4\"><div class=\"font-code-table font-semibold text-on-surface text-xs\">" + esc(viaje) + "</div><div class=\"font-label-md text-label-md font-bold text-on-surface\">" + esc(g.cliente || "—") + "</div></td>" +
      "<td class=\"py-3 px-3\"><div class=\"font-medium\">" + esc(g.destino || "—") + "</div></td>" +
      "<td class=\"py-3 px-3\"><div class=\"font-medium\">" + esc(g.chofer || "—") + "</div><span class=\"text-[11px] font-code-table text-outline\">" + esc(g.telefonoChofer || g.telefonoCliente || "—") + "</span></td>" +
      "<td class=\"py-3 px-3\"><div class=\"font-code-table font-bold text-on-surface\">" + esc(g.etaTexto || "—") + "</div><span class=\"text-[11px] text-outline\">" + esc(g.estadoLabel || "") + "</span></td>" +
      "<td class=\"py-3 px-3\"><span class=\"inline-flex items-center gap-1 font-label-caps text-[10px] px-2 py-0.5 rounded-full font-bold " + badge(g) + "\">" + esc(g.estadoLabel || "—") + "</span></td>" +
      "<td class=\"py-3 px-3\"><span class=\"text-xs text-on-surface-variant\">" + esc(avisoTxt) + "</span></td>" +
      "<td class=\"py-3 px-4 text-right\"><div class=\"flex items-center justify-end gap-1\">" +
      "<button type=\"button\" data-act=\"mapa\" title=\"Ver mapa\" class=\"p-1 hover:bg-surface-container rounded text-outline hover:text-on-surface\"><span class=\"material-symbols-outlined text-[18px]\">map</span></button>" +
      "<button type=\"button\" data-act=\"avisar\" title=\"Notificar WA\" class=\"p-1 hover:bg-surface-container rounded text-outline hover:text-[#128C7E]\"><span class=\"material-symbols-outlined text-[18px]\">chat</span></button>" +
      "<button type=\"button\" data-act=\"ventana\" title=\"Ajustar ventana\" class=\"p-1 hover:bg-surface-container rounded text-outline hover:text-on-surface\"><span class=\"material-symbols-outlined text-[18px]\">edit_calendar</span></button>" +
      "</div></td></tr>";
  }

  function vacio(texto) {
    var body = $("sol-eta-body");
    if (body) body.innerHTML = "<tr><td colspan=\"7\" class=\"py-8 px-4 text-center text-sm text-outline\">" + esc(texto) + "</td></tr>";
    setText("sol-eta-pie", texto);
  }

  function pintarTabla() {
    var list = visibles();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    var body = $("sol-eta-body");
    if (!slice.length) vacio(rows.length ? "No hay casos con este filtro." : "No hay casos en la cola.");
    else if (body) {
      body.innerHTML = slice.map(fila).join("");
      setText("sol-eta-pie", "Mostrando " + (page * PAGE + 1) + "–" + (page * PAGE + slice.length) + " de " + list.length);
    }
    var footer = $("sol-eta-pie") && $("sol-eta-pie").parentElement;
    if (!footer) return;
    var buttons = footer.querySelectorAll("button");
    var nums = [];
    for (var i = 0; i < buttons.length; i++) {
      var t = labelOf(buttons[i]);
      if (t === "anterior" || t.indexOf("siguiente") >= 0) continue;
      nums.push(buttons[i]);
    }
    for (var j = 0; j < nums.length; j++) {
      var n = pages <= 3 ? j : page - 1 + j;
      if (n < 0 || n >= pages) { nums[j].style.visibility = "hidden"; continue; }
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
    if (!conv) setText("sol-eta-chat", SESION);
    nota(SESION);
    setText("sol-eta-aviso-sub", SESION);
  }

  function load() {
    return Promise.all([
      api("/api/eta?limit=80"),
      api("/api/eta/resumen").catch(function () { return null; }),
      api("/api/eta/notificaciones?limit=40").catch(function () { return []; }),
    ]).then(function (pack) {
      live = true;
      rows = asList(pack[0]);
      resumen = pack[1];
      avisos = {};
      asList(pack[2]).forEach(function (n) {
        var key = n.ref_id || n.refId;
        if (!key) return;
        if (!avisos[key] || String(n.created_at || "") > String(avisos[key].created_at || "")) avisos[key] = n;
      });
      byId = {};
      rows.forEach(function (g) { byId[g.id] = g; });
      pintarKpis();
      pintarFiltros();
      if (!primed) {
        primed = true;
        var primero = rows.filter(esDemora)[0] || rows[0];
        if (primero) ver(primero);
        else pintarSelect();
      } else if (selectedId && byId[selectedId]) ver(byId[selectedId]);
      else pintarSelect();
      pintarTabla();
    }).catch(function (err) {
      if (err && err.status === 401) sesion();
      else {
        vacio((err && err.message) || "No pude leer la cola ETA.");
        nota((err && err.message) || "No pude leer la cola ETA.");
      }
    });
  }

  function enviar(g) {
    if (!g || busy) return;
    if (!g.puedeNotificar) {
      nota("No se puede avisar: falta el teléfono del cliente o el ETA.");
      setText("sol-eta-aviso-sub", g.telefonoCliente ? "Pedile el estimado al chofer antes de avisar." : "Este caso no tiene teléfono de cliente.");
      return;
    }
    var ok = window.confirm((esDemora(g) ? "Avisar demora" : "Enviar ETA") + " por WhatsApp a " + (g.cliente || "el cliente") + "\n" + (g.telefonoCliente || "sin teléfono") + "\n" + (g.destino || "") + "\nETA: " + (g.etaTexto || "sin estimado") + "\n\nSale solo al cliente. No copia al depósito.");
    if (!ok) {
      nota("No se envió el WhatsApp.");
      return;
    }
    busy = true;
    nota("Enviando…");
    var req = esDemora(g)
      ? api("/api/eta/incidencia/" + encodeURIComponent(g.refId) + "/avisar", { method: "POST", body: JSON.stringify({ etaTexto: g.etaTexto || undefined }) })
      : api("/api/eta/destino/" + encodeURIComponent(g.refId) + "/notificar", { method: "POST", body: JSON.stringify({ demora: false, etaTexto: g.etaTexto || undefined }) });
    req.then(function (res) {
      nota(res.mensaje || "Aviso enviado.");
      setText("sol-eta-aviso-sub", res.telefono ? "Enviado a " + res.telefono + "." : "El aviso salió.");
      return load();
    }).catch(function (err) {
      nota("No se envió el WhatsApp.");
      setText("sol-eta-aviso-sub", err.status === 401 ? SESION : (err.message || "Falló el envío."));
    }).then(function () { busy = false; });
  }

  function preguntar(q) {
    q = String(q || "").trim();
    if (!q) return;
    setText("sol-eta-chat", "Consultando…");
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({ agentId: "eta", message: q, conversationId: conv || undefined }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      setText("sol-eta-chat", (res.message && res.message.text) || "Sin respuesta.");
    }).catch(function (err) {
      setText("sol-eta-chat", err.status === 401 ? SESION : (err.message || "No pude consultar."));
    });
  }

  dash();
  setText("sol-eta-alerta", "Sin caso seleccionado");
  setText("sol-eta-alerta-sub", "La cola real reemplaza el ejemplo.");
  setText("sol-eta-pactado", "—");
  setText("sol-eta-ventana", "Sin ventana pactada");
  setText("sol-eta-nuevo", "—");
  setText("sol-eta-delta", "—");
  setText("sol-eta-chofer", "—");
  setText("sol-eta-preview", "Elegí un caso. El WhatsApp se envía con el botón verde.");
  setText("sol-eta-preview-hora", "—");
  nota("Todavía no se envió un aviso.");
  setText("sol-eta-aviso-sub", "Sin confirmación del cliente en el sistema.");
  vacio("Cargando la cola…");
  load();
  setInterval(function () { if (!busy) load(); }, 12000);

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pill = t.closest("[data-filtro]");
    var act = t.closest("[data-act]");
    var row = t.closest("#sol-eta-body tr[data-id]");
    var pageBtn = t.closest("[data-page]");
    var textoBtn = t.closest("button");
    var texto = textoBtn ? labelOf(textoBtn) : "";
    var chipBtn = t.closest("button");
    var chatChip = chipBtn && $("sol-eta-chat") && chipBtn.closest(".rounded-xl") === $("sol-eta-chat").closest(".rounded-xl") && String(chipBtn.className).indexOf("rounded-full") >= 0;
    var consultar = $("sol-eta-pregunta") && textoBtn && textoBtn.parentElement === $("sol-eta-pregunta").parentElement;
    var handled = pill || act || row || pageBtn || chatChip || consultar || t.closest("#sol-eta-enviar") || t.closest("#sol-eta-reprogramar");
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("disparar aviso") >= 0 || texto === "anterior" || texto.indexOf("siguiente") >= 0) handled = textoBtn;
    if (!handled) return;
    ev.preventDefault();
    ev.stopPropagation();

    if (t.closest("#sol-eta-enviar") || (act && act.getAttribute("data-act") === "avisar")) {
      var id = act && row ? row.getAttribute("data-id") : selectedId;
      if (id && byId[id]) ver(byId[id]);
      enviar(byId[id]);
      return;
    }
    if (t.closest("#sol-eta-reprogramar") || (act && act.getAttribute("data-act") === "ventana")) {
      nota("No se reprograma la ventana en esta pantalla.");
      setText("sol-eta-aviso-sub", "El ETA lo informa el chofer. Acá solo se avisa al cliente.");
      return;
    }
    if (act && act.getAttribute("data-act") === "mapa") {
      nota("Sin coordenadas para abrir el mapa.");
      return;
    }
    if (texto.indexOf("sincronizar") >= 0) {
      nota("Actualizando…");
      load().then(function () { if (live) nota("Cola actualizada."); });
      return;
    }
    if (texto.indexOf("disparar aviso") >= 0) {
      var btn = $("sol-eta-enviar");
      if (btn && btn.scrollIntoView) btn.scrollIntoView({ behavior: "smooth", block: "center" });
      nota("Elegí el caso y confirmá con el botón verde. Todavía no se envió nada.");
      return;
    }
    if (pill) {
      filtro = pill.getAttribute("data-filtro");
      page = 0;
      pintarFiltros();
      pintarTabla();
      return;
    }
    if (row && !(act && act.getAttribute("data-act") === "avisar")) {
      ver(byId[row.getAttribute("data-id")]);
      pintarTabla();
      return;
    }
    if (pageBtn) { page = Number(pageBtn.getAttribute("data-page")) || 0; pintarTabla(); return; }
    if (texto === "anterior") { page = Math.max(0, page - 1); pintarTabla(); return; }
    if (texto.indexOf("siguiente") >= 0) { page += 1; pintarTabla(); return; }
    if (chatChip || consultar) {
      var q = consultar ? ($("sol-eta-pregunta").value || "") : labelOf(chipBtn);
      if (consultar) $("sol-eta-pregunta").value = "";
      preguntar(q);
    }
  }, true);

  var buscar = $("sol-eta-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; pintarTabla(); });
  var sel = $("sol-eta-viaje");
  if (sel) sel.addEventListener("change", function () {
    if (byId[sel.value]) { ver(byId[sel.value]); pintarTabla(); }
  });
  var pregunta = $("sol-eta-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    preguntar(pregunta.value);
    pregunta.value = "";
  });
})();
