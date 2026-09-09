/**
 * Inserta en cada pantalla el bloque "Qué hace" + "Flujo" del agente/módulo.
 */
(function () {
  function slug() {
    var m = location.pathname.match(/\/stitch-screens\/([^/.]+)/);
    return m ? m[1] : "menu";
  }

  function render(brief) {
    if (!brief || document.getElementById("sol-agent-brief")) return;

    var kindLabel =
      brief.kind === "agente"
        ? "Agente SOL"
        : brief.kind === "canal"
          ? "Canal"
          : "Mesa";

    var flowHtml = (brief.flow || [])
      .map(function (step, i) {
        return (
          '<li class="flex gap-2.5 text-[12px] leading-snug text-slate-700">' +
          '<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">' +
          (i + 1) +
          "</span>" +
          "<span>" +
          step +
          "</span></li>"
        );
      })
      .join("");

    var el = document.createElement("section");
    el.id = "sol-agent-brief";
    el.setAttribute("data-purpose", "agent-description-and-flow");
    el.className =
      "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50/40 p-4 shadow-sm ring-1 ring-violet-100";
    el.innerHTML =
      '<div class="flex flex-wrap items-start justify-between gap-2">' +
      '<div class="min-w-0">' +
      '<div class="text-[10px] font-bold uppercase tracking-wider text-violet-600">' +
      kindLabel +
      " · descripción y flujo</div>" +
      '<div class="mt-0.5 text-sm font-semibold text-slate-900">' +
      brief.name +
      "</div>" +
      '<div class="mt-0.5 text-xs text-slate-500">' +
      brief.subtitle +
      "</div>" +
      "</div>" +
      '<span class="rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">Lo más importante</span>' +
      "</div>" +
      '<p class="mt-3 text-[13px] leading-relaxed text-slate-700">' +
      brief.what +
      "</p>" +
      '<div class="mt-3 grid gap-3 lg:grid-cols-2">' +
      '<div class="rounded-xl border border-slate-200/80 bg-white/80 p-3">' +
      '<div class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Flujo</div>' +
      '<ol class="space-y-2">' +
      flowHtml +
      "</ol></div>" +
      '<div class="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-3 text-[12px] leading-relaxed text-slate-600">' +
      "<strong class=\"text-violet-800\">Cómo leer esta pantalla:</strong> la UI de abajo es la mesa del agente. " +
      "Arriba tenés <em>qué hace</em> y el <em>flujo</em> real de punta a punta (WhatsApp / TMS / mesa). " +
      "En la demo los datos son ficticios; en producción esto opera con tu operación." +
      "</div></div>";

    var main = document.querySelector("main");
    if (!main) {
      document.body.insertBefore(el, document.body.firstChild);
      return;
    }

    // Prefer after hero / title section
    var hero =
      main.querySelector("[data-purpose='agent-header']") ||
      main.querySelector("section") ||
      main.firstElementChild;
    if (hero && hero.parentNode === main) {
      if (hero.nextSibling) main.insertBefore(el, hero.nextSibling);
      else main.appendChild(el);
    } else {
      main.insertBefore(el, main.firstChild);
    }

    // Reinforce subtitle under h1 if empty/short
    var h1 = main.querySelector("h1");
    if (h1 && brief.subtitle) {
      var p = h1.parentElement && h1.parentElement.querySelector("p");
      if (p && (p.textContent || "").trim().length < 20) {
        p.textContent = brief.subtitle;
      }
    }
  }

  function run() {
    var data = window.SOL_AGENT_BRIEFS || {};
    render(data[slug()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
