/* Torre: feed simulado de actividad de agentes (demo). */
(function () {
  var LEVEL = {
    info: { dot: "#38bdf8", ring: "rgba(56,189,248,0.22)" },
    ok: { dot: "#22c55e", ring: "rgba(34,197,94,0.22)" },
    warn: { dot: "#f59e0b", ring: "rgba(245,158,11,0.22)" },
    alert: { dot: "#ef4444", ring: "rgba(239,68,68,0.22)" },
  };

  var BASE = [
    { agent: "Remitos", text: "Remito R-0048213 validado · Arcor S.A. (VJ-24817)", time: "08:12", level: "ok" },
    { agent: "Gestión de Viajes", text: "Viaje VJ-24831 confirmado y asignado a R. Quiroga", time: "08:31", level: "ok" },
    { agent: "Incidencias", text: "INC-3391 abierta · parada no prevista (VJ-24820)", time: "11:20", level: "alert" },
    { agent: "ETA", text: "Notificación de llegada enviada · VJ-24836", time: "11:46", level: "info" },
    { agent: "Destinos", text: "Dirección corregida y validada · Coca-Cola Andina", time: "09:44", level: "ok" },
    { agent: "Reclamos", text: "RC-1182 escalado a coordinador zona Cuyo", time: "09:34", level: "warn" },
    { agent: "Rendición", text: "Rendición RD-7741 armada · $242.600 (9 comprob.)", time: "10:12", level: "info" },
    { agent: "Analítica", text: "Alerta: SLA zona NOA por debajo del objetivo (-3,1%)", time: "10:55", level: "warn" },
    { agent: "Remitos", text: "Remito R-0048274 validado · Newsan (VJ-24854)", time: "10:58", level: "ok" },
    { agent: "ETA", text: "ETA recalculada por obra en RN 3 · Sinteplast (VJ-24860)", time: "12:22", level: "warn" },
    { agent: "Gestión de Viajes", text: "Solicitud Mercado Libre Full convertida en viaje VJ-24848", time: "11:06", level: "ok" },
    { agent: "Incidencias", text: "INC-3397 en gestión · control vial extendido (RN 3)", time: "12:08", level: "alert" },
  ];

  var TEMPLATES = [
    { agent: "Remitos", text: "Nuevo remito recibido por WhatsApp · lectura en curso", level: "info" },
    { agent: "Remitos", text: "Remito validado automáticamente (confianza 97%)", level: "ok" },
    { agent: "ETA", text: "ETA recalculada · cliente notificado proactivamente", level: "info" },
    { agent: "Incidencias", text: "Chofer informó causa del evento · clasificado", level: "ok" },
    { agent: "Gestión de Viajes", text: "Solicitud por email interpretada y validada", level: "ok" },
    { agent: "Destinos", text: "Destino validado en Google Maps · link enviado al chofer", level: "ok" },
    { agent: "Reclamos", text: "Reclamo recibido · viaje identificado automáticamente", level: "warn" },
    { agent: "Rendición", text: "Comprobante leído y clasificado · combustible", level: "info" },
    { agent: "Analítica", text: "Patrón detectado · pico de demoras acceso CABA 13–15h", level: "warn" },
    { agent: "Gestión de Viajes", text: "Unidad asignada según disponibilidad de flota", level: "ok" },
    { agent: "ETA", text: "Cliente avisado por ventana horaria actualizada", level: "info" },
    { agent: "Remitos", text: "Diferencia de bultos detectada · enviado a revisión", level: "warn" },
    { agent: "Incidencias", text: "Evento resuelto · causa trazada en backoffice", level: "ok" },
    { agent: "Analítica", text: "Dashboard operativo actualizado en BigQuery", level: "info" },
  ];

  function nowTime() {
    return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowHtml(ev, isNew) {
    var c = LEVEL[ev.level] || LEVEL.info;
    var bg = isNew ? "background:rgba(99,102,241,0.08);" : "";
    var ping = isNew
      ? '<span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style="background:' +
        c.dot +
        '"></span>'
      : "";
    return (
      '<div class="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors" style="' +
      bg +
      '">' +
      '<span class="relative mt-1.5 flex h-2 w-2 shrink-0">' +
      ping +
      '<span class="relative inline-flex h-2 w-2 rounded-full" style="background:' +
      c.dot +
      ";box-shadow:0 0 0 3px " +
      c.ring +
      '"></span>' +
      "</span>" +
      '<div class="min-w-0 flex-1">' +
      '<p class="text-sm leading-snug text-slate-800 font-medium">' +
      esc(ev.text) +
      "</p>" +
      '<p class="mt-0.5 text-[11px] text-slate-400">' +
      esc(ev.agent) +
      "</p>" +
      "</div>" +
      '<span class="shrink-0 text-[11px] tabular-nums text-slate-400 pt-0.5">' +
      esc(ev.time) +
      "</span>" +
      "</div>"
    );
  }

  function setText(sel, value) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.textContent = value == null || value === "" ? "—" : String(value);
    });
  }

  var criticalIncidents = [
    {
      id: "INC-3391",
      titulo: "Parada no prevista",
      viaje: "VJ-24820",
      chofer: "Juan Domínguez",
      ruta: "Zárate → Mar del Plata",
      hace: "hace 42 min",
      detalle: "Unidad detenida fuera de ruta. Requiere confirmación de causa y ETA.",
    },
    {
      id: "INC-3397",
      titulo: "Control vial extendido",
      viaje: "VJ-24860",
      chofer: "Walter Benítez",
      ruta: "Bahía Blanca → Neuquén · RN 3",
      hace: "hace 18 min",
      detalle: "Demora acumulada por control. Cliente aún no notificado.",
    },
  ];

  var CIUDADES = {
    CABA: { lat: -34.6037, lng: -58.3816 },
    Rosario: { lat: -32.9442, lng: -60.6505 },
    Córdoba: { lat: -31.4201, lng: -64.1888 },
    Mendoza: { lat: -32.8895, lng: -68.8458 },
    "Mar del Plata": { lat: -38.0055, lng: -57.5426 },
    "Bahía Blanca": { lat: -38.7183, lng: -62.2663 },
    Tucumán: { lat: -26.8083, lng: -65.2176 },
    Salta: { lat: -24.7859, lng: -65.4117 },
    Neuquén: { lat: -38.9516, lng: -68.0591 },
    "Santa Fe": { lat: -31.6333, lng: -60.7 },
    Zárate: { lat: -34.0981, lng: -59.0286 },
    Campana: { lat: -34.1635, lng: -58.9592 },
    Pilar: { lat: -34.4587, lng: -58.9142 },
    Ezeiza: { lat: -34.8531, lng: -58.5228 },
  };

  var FLEET = [
    { id: "VJ-24817", cliente: "Arcor S.A.", origen: "Córdoba", destino: "CABA", chofer: "Carlos Páez", estado: "en_curso", progreso: 62, eta: "18:40", speed: 0.28 },
    { id: "VJ-24836", cliente: "Molinos", origen: "Rosario", destino: "CABA", chofer: "Sergio Ferreyra", estado: "en_curso", progreso: 41, eta: "17:20", speed: 0.35 },
    { id: "VJ-24829", cliente: "Quilmes", origen: "CABA", destino: "Mar del Plata", chofer: "Pablo Cardozo", estado: "en_curso", progreso: 74, eta: "16:55", speed: 0.22 },
    { id: "VJ-24831", cliente: "Coca-Cola Andina", origen: "Mendoza", destino: "Córdoba", chofer: "Roberto Quiroga", estado: "detenido", progreso: 38, eta: "21:10", speed: 0 },
    { id: "VJ-24842", cliente: "YPF", origen: "Bahía Blanca", destino: "Neuquén", chofer: "Marcelo Ojeda", estado: "en_curso", progreso: 55, eta: "20:05", speed: 0.3 },
    { id: "VJ-24845", cliente: "Acindar", origen: "Rosario", destino: "Córdoba", chofer: "Gustavo Leiva", estado: "en_curso", progreso: 28, eta: "19:30", speed: 0.32 },
    { id: "VJ-24848", cliente: "La Pampa", origen: "CABA", destino: "Tucumán", chofer: "Martín Aguirre", estado: "en_curso", progreso: 33, eta: "22:15", speed: 0.25 },
    { id: "VJ-24851", cliente: "Arcor S.A.", origen: "Salta", destino: "Rosario", chofer: "Fernando Ledesma", estado: "detenido", progreso: 52, eta: "23:40", speed: 0 },
    { id: "VJ-24863", cliente: "Molinos", origen: "Santa Fe", destino: "CABA", chofer: "Ezequiel Farias", estado: "en_curso", progreso: 68, eta: "15:50", speed: 0.27 },
    { id: "VJ-24875", cliente: "YPF", origen: "Campana", destino: "Pilar", chofer: "Sergio Ferreyra", estado: "en_curso", progreso: 82, eta: "14:35", speed: 0.4 },
    { id: "VJ-24881", cliente: "Acindar", origen: "Córdoba", destino: "Mendoza", chofer: "Pablo Cardozo", estado: "en_curso", progreso: 47, eta: "21:45", speed: 0.26 },
    { id: "VJ-24820", cliente: "Quilmes", origen: "Zárate", destino: "Mar del Plata", chofer: "Juan Domínguez", estado: "detenido", progreso: 41, eta: "16:10", speed: 0 },
  ];

  var COLORS = { en_curso: "#2563eb", detenido: "#f43f5e", entregado: "#10b981" };
  var mapState = { el: null, map: null, markers: [], timer: null, leafletReady: null };

  function tripPos(t) {
    var o = CIUDADES[t.origen];
    var d = CIUDADES[t.destino];
    if (!o || !d) return null;
    var p = Math.min(100, Math.max(0, t.progreso || 0)) / 100;
    return {
      lat: o.lat + (d.lat - o.lat) * p,
      lng: o.lng + (d.lng - o.lng) * p,
      origin: o,
      dest: d,
    };
  }

  function loadLeaflet() {
    if (mapState.leafletReady) return mapState.leafletReady;
    mapState.leafletReady = new Promise(function (resolve, reject) {
      if (window.L) {
        resolve(window.L);
        return;
      }
      if (!document.querySelector("link[data-sol-torre-leaflet]")) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-sol-torre-leaflet", "1");
        document.head.appendChild(link);
      }
      var existing = document.querySelector("script[data-sol-torre-leaflet]");
      if (existing) {
        existing.addEventListener("load", function () {
          resolve(window.L);
        });
        existing.addEventListener("error", function () {
          reject(new Error("Leaflet"));
        });
        return;
      }
      var s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.async = true;
      s.setAttribute("data-sol-torre-leaflet", "1");
      s.onload = function () {
        resolve(window.L);
      };
      s.onerror = function () {
        reject(new Error("No se pudo cargar el mapa"));
      };
      document.head.appendChild(s);
    });
    return mapState.leafletReady;
  }

  function divIcon(L, color, pulse) {
    var size = pulse ? 14 : 11;
    return L.divIcon({
      className: "",
      html:
        '<span style="display:block;width:' +
        size +
        "px;height:" +
        size +
        "px;border-radius:99px;background:" +
        color +
        ";border:2px solid #fff;box-shadow:0 0 0 " +
        (pulse ? 5 : 0) +
        "px " +
        color +
        '55,0 1px 4px rgba(0,0,0,.35)"></span>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function ensureFleetOverlay() {
    if (mapState.el) return mapState.el;
    var el = document.createElement("div");
    el.id = "sol-torre-fleet-overlay";
    el.className = "hidden fixed inset-0 z-[10040]";
    el.innerHTML =
      '<div class="absolute inset-0 bg-slate-950/50" data-sol-fleet-bg></div>' +
      '<div class="absolute inset-0 md:inset-3 lg:inset-5 bg-white md:rounded-2xl overflow-hidden shadow-2xl flex flex-col">' +
      '<div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white z-10">' +
      '<div class="min-w-0">' +
      '<p class="text-sm font-extrabold text-slate-900">Flota en tiempo real</p>' +
      '<p class="text-[11px] text-slate-500 font-medium">Unidades en ruta · actualización en vivo</p>' +
      "</div>" +
      '<div class="flex items-center gap-3">' +
      '<div class="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-slate-600">' +
      '<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-600"></span>En curso</span>' +
      '<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Detenidos</span>' +
      '<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Entregados</span>' +
      "</div>" +
      '<button type="button" data-sol-fleet-close class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">' +
      '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      "</div></div>" +
      '<div class="relative flex-1 min-h-0 bg-[#e8eef5]" data-sol-fleet-map></div>' +
      "</div>";
    document.body.appendChild(el);
    el.querySelector("[data-sol-fleet-bg]").addEventListener("click", closeFleetOverlay);
    el.querySelector("[data-sol-fleet-close]").addEventListener("click", closeFleetOverlay);
    mapState.el = el;
    return el;
  }

  function stopFleetAnim() {
    if (mapState.timer) {
      clearInterval(mapState.timer);
      mapState.timer = null;
    }
  }

  function closeFleetOverlay() {
    stopFleetAnim();
    if (mapState.map) {
      try {
        mapState.map.remove();
      } catch (e) {}
      mapState.map = null;
      mapState.markers = [];
    }
    if (mapState.el) mapState.el.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function openFleetOverlay() {
    var el = ensureFleetOverlay();
    el.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    var host = el.querySelector("[data-sol-fleet-map]");
    host.innerHTML = '<div class="absolute inset-0 grid place-items-center text-xs text-slate-500">Cargando mapa…</div>';

    loadLeaflet()
      .then(function (L) {
        host.innerHTML = "";
        var mapDiv = document.createElement("div");
        mapDiv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
        host.appendChild(mapDiv);

        if (mapState.map) {
          try {
            mapState.map.remove();
          } catch (e) {}
        }

        var map = L.map(mapDiv, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
        }).setView([-34.6, -64.0], 5);

        // Capas estilo Google Maps (sin clave JS)
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 20,
          attribution: "Map data © Google",
        }).addTo(map);

        mapState.markers = [];
        var bounds = [];

        FLEET.forEach(function (t) {
          var pos = tripPos(t);
          if (!pos) return;
          var color = COLORS[t.estado] || COLORS.en_curso;

          L.polyline(
            [
              [pos.origin.lat, pos.origin.lng],
              [pos.dest.lat, pos.dest.lng],
            ],
            { color: t.estado === "detenido" ? "#fda4af" : "#93c5fd", weight: 3, opacity: 0.75 },
          ).addTo(map);

          var m = L.marker([pos.lat, pos.lng], {
            icon: divIcon(L, color, t.estado === "en_curso"),
          }).addTo(map);
          m.bindPopup(
            '<div style="font:12px/1.4 Plus Jakarta Sans,system-ui,sans-serif;min-width:160px;color:#0f172a">' +
              '<div style="font-weight:700">' +
              esc(t.id) +
              " · " +
              esc(t.cliente) +
              "</div>" +
              '<div style="color:#64748b;margin-top:2px">' +
              esc(t.origen) +
              " → " +
              esc(t.destino) +
              "</div>" +
              '<div style="margin-top:6px;color:#334155">' +
              esc(t.chofer) +
              (t.eta ? " · ETA " + esc(t.eta) : "") +
              "</div></div>",
          );
          mapState.markers.push({ trip: t, marker: m, L: L });
          bounds.push([pos.lat, pos.lng]);
        });

        if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
        mapState.map = map;
        setTimeout(function () {
          map.invalidateSize();
        }, 80);
        setTimeout(function () {
          map.invalidateSize();
        }, 320);

        stopFleetAnim();
        mapState.timer = setInterval(function () {
          mapState.markers.forEach(function (item) {
            var t = item.trip;
            if (t.estado !== "en_curso") return;
            t.progreso += t.speed || 0.3;
            if (t.progreso >= 97) t.progreso = 12 + Math.random() * 18;
            var p = tripPos(t);
            if (!p) return;
            item.marker.setLatLng([p.lat, p.lng]);
            item.marker.setIcon(divIcon(item.L, COLORS.en_curso, true));
          });
        }, 700);
      })
      .catch(function () {
        host.innerHTML =
          '<div class="absolute inset-0 grid place-items-center text-sm text-rose-600 px-6 text-center">No se pudo cargar el mapa.</div>';
      });
  }

  var incPanel = null;

  function ensureIncPanel() {
    if (incPanel) return incPanel;
    incPanel = document.createElement("div");
    incPanel.id = "sol-torre-inc-panel";
    incPanel.className = "hidden fixed inset-0 z-[10040]";
    incPanel.innerHTML =
      '<div class="absolute inset-0 bg-slate-900/35" data-sol-inc-bg></div>' +
      '<div class="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] bg-white shadow-2xl flex flex-col sm:rounded-l-2xl max-h-[88vh] sm:max-h-none">' +
      '<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-rose-100 bg-rose-50/80">' +
      '<div>' +
      '<p class="text-sm font-extrabold text-slate-900">Criticidad alta</p>' +
      '<p class="text-[11px] text-rose-600 font-semibold" data-sol-inc-panel-sub>2 requieren seguimiento inmediato</p>' +
      "</div>" +
      '<button type="button" data-sol-inc-close class="p-2 rounded-lg hover:bg-white/80 text-slate-500" aria-label="Cerrar">' +
      '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      "</div>" +
      '<div class="flex-1 overflow-y-auto p-4 space-y-3" data-sol-inc-panel-body></div>' +
      "</div>";
    document.body.appendChild(incPanel);
    incPanel.querySelector("[data-sol-inc-bg]").addEventListener("click", closeIncPanel);
    incPanel.querySelector("[data-sol-inc-close]").addEventListener("click", closeIncPanel);
    return incPanel;
  }

  function closeIncPanel() {
    if (incPanel) incPanel.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function openIncPanel() {
    var panel = ensureIncPanel();
    var items = criticalIncidents.slice(0, 2);
    var sub = panel.querySelector("[data-sol-inc-panel-sub]");
    if (sub) sub.textContent = items.length + " requieren seguimiento inmediato";
    var body = panel.querySelector("[data-sol-inc-panel-body]");
    body.innerHTML = items
      .map(function (inc) {
        return (
          '<article class="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4">' +
          '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
          '<p class="text-[11px] font-bold uppercase tracking-wide text-rose-600">' +
          esc(inc.id) +
          "</p>" +
          '<h3 class="text-sm font-extrabold text-slate-900 mt-0.5">' +
          esc(inc.titulo) +
          "</h3>" +
          "</div>" +
          '<span class="shrink-0 text-[10px] font-semibold text-slate-400">' +
          esc(inc.hace) +
          "</span>" +
          "</div>" +
          '<p class="mt-2 text-xs text-slate-600 leading-relaxed">' +
          esc(inc.detalle) +
          "</p>" +
          '<div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">' +
          '<div class="rounded-lg bg-white/80 border border-rose-100 px-2.5 py-2">' +
          '<p class="text-slate-400 font-medium">Viaje</p>' +
          '<p class="font-bold text-slate-800">' +
          esc(inc.viaje) +
          "</p></div>" +
          '<div class="rounded-lg bg-white/80 border border-rose-100 px-2.5 py-2">' +
          '<p class="text-slate-400 font-medium">Chofer</p>' +
          '<p class="font-bold text-slate-800">' +
          esc(inc.chofer) +
          "</p></div>" +
          '<div class="col-span-2 rounded-lg bg-white/80 border border-rose-100 px-2.5 py-2">' +
          '<p class="text-slate-400 font-medium">Ruta</p>' +
          '<p class="font-bold text-slate-800">' +
          esc(inc.ruta) +
          "</p></div>" +
          "</div></article>"
        );
      })
      .join("");
    panel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function wireCards() {
    document.querySelectorAll("[data-sol-torre-card]").forEach(function (card) {
      if (card.getAttribute("data-sol-torre-wired")) return;
      card.setAttribute("data-sol-torre-wired", "1");
      card.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var kind = card.getAttribute("data-sol-torre-card");
        if (kind === "flota") openFleetOverlay();
        else if (kind === "incidencias") openIncPanel();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeFleetOverlay();
      closeIncPanel();
    });
  }

  function loadKpis() {
    function api(path) {
      return fetch("/backend" + path, { credentials: "include" })
        .then(function (r) {
          return r
            .json()
            .catch(function () {
              return null;
            })
            .then(function (data) {
              if (!r.ok) return null;
              return data;
            });
        })
        .catch(function () {
          return null;
        });
    }

    Promise.all([
      api("/api/incidencias/resumen"),
      api("/api/incidencias?limit=100"),
      api("/api/viajes?limit=100"),
    ]).then(function (pair) {
      var resumen = pair[0];
      var lista = Array.isArray(pair[1]) ? pair[1] : Array.isArray(pair[1] && pair[1].items) ? pair[1].items : [];
      var viajes = Array.isArray(pair[2]) ? pair[2] : Array.isArray(pair[2] && pair[2].items) ? pair[2].items : [];

      var abiertas = resumen && resumen.abiertas != null ? Number(resumen.abiertas) : null;
      var alta =
        resumen && (resumen.alta != null || resumen.criticidad_alta != null)
          ? Number(resumen.alta != null ? resumen.alta : resumen.criticidad_alta)
          : null;

      function isOpen(g) {
        var e = String((g && (g.estado || g.status)) || "").toLowerCase();
        return e && e !== "resuelta" && e !== "cerrada" && e !== "resolved" && e !== "cerrado";
      }
      function isAlta(g) {
        var c = String((g && (g.criticidad || g.prioridad || g.priority)) || "").toLowerCase();
        return c === "alta" || c === "high" || c === "critica" || c === "crítica";
      }

      if (lista.length) {
        var altas = lista.filter(function (g) {
          return isOpen(g) && isAlta(g);
        });
        if (abiertas == null) {
          abiertas = lista.filter(isOpen).length;
        }
        if (alta == null) alta = altas.length;
        if (altas.length) {
          var mapped = altas.slice(0, 2).map(function (g, i) {
            var fallback = criticalIncidents[i] || criticalIncidents[0];
            var origen = g.origen || (g.viaje && g.viaje.origen) || "";
            var destino = g.destino || (g.viaje && g.viaje.destino) || "";
            var ruta = g.ruta || (origen && destino ? origen + " → " + destino : origen || destino || fallback.ruta);
            return {
              id: g.codigo || g.id || fallback.id,
              titulo: g.titulo || g.motivo || g.tipo || fallback.titulo,
              viaje: g.viajeCodigo || g.viaje_id || g.viajeId || (g.viaje && g.viaje.codigo) || fallback.viaje,
              chofer: g.chofer || (g.viaje && g.viaje.chofer) || fallback.chofer,
              ruta: ruta,
              hace: g.hace || fallback.hace,
              detalle: g.detalle || g.descripcion || g.nota || fallback.detalle,
            };
          });
          while (mapped.length < 2) mapped.push(criticalIncidents[mapped.length]);
          criticalIncidents = mapped;
        }
      } else {
        if (abiertas == null) abiertas = 7;
        if (alta == null) alta = 2;
      }

      // La tarjeta promete 2 críticas: el panel muestra exactamente esas.
      if (alta == null) alta = criticalIncidents.length;
      setText("[data-sol-inc-abiertas]", abiertas != null ? abiertas : 7);
      setText("[data-sol-inc-alta]", Math.min(2, alta != null ? alta : 2));

      if (viajes.length) {
        var curso = 0;
        var detenidos = 0;
        viajes.forEach(function (v) {
          var e = String((v && (v.estado || v.status)) || "").toLowerCase();
          if (e.indexOf("deteni") >= 0 || e.indexOf("parada") >= 0 || e.indexOf("incidencia") >= 0) detenidos += 1;
          else if (
            e.indexOf("curso") >= 0 ||
            e.indexOf("ruta") >= 0 ||
            e.indexOf("transito") >= 0 ||
            e === "en_viaje"
          )
            curso += 1;
        });
        if (curso || detenidos) {
          setText("[data-sol-flota-curso]", curso || "—");
          setText("[data-sol-flota-detenidos]", detenidos || "0");
        }
      }
    });
  }

  function mountFeed() {
    var root = document.getElementById("sol-torre-activity-feed");
    if (!root) return;

    var events = BASE.map(function (e, i) {
      return { id: i + 1, agent: e.agent, text: e.text, time: e.time, level: e.level };
    });
    var nextId = 1000;

    function render(highlightFirst) {
      root.innerHTML = events
        .map(function (ev, i) {
          return rowHtml(ev, !!highlightFirst && i === 0);
        })
        .join("");
    }

    render(false);

    setInterval(function () {
      var tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      events = [{ id: nextId++, agent: tpl.agent, text: tpl.text, time: nowTime(), level: tpl.level }].concat(events).slice(0, 14);
      render(true);
    }, 4200);
  }

  function mount() {
    wireCards();
    mountFeed();
    loadKpis();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
