/**
 * Marketing Stitch — demo operable (campañas / agentes) en SOL borrador.
 */
(function () {
  function toast(msg, tone) {
    var el = document.getElementById("sol-mkt-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sol-mkt-toast";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:10050;max-width:380px;padding:12px 14px;border-radius:12px;font:600 12px/1.45 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 12px 32px rgba(15,23,42,.2);border:1px solid #e2e8f0;background:#fff;color:#0f172a;opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.style.borderColor = tone === "err" ? "#fecaca" : tone === "ok" ? "#bbf7d0" : "#e2e8f0";
    el.style.background = tone === "err" ? "#fff1f2" : tone === "ok" ? "#f0fdf4" : "#fff";
    el.textContent = msg;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
    }, 3200);
  }

  function pageKey() {
    var p = "";
    try {
      p = window.top.location.pathname || "";
    } catch (e) {
      p = location.pathname || "";
    }
    var file = (location.pathname || "").split("/").pop() || "";
    if (file.indexOf("marketing-estrategia") === 0 || p.indexOf("/marketing/estrategia") === 0) return "estrategia";
    if (file.indexOf("marketing-email") === 0 || p.indexOf("/marketing/email") === 0) return "email";
    if (file.indexOf("marketing-contenidos") === 0 || p.indexOf("/marketing/contenidos") === 0) return "contenidos";
    if (file.indexOf("marketing-ofertas") === 0 || p.indexOf("/marketing/ofertas") === 0) return "ofertas";
    if (file.indexOf("marketing-visibilidad") === 0 || p.indexOf("/marketing/visibilidad") === 0) return "visibilidad";
    if (file.indexOf("marketing-difusion") === 0 || p.indexOf("/marketing/difusion") === 0) return "difusion";
    if (file.indexOf("marketing-resultados") === 0 || p.indexOf("/marketing/resultados") === 0) return "resultados";
    return "dashboard";
  }

  function bannerDemo() {
    if (document.getElementById("sol-mkt-demo-banner")) return;
    var b = document.createElement("div");
    b.id = "sol-mkt-demo-banner";
    b.className = "mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-8 pt-3";
    b.innerHTML =
      '<div class="rounded-xl border border-indigo-100 bg-indigo-50/70 text-indigo-800 text-[11px] font-semibold px-3 py-2">Modo demo Marketing · 7 agentes (Planificador, Email, Contenidos, Promociones, Rankear, Menciones, Analítica). Datos de prueba.</div>';
    var main = document.querySelector("main");
    if (main && main.parentNode) main.parentNode.insertBefore(b, main);
  }

  function wireActions() {
    if (document.documentElement.getAttribute("data-sol-mkt-actions")) return;
    document.documentElement.setAttribute("data-sol-mkt-actions", "1");
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target.closest("[data-sol-mkt-action], button");
        if (!btn || !btn.closest("main, header")) return;
        var action = btn.getAttribute("data-sol-mkt-action");
        var label = (btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (action === "sync" || label.indexOf("sincronizar") >= 0) {
          e.preventDefault();
          toast("Sincronización demo OK · " + pageKey() + ".", "ok");
          return;
        }
        if (action === "nuevo" || label === "nuevo" || label.indexOf("nuevo") === 0) {
          e.preventDefault();
          var hints = {
            estrategia: "Nueva campaña propuesta (demo).",
            email: "Borrador de email creado (demo).",
            contenidos: "Pieza de contenido en cola (demo).",
            ofertas: "Promoción en borrador (demo).",
            visibilidad: "Exploración Rankear encolada (demo).",
            difusion: "Búsqueda de menciones iniciada (demo).",
            resultados: "Informe analítico regenerado (demo).",
            dashboard: "Acción registrada en el hub (demo).",
          };
          toast(hints[pageKey()] || "Acción demo registrada.", "ok");
          return;
        }
        if (label === "abrir") {
          e.preventDefault();
          toast("Detalle demo · " + pageKey() + " (sin API aún).", "ok");
        }
      },
      true,
    );
  }

  function boot() {
    bannerDemo();
    wireActions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
