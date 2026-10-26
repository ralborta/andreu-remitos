(function () {
  var POLL = 12000;
  var TONE_HEX = { green: "#16a34a", amber: "#d97706", red: "#dc2626", gray: "#6b7280", blue: "#0284c7" };
  var TONE_LABEL = {
    green: "Reciente",
    amber: "Antigua / baja prec.",
    red: "Perdido",
    gray: "No iniciado",
    blue: "Llegado",
  };
  var TONE_PILL = {
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    red: "bg-rose-50 text-rose-700 border border-rose-200",
    gray: "bg-slate-100 text-slate-600 border border-slate-200",
    blue: "bg-blue-50 text-blue-700 border border-blue-200/60",
  };
  var TONE_DOT = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", gray: "bg-slate-400", blue: "bg-blue-500" };
  var ORDER = { red: 0, amber: 1, green: 2, blue: 3, gray: 4 };

  var frame = document.getElementById("tracking-map");
  var rows = [];
  var selectedId = null;
  var sessionError = false;
  var loaded = false;
  var fitted = false;
  var busy = false;
  var linkId = null;

  function $(id) { return document.getElementById(id); }

  function send(payload) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(payload, "*");
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
          err.code = data.error;
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function text(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null || value === "" ? "—" : String(value);
  }

  function trackingTone(status, ageSec, accuracy) {
    var s = String(status || "NOT_STARTED");
    if (s === "COMPLETED" || s === "ARRIVED") return "blue";
    if (s === "CANCELLED" || s === "STOPPED_BY_DRIVER") return "gray";
    if (s === "NOT_STARTED" || s === "AWAITING_PERMISSION") return "gray";
    if (s === "PERMISSION_DENIED") return "red";
    if (ageSec != null && ageSec > 300) return "red";
    if (s === "STALE" || s === "BACKGROUND_SUSPECTED" || s === "OFFLINE") return "amber";
    if (s === "LOW_ACCURACY" || (accuracy != null && accuracy > 100)) return "amber";
    if (ageSec != null && ageSec > 120) return "amber";
    if (s === "ACTIVE" && (ageSec == null || ageSec <= 90)) return "green";
    return "amber";
  }

  function ageFromIso(iso) {
    if (!iso) return null;
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 1000));
  }

  function formatAge(sec) {
    if (sec == null) return "sin datos";
    if (sec < 60) return "hace " + sec + " segundos";
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return s ? "hace " + m + " min " + s + " s" : "hace " + m + " min";
  }

  function buildAlerts(state, ageSec) {
    var alerts = [];
    var status = state && state.status;
    if (!state || !status || status === "NOT_STARTED") {
      alerts.push("Tracking no iniciado");
      return alerts;
    }
    if (status === "PERMISSION_DENIED") alerts.push("Permiso de ubicación denegado");
    if (ageSec != null && ageSec > 300) alerts.push("Sin posición > 5 min (crítico)");
    else if (ageSec != null && ageSec > 120) alerts.push("Posición antigua (stale)");
    if (status === "BACKGROUND_SUSPECTED") alerts.push("Posible suspensión del navegador");
    if (status === "OFFLINE") alerts.push("Chofer offline / pendientes");
    if (status === "LOW_ACCURACY" || (state.accuracy != null && state.accuracy > 100)) {
      alerts.push("Baja precisión GPS");
    }
    return alerts;
  }

  function canTrack(estado) {
    return estado === "asignado" || estado === "en_curso" || estado === "confirmado";
  }

  function fechaTxt(v) {
    if (!v || !v.fecha) return "—";
    var m = String(v.fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
    var d = m ? m[3] + "/" + m[2] + "/" + m[1] : v.fecha;
    return v.hora ? d + " - " + String(v.hora).slice(0, 5) : d;
  }

  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function selected() {
    for (var i = 0; i < rows.length; i++) if (rows[i].tripId === selectedId) return rows[i];
    return null;
  }

  function pushMap(fit) {
    var vehicles = [];
    rows.forEach(function (row) {
      var pos = row.state && row.state.last_position;
      if (!pos || !isFinite(pos.latitude) || !isFinite(pos.longitude)) return;
      var codigo = (row.viaje && row.viaje.codigo) || row.tripId;
      vehicles.push({
        id: row.tripId,
        lat: pos.latitude,
        lng: pos.longitude,
        color: TONE_HEX[row.tone],
        pulse: row.tone === "green",
        label: codigo,
        popup: "<div style=\"font:12px/1.4 system-ui;max-width:220px\"><strong>" + esc(codigo) + "</strong><br/>" +
          esc((row.viaje && row.viaje.chofer) || "—") + " · " + esc((row.viaje && row.viaje.tractor) || "—") + "<br/>" +
          "Estado: " + esc((row.state && row.state.status) || "NOT_STARTED") + "<br/>" +
          "Última ubicación: " + esc(formatAge(row.ageSec)) + "<br/>Fuente: navegador del chofer</div>",
      });
    });
    send({ type: "sol-tracking", action: "vehicles", vehicles: vehicles, fit: Boolean(fit) });
    if (fit && vehicles.length) fitted = true;
  }

  function paintOverlay(row) {
    var dot = $("sol-trk-overlay-dot");
    if (!row) {
      text("sol-trk-overlay-nombre", "Sin viaje seleccionado");
      text("sol-trk-overlay-codigo", "—");
      text("sol-trk-overlay-unidad", "—");
      text("sol-trk-overlay-estado", "—");
      text("sol-trk-overlay-prec", "—");
      text("sol-trk-overlay-edad", "sin datos");
      text("sol-trk-overlay-ruta", "Elegí un viaje de la torre");
      if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-400";
      return;
    }
    var v = row.viaje || {};
    text("sol-trk-overlay-nombre", v.chofer || "Sin chofer");
    text("sol-trk-overlay-codigo", v.codigo || row.tripId);
    text("sol-trk-overlay-unidad", v.tractor || "—");
    text("sol-trk-overlay-estado", (row.state && row.state.status) || "NOT_STARTED");
    text("sol-trk-overlay-prec", row.state && row.state.accuracy != null ? "±" + Math.round(row.state.accuracy) + " m" : "—");
    text("sol-trk-overlay-edad", formatAge(row.ageSec));
    text("sol-trk-overlay-ruta", (v.origen || "—") + " → " + (v.destino || "—"));
    if (dot) dot.className = "w-2 h-2 rounded-full " + (TONE_DOT[row.tone] || "bg-slate-400") + (row.tone === "green" ? " animate-pulse" : "");
  }

  function visibleRows() {
    var q = fold($("sol-trk-buscar") ? $("sol-trk-buscar").value : "");
    var tone = $("sol-trk-estado") ? $("sol-trk-estado").value : "todos";
    return rows.filter(function (row) {
      if (tone !== "todos" && row.tone !== tone) return false;
      if (!q) return true;
      var v = row.viaje || {};
      var blob = fold([v.codigo, v.chofer, v.tractor, v.origen, v.destino, v.cliente, row.state && row.state.status].join(" "));
      return blob.indexOf(q) >= 0;
    });
  }

  function card(row) {
    var v = row.viaje || {};
    var wrap = document.createElement("div");
    wrap.className = "p-3 rounded-lg border border-slate-200/90 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" + (row.tripId === selectedId ? " ring-1 ring-indigo-200" : "");
    wrap.setAttribute("data-trip", row.tripId);
    var acc = row.state && row.state.accuracy != null ? "±" + Math.round(row.state.accuracy) + " m" : "—";
    wrap.innerHTML =
      '<div class="space-y-1">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<span class="w-2 h-2 rounded-full ' + (TONE_DOT[row.tone] || "bg-slate-400") + (row.tone === "green" ? " animate-pulse" : "") + '"></span>' +
      '<span class="font-bold text-slate-900">' + esc(v.chofer || "Sin chofer") + "</span>" +
      '<span class="font-mono text-indigo-600 text-[11px]">' + esc(v.codigo || row.tripId) + "</span>" +
      '<span class="px-2 py-0.5 rounded text-[10px] font-semibold ' + (TONE_PILL[row.tone] || "") + '">' + esc((row.state && row.state.status) || "NOT_STARTED") + "</span>" +
      "</div>" +
      '<p class="text-slate-600 text-[11px]">' + esc((v.origen || "—") + " → " + (v.destino || "—") + (v.tractor ? " · " + v.tractor : "")) + "</p>" +
      '<div class="flex items-center gap-3 text-slate-500 text-[10px]">' +
      "<span>Señal: <b>" + esc(formatAge(row.ageSec)) + "</b></span>" +
      "<span>Precisión: <b>" + esc(acc) + "</b></span>" +
      (row.alerts[0] ? '<span class="text-amber-700">' + esc(row.alerts[0]) + "</span>" : "") +
      "</div></div>" +
      '<div class="flex items-center gap-1.5 shrink-0">' +
      '<button type="button" data-act="mapa" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] transition-colors">Ver en mapa</button>' +
      '<button type="button" data-act="wa" class="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded font-medium text-[11px] transition-colors">WhatsApp</button>' +
      "</div>";
    return wrap;
  }

  function tableRow(row) {
    var v = row.viaje || {};
    var tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/80 transition-colors cursor-pointer";
    tr.setAttribute("data-trip", row.tripId);
    var pos = row.state && row.state.last_position;
    var ubi = pos ? pos.latitude.toFixed(5) + ", " + pos.longitude.toFixed(5) : "sin posición";
    var acc = row.state && row.state.accuracy != null ? "±" + Math.round(row.state.accuracy) + " m" : "—";
    tr.innerHTML =
      '<td class="py-3 px-4 font-mono font-semibold text-indigo-600">' + esc(v.codigo || row.tripId) + "</td>" +
      '<td class="py-3 px-4 text-slate-500 whitespace-nowrap">' + esc(fechaTxt(v)) + "</td>" +
      '<td class="py-3 px-4 font-semibold text-slate-900">' + esc(v.chofer || "Sin chofer") + "</td>" +
      '<td class="py-3 px-4 font-mono text-slate-600">' + esc(v.telefonoChofer || "—") + "</td>" +
      '<td class="py-3 px-4 whitespace-nowrap">' + esc(formatAge(row.ageSec)) + "</td>" +
      '<td class="py-3 px-4 text-slate-600">' + esc(ubi) + "</td>" +
      '<td class="py-3 px-4 font-semibold text-slate-800">' + esc(acc) + "</td>" +
      '<td class="py-3 px-4"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ' + (TONE_PILL[row.tone] || "") + '"><span class="w-1.5 h-1.5 rounded-full ' + (TONE_DOT[row.tone] || "") + ' mr-1.5"></span>' + esc((row.state && row.state.status) || "NOT_STARTED") + "</span></td>" +
      '<td class="py-3 px-4 text-center whitespace-nowrap"><button type="button" data-act="detalle" class="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded font-medium text-[11px]">Detalle</button></td>';
    return tr;
  }

  function render() {
    var list = $("sol-trk-lista");
    var body = $("sol-trk-body");
    var shown = visibleRows();
    if (list) {
      list.innerHTML = "";
      if (!shown.length) {
        var empty = document.createElement("p");
        empty.className = "text-xs text-slate-400";
        empty.textContent = rows.length ? "No hay viajes con esos filtros." : "No hay viajes con tracking ni asignados en curso.";
        list.appendChild(empty);
      } else {
        shown.forEach(function (row) { list.appendChild(card(row)); });
      }
    }
    if (body) {
      body.innerHTML = "";
      if (!shown.length) {
        var tr = document.createElement("tr");
        tr.innerHTML = '<td colspan="9" class="py-8 text-center text-slate-400">No hay viajes con esos filtros.</td>';
        body.appendChild(tr);
      } else {
        shown.forEach(function (row) { body.appendChild(tableRow(row)); });
      }
    }
    var counts = { green: 0, amber: 0, red: 0, gray: 0, blue: 0 };
    rows.forEach(function (row) { counts[row.tone] += 1; });
    document.querySelectorAll("#sol-trk-tones [data-tone]").forEach(function (btn) {
      var tone = btn.getAttribute("data-tone");
      var label = btn.textContent.replace(/^\s*\d+\s*/, "");
      btn.lastChild.textContent = " " + counts[tone] + " " + (TONE_LABEL[tone] || label);
    });
    var live = rows.filter(function (row) { return row.state && row.state.last_position; }).length;
    text("sol-trk-kpi-vivos", String(live));
    text("sol-trk-kpi-vivos-hint", "de " + rows.length + " en torre");
    var transmitting = rows.filter(function (row) { return row.tone === "green" || row.tone === "amber" || row.tone === "blue"; }).length;
    text("sol-trk-transmitiendo", transmitting + (transmitting === 1 ? " chofer en torre" : " choferes en torre"));
    var accs = rows.map(function (row) { return row.state && row.state.accuracy; }).filter(function (n) { return n != null && isFinite(n); });
    text("sol-trk-kpi-prec", accs.length ? (accs.reduce(function (a, b) { return a + b; }, 0) / accs.length).toFixed(1) + " m" : "—");
    text("sol-trk-kpi-prec-hint", accs.length ? "precisión media" : "sin posiciones");
    paintOverlay(selected());
  }

  function fillSelect() {
    var sel = $("sol-trk-viaje");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Elegí un viaje asignado, confirmado o en curso";
    sel.appendChild(opt0);
    rows.forEach(function (row) {
      var v = row.viaje;
      if (!v || !canTrack(v.estado)) return;
      var opt = document.createElement("option");
      opt.value = row.tripId;
      opt.textContent = (v.codigo || row.tripId) + " — " + (v.chofer || "Sin chofer") + (v.cliente ? " (" + v.cliente + ")" : "");
      opt.setAttribute("data-tel", v.telefonoChofer || "");
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  function showError(msg) {
    var list = $("sol-trk-lista");
    if (!list) return;
    list.innerHTML = "";
    var p = document.createElement("p");
    p.className = "text-xs text-rose-600";
    p.textContent = msg;
    list.appendChild(p);
  }

  function load() {
    return Promise.all([
      api("/api/tracking/trips/active"),
      api("/api/viajes?limit=100"),
      api("/api/tracking/pilot/metrics").catch(function () { return null; }),
    ]).then(function (res) {
      var active = res[0];
      var viajes = Array.isArray(res[1]) ? res[1] : [];
      var metrics = res[2];
      var byId = {};
      viajes.forEach(function (v) { byId[v.id] = v; });
      var activeIds = {};
      var merged = (active.trips || []).map(function (state) {
        activeIds[state.trip_id] = true;
        var ageSec = state.position_age_seconds != null ? state.position_age_seconds : ageFromIso(state.last_position_at);
        return {
          tripId: state.trip_id,
          viaje: byId[state.trip_id] || null,
          state: state,
          ageSec: ageSec,
          tone: trackingTone(state.status, ageSec, state.accuracy),
          alerts: buildAlerts(state, ageSec),
        };
      });
      viajes.forEach(function (v) {
        if ((v.estado === "asignado" || v.estado === "en_curso") && !activeIds[v.id]) {
          merged.push({
            tripId: v.id,
            viaje: v,
            state: null,
            ageSec: null,
            tone: "gray",
            alerts: ["Tracking no iniciado"],
          });
        }
      });
      merged.sort(function (a, b) { return ORDER[a.tone] - ORDER[b.tone]; });
      rows = merged;
      sessionError = false;
      loaded = true;
      if (metrics && metrics.last24h) text("sol-trk-kpi-pos", metrics.last24h.positions);
      if (metrics && metrics.gate) {
        var g = metrics.gate;
        text("sol-trk-modo", (g.pilot || g.gated) ? "Modo: Piloto" : "Modo: abierto");
      }
      fillSelect();
      render();
      pushMap(!fitted);
      if (selectedId) return openDetail(selectedId, true);
    }).catch(function (err) {
      var msg = err && err.message ? err.message : "No se pudo cargar la torre";
      sessionError = err && err.status === 401;
      loaded = true;
      if (sessionError) decir("Hace falta una sesión para consultar la operación.");
      if (/feature_disabled|no habilitado|404/i.test(msg) || (err && err.code === "feature_disabled")) {
        showError("El módulo está desactivado. Activá SOL_TRACKING_EXPRESS_ENABLED=true en el API para ver la torre.");
        decir("El módulo de tracking está desactivado en el servidor.");
      } else if (!sessionError) {
        showError(msg);
        decir(msg);
      } else {
        showError(msg);
      }
    });
  }

  function openDetail(tripId, silent) {
    selectedId = tripId;
    var row = selected();
    paintOverlay(row);
    var box = $("sol-trk-detalle");
    if (box) box.classList.remove("hidden");
    text("sol-trk-detalle-titulo", "Detalle · " + ((row && row.viaje && row.viaje.codigo) || tripId));
    var sel = $("sol-trk-viaje");
    if (sel && row && row.viaje && canTrack(row.viaje.estado)) {
      sel.value = tripId;
      if ($("sol-trk-tel")) $("sol-trk-tel").value = row.viaje.telefonoChofer || "";
    }
    if (!silent) render();
    return Promise.all([
      api("/api/tracking/trips/" + encodeURIComponent(tripId) + "/live"),
      api("/api/tracking/trips/" + encodeURIComponent(tripId) + "/history"),
    ]).then(function (pair) {
      var live = pair[0];
      var history = pair[1];
      var tracking = (live && live.tracking) || (row && row.state) || null;
      var age = tracking ? (tracking.position_age_seconds != null ? tracking.position_age_seconds : ageFromIso(tracking.last_position_at)) : (row && row.ageSec);
      text("sol-trk-detalle-estado", (tracking && tracking.status) || "NOT_STARTED");
      text("sol-trk-detalle-edad", formatAge(age));
      text("sol-trk-detalle-prec", tracking && tracking.accuracy != null ? "±" + Math.round(tracking.accuracy) + " metros" : "—");
      var alerts = buildAlerts(tracking, age);
      text("sol-trk-detalle-alerta", alerts[0] || "");
      var nota = $("sol-trk-detalle-nota");
      var status = (tracking && tracking.status) || "NOT_STARTED";
      var hasPos = tracking && tracking.last_position;
      if (nota) {
        if (!hasPos && (status === "NOT_STARTED" || status === "AWAITING_PERMISSION")) {
          nota.textContent = "Sin posiciones en el mapa: el chofer aceptó consentimiento pero aún no tocó «Iniciar seguimiento» (o el inicio no llegó al servidor).";
          nota.classList.remove("hidden");
        } else {
          nota.classList.add("hidden");
        }
      }
      var posList = $("sol-trk-detalle-pos");
      var evList = $("sol-trk-detalle-ev");
      if (posList) {
        posList.innerHTML = "";
        var positions = (history && history.positions) || [];
        if (!positions.length) {
          posList.innerHTML = "<li>Sin posiciones todavía.</li>";
        } else {
          positions.slice(-30).reverse().forEach(function (p) {
            var li = document.createElement("li");
            li.className = "font-mono";
            li.textContent = "#" + p.sequence + " · " + Number(p.latitude).toFixed(5) + ", " + Number(p.longitude).toFixed(5) +
              (p.accuracy != null ? " · ±" + Math.round(p.accuracy) + "m" : "") + " · " +
              new Date(p.recorded_at).toLocaleTimeString("es-AR");
            posList.appendChild(li);
          });
        }
        var pts = positions.filter(function (p) { return isFinite(p.latitude) && isFinite(p.longitude); }).map(function (p) { return [p.latitude, p.longitude]; });
        send({ type: "sol-tracking", action: "trail", points: pts });
      }
      if (evList) {
        evList.innerHTML = "";
        var events = (history && history.events) || [];
        if (!events.length) {
          evList.innerHTML = "<li>Sin eventos.</li>";
        } else {
          events.slice(-25).reverse().forEach(function (e) {
            var li = document.createElement("li");
            li.textContent = e.type + " · " + new Date(e.occurred_at).toLocaleString("es-AR");
            evList.appendChild(li);
          });
        }
      }
      var pos = tracking && tracking.last_position;
      if (pos) send({ type: "sol-tracking", action: "center", lat: pos.latitude, lng: pos.longitude, zoom: 13 });
    }).catch(function (err) {
      text("sol-trk-detalle-alerta", err.message || "No se pudo cargar el detalle");
    });
  }

  function generar(tripId, sendWa) {
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].tripId === tripId) row = rows[i];
    var msg = $("sol-trk-link-msg");
    if (!row || !row.viaje || !canTrack(row.viaje.estado)) {
      if (msg) msg.textContent = "El enlace se genera solo en viajes confirmados, asignados o en curso.";
      return;
    }
    if (busy) return;
    busy = true;
    api("/api/tracking/links", {
      method: "POST",
      body: JSON.stringify({ tripId: tripId, sendWhatsApp: Boolean(sendWa) }),
    }).then(function (res) {
      linkId = res.link && res.link.id;
      if ($("sol-trk-url")) $("sol-trk-url").textContent = res.trackingUrl || "—";
      var note = res.reused ? "Enlace activo listo." : "Enlace generado.";
      if (sendWa) {
        note = res.whatsapp && res.whatsapp.ok
          ? (res.reused ? "Enlace activo reenviado por WhatsApp al chofer." : "Enlace generado y enviado por WhatsApp al chofer.")
          : note + " WhatsApp: " + ((res.whatsapp && res.whatsapp.error) || "no enviado (revisá teléfono / bot).");
      }
      if (msg) msg.textContent = note;
    }).catch(function (err) {
      if (msg) msg.textContent = err.message || "No pude crear el enlace";
    }).finally(function () { busy = false; });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act], [data-trip] button, [data-tracking-center], [data-tracking-zoom], [data-sol-trk-refresh], #sol-trk-generar, #sol-trk-copiar, #sol-trk-enlace-rapido, #sol-trk-tones [data-tone]");
    if (!btn) {
      var rowEl = e.target.closest("[data-trip]");
      if (rowEl && rowEl.getAttribute("data-trip")) openDetail(rowEl.getAttribute("data-trip"));
      return;
    }
    if (btn.id === "sol-trk-enlace-rapido") {
      var sel = $("sol-trk-viaje");
      if (sel) sel.focus();
      return;
    }
    if (btn.hasAttribute("data-sol-trk-refresh")) {
      e.preventDefault();
      fitted = false;
      load();
      return;
    }
    if (btn.hasAttribute("data-tracking-zoom")) {
      e.preventDefault();
      send({ type: "sol-tracking", action: "zoom", dir: Number(btn.getAttribute("data-tracking-zoom")) });
      return;
    }
    if (btn.hasAttribute("data-tracking-center")) {
      e.preventDefault();
      var current = selected();
      var pos = current && current.state && current.state.last_position;
      if (pos) send({ type: "sol-tracking", action: "center", lat: pos.latitude, lng: pos.longitude, zoom: 13 });
      return;
    }
    if (btn.id === "sol-trk-copiar") {
      var url = ($("sol-trk-url") && $("sol-trk-url").textContent || "").trim();
      if (url.indexOf("http") === 0 && navigator.clipboard) navigator.clipboard.writeText(url);
      return;
    }
    if (btn.id === "sol-trk-generar") {
      var id = $("sol-trk-viaje") && $("sol-trk-viaje").value;
      if (id) generar(id, true);
      else if ($("sol-trk-link-msg")) $("sol-trk-link-msg").textContent = "Elegí un viaje confirmado, asignado o en curso.";
      return;
    }
    var toneBtn = btn.closest("#sol-trk-tones [data-tone]");
    if (toneBtn && $("sol-trk-estado")) {
      $("sol-trk-estado").value = toneBtn.getAttribute("data-tone");
      render();
      return;
    }
    var host = btn.closest("[data-trip]");
    if (!host) return;
    var tripId = host.getAttribute("data-trip");
    var act = btn.getAttribute("data-act");
    if (act === "wa") generar(tripId, true);
    else openDetail(tripId);
  });

  var buscar = $("sol-trk-buscar");
  if (buscar) buscar.addEventListener("input", render);
  var estado = $("sol-trk-estado");
  if (estado) estado.addEventListener("change", render);
  var viajeSel = $("sol-trk-viaje");
  if (viajeSel) viajeSel.addEventListener("change", function () {
    var opt = viajeSel.options[viajeSel.selectedIndex];
    if ($("sol-trk-tel")) $("sol-trk-tel").value = opt ? (opt.getAttribute("data-tel") || "") : "";
    if (viajeSel.value) openDetail(viajeSel.value);
  });

  window.addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.type !== "sol-tracking" || data.action !== "ready") return;
    pushMap(!fitted);
  });

  function decir(texto) {
    var p = $("sol-trk-chat");
    if (p) p.textContent = texto;
  }

  function tienePosicion(row) {
    var pos = row.state && row.state.last_position;
    return Boolean(pos && isFinite(pos.latitude) && isFinite(pos.longitude));
  }

  function linea(row) {
    var v = row.viaje || {};
    var pos = row.state && row.state.last_position;
    var ubi = tienePosicion(row) ? pos.latitude.toFixed(5) + ", " + pos.longitude.toFixed(5) : "sin posición";
    return (v.codigo || row.tripId) + " · " + (v.chofer || "Sin chofer") + " · " + (v.origen || "—") + " → " + (v.destino || "—") + " · " + ((row.state && row.state.status) || "NOT_STARTED") + " · " + formatAge(row.ageSec) + " · " + ubi;
  }

  function listar(lista, vacio) {
    if (!lista.length) return vacio;
    return lista.slice(0, 8).map(linea).join(" · ");
  }

  function preguntar(q) {
    q = String(q || "").replace(/\s+/g, " ").trim();
    if (!q) return;
    var input = $("sol-trk-pregunta");
    if (input) input.value = q;
    if (sessionError) {
      decir("Hace falta una sesión para consultar la operación.");
      return;
    }
    if (!loaded) {
      decir("Todavía estoy cargando la torre.");
      return;
    }
    var f = fold(q);
    var vivos = rows.filter(tienePosicion);
    var sin = rows.filter(function (row) { return !tienePosicion(row); });
    var alerta = rows.filter(function (row) { return row.tone === "red"; });
    var ruta = rows.filter(function (row) { return row.tone === "green"; });
    if (f.indexOf("sin posicion") >= 0 || f.indexOf("no tienen posicion") >= 0 || f.indexOf("quienes no") >= 0) {
      decir(sin.length ? sin.length + " sin posición. " + listar(sin, "") : "Todos los de la torre tienen una posición.");
      return;
    }
    if (f.indexOf("alerta") >= 0 || f.indexOf("gps") >= 0 || f.indexOf("perdid") >= 0) {
      decir(alerta.length ? alerta.length + " con alerta de GPS. " + listar(alerta, "") : "No hay alertas de GPS en la torre cargada.");
      return;
    }
    if (f.indexOf("en ruta") >= 0 || f.indexOf("reciente") >= 0) {
      decir(ruta.length ? ruta.length + " en ruta, con señal reciente. " + listar(ruta, "") : "No hay choferes en ruta con señal reciente.");
      return;
    }
    if (f.indexOf("transmit") >= 0 || f.indexOf("cuantos") >= 0) {
      decir("Hay " + vivos.length + " con posición reportada, de " + rows.length + " en la torre. " + listar(vivos, "Ninguno tiene una posición ahora."));
      return;
    }
    var hallados = rows.filter(function (row) {
      var v = row.viaje || {};
      var blob = fold([v.codigo, v.chofer, v.tractor, v.cliente, v.origen, v.destino, row.tripId].join(" "));
      return blob.indexOf(f) >= 0;
    });
    if (hallados.length) {
      decir(listar(hallados, ""));
      return;
    }
    decir("En la torre hay " + rows.length + " viajes, " + vivos.length + " con posición y " + alerta.length + " con alerta de GPS. Probá con un chofer, un código de viaje o una sugerencia.");
  }

  document.addEventListener("click", function (e) {
    var root = e.target.closest("#sol-trk-chat-box");
    if (!root) return;
    var btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var label = fold((btn.textContent || "").replace(/\s+/g, " ").trim());
    if (String(btn.className).indexOf("sol-chat-chip") >= 0) {
      preguntar(btn.textContent);
      return;
    }
    if (label.indexOf("consultar") === 0) {
      var box = $("sol-trk-pregunta");
      preguntar(box ? box.value : "");
    }
  }, true);

  var pregunta = $("sol-trk-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    preguntar(pregunta.value);
  });

  load();
  setInterval(load, POLL);
})();
