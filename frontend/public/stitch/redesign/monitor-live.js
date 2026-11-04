/**
 * Monitor Stitch — fecha/hora real y badge de agentes coherente con el resumen.
 */
(function () {
  function n(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseInt(String(el.textContent || "").replace(/\D/g, ""), 10);
    return Number.isFinite(v) ? v : 0;
  }

  function paintClock() {
    var el = document.getElementById("sol-monitor-fecha");
    if (!el) return;
    function tick() {
      try {
        el.textContent = new Date().toLocaleString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } catch (e) {
        el.textContent = new Date().toISOString();
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  function paintAgentes() {
    var el = document.getElementById("sol-monitor-agentes-online");
    if (!el) return;
    var online = n("sol-mon-n-activo") + n("sol-mon-n-espera") + n("sol-mon-n-hold");
    el.textContent = online + " agentes en línea";
  }

  function boot() {
    paintClock();
    paintAgentes();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
