/**
 * Mapa real Leaflet + CARTO Voyager (mismo estilo que el UI SOL / FleetMap).
 * Reemplaza los mocks Stitch con watermark "API KEY REQUIRED".
 */
(function () {
  "use strict";

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

  var COLORS = {
    en_curso: "#38bdf8",
    detenido: "#f59e0b",
    entregado: "#22c55e",
    pendiente: "#a79fc9",
  };

  var TRIPS = [
    { id: "VJ-24817", cliente: "Arcor S.A.", origen: "Córdoba", destino: "CABA", chofer: "Carlos Páez", estado: "en_curso", progreso: 62, eta: "18:40" },
    { id: "VJ-24836", cliente: "Molinos", origen: "Rosario", destino: "CABA", chofer: "Sergio Ferreyra", estado: "en_curso", progreso: 41, eta: "17:20" },
    { id: "VJ-24829", cliente: "Quilmes", origen: "CABA", destino: "Mar del Plata", chofer: "Pablo Cardozo", estado: "en_curso", progreso: 74, eta: "16:55" },
    { id: "VJ-24831", cliente: "Coca-Cola Andina", origen: "Mendoza", destino: "Córdoba", chofer: "Roberto Quiroga", estado: "detenido", progreso: 38, eta: "21:10" },
    { id: "VJ-24842", cliente: "YPF", origen: "Bahía Blanca", destino: "Neuquén", chofer: "Marcelo Ojeda", estado: "en_curso", progreso: 55, eta: "20:05" },
    { id: "VJ-24845", cliente: "Acindar", origen: "Rosario", destino: "Córdoba", chofer: "Gustavo Leiva", estado: "en_curso", progreso: 28, eta: "19:30" },
    { id: "VJ-24848", cliente: "Frigorífico La Pampa", origen: "CABA", destino: "Tucumán", chofer: "Martín Aguirre", estado: "en_curso", progreso: 33, eta: "22:15" },
    { id: "VJ-24851", cliente: "Arcor S.A.", origen: "Salta", destino: "Rosario", chofer: "Fernando Ledesma", estado: "detenido", progreso: 52, eta: "23:40" },
    { id: "VJ-24863", cliente: "Molinos", origen: "Santa Fe", destino: "CABA", chofer: "Ezequiel Farias", estado: "en_curso", progreso: 68, eta: "15:50" },
    { id: "VJ-24872", cliente: "Quilmes", origen: "Zárate", destino: "CABA", chofer: "Carlos Páez", estado: "entregado", progreso: 100, eta: "Entregado" },
    { id: "VJ-24875", cliente: "YPF", origen: "Campana", destino: "Pilar", chofer: "Sergio Ferreyra", estado: "en_curso", progreso: 82, eta: "14:35" },
    { id: "VJ-24881", cliente: "Acindar", origen: "Córdoba", destino: "Mendoza", chofer: "Pablo Cardozo", estado: "en_curso", progreso: 47, eta: "21:45" },
  ];

  function tripLatLng(t) {
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
    return new Promise(function (resolve, reject) {
      if (window.L) {
        resolve(window.L);
        return;
      }
      if (!document.querySelector('link[data-sol-demo-leaflet]')) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-sol-demo-leaflet", "1");
        document.head.appendChild(link);
      }
      var existing = document.querySelector("script[data-sol-demo-leaflet]");
      if (existing) {
        existing.addEventListener("load", function () {
          resolve(window.L);
        });
        existing.addEventListener("error", function () {
          reject(new Error("Leaflet error"));
        });
        return;
      }
      var s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.async = true;
      s.setAttribute("data-sol-demo-leaflet", "1");
      s.onload = function () {
        resolve(window.L);
      };
      s.onerror = function () {
        reject(new Error("No se pudo cargar el mapa"));
      };
      document.head.appendChild(s);
    });
  }

  function divIcon(L, color, pulse) {
    var size = pulse ? 16 : 12;
    return L.divIcon({
      className: "",
      html:
        '<span style="display:block;width:' +
        size +
        "px;height:" +
        size +
        "px;border-radius:99px;background:" +
        color +
        ";border:2px solid #0c0a18;box-shadow:0 0 0 " +
        (pulse ? 6 : 0) +
        "px " +
        color +
        '55"></span>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function popupHtml(t) {
    var color = COLORS[t.estado] || COLORS.pendiente;
    var label =
      t.estado === "en_curso"
        ? "En curso"
        : t.estado === "detenido"
          ? "Detenido"
          : t.estado === "entregado"
            ? "Entregado"
            : "Pendiente";
    return (
      '<div style="font:12px/1.4 system-ui,sans-serif;max-width:220px;color:#111">' +
      '<div style="font-weight:700;margin-bottom:2px">' +
      t.id +
      " · " +
      t.cliente +
      "</div>" +
      '<div style="color:#555">' +
      t.origen +
      " → " +
      t.destino +
      "</div>" +
      '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;color:#444">' +
      '<span style="width:8px;height:8px;border-radius:99px;background:' +
      color +
      ';display:inline-block"></span>' +
      label +
      " · " +
      t.chofer +
      (t.eta && t.eta !== "—" ? " · ETA " + t.eta : "") +
      "</div></div>"
    );
  }

  function mount(el) {
    if (!el || el.dataset.mapReady === "1") return;
    el.dataset.mapReady = "1";
    el.innerHTML = "";
    el.style.background = "#eaf2f8";

    loadLeaflet()
      .then(function (L) {
        var map = L.map(el, {
          zoomControl: true,
          attributionControl: true,
        }).setView([-34.6, -64.0], 5);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution: "&copy; OpenStreetMap &copy; CARTO",
            maxZoom: 18,
          },
        ).addTo(map);

        Object.keys(CIUDADES).forEach(function (name) {
          var p = CIUDADES[name];
          L.circleMarker([p.lat, p.lng], {
            radius: 3,
            color: "#6f6796",
            fillColor: "#6f6796",
            fillOpacity: 0.9,
            weight: 0,
          })
            .bindTooltip(name, { direction: "top", opacity: 0.9 })
            .addTo(map);
        });

        var bounds = [];
        TRIPS.forEach(function (t) {
          var pos = tripLatLng(t);
          if (!pos) return;
          var color = COLORS[t.estado] || COLORS.pendiente;

          if (t.estado === "en_curso" || t.estado === "detenido") {
            L.polyline(
              [
                [pos.origin.lat, pos.origin.lng],
                [pos.dest.lat, pos.dest.lng],
              ],
              { color: "#6f5aad", weight: 2, opacity: 0.55 },
            ).addTo(map);
          }

          var m = L.marker([pos.lat, pos.lng], {
            icon: divIcon(L, color, t.estado === "en_curso"),
          }).addTo(map);
          m.bindPopup(popupHtml(t));
          bounds.push([pos.lat, pos.lng]);
        });

        if (bounds.length) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
        }
        setTimeout(function () {
          map.invalidateSize();
        }, 100);
        setTimeout(function () {
          map.invalidateSize();
        }, 400);
      })
      .catch(function (err) {
        el.innerHTML =
          '<div style="display:grid;place-items:center;height:100%;font:13px system-ui;color:#b91c1c;padding:16px;text-align:center">' +
          (err && err.message ? err.message : "Error al cargar mapa") +
          "</div>";
      });
  }

  function boot() {
    document.querySelectorAll("[data-sol-demo-map]").forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
