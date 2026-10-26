(function () {
  var SALUDO = "Consultá viajes, remitos, incidencias, ETA y POD con datos reales de tus módulos activos.";
  var conv = "";
  var busy = false;
  var mensajes = [];

  function $(id) { return document.getElementById(id); }
  function fold(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function hora(iso) {
    try {
      return new Date(iso || Date.now()).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " hs";
    } catch (_) {
      return "";
    }
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmtTexto(s) {
    return esc(s).replace(/\n/g, "<br>");
  }
  function syncEnviar() {
    var btn = $("sol-torre-enviar");
    var input = $("sol-torre-pregunta");
    if (!btn) return;
    btn.disabled = busy || !String(input && input.value || "").trim();
  }
  function aviso(texto, error) {
    var el = $("sol-torre-aviso");
    if (!el) return;
    el.textContent = texto;
    el.className = "mx-auto mt-2 max-w-[720px] text-center text-[11px] flex items-center justify-center gap-1 " + (error ? "text-rose-500" : "text-slate-400");
  }
  function scrollBottom() {
    var thread = $("sol-torre-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }
  function pintar() {
    var empty = $("sol-torre-empty");
    var list = $("sol-torre-msgs");
    var pills = $("sol-torre-sugerencias");
    if (!list) return;
    if (!mensajes.length) {
      if (empty) empty.classList.remove("hidden");
      list.classList.add("hidden");
      list.innerHTML = "";
      if (pills) pills.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");
    list.classList.remove("hidden");
    if (pills) pills.classList.add("hidden");
    var html = mensajes.map(function (m, i) {
      if (m.role === "user") {
        return (
          '<div class="flex w-full justify-end">' +
            '<div class="max-w-[78%] sm:max-w-[70%]">' +
              '<div class="sol-gpt-bubble-user whitespace-pre-wrap">' + fmtTexto(m.text) + "</div>" +
              '<div class="mt-1.5 flex items-center justify-end gap-1.5 text-[11px] text-slate-400">' +
                esc(hora(m.at)) +
                '<span class="material-symbols-outlined text-[14px] text-indigo-500">done_all</span>' +
              "</div>" +
            "</div>" +
          "</div>"
        );
      }
      return (
        '<div class="flex w-full max-w-[720px] items-start gap-3">' +
          '<div class="w-9 h-9 rounded-lg bg-[#0e1738] text-white flex items-center justify-center shrink-0">' +
            '<span class="material-symbols-outlined text-[18px]">smart_toy</span>' +
          "</div>" +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-2 mb-2">' +
              '<p class="text-sm font-bold text-slate-900">SOL AGENT</p>' +
              '<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">Base operativa actualizada</span>' +
              (m.ms ? '<span class="text-[11px] text-slate-400">' + esc(String(m.ms)) + "ms</span>" : "") +
            "</div>" +
            '<div class="text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap">' + fmtTexto(m.text) + "</div>" +
            '<div class="mt-3 flex flex-wrap items-center gap-1">' +
              '<button type="button" data-copy-idx="' + i + '" class="sol-torre-copy inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Copiar" aria-label="Copiar">' +
                '<span class="material-symbols-outlined text-[17px]">content_copy</span>' +
              "</button>" +
              '<span class="text-[11px] text-slate-400 ml-1">' + esc(hora(m.at)) + "</span>" +
            "</div>" +
            '<p class="mt-3 flex items-center gap-2 text-[12px] text-slate-500">' +
              '<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Datos operativos conectados' +
            "</p>" +
          "</div>" +
        "</div>"
      );
    }).join("");
    if (busy) {
      html +=
        '<div class="flex items-start gap-3">' +
          '<div class="w-9 h-9 rounded-lg bg-[#0e1738] text-white flex items-center justify-center shrink-0">' +
            '<span class="material-symbols-outlined text-[18px]">smart_toy</span>' +
          "</div>" +
          '<div class="pt-2 text-xs text-slate-500 flex items-center gap-2">' +
            '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Pensando…' +
          "</div>" +
        "</div>";
    }
    list.innerHTML = html;
    scrollBottom();
  }

  function api(path, opts) {
    return fetch("/backend" + path, Object.assign({ credentials: "include", headers: { "Content-Type": "application/json" } }, opts || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || data.message || "No pude consultar la operación");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function autoSize() {
    var input = $("sol-torre-pregunta");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 112) + "px";
  }

  function preguntar(text) {
    var q = String(text || "").trim();
    if (!q || busy) return;
    busy = true;
    syncEnviar();
    aviso("Las respuestas se generan con datos reales de tus módulos activos.");
    var started = Date.now();
    mensajes.push({ role: "user", text: q, at: new Date().toISOString() });
    pintar();
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({
        agentId: "commander",
        tenant: "tsb",
        message: q,
        conversationId: conv || undefined,
      }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      var reply = (res.message && res.message.text) || "Sin respuesta.";
      mensajes.push({
        role: "assistant",
        text: reply,
        at: new Date().toISOString(),
        ms: Math.max(1, Date.now() - started),
      });
    }).catch(function (err) {
      var msg = err.status === 401
        ? "Hace falta una sesión para consultar la operación."
        : (err.message || "No pude consultar.");
      aviso(msg, true);
      mensajes.push({
        role: "assistant",
        text: "No pude responder: " + msg,
        at: new Date().toISOString(),
      });
    }).then(function () {
      busy = false;
      syncEnviar();
      pintar();
    });
  }

  function reset() {
    conv = "";
    busy = false;
    mensajes = [];
    var pregunta = $("sol-torre-pregunta");
    if (pregunta) {
      pregunta.value = "";
      autoSize();
    }
    aviso("Las respuestas se generan con datos reales de tus módulos activos.");
    var chat = $("sol-torre-chat");
    if (chat) chat.textContent = SALUDO;
    syncEnviar();
    pintar();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    if (btn.classList.contains("sol-torre-copy") || btn.getAttribute("data-copy-idx") != null) {
      e.preventDefault();
      e.stopPropagation();
      var idx = Number(btn.getAttribute("data-copy-idx"));
      var texto = mensajes[idx] && mensajes[idx].text ? mensajes[idx].text : "";
      if (texto && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).catch(function () {});
      }
      return;
    }
    if (btn.classList.contains("sol-gpt-tool")) {
      e.preventDefault();
      e.stopPropagation();
      var on = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      return;
    }
    var chip = btn.getAttribute("data-q");
    if (chip) {
      e.preventDefault();
      e.stopPropagation();
      var box = $("sol-torre-pregunta");
      if (box) {
        box.value = chip;
        autoSize();
        syncEnviar();
      }
      preguntar(chip);
      if (box) {
        box.value = "";
        autoSize();
        syncEnviar();
      }
      return;
    }
    if (btn.id === "sol-torre-nueva") {
      e.preventDefault();
      e.stopPropagation();
      reset();
      return;
    }
    if (btn.id === "sol-torre-historial") {
      e.preventDefault();
      e.stopPropagation();
      if (!mensajes.length) aviso("Todavía no hay una consulta en esta conversación.");
      else scrollBottom();
      return;
    }
    if (btn.id === "sol-torre-adjuntar" || btn.id === "sol-torre-mic") {
      e.preventDefault();
      e.stopPropagation();
      aviso(btn.id === "sol-torre-mic" ? "El dictado todavía no está disponible en este chat." : "Los adjuntos todavía no están disponibles en este chat.");
      return;
    }
  }, true);

  var form = $("sol-torre-form");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var input = $("sol-torre-pregunta");
    var q = input ? input.value : "";
    if (input) {
      input.value = "";
      autoSize();
    }
    syncEnviar();
    preguntar(q);
  });

  var pregunta = $("sol-torre-pregunta");
  if (pregunta) {
    pregunta.addEventListener("input", function () {
      autoSize();
      syncEnviar();
    });
    pregunta.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (busy || !String(pregunta.value || "").trim()) return;
      var q = pregunta.value;
      pregunta.value = "";
      autoSize();
      syncEnviar();
      preguntar(q);
    });
  }

  syncEnviar();
  pintar();
})();
