(function () {
  var PAGE = 5;
  var rows = [];
  var live = false;
  var selectedId = null;
  var page = 0;
  var modo = "direccion";
  var placeId = null;
  var conv = null;
  var primed = false;
  var busy = false;
  var sugTimer = null;

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

  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function displayPhone(raw) {
    var d = digits(raw);
    if (d.indexOf("549") === 0) return d.slice(3);
    if (d.indexOf("54") === 0) return d.slice(2);
    return d;
  }
  function sendPhone(raw) {
    var d = digits(raw);
    if (!d) return "";
    if (d.indexOf("54") === 0) return d;
    if (d.length <= 8) return "54911" + d;
    return "549" + d;
  }
  function hace(iso) {
    if (!iso) return "";
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return "";
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return "Hace " + s + " s";
    var m = Math.floor(s / 60);
    if (m < 60) return "Hace " + m + " min";
    var h = Math.floor(m / 60);
    if (h < 24) return "Hace " + h + " h";
    return "Hace " + Math.floor(h / 24) + " d";
  }
  function mismoDia(iso) {
    if (!iso) return false;
    var t = new Date(iso);
    var h = new Date();
    return t.getFullYear() === h.getFullYear() && t.getMonth() === h.getMonth() && t.getDate() === h.getDate();
  }
  function estadoLabel(estado) {
    if (estado === "confirmado") return "Confirmado por cliente";
    if (estado === "en_ruta") return "En ruta";
    if (estado === "esperando_eta_chofer") return "Enviado al chofer";
    if (estado === "cancelado") return "Cancelado";
    return "Esperando respuesta WA";
  }
  function badge(estado) {
    var label = esc(estadoLabel(estado));
    if (estado === "confirmado" || estado === "en_ruta") {
      return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">' + label + "</span>";
    }
    if (estado === "esperando_eta_chofer") {
      return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">' + label + "</span>";
    }
    if (estado === "cancelado") {
      return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">' + label + "</span>";
    }
    return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">' + label + "</span>";
  }

  function chat(msg) {
    var el = $("sol-des-chat");
    if (el && msg) el.textContent = msg;
  }
  function status(msg) {
    setText("sol-des-status", msg);
  }

  function selected() {
    for (var i = 0; i < rows.length; i++) if (rows[i].id === selectedId) return rows[i];
    return null;
  }

  function sendMap(d) {
    var frame = $("sol-des-map");
    if (!frame || !frame.contentWindow || !d || !isFinite(d.lat) || !isFinite(d.lng)) return;
    frame.contentWindow.postMessage({ type: "sol-destinos", action: "point", lat: d.lat, lng: d.lng }, "*");
  }

  function pintarPunto(d) {
    if (!d) {
      setText("sol-des-lat", "Sin coordenadas");
      setText("sol-des-punto", "Sin destino seleccionado");
      setText("sol-des-punto-sub", "Elegí uno de la cola");
      setText("sol-des-match", "Sin punto");
      setText("sol-des-wa", "—");
      setText("sol-des-plantilla", "—");
      setText("sol-des-viaje", "Sin viaje vinculado");
      var geo = $("sol-des-geo");
      if (geo) geo.classList.add("hidden");
      return;
    }
    var addr = d.formattedAddress || "Sin dirección";
    var parts = addr.split(",");
    setText("sol-des-punto", (parts[0] || addr).trim());
    setText("sol-des-punto-sub", d.partial ? "Coincidencia parcial" : (parts.slice(1).join(",").trim() || "Geocodificado"));
    setText("sol-des-match", d.partial ? "Coincidencia parcial" : (isFinite(d.lat) ? "Coincidencia exacta" : "Sin coordenadas"));
    if (isFinite(d.lat) && isFinite(d.lng)) {
      setText("sol-des-lat", "Lat: " + Number(d.lat).toFixed(4) + " | Lng: " + Number(d.lng).toFixed(4));
    } else {
      setText("sol-des-lat", "Sin coordenadas");
    }
    setText("sol-des-wa", d.whatsappSent ? "Enviado al cliente" : "Sin envío");
    setText("sol-des-plantilla", estadoLabel(d.estado));
    setText("sol-des-viaje", d.cliente || "Sin viaje vinculado");
    var geo = $("sol-des-geo");
    if (geo) geo.classList.toggle("hidden", !(isFinite(d.lat) && isFinite(d.lng)));
    sendMap(d);
  }

  function llenarForm(d) {
    if (!d) return;
    if ($("sol-des-dir")) $("sol-des-dir").value = d.formattedAddress || "";
    if ($("sol-des-cliente")) $("sol-des-cliente").value = d.cliente || "";
    if ($("sol-des-tel-cli")) $("sol-des-tel-cli").value = displayPhone(d.telefonoCliente);
    if ($("sol-des-tel-cho")) $("sol-des-tel-cho").value = displayPhone(d.telefonoChofer);
    placeId = null;
    pintarPunto(d);
  }

  function limpiarForm() {
    selectedId = null;
    placeId = null;
    if ($("sol-des-dir")) $("sol-des-dir").value = "";
    if ($("sol-des-cliente")) $("sol-des-cliente").value = "";
    if ($("sol-des-tel-cli")) $("sol-des-tel-cli").value = "";
    if ($("sol-des-tel-cho")) $("sol-des-tel-cho").value = "";
    pintarPunto(null);
    status("Completá dirección, cliente y los dos WhatsApp.");
    if (live) pintar();
  }

  function matchEstado(d, filtro) {
    if (filtro === "confirmado") return d.estado === "confirmado" || d.estado === "en_ruta";
    if (filtro === "pendiente") return d.estado === "esperando_cliente";
    if (filtro === "revision") return d.estado === "esperando_eta_chofer" || d.partial;
    return true;
  }

  function filtradas() {
    var q = fold($("sol-des-buscar") && $("sol-des-buscar").value);
    var filtro = $("sol-des-estado") ? $("sol-des-estado").value : "todos";
    return rows.filter(function (d) {
      if (!matchEstado(d, filtro)) return false;
      if (!q) return true;
      var blob = fold([d.id, d.cliente, d.formattedAddress, d.correccion, d.telefonoCliente, d.telefonoChofer, d.estado].join(" "));
      return blob.indexOf(q) >= 0;
    });
  }

  function rowHtml(d) {
    var addr = d.formattedAddress || "—";
    var geo = d.correccion || addr;
    var nota = d.correccion ? "Corregido por el cliente" : (d.partial ? "Coincidencia parcial" : (isFinite(d.lat) ? "Geocodificado" : "Sin coordenadas"));
    var color = d.partial ? "text-blue-700" : "text-emerald-700";
    var dot = d.partial ? "bg-blue-500" : "bg-emerald-500";
    var accion = isFinite(d.lat) ? "Ver link" : "Ver detalle";
    var active = d.id === selectedId ? " bg-indigo-50/50" : "";
    return '<tr data-id="' + esc(d.id) + '" class="hover:bg-slate-50/80 transition-colors' + active + '">' +
      '<td class="py-3.5 px-4 font-bold text-slate-900">#' + esc(d.id) +
      '<span class="block text-[10px] text-slate-400 font-normal">' + esc(hace(d.updatedAt || d.createdAt)) + "</span></td>" +
      '<td class="py-3.5 px-4"><div class="font-bold text-slate-900">' + esc(d.cliente || "Sin cliente") + '</div>' +
      '<div class="text-[11px] text-indigo-600 font-semibold">' + esc(estadoLabel(d.estado)) + "</div></td>" +
      '<td class="py-3.5 px-4">' + esc(addr) + "</td>" +
      '<td class="py-3.5 px-4"><div class="flex items-center gap-1.5 ' + color + ' font-semibold"><span class="w-1.5 h-1.5 rounded-full ' + dot + '"></span>' + esc(geo) + '</div>' +
      '<span class="text-[10px] text-slate-400">' + esc(nota) + "</span></td>" +
      '<td class="py-3.5 px-4"><div>' + esc(d.telefonoCliente || "—") + '</div>' +
      '<span class="text-[10px] text-slate-400">Chofer: ' + esc(d.telefonoChofer ? "…" + String(d.telefonoChofer).slice(-4) : "—") + "</span></td>" +
      '<td class="py-3.5 px-4">' + badge(d.estado) + "</td>" +
      '<td class="py-3.5 px-4 text-right"><button type="button" data-act="' + (isFinite(d.lat) ? "link" : "ver") + '" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold text-xs transition-colors">' + accion + "</button></td></tr>";
  }

  function kpis() {
    var hoy = rows.filter(function (d) {
      return (d.estado === "confirmado" || d.estado === "en_ruta") && mismoDia(d.updatedAt || d.createdAt);
    }).length;
    var corr = rows.filter(function (d) { return d.correccion; }).length;
    var conPunto = rows.filter(function (d) { return isFinite(d.lat) && isFinite(d.lng); });
    var exactas = conPunto.filter(function (d) { return !d.partial; }).length;
    var esperando = rows.filter(function (d) { return d.estado === "esperando_cliente"; }).length;
    setText("sol-des-kpi-hoy", String(hoy));
    setText("sol-des-kpi-hoy-hint", "de " + rows.length + " en la cola");
    setText("sol-des-kpi-corr", String(corr));
    if (conPunto.length) {
      var pct = Math.round((exactas / conPunto.length) * 1000) / 10;
      setText("sol-des-kpi-prec", String(pct).replace(".", ",") + "%");
      setText("sol-des-kpi-prec-hint", exactas + " exactas");
    } else {
      setText("sol-des-kpi-prec", "—");
      setText("sol-des-kpi-prec-hint", "sin geocodificar");
    }
    setText("sol-des-kpi-tiempo", "—");
    setText("sol-des-kpi-tiempo-hint", esperando + " esperando respuesta");
  }

  function pintar() {
    var body = $("sol-des-body");
    if (!body || !live) return;
    var list = filtradas();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    body.innerHTML = slice.map(rowHtml).join("") ||
      '<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay destinos con esos filtros.</td></tr>';
    setText("sol-des-cola", "Cola en vivo de Validaciones (" + rows.length + " en gestión)");
    setText("sol-des-pie", "Mostrando " + slice.length + " de " + list.length + " validaciones");
    setText("sol-des-pag", String(page + 1));
    var prev = $("sol-des-prev");
    var next = $("sol-des-next");
    if (prev) prev.className = "px-2.5 py-1 bg-white border border-slate-200 rounded " + (page === 0 ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100");
    if (next) next.className = "px-2.5 py-1 bg-white border border-slate-200 rounded " + (page >= pages - 1 ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100");
    kpis();
    var actual = selected();
    if (actual) pintarPunto(actual);
  }

  function seleccionar(id, abrir) {
    selectedId = id;
    var d = selected();
    if (d) llenarForm(d);
    pintar();
    if (abrir && d && isFinite(d.lat) && isFinite(d.lng)) {
      window.open("https://www.google.com/maps/search/?api=1&query=" + d.lat + "," + d.lng, "_blank");
    }
  }

  function dashKpis(msg) {
    ["sol-des-kpi-hoy", "sol-des-kpi-corr", "sol-des-kpi-prec", "sol-des-kpi-tiempo"].forEach(function (id) { setText(id, "—"); });
    setText("sol-des-kpi-hoy-hint", msg || "sin sesión");
    setText("sol-des-kpi-prec-hint", "sin dato");
    setText("sol-des-kpi-tiempo-hint", "sin tiempo medido");
  }

  function load() {
    return api("/api/destinos?limit=100").then(function (data) {
      rows = Array.isArray(data) ? data : [];
      live = true;
      if (!primed) {
        primed = true;
        var espera = rows.filter(function (d) { return d.estado === "esperando_cliente" || d.estado === "esperando_eta_chofer"; })[0];
        selectedId = (espera || rows[0] || {}).id || null;
        if (selected()) llenarForm(selected());
        else limpiarForm();
      } else if (selectedId && !selected()) {
        selectedId = null;
        pintarPunto(null);
      } else if (selected()) {
        pintarPunto(selected());
      }
      pintar();
    }).catch(function (err) {
      live = false;
      rows = [];
      dashKpis(err && err.status === 401 ? "hace falta sesión" : "sin dato");
      var body = $("sol-des-body");
      if (body) {
        body.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">' +
          esc(err && err.status === 401 ? "Hace falta una sesión para ver los destinos." : (err.message || "No pude cargar los destinos.")) +
          "</td></tr>";
      }
      setText("sol-des-cola", "Cola en vivo de Validaciones");
      setText("sol-des-pie", "Sin datos");
      if (err && err.status === 401) chat("Hace falta una sesión para ver y validar destinos.");
      else chat(err.message || "No pude cargar los destinos.");
    });
  }

  function enviar() {
    var query = ($("sol-des-dir") && $("sol-des-dir").value || "").trim();
    var cliente = ($("sol-des-cliente") && $("sol-des-cliente").value || "").trim();
    var telCli = sendPhone($("sol-des-tel-cli") && $("sol-des-tel-cli").value);
    var telCho = sendPhone($("sol-des-tel-cho") && $("sol-des-tel-cho").value);
    if (!query) { status("Falta la dirección o las coordenadas."); return; }
    if (!telCli) { status("Falta el WhatsApp del cliente."); return; }
    if (!telCho) { status("Falta el WhatsApp del chofer."); return; }
    if (busy) return;
    busy = true;
    status("Geocodificando y enviando WhatsApp…");
    api("/api/destinos/validar", {
      method: "POST",
      body: JSON.stringify({
        query: query,
        mode: modo,
        placeId: placeId || undefined,
        cliente: cliente || undefined,
        telefonoCliente: telCli,
        telefonoChofer: telCho,
      }),
    }).then(function (out) {
      selectedId = out.id;
      status(out.whatsappSent ? "WhatsApp enviado al cliente." : "Destino guardado.");
      return load();
    }).catch(function (err) {
      status(err.message || "No se pudo validar el destino. No quedó enviado.");
    }).finally(function () { busy = false; });
  }

  function sugerencias(q) {
    var box = $("sol-des-sug");
    if (!box) return;
    if (modo !== "direccion" || q.trim().length < 3) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    api("/api/destinos/autocomplete?input=" + encodeURIComponent(q.trim())).then(function (items) {
      if (!Array.isArray(items) || !items.length) {
        box.classList.add("hidden");
        return;
      }
      box.innerHTML = items.slice(0, 6).map(function (s) {
        return '<button type="button" data-place="' + esc(s.placeId) + '" data-desc="' + esc(s.description) + '" class="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"><span class="font-semibold text-slate-800">' + esc(s.mainText || s.description) + '</span> <span class="text-slate-400">' + esc(s.secondaryText || "") + "</span></button>";
      }).join("");
      box.classList.remove("hidden");
    }).catch(function () { box.classList.add("hidden"); });
  }

  function setModo(next) {
    modo = next;
    placeId = null;
    var dir = $("sol-des-modo-dir");
    var coord = $("sol-des-modo-coord");
    var on = "px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-xs";
    var off = "px-2.5 py-1 text-slate-600 hover:text-slate-900";
    if (dir) dir.className = next === "direccion" ? on : off;
    if (coord) coord.className = next === "coordenadas" ? on : off;
    var input = $("sol-des-dir");
    if (input) input.placeholder = next === "direccion" ? "Ej: Av. Córdoba 1200, Rosario" : "Ej: -34.45, -58.64";
    var box = $("sol-des-sug");
    if (box) box.classList.add("hidden");
  }

  function preguntar(text) {
    var q = String(text || "").trim();
    if (!q) return;
    chat("Consultando…");
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({ agentId: "destinos", message: q, conversationId: conv || undefined }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      chat((res.message && res.message.text) || "Sin respuesta.");
    }).catch(function (err) {
      chat(err.message || "No pude consultar los destinos.");
    });
  }

  var dirInput = $("sol-des-dir");
  if (dirInput && dirInput.parentElement) {
    var sug = document.createElement("div");
    sug.id = "sol-des-sug";
    sug.className = "absolute left-0 right-0 top-full z-30 mt-1 hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg";
    dirInput.parentElement.appendChild(sug);
    dirInput.addEventListener("input", function () {
      placeId = null;
      if (sugTimer) clearTimeout(sugTimer);
      sugTimer = setTimeout(function () { sugerencias(dirInput.value); }, 300);
    });
  }

  var estado = $("sol-des-estado");
  if (estado && estado.options.length >= 4) {
    estado.options[0].value = "todos";
    estado.options[1].value = "confirmado";
    estado.options[2].value = "pendiente";
    estado.options[3].value = "revision";
    estado.addEventListener("change", function () { page = 0; if (live) pintar(); });
  }
  var buscar = $("sol-des-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; if (live) pintar(); });

  var pregunta = $("sol-des-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    preguntar(pregunta.value);
    pregunta.value = "";
  });

  document.addEventListener("click", function (e) {
    var sugBtn = e.target.closest("#sol-des-sug button");
    if (sugBtn) {
      e.preventDefault();
      e.stopPropagation();
      placeId = sugBtn.getAttribute("data-place");
      if ($("sol-des-dir")) $("sol-des-dir").value = sugBtn.getAttribute("data-desc") || "";
      var box = $("sol-des-sug");
      if (box) box.classList.add("hidden");
      return;
    }
    var act = e.target.closest("[data-act]");
    if (act) {
      var tr = act.closest("tr");
      if (tr && tr.getAttribute("data-id")) {
        e.preventDefault();
        e.stopPropagation();
        seleccionar(tr.getAttribute("data-id"), act.getAttribute("data-act") === "link");
      }
      return;
    }
    var btn = e.target.closest("button");
    if (!btn) return;
    if (btn.id === "sol-des-enviar") { e.preventDefault(); e.stopPropagation(); enviar(); return; }
    if (btn.id === "sol-des-modo-dir") { e.preventDefault(); setModo("direccion"); return; }
    if (btn.id === "sol-des-modo-coord") { e.preventDefault(); setModo("coordenadas"); return; }
    if (btn.id === "sol-des-prev") { e.preventDefault(); if (page > 0) { page -= 1; pintar(); } return; }
    if (btn.id === "sol-des-next") { e.preventDefault(); page += 1; pintar(); return; }
    var label = fold(btn.textContent || "");
    if (label.indexOf("geocodificar y enviar") >= 0) { e.preventDefault(); e.stopPropagation(); enviar(); return; }
    if (label.indexOf("validar nueva") >= 0) {
      e.preventDefault();
      limpiarForm();
      var form = $("sol-des-dir");
      if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (label === "sync" || label.indexOf("sincronizar") >= 0) { e.preventDefault(); load(); return; }
    if (!label && btn.parentElement && btn.parentElement.contains($("sol-des-estado"))) { load(); return; }
    if (label === "enviar" && btn.parentElement && btn.parentElement.contains(pregunta)) {
      e.preventDefault();
      e.stopPropagation();
      preguntar(pregunta.value);
      pregunta.value = "";
      return;
    }
    if (/^(¿|mostrame|resumen)/.test(label)) {
      e.preventDefault();
      preguntar(btn.textContent);
    }
  }, true);

  var body = $("sol-des-body");
  if (body) body.addEventListener("click", function (e) {
    if (e.target.closest("button")) return;
    var tr = e.target.closest("tr");
    if (tr && tr.getAttribute("data-id")) seleccionar(tr.getAttribute("data-id"), false);
  });

  window.addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.type !== "sol-destinos" || data.action !== "ready") return;
    if (selected()) sendMap(selected());
  });

  load();
  setInterval(load, 10000);
})();
