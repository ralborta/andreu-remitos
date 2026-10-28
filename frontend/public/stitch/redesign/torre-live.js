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

  function mount() {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
