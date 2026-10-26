(function () {
  var PAGE = 6;
  var SESION = "Hace falta una sesión para ver las evidencias reales.";
  var rows = [];
  var byId = {};
  var resumen = null;
  var filtro = "all";
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
    if (!iso) return "—";
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return "—";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function mismoDia(iso, ref) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return false;
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
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
  function setImg(id, url) {
    var img = $(id);
    if (!img) return;
    var src = media(url);
    if (src) {
      img.style.display = "";
      img.src = src;
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
  }
  function qty(q) {
    if (!q || typeof q !== "object") return "";
    var parts = [];
    ["pallets", "cajas", "bultos", "unidades"].forEach(function (k) {
      if (q[k] != null && q[k] !== "") parts.push(q[k] + " " + k);
    });
    return parts.join(" · ");
  }
  function nums(q) {
    if (!q || typeof q !== "object") return null;
    var out = {};
    ["pallets", "cajas", "bultos", "unidades"].forEach(function (k) {
      if (q[k] != null && q[k] !== "" && isFinite(Number(q[k]))) out[k] = Number(q[k]);
    });
    return Object.keys(out).length ? out : null;
  }
  function coords(g) {
    var loc = g && g.location;
    if (!loc) return "";
    if (typeof loc === "string") return loc.trim();
    if (loc.lat != null && (loc.lng != null || loc.lon != null)) {
      return String(loc.lat) + ", " + String(loc.lng != null ? loc.lng : loc.lon);
    }
    return "";
  }
  function canal(g) {
    if (!g) return "—";
    var s = String(g.source || "").toLowerCase();
    if (!s || s === "whatsapp") return "WhatsApp";
    return String(g.source);
  }
  function lugar(g, fallback) {
    if (!g) return "Sin evidencia";
    var c = coords(g);
    if (c) return c;
    var site = g.type === "POP" ? g.origen : g.destino;
    if (site && site !== "—") return site;
    return fallback || "Sin lugar";
  }
  function decidirAbierta(g) {
    return g && (g.estado === "pendiente" || g.estado === "observado");
  }
  function enPeriodo(g) {
    var sel = $("sol-pod-cuando");
    var idx = sel ? sel.selectedIndex : 0;
    var iso = g.createdAt || g.updatedAt;
    var t = new Date(iso || 0).getTime();
    if (!isFinite(t)) return false;
    if (idx === 1) return Date.now() - t <= 24 * 3600 * 1000;
    if (idx === 2) {
      var d = new Date();
      var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      return t >= monday.getTime();
    }
    return mismoDia(iso, new Date());
  }
  function usarColaCompleta() {
    return rows.length > 0 && !rows.some(enPeriodo);
  }
  function pasa(g) {
    if (!usarColaCompleta() && !enPeriodo(g)) return false;
    if (filtro === "POP" || filtro === "POD") {
      if (g.type !== filtro) return false;
    } else if (filtro === "pending" && g.estado !== "pendiente") return false;
    else if (filtro === "diff" && !(g.estado === "observado" || g.observed)) return false;
    else if (filtro === "approved" && g.estado !== "ok") return false;
    else if (filtro === "rejected" && g.estado !== "rechazado") return false;
    var q = fold(($("sol-pod-buscar") || {}).value);
    if (!q) return true;
    return fold([g.codigo, g.viaje, g.chofer, g.receptor, g.destino, g.origen, g.estadoLabel, g.type, g.telefono].join(" ")).indexOf(q) >= 0;
  }
  function delPeriodo(g) {
    if (usarColaCompleta()) return true;
    return enPeriodo(g);
  }
  function notaCola() {
    var base = "POP y POD de la mesa. La foto la manda el chofer por WhatsApp.";
    if (rows.length >= 500) base += " Se muestran las últimas 500.";
    if (usarColaCompleta()) base = "No hay evidencias en el período elegido. Se muestra la cola completa, con la fecha real de cada fila.";
    setText("sol-pod-cola", base);
  }

  function mapaVacio() {
    var mapa = $("sol-pod-mapa");
    if (mapa) mapa.style.backgroundImage = "none";
    setText("sol-pod-geo", "Sin coordenadas");
  }
  function inspectorVacio(texto) {
    setText("sol-pod-viaje", "Sin viaje seleccionado");
    setText("sol-pod-cliente", "sin destino");
    setText("sol-pod-valida", "Sin comparación");
    setImg("sol-pod-img-pop", "");
    setImg("sol-pod-img-pod", "");
    setText("sol-pod-pop-hora", "—");
    setText("sol-pod-pod-hora", "—");
    setText("sol-pod-pop-lugar", "Sin evidencia");
    setText("sol-pod-pod-lugar", "Sin evidencia");
    setText("sol-pod-pop-estado", "Sin evidencia");
    setText("sol-pod-pod-estado", "Sin evidencia");
    setText("sol-pod-pop-chofer", "—");
    setText("sol-pod-pop-carga", "—");
    setText("sol-pod-pop-precinto", "sin dato");
    setText("sol-pod-pop-sello", "sin verificación");
    setText("sol-pod-pod-receptor", "—");
    setText("sol-pod-pod-bultos", "—");
    setText("sol-pod-pod-precinto", "sin dato");
    setText("sol-pod-pod-canal", "—");
    setText("sol-pod-dictamen", texto || "Elegí una evidencia de la cola.");
    setText("sol-pod-elapsed", "—");
    setText("sol-pod-m1", "— · Llegada a origen");
    setText("sol-pod-m1s", "sin dato");
    setText("sol-pod-m1p", "Sin geocerca ni hora de llegada.");
    setText("sol-pod-m2", "— · POP");
    setText("sol-pod-m2s", "sin evidencia");
    setText("sol-pod-m2p", "Este viaje no tiene POP.");
    setText("sol-pod-m3", "— · Tránsito");
    setText("sol-pod-m3s", "sin dato");
    setText("sol-pod-m3p", "Sin recorrido ni paradas.");
    setText("sol-pod-m4", "— · POD");
    setText("sol-pod-m4s", "sin evidencia");
    setText("sol-pod-m4p", "Este viaje no tiene POD.");
    setText("sol-pod-m5", "— · Comparación");
    setText("sol-pod-m5s", "sin dato");
    setText("sol-pod-m5p", "Sin cantidades para comparar.");
    setText("sol-pod-tel-precinto", "sin dato");
    setText("sol-pod-tel-gps", "sin dato");
    setText("sol-pod-tel-receptor", "—");
    mapaVacio();
  }
  function dash() {
    setText("sol-pod-kpi-pop", "—");
    setText("sol-pod-kpi-pop-hint", "sin comparación");
    setText("sol-pod-kpi-pop-sub", "sin proceso medido");
    setText("sol-pod-kpi-pop-sub2", "sin promedio");
    setText("sol-pod-kpi-pod", "—");
    setText("sol-pod-kpi-pod-hint", "sin autoverificación");
    setText("sol-pod-kpi-pod-sub", "sin recepciones de hoy");
    setText("sol-pod-kpi-pod-sub2", "sin SLA");
    setText("sol-pod-kpi-diff", "—");
    setText("sol-pod-kpi-diff-hint", "sin desglose");
    setText("sol-pod-kpi-diff-sub", "—");
    setText("sol-pod-kpi-diff-sub2", "sin desglose de bultos");
    setText("sol-pod-kpi-ia", "—");
    setText("sol-pod-kpi-ia-hint", "sin medición");
    setText("sol-pod-kpi-ia-sub", "sin lectura medida");
    setText("sol-pod-kpi-ia-sub2", "sin latencia");
    document.querySelectorAll("[data-filtro]").forEach(function (btn) {
      var badge = btn.querySelector("span:last-child");
      if (badge) badge.textContent = "—";
    });
    setText("sol-pod-volumen", "—");
    setText("sol-pod-tasa", "Sin tasa");
    setText("sol-pod-clientes", "Sin destinos en la cola.");
    setText("sol-pod-rechazo-tit", "Sin rechazo");
    setText("sol-pod-rechazo", "Sin motivo cargado.");
    setText("sol-pod-reintento", "Sin reintento programado");
  }
  function vacio(texto) {
    var body = $("sol-pod-body");
    if (!body) return;
    body.innerHTML = '<tr><td class="py-6 px-4 text-on-surface-variant" colspan="8">' + esc(texto) + "</td></tr>";
    setText("sol-pod-n", "0");
    setText("sol-pod-de", "0");
    setText("sol-pod-pag", "Página 0 de 0");
  }

  function parDe(g) {
    var pop = g && g.type === "POP" ? g : null;
    var pod = g && g.type === "POD" ? g : null;
    if (!g || !g.tripId) return { pop: pop, pod: pod };
    rows.forEach(function (r) {
      if (r.tripId !== g.tripId) return;
      if (r.type === "POP") pop = pop || r;
      if (r.type === "POD") pod = pod || r;
    });
    return { pop: pop, pod: pod };
  }
  function comparar(pop, pod) {
    if (!pop || !pod) return "Falta POP o POD para comparar.";
    var a = nums(pop.reportedQuantities);
    var b = nums(pod.reportedQuantities);
    if (!a || !b) return "Sin cantidades para comparar POP y POD.";
    var keys = {};
    Object.keys(a).forEach(function (k) { keys[k] = 1; });
    Object.keys(b).forEach(function (k) { keys[k] = 1; });
    var diffs = [];
    Object.keys(keys).forEach(function (k) {
      if (a[k] == null || b[k] == null || a[k] !== b[k]) {
        diffs.push(k + " " + (a[k] == null ? "—" : a[k]) + " / " + (b[k] == null ? "—" : b[k]));
      }
    });
    if (!diffs.length) return "Las cantidades informadas de POP y POD coinciden.";
    return "Diferencia de cantidades: " + diffs.join(", ") + ".";
  }
  function dictamen(pop, pod) {
    var bits = [];
    var cmp = comparar(pop, pod);
    if (cmp) bits.push(cmp);
    [pop, pod].forEach(function (g) {
      if (g && g.differenceNotes) bits.push(String(g.differenceNotes));
    });
    var ocr = (pod && pod.textoOcr) || (pop && pop.textoOcr);
    if (ocr) bits.push("Texto leído: " + String(ocr).replace(/\s+/g, " ").slice(0, 180));
    if (!bits.length) return "Sin dictamen de visión. La mesa confirma la foto.";
    return bits.join(" ");
  }
  function entre(pop, pod) {
    if (!pop || !pod || !pop.createdAt || !pod.createdAt) return "—";
    var ms = Math.abs(new Date(pod.createdAt) - new Date(pop.createdAt));
    if (!isFinite(ms)) return "—";
    var m = Math.round(ms / 60000);
    return Math.floor(m / 60) + "h " + (m % 60) + "m entre POP y POD";
  }

  function pintarKpis() {
    var popPend = rows.filter(function (g) { return g.type === "POP" && g.estado === "pendiente"; }).length;
    var podPend = rows.filter(function (g) { return g.type === "POD" && g.estado === "pendiente"; }).length;
    var obs = resumen ? Number(resumen.observados) : rows.filter(function (g) { return g.estado === "observado" || g.observed; }).length;
    var hoy = new Date();
    var conformes = rows.filter(function (g) { return g.type === "POD" && g.estado === "ok" && mismoDia(g.createdAt, hoy); }).length;
    setText("sol-pod-kpi-pop", String(popPend));
    setText("sol-pod-kpi-pop-hint", "sin comparación vs ayer");
    setText("sol-pod-kpi-pop-sub", "pendientes de mesa");
    setText("sol-pod-kpi-pop-sub2", "sin promedio");
    setText("sol-pod-kpi-pod", String(podPend));
    setText("sol-pod-kpi-pod-hint", "sin autoverificación");
    setText("sol-pod-kpi-pod-sub", conformes + " conformes hoy");
    setText("sol-pod-kpi-pod-sub2", "sin SLA");
    setText("sol-pod-kpi-diff", String(obs));
    setText("sol-pod-kpi-diff-hint", obs ? "en la cola" : "sin diferencias");
    setText("sol-pod-kpi-diff-sub", obs ? "la mesa las revisa" : "sin casos observados");
    setText("sol-pod-kpi-diff-sub2", "sin desglose de bultos");
    setText("sol-pod-kpi-ia", "—");
    setText("sol-pod-kpi-ia-hint", "sin medición");
    setText("sol-pod-kpi-ia-sub", "sin lectura medida");
    setText("sol-pod-kpi-ia-sub2", "sin latencia");
  }
  function pintarFiltros() {
    var base = rows.filter(delPeriodo);
    var counts = {
      all: base.length,
      POP: base.filter(function (g) { return g.type === "POP"; }).length,
      POD: base.filter(function (g) { return g.type === "POD"; }).length,
      pending: base.filter(function (g) { return g.estado === "pendiente"; }).length,
      diff: base.filter(function (g) { return g.estado === "observado" || g.observed; }).length,
      approved: base.filter(function (g) { return g.estado === "ok"; }).length,
      rejected: base.filter(function (g) { return g.estado === "rechazado"; }).length,
    };
    document.querySelectorAll("[data-filtro]").forEach(function (btn) {
      var on = btn.getAttribute("data-filtro") === filtro;
      btn.classList.remove("bg-primary-container", "text-on-primary", "bg-surface-container-lowest", "text-on-surface", "hover:bg-surface-container");
      if (on) btn.classList.add("bg-primary-container", "text-on-primary");
      else btn.classList.add("bg-surface-container-lowest", "text-on-surface", "hover:bg-surface-container");
      var badge = btn.querySelector("span:last-child");
      var key = btn.getAttribute("data-filtro");
      if (badge && counts[key] != null) badge.textContent = String(counts[key]);
    });
  }
  function pintarInsights() {
    var hoy = new Date();
    var deHoy = rows.filter(function (g) { return mismoDia(g.createdAt, hoy); });
    var ok = deHoy.filter(function (g) { return g.estado === "ok"; }).length;
    var pend = deHoy.filter(function (g) { return g.estado === "pendiente"; }).length;
    var obs = deHoy.filter(function (g) { return g.estado === "observado" || g.observed; }).length;
    setText("sol-pod-volumen", deHoy.length + " recibidos hoy · " + ok + " aprobados · " + pend + " pendientes · " + obs + " observados");
    var decididosOk = rows.filter(function (g) { return g.estado === "ok"; }).length;
    var decididosNo = rows.filter(function (g) { return g.estado === "rechazado"; }).length;
    var den = decididosOk + decididosNo;
    setText("sol-pod-tasa", den ? ("Tasa de aprobación: " + Math.round((decididosOk / den) * 1000) / 10 + "%") : "Sin tasa");
    var dest = {};
    rows.forEach(function (g) {
      var d = g.destino && g.destino !== "—" ? g.destino : "";
      if (!d) return;
      dest[d] = (dest[d] || 0) + 1;
    });
    var top = Object.keys(dest).sort(function (a, b) { return dest[b] - dest[a]; }).slice(0, 4);
    setText("sol-pod-clientes", top.length ? top.map(function (d) { return d + " (" + dest[d] + ")"; }).join(", ") : "Sin destinos en la cola.");
    var rech = rows.filter(function (g) { return g.estado === "rechazado"; }).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    })[0];
    if (!rech) {
      setText("sol-pod-rechazo-tit", "Sin rechazo");
      setText("sol-pod-rechazo", "No hay evidencias rechazadas en la cola.");
    } else {
      setText("sol-pod-rechazo-tit", rech.codigo || "Rechazo");
      setText("sol-pod-rechazo", "Causa: " + (rech.notaBackoffice || rech.differenceNotes || "sin motivo cargado") + ".");
    }
    setText("sol-pod-reintento", "Sin reintento programado");
  }
  function lado(g, prefix) {
    var esPop = prefix === "pop";
    if (!g) {
      setText("sol-pod-" + prefix + "-hora", "—");
      setText("sol-pod-" + prefix + "-lugar", "Sin evidencia");
      setText("sol-pod-" + prefix + "-estado", "Sin evidencia");
      setImg("sol-pod-img-" + prefix, "");
      if (esPop) {
        setText("sol-pod-pop-chofer", "—");
        setText("sol-pod-pop-carga", "—");
        setText("sol-pod-pop-precinto", "sin dato");
        setText("sol-pod-pop-sello", "sin verificación");
      } else {
        setText("sol-pod-pod-receptor", "—");
        setText("sol-pod-pod-bultos", "—");
        setText("sol-pod-pod-precinto", "sin dato");
        setText("sol-pod-pod-canal", "—");
      }
      return;
    }
    setText("sol-pod-" + prefix + "-hora", hora(g.createdAt));
    setText("sol-pod-" + prefix + "-lugar", lugar(g));
    setText("sol-pod-" + prefix + "-estado", g.estadoLabel || g.estado || "—");
    setImg("sol-pod-img-" + prefix, g.imagenUrl);
    if (esPop) {
      setText("sol-pod-pop-chofer", g.chofer || "—");
      setText("sol-pod-pop-carga", qty(g.reportedQuantities) || "sin cantidades");
      setText("sol-pod-pop-precinto", "sin dato");
      setText("sol-pod-pop-sello", "sin verificación");
    } else {
      setText("sol-pod-pod-receptor", g.receptor || "—");
      setText("sol-pod-pod-bultos", qty(g.reportedQuantities) || "sin cantidades");
      setText("sol-pod-pod-precinto", g.condition ? String(g.condition) : "sin dato");
      setText("sol-pod-pod-canal", canal(g));
    }
  }
  function ver(g) {
    if (!g) {
      selectedId = null;
      inspectorVacio();
      setText("sol-pod-estado", "Elegí una evidencia de la cola.");
      return;
    }
    selectedId = g.id;
    var par = parDe(g);
    var cmp = comparar(par.pop, par.pod);
    setText("sol-pod-viaje", g.viaje && g.viaje !== "—" ? g.viaje : "Sin código de viaje");
    setText("sol-pod-cliente", (g.destino && g.destino !== "—" ? g.destino : "sin destino"));
    setText("sol-pod-valida", cmp);
    lado(par.pop, "pop");
    lado(par.pod, "pod");
    setText("sol-pod-dictamen", dictamen(par.pop, par.pod));
    setText("sol-pod-elapsed", entre(par.pop, par.pod));
    setText("sol-pod-m1", "— · Llegada a origen");
    setText("sol-pod-m1s", "sin dato");
    setText("sol-pod-m1p", "Sin geocerca ni hora de llegada.");
    if (par.pop) {
      setText("sol-pod-m2", hora(par.pop.createdAt) + " · POP");
      setText("sol-pod-m2s", par.pop.estadoLabel || par.pop.estado || "—");
      setText("sol-pod-m2p", (par.pop.chofer || "Sin chofer") + (qty(par.pop.reportedQuantities) ? " · " + qty(par.pop.reportedQuantities) : ""));
    } else {
      setText("sol-pod-m2", "— · POP");
      setText("sol-pod-m2s", "sin evidencia");
      setText("sol-pod-m2p", "Este viaje no tiene POP.");
    }
    setText("sol-pod-m3", "— · Tránsito");
    setText("sol-pod-m3s", "sin dato");
    setText("sol-pod-m3p", "Sin recorrido ni paradas.");
    if (par.pod) {
      setText("sol-pod-m4", hora(par.pod.createdAt) + " · POD");
      setText("sol-pod-m4s", par.pod.estadoLabel || par.pod.estado || "—");
      setText("sol-pod-m4p", (par.pod.receptor || par.pod.destino || "Sin receptor") + (qty(par.pod.reportedQuantities) ? " · " + qty(par.pod.reportedQuantities) : ""));
    } else {
      setText("sol-pod-m4", "— · POD");
      setText("sol-pod-m4s", "sin evidencia");
      setText("sol-pod-m4p", "Este viaje no tiene POD.");
    }
    setText("sol-pod-m5", "— · Comparación");
    setText("sol-pod-m5s", par.pop && par.pod ? "en la cola" : "sin dato");
    setText("sol-pod-m5p", cmp);
    setText("sol-pod-tel-precinto", "sin dato");
    var gps = coords(g) || coords(par.pod) || coords(par.pop);
    setText("sol-pod-tel-gps", gps || "sin dato");
    setText("sol-pod-tel-receptor", (par.pod && par.pod.receptor) || g.receptor || "—");
    mapaVacio();
    if (gps) setText("sol-pod-geo", gps);
    if (decidirAbierta(g)) {
      setText("sol-pod-estado", (g.codigo || g.type) + " pendiente de mesa. Confirmar avisa por WhatsApp.");
    } else {
      setText("sol-pod-estado", (g.codigo || "Evidencia") + " ya está " + (g.estadoLabel || g.estado || "cerrada") + ".");
    }
  }

  function badgeTipo(g) {
    if (g.type === "POP") {
      return '<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-label-caps text-label-caps font-bold">POP Retiro</span>';
    }
    return '<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-label-caps text-label-caps font-bold">POD Entrega</span>';
  }
  function badgeEstado(g) {
    var color = g.estado === "ok" ? "text-emerald-700" : g.estado === "rechazado" ? "text-slate-600" : g.estado === "observado" || g.observed ? "text-error" : "text-amber-700";
    var dot = g.estado === "ok" ? "bg-emerald-500" : g.estado === "rechazado" ? "bg-slate-400" : g.estado === "observado" || g.observed ? "bg-error" : "bg-amber-500";
    return '<span class="inline-flex items-center gap-1 ' + color + ' font-bold font-label-md"><span class="w-1.5 h-1.5 rounded-full ' + dot + '"></span> ' + esc(g.estadoLabel || g.estado || "—") + "</span>";
  }
  function pintarTabla() {
    var body = $("sol-pod-body");
    if (!body) return;
    var list = rows.filter(pasa);
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var slice = list.slice(page * PAGE, page * PAGE + PAGE);
    if (!list.length) {
      var hay = rows.length > 0;
      notaCola();
      vacio(hay ? "Ninguna evidencia coincide con el filtro o la búsqueda." : "No hay evidencias en la cola.");
      return;
    }
    body.innerHTML = slice.map(function (g) {
      var q = qty(g.reportedQuantities) || "sin cantidades";
      var sel = g.id === selectedId ? " bg-surface-container-low" : "";
      return '<tr class="evidence-row hover:bg-surface-container-low/50 transition-colors' + sel + '" data-id="' + esc(g.id) + '">' +
        '<td class="py-3 px-4 font-code-table text-code-table font-bold text-secondary">' + esc(g.codigo || "—") + "</td>" +
        '<td class="py-3 px-4">' + badgeTipo(g) + "</td>" +
        '<td class="py-3 px-4">' + badgeEstado(g) + "</td>" +
        '<td class="py-3 px-4"><div class="font-bold">' + esc(g.viaje || "—") + '</div><div class="text-xs text-on-surface-variant">' + esc(g.destino && g.destino !== "—" ? g.destino : "sin destino") + "</div></td>" +
        '<td class="py-3 px-4"><div class="font-semibold">' + esc(g.chofer || "—") + '</div><div class="text-xs text-on-surface-variant">' + esc(g.telefono || "sin teléfono") + "</div></td>" +
        '<td class="py-3 px-4 font-code-table text-code-table">' + esc(q) + "</td>" +
        '<td class="py-3 px-4"><div>' + esc(hora(g.createdAt)) + '</div><div class="text-xs text-on-surface-variant">' + esc(canal(g)) + "</div></td>" +
        '<td class="py-3 px-4 text-right"><div class="inline-flex items-center gap-1.5">' +
        '<button type="button" data-act="ver" class="p-1 rounded hover:bg-surface-container text-on-surface-variant" title="Ver Evidencia"><span class="material-symbols-outlined text-base">visibility</span></button>' +
        '<button type="button" data-act="aprobar" class="p-1 rounded hover:bg-surface-container text-emerald-600" title="Aprobación rápida"><span class="material-symbols-outlined text-base">check_circle</span></button>' +
        "</div></td></tr>";
    }).join("");
    setText("sol-pod-n", String(slice.length));
    setText("sol-pod-de", String(list.length));
    setText("sol-pod-pag", "Página " + (page + 1) + " de " + pages);
    notaCola();
    var nav = $("sol-pod-paginacion");
    if (nav) {
      var btns = nav.querySelectorAll("button");
      if (btns[0]) btns[0].disabled = page <= 0;
      if (btns[1]) btns[1].disabled = page >= pages - 1;
    }
  }

  function sesion() {
    live = false;
    dash();
    inspectorVacio(SESION);
    setText("sol-pod-estado", SESION);
    setText("sol-pod-chat", SESION);
    setText("sol-pod-cola", SESION);
    vacio(SESION);
  }
  function load() {
    return Promise.all([
      api("/api/evidence?limit=500"),
      api("/api/evidence/resumen"),
    ]).then(function (pair) {
      live = true;
      rows = asList(pair[0]);
      resumen = pair[1] || null;
      byId = {};
      rows.forEach(function (g) { if (g && g.id) byId[g.id] = g; });
      pintarKpis();
      pintarFiltros();
      pintarInsights();
      notaCola();
      if (!primed) {
        primed = true;
        var visibles = rows.filter(pasa);
        var primero = visibles.filter(function (g) { return g.estado === "pendiente"; })[0] || visibles[0];
        if (primero) ver(primero);
        else {
          inspectorVacio(rows.length ? "Ninguna evidencia coincide con el filtro." : "No hay evidencias en la cola.");
          setText("sol-pod-estado", rows.length ? "Probá otro filtro o la búsqueda." : "No hay evidencias para confirmar.");
        }
      } else if (selectedId && byId[selectedId]) ver(byId[selectedId]);
      else ver(null);
      pintarTabla();
    }).catch(function (err) {
      if (err && err.status === 401) sesion();
      else {
        live = false;
        vacio((err && err.message) || "No pude leer las evidencias.");
        setText("sol-pod-estado", (err && err.message) || "No pude leer las evidencias.");
        setText("sol-pod-chat", (err && err.message) || "No pude consultar.");
      }
    });
  }

  function decidir(estado) {
    var g = byId[selectedId];
    if (!g || busy) {
      setText("sol-pod-estado", "Elegí una evidencia de la cola.");
      return;
    }
    if (!decidirAbierta(g)) {
      setText("sol-pod-estado", (g.codigo || "Esta evidencia") + " ya está " + (g.estadoLabel || g.estado) + ".");
      return;
    }
    var verbo = estado === "ok" ? "Aprobar" : estado === "rechazado" ? "Rechazar" : "Marcar con diferencia";
    var extra = estado === "ok"
      ? "Si es un POD y el viaje está en curso, pasa a entregado. Si es un POP y está asignado, pasa a en curso."
      : "La evidencia queda " + (estado === "rechazado" ? "rechazada" : "observada") + ".";
    var ok = window.confirm(verbo + " " + (g.type || "") + " " + (g.codigo || "") + "\n" + (g.viaje || "sin viaje") + " · " + (g.chofer || "sin chofer") + "\n\nSe intenta avisar por WhatsApp si hay teléfono.\n" + extra);
    if (!ok) {
      setText("sol-pod-estado", "No se cambió la evidencia.");
      return;
    }
    busy = true;
    setText("sol-pod-estado", "Guardando…");
    api("/api/evidence/" + encodeURIComponent(g.id) + "/decidir", {
      method: "POST",
      body: JSON.stringify({ estado: estado, notificar: true }),
    }).then(function () {
      setText("sol-pod-estado", verbo + " registrado. El aviso por WhatsApp se intenta si hay teléfono; esta pantalla no confirma el envío.");
      return load();
    }).catch(function (err) {
      setText("sol-pod-estado", err && err.status === 401 ? SESION : ("No se guardó. " + ((err && err.message) || "")));
    }).then(function () { busy = false; });
  }

  function preguntar(q) {
    q = String(q || "").trim();
    if (!q) return;
    var input = $("ai-evidence-query");
    if (input) input.value = q;
    setText("sol-pod-chat", "Consultando…");
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({ agentId: "pod", tenant: "tsb", message: q, conversationId: conv || undefined }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      setText("sol-pod-chat", (res.message && res.message.text) || "Sin respuesta.");
      if (input) input.value = "";
    }).catch(function (err) {
      setText("sol-pod-chat", err && err.status === 401 ? SESION : ((err && err.message) || "No pude consultar."));
    });
  }

  window.filterEvidence = function (category) {
    filtro = category || "all";
    page = 0;
    pintarFiltros();
    pintarTabla();
  };
  window.triggerEvidencePrompt = function (promptText) {
    preguntar(promptText);
  };

  dash();
  inspectorVacio("Cargando evidencias…");
  setText("sol-pod-estado", "Cargando la cola…");
  setText("sol-pod-chat", "Preguntame por pendientes, rechazos o los últimos del día.");
  vacio("Cargando la cola…");
  load();
  setInterval(function () { if (!busy) load(); }, 12000);

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pill = t.closest("[data-filtro]");
    var act = t.closest("[data-act]");
    var row = t.closest("#sol-pod-body tr[data-id]");
    var textoBtn = t.closest("button");
    var texto = textoBtn ? labelOf(textoBtn) : "";
    var oc = textoBtn && textoBtn.getAttribute ? (textoBtn.getAttribute("onclick") || "") : "";
    var chatChip = oc.indexOf("triggerEvidencePrompt") >= 0 ? textoBtn : null;
    var input = $("ai-evidence-query");
    var consultar = input && textoBtn && textoBtn.parentElement === input.parentElement;
    var nav = t.closest("#sol-pod-paginacion");
    var handled = pill || act || row || chatChip || consultar || t.closest("#sol-pod-ok") || t.closest("#sol-pod-rechazar") || t.closest("#sol-pod-diff");
    if (texto.indexOf("sincronizar") >= 0 || texto.indexOf("cargar evidencia") >= 0 || texto.indexOf("exportar") >= 0) handled = textoBtn;
    if (nav && (texto === "anterior" || texto.indexOf("siguiente") >= 0)) handled = textoBtn;
    if (!handled) return;
    ev.preventDefault();
    ev.stopPropagation();

    if (t.closest("#sol-pod-ok") || (act && act.getAttribute("data-act") === "aprobar")) {
      var idOk = act && row ? row.getAttribute("data-id") : selectedId;
      if (idOk && byId[idOk]) ver(byId[idOk]);
      decidir("ok");
      return;
    }
    if (t.closest("#sol-pod-rechazar")) { decidir("rechazado"); return; }
    if (t.closest("#sol-pod-diff")) { decidir("observado"); return; }
    if (act && act.getAttribute("data-act") === "ver") {
      var idVer = row && row.getAttribute("data-id");
      if (idVer && byId[idVer]) ver(byId[idVer]);
      var foto = media(byId[idVer] && byId[idVer].imagenUrl);
      if (foto) window.open(foto, "_blank", "noopener");
      else setText("sol-pod-estado", "Esta evidencia no tiene foto.");
      pintarTabla();
      return;
    }
    if (texto.indexOf("sincronizar") >= 0) {
      setText("sol-pod-estado", "Actualizando…");
      load().then(function () { if (live) setText("sol-pod-estado", "Cola actualizada."); });
      return;
    }
    if (texto.indexOf("cargar evidencia") >= 0) {
      setText("sol-pod-estado", "La foto la carga el chofer por WhatsApp. Esta pantalla no abre un formulario.");
      return;
    }
    if (texto.indexOf("exportar") >= 0) {
      setText("sol-pod-cola", "Esta pantalla no exporta el reporte.");
      setText("sol-pod-estado", "No hay exportación de evidencias.");
      return;
    }
    if (pill) {
      filtro = pill.getAttribute("data-filtro") || "all";
      page = 0;
      pintarFiltros();
      pintarTabla();
      return;
    }
    if (row) {
      ver(byId[row.getAttribute("data-id")]);
      pintarTabla();
      return;
    }
    if (nav && texto === "anterior") { page = Math.max(0, page - 1); pintarTabla(); return; }
    if (nav && texto.indexOf("siguiente") >= 0) { page += 1; pintarTabla(); return; }
    if (chatChip || consultar) {
      var q = chatChip ? ((oc.match(/triggerEvidencePrompt\('([^']*)'\)/) || [])[1] || labelOf(chatChip)) : (input.value || "");
      if (consultar && input) input.value = "";
      preguntar(q);
    }
  }, true);

  var buscar = $("sol-pod-buscar");
  if (buscar) buscar.addEventListener("input", function () { page = 0; pintarTabla(); });
  var cuando = $("sol-pod-cuando");
  if (cuando) cuando.addEventListener("change", function () { page = 0; pintarFiltros(); pintarTabla(); });
  var pregunta = $("ai-evidence-query");
  if (pregunta) pregunta.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var q = pregunta.value;
    pregunta.value = "";
    preguntar(q);
  });
})();
