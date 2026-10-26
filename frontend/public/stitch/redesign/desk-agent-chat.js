/**
 * Chat tipo ChatGPT compartido: historial a la izquierda + hilo a la derecha.
 * Uso: <div data-sol-desk-chat data-agent-id="destinos" data-label="Destinos"
 *   data-subtitle="..." data-suggestions="a|b|c" data-mode="api|local" data-tenant="tsb"></div>
 * Modo local: window.SolDeskChatLocal[agentId] = function (q) { return Promise.resolve("..."); }
 */
(function (global) {
  var API_AGENTS = {
    commander: 1,
    viajes: 1,
    remitos: 1,
    destinos: 1,
    incidencias: 1,
    rendicion: 1,
    eta: 1,
    pod: 1,
  };

  function $(root, sel) {
    return root.querySelector(sel);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(s) {
    return esc(s).replace(/\n/g, "<br>");
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
  function localKey(agentId) {
    return "sol-desk-chat:" + agentId;
  }
  function readLocal(agentId) {
    try {
      var raw = JSON.parse(localStorage.getItem(localKey(agentId)) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }
  function writeLocal(agentId, rows) {
    try {
      localStorage.setItem(localKey(agentId), JSON.stringify(rows.slice(0, 40)));
    } catch (_) {}
  }

  function mount(el) {
    if (!el || el.getAttribute("data-sol-desk-ready") === "1") return;
    var agentId = String(el.getAttribute("data-agent-id") || "").trim().toLowerCase();
    if (!agentId) return;
    var label = el.getAttribute("data-label") || agentId;
    var subtitle = el.getAttribute("data-subtitle") || ("Consulto datos reales de " + label + ".");
    var suggestions = String(el.getAttribute("data-suggestions") || "")
      .split("|")
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .slice(0, 6);
    var tenant = el.getAttribute("data-tenant");
    tenant = tenant && tenant.trim() ? tenant.trim() : null;
    var mode = String(el.getAttribute("data-mode") || "").toLowerCase();
    if (!mode) mode = API_AGENTS[agentId] ? "api" : "local";
    var icon = el.getAttribute("data-icon") || "smart_toy";

    el.setAttribute("data-sol-desk-ready", "1");
    el.className = (el.className ? el.className + " " : "") + "sol-desk-root";
    el.innerHTML =
      '<style>' +
      ".sol-desk-root{display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;height:min(520px,62vh);min-height:420px;box-shadow:0 1px 2px rgba(15,23,42,.04)}" +
      "@media(min-width:768px){.sol-desk-root{flex-direction:row}}" +
      ".sol-desk-root .sol-desk-hist-item[aria-current=true]{background:#eef2ff;border-color:#c7d2fe}" +
      ".sol-desk-root .sol-desk-mic[aria-pressed=true]{background:#fee2e2;color:#dc2626}" +
      ".sol-desk-root .sol-desk-composer{border:1px solid #e5e7eb;border-radius:24px;box-shadow:0 6px 18px rgba(15,23,42,.07)}" +
      ".sol-desk-root .sol-desk-send:disabled{opacity:.45;cursor:not-allowed}" +
      ".sol-desk-root .sol-desk-user{background:#f3f4f6;border-radius:16px;padding:10px 14px;font-size:13px;line-height:1.45;color:#111827}" +
      "</style>" +
      '<aside class="w-full md:w-[240px] lg:w-[260px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 flex flex-col min-h-0">' +
        '<div class="px-3 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">' +
          '<div class="min-w-0"><p class="text-xs font-extrabold text-slate-800 tracking-tight truncate">Historial</p>' +
          '<p class="text-[10px] text-slate-400">Chats de ' + esc(label) + "</p></div>" +
          '<button type="button" data-sol-desk-nueva class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0e1738] text-white text-[11px] font-semibold hover:bg-[#14214d]" title="Nueva conversación">' +
            '<span class="material-symbols-outlined text-[14px]">add</span> Nueva</button>' +
        "</div>" +
        '<div data-sol-desk-historial class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1"></div>' +
        '<div class="shrink-0 border-t border-slate-200 p-3 text-[11px] text-slate-500 leading-relaxed">' +
          '<p class="font-semibold text-slate-700 mb-1">Solo consulta</p>No aprueba ni envía WhatsApp desde este chat.' +
        "</div>" +
      "</aside>" +
      '<section class="min-w-0 flex-1 flex flex-col bg-white">' +
        '<div class="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<div class="w-8 h-8 rounded-lg bg-[#0e1738] text-white flex items-center justify-center shrink-0">' +
              '<span class="material-symbols-outlined text-[18px]">' + esc(icon) + "</span></div>" +
            '<div class="min-w-0"><div class="flex items-center gap-2 flex-wrap">' +
              '<p class="text-sm font-extrabold text-slate-900">SOL AGENT</p>' +
              '<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">' +
                '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ' + esc(label) + "</span></div>" +
              '<p data-sol-desk-status class="text-[11px] text-slate-500 truncate">' + esc(subtitle) + "</p>" +
            "</div></div>" +
          '<span class="text-[10px] text-slate-400 shrink-0 hidden sm:inline">Motor <span class="font-mono font-bold text-slate-600">SOL ' + esc(label) + "</span></span>" +
        "</div>" +
        '<div data-sol-desk-thread class="flex-1 min-h-0 overflow-y-auto px-4 py-4">' +
          '<div data-sol-desk-empty class="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-2">' +
            '<div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">' +
              '<span class="material-symbols-outlined text-[22px]">' + esc(icon) + "</span></div>" +
            '<h2 class="text-base font-semibold text-slate-900">¿Qué necesitás saber de ' + esc(label) + "?</h2>" +
            '<p class="mt-1 max-w-md text-xs text-slate-500">' + esc(subtitle) + "</p>" +
            '<div data-sol-desk-chips class="mt-4 flex flex-wrap justify-center gap-2"></div>' +
          "</div>" +
          '<div data-sol-desk-msgs class="hidden mx-auto w-full max-w-[680px] flex flex-col gap-5"></div>' +
        "</div>" +
        '<div class="shrink-0 px-3 sm:px-4 pb-3 pt-1">' +
          '<form data-sol-desk-form class="sol-desk-composer bg-white px-2.5 py-2 flex items-end gap-1.5">' +
            '<textarea data-sol-desk-input rows="1" class="min-w-0 flex-1 resize-none border-0 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 py-2 max-h-24" placeholder="Preguntale a SOL sobre ' + esc(label).toLowerCase() + '..."></textarea>' +
            '<button type="button" data-sol-desk-mic class="sol-desk-mic w-9 h-9 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 flex items-center justify-center shrink-0" title="Dictar pregunta" aria-pressed="false">' +
              '<span class="material-symbols-outlined text-[20px]">mic</span></button>' +
            '<button type="submit" data-sol-desk-send class="sol-desk-send w-9 h-9 rounded-full bg-[#0e1738] text-white flex items-center justify-center shrink-0 hover:bg-[#14214d]" aria-label="Enviar" disabled>' +
              '<span class="material-symbols-outlined text-[18px]">arrow_upward</span></button>' +
          "</form>" +
          '<p data-sol-desk-aviso class="mt-1.5 text-center text-[10px] text-slate-400">Datos reales del módulo ' + esc(label) + ".</p>" +
        "</div>" +
      "</section>";

    var state = {
      conv: null,
      mensajes: [],
      historial: [],
      busy: false,
      escuchando: false,
      dictadoBase: "",
      recognition: null,
    };
    var SpeechRec = global.SpeechRecognition || global.webkitSpeechRecognition || null;

    var chips = $(el, "[data-sol-desk-chips]");
    if (chips) {
      chips.innerHTML = suggestions.map(function (q) {
        return '<button type="button" data-q="' + esc(q) + '" class="px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">' + esc(q) + "</button>";
      }).join("");
    }

    function setStatus(t) {
      var n = $(el, "[data-sol-desk-status]");
      if (n) n.textContent = t;
    }
    function aviso(t, err) {
      var n = $(el, "[data-sol-desk-aviso]");
      if (!n) return;
      n.textContent = t;
      n.className = "mt-1.5 text-center text-[10px] " + (err ? "text-rose-500" : "text-slate-400");
    }
    function syncSend() {
      var btn = $(el, "[data-sol-desk-send]");
      var input = $(el, "[data-sol-desk-input]");
      if (!btn) return;
      btn.disabled = state.busy || !String(input && input.value || "").trim();
    }
    function autoSize() {
      var input = $(el, "[data-sol-desk-input]");
      if (!input) return;
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
    }
    function scrollBottom() {
      var thread = $(el, "[data-sol-desk-thread]");
      if (thread) thread.scrollTop = thread.scrollHeight;
    }
    function setMic(on) {
      var mic = $(el, "[data-sol-desk-mic]");
      if (!mic) return;
      mic.setAttribute("aria-pressed", on ? "true" : "false");
      var iconEl = mic.querySelector(".material-symbols-outlined");
      if (iconEl) iconEl.textContent = on ? "mic_off" : "mic";
    }
    function stopMic() {
      state.escuchando = false;
      setMic(false);
      if (state.recognition) {
        try { state.recognition.stop(); } catch (_) {}
      }
    }
    function startMic() {
      if (!SpeechRec) {
        aviso("Este navegador no soporta dictado. Probá en Chrome o Edge.", true);
        return;
      }
      if (state.busy) return;
      if (!state.recognition) {
        state.recognition = new SpeechRec();
        state.recognition.lang = "es-AR";
        state.recognition.interimResults = true;
        state.recognition.continuous = false;
        state.recognition.onstart = function () {
          state.escuchando = true;
          setMic(true);
          aviso("Escuchando… hablá tu pregunta.");
        };
        state.recognition.onresult = function (ev) {
          var texto = "";
          var final = false;
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            texto += ev.results[i][0].transcript;
            if (ev.results[i].isFinal) final = true;
          }
          var input = $(el, "[data-sol-desk-input]");
          if (!input) return;
          var base = state.dictadoBase ? state.dictadoBase.replace(/\s+$/, "") + " " : "";
          input.value = (base + String(texto || "").trim()).replace(/\s+/g, " ").trim();
          autoSize();
          syncSend();
          if (final) state.dictadoBase = input.value;
        };
        state.recognition.onerror = function (ev) {
          stopMic();
          var code = ev && ev.error;
          if (code === "not-allowed" || code === "service-not-allowed") aviso("Necesito permiso del micrófono para dictar.", true);
          else if (code === "no-speech") aviso("No escuché nada. Tocá el micrófono e intentá de nuevo.");
          else if (code !== "aborted") aviso("No pude usar el micrófono.", true);
        };
        state.recognition.onend = function () {
          state.escuchando = false;
          setMic(false);
          var input = $(el, "[data-sol-desk-input]");
          aviso(input && String(input.value || "").trim() ? "Dictado listo. Revisá el texto y enviá." : ("Datos reales del módulo " + label + "."));
        };
      }
      var input = $(el, "[data-sol-desk-input]");
      state.dictadoBase = input ? String(input.value || "").trim() : "";
      try { state.recognition.start(); } catch (_) {
        stopMic();
        aviso("No pude iniciar el dictado.", true);
      }
    }

    function pintarHistorial() {
      var box = $(el, "[data-sol-desk-historial]");
      if (!box) return;
      if (!state.historial.length) {
        box.innerHTML = '<p class="px-2 py-3 text-[11px] text-slate-400 text-center">Todavía no hay chats. Empezá uno nuevo.</p>';
        return;
      }
      box.innerHTML = state.historial.map(function (h) {
        var active = state.conv && h.id === state.conv;
        return (
          '<button type="button" data-conv="' + esc(h.id) + '" aria-current="' + (active ? "true" : "false") + '" class="sol-desk-hist-item w-full text-left px-2.5 py-2 rounded-lg border border-transparent hover:bg-white hover:border-slate-200 transition-colors">' +
            '<p class="text-[12px] font-semibold text-slate-800 line-clamp-2 leading-snug">' + esc(h.title || "Conversación") + "</p>" +
            '<p class="mt-0.5 text-[10px] text-slate-400 truncate">' + esc(hora(h.updatedAt)) + (h.messageCount ? " · " + h.messageCount + " msgs" : "") + "</p>" +
          "</button>"
        );
      }).join("");
    }

    function pintarMsgs() {
      var empty = $(el, "[data-sol-desk-empty]");
      var list = $(el, "[data-sol-desk-msgs]");
      if (!list) return;
      if (!state.mensajes.length) {
        if (empty) empty.classList.remove("hidden");
        list.classList.add("hidden");
        list.innerHTML = "";
        return;
      }
      if (empty) empty.classList.add("hidden");
      list.classList.remove("hidden");
      var html = state.mensajes.map(function (m) {
        if (m.role === "user") {
          return (
            '<div class="flex w-full justify-end"><div class="max-w-[82%]">' +
              '<div class="sol-desk-user whitespace-pre-wrap">' + fmt(m.text) + "</div>" +
              '<div class="mt-1 text-right text-[10px] text-slate-400">' + esc(hora(m.at)) + "</div></div></div>"
          );
        }
        return (
          '<div class="flex w-full items-start gap-2.5">' +
            '<div class="w-7 h-7 rounded-md bg-[#0e1738] text-white flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[15px]">smart_toy</span></div>' +
            '<div class="min-w-0 flex-1"><p class="text-[12px] font-bold text-slate-900 mb-1">SOL AGENT</p>' +
            '<div class="text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap">' + fmt(m.text) + "</div>" +
            '<p class="mt-2 text-[10px] text-slate-400">' + esc(hora(m.at)) + "</p></div></div>"
        );
      }).join("");
      if (state.busy) {
        html += '<div class="flex items-center gap-2 text-[11px] text-slate-500"><span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span> Pensando…</div>';
      }
      list.innerHTML = html;
      scrollBottom();
    }

    function titleFromMsgs(msgs) {
      var first = null;
      for (var i = 0; i < msgs.length; i++) {
        if (msgs[i].role === "user" && msgs[i].text) { first = msgs[i].text; break; }
      }
      return String(first || "Nueva conversación").replace(/\s+/g, " ").trim().slice(0, 72);
    }

    function persistLocalThread() {
      if (mode !== "local" || !state.conv) return;
      var rows = readLocal(agentId);
      var i = rows.findIndex(function (r) { return r.id === state.conv; });
      var row = {
        id: state.conv,
        agentId: agentId,
        title: titleFromMsgs(state.mensajes),
        preview: state.mensajes.length ? String(state.mensajes[state.mensajes.length - 1].text || "").slice(0, 100) : "",
        messageCount: state.mensajes.length,
        updatedAt: new Date().toISOString(),
        createdAt: i >= 0 ? rows[i].createdAt : new Date().toISOString(),
        messages: state.mensajes.slice(),
      };
      if (i >= 0) rows[i] = row;
      else rows.unshift(row);
      rows.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      writeLocal(agentId, rows);
      state.historial = rows.map(function (r) {
        return { id: r.id, title: r.title, preview: r.preview, messageCount: r.messageCount, updatedAt: r.updatedAt };
      });
      pintarHistorial();
    }

    function cargarHistorial() {
      if (mode === "local") {
        var rows = readLocal(agentId);
        state.historial = rows.map(function (r) {
          return { id: r.id, title: r.title, preview: r.preview, messageCount: r.messageCount, updatedAt: r.updatedAt };
        });
        pintarHistorial();
        return Promise.resolve();
      }
      return api("/api/agents/chat?agentId=" + encodeURIComponent(agentId) + "&limit=40").then(function (res) {
        state.historial = Array.isArray(res.items) ? res.items : [];
        pintarHistorial();
      }).catch(function () {
        state.historial = [];
        pintarHistorial();
      });
    }

    function abrir(id) {
      if (!id || state.busy) return;
      if (state.escuchando) stopMic();
      if (mode === "local") {
        var rows = readLocal(agentId);
        var row = null;
        for (var i = 0; i < rows.length; i++) if (rows[i].id === id) row = rows[i];
        if (!row) return;
        state.conv = row.id;
        state.mensajes = (row.messages || []).slice();
        setStatus("Conversación abierta");
        pintarMsgs();
        pintarHistorial();
        return;
      }
      api("/api/agents/chat/" + encodeURIComponent(id)).then(function (res) {
        state.conv = res.id || id;
        state.mensajes = (res.messages || []).map(function (m) {
          return { role: m.role === "user" ? "user" : "assistant", text: m.text || "", at: m.at };
        });
        setStatus("Conversación abierta");
        pintarMsgs();
        pintarHistorial();
      }).catch(function (err) {
        aviso(err.message || "No pude abrir esa conversación.", true);
      });
    }

    function nueva() {
      if (state.escuchando) stopMic();
      state.conv = null;
      state.mensajes = [];
      state.dictadoBase = "";
      var input = $(el, "[data-sol-desk-input]");
      if (input) {
        input.value = "";
        autoSize();
      }
      setStatus(subtitle);
      aviso("Datos reales del módulo " + label + ".");
      syncSend();
      pintarMsgs();
      pintarHistorial();
    }

    function askLocal(q) {
      var fn = (global.SolDeskChatLocal || {})[agentId];
      if (typeof fn === "function") return Promise.resolve(fn(q));
      return Promise.resolve("Este módulo todavía no tiene un agente de consulta conectado.");
    }

    function preguntar(text) {
      var q = String(text || "").trim();
      if (!q || state.busy) return;
      if (state.escuchando) stopMic();
      state.busy = true;
      syncSend();
      aviso("Datos reales del módulo " + label + ".");
      state.mensajes.push({ role: "user", text: q, at: new Date().toISOString() });
      if (mode === "local" && !state.conv) state.conv = "local_" + Date.now().toString(36);
      pintarMsgs();

      var req = mode === "local"
        ? askLocal(q).then(function (reply) {
            return { conversationId: state.conv, message: { text: String(reply || "Sin respuesta.") } };
          })
        : api("/api/agents/chat", {
            method: "POST",
            body: JSON.stringify({
              agentId: agentId,
              message: q,
              conversationId: state.conv || undefined,
              tenant: tenant || undefined,
            }),
          });

      req.then(function (res) {
        state.conv = res.conversationId || state.conv;
        state.mensajes.push({
          role: "assistant",
          text: (res.message && res.message.text) || "Sin respuesta.",
          at: new Date().toISOString(),
        });
        setStatus("Conversación activa");
        if (mode === "local") persistLocalThread();
        else return cargarHistorial();
      }).catch(function (err) {
        var msg = err.status === 401
          ? "Hace falta una sesión para consultar."
          : (err.message || "No pude consultar.");
        aviso(msg, true);
        state.mensajes.push({ role: "assistant", text: "No pude responder: " + msg, at: new Date().toISOString() });
        if (mode === "local") persistLocalThread();
      }).then(function () {
        state.busy = false;
        syncSend();
        pintarMsgs();
        pintarHistorial();
      });
    }

    el.addEventListener("click", function (e) {
      var hist = e.target.closest("[data-conv]");
      if (hist && el.contains(hist)) {
        e.preventDefault();
        e.stopPropagation();
        abrir(hist.getAttribute("data-conv"));
        return;
      }
      var btn = e.target.closest("button");
      if (!btn || !el.contains(btn)) return;
      if (btn.hasAttribute("data-sol-desk-nueva")) {
        e.preventDefault();
        e.stopPropagation();
        nueva();
        return;
      }
      if (btn.hasAttribute("data-sol-desk-mic")) {
        e.preventDefault();
        e.stopPropagation();
        if (state.escuchando) stopMic();
        else startMic();
        return;
      }
      var q = btn.getAttribute("data-q");
      if (q) {
        e.preventDefault();
        e.stopPropagation();
        preguntar(q);
      }
    }, true);

    var form = $(el, "[data-sol-desk-form]");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var input = $(el, "[data-sol-desk-input]");
      var q = input ? input.value : "";
      if (input) {
        input.value = "";
        autoSize();
      }
      syncSend();
      preguntar(q);
    });

    var input = $(el, "[data-sol-desk-input]");
    if (input) {
      input.addEventListener("input", function () {
        autoSize();
        syncSend();
      });
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" || e.shiftKey) return;
        e.preventDefault();
        if (state.busy || !String(input.value || "").trim()) return;
        var q = input.value;
        input.value = "";
        autoSize();
        syncSend();
        preguntar(q);
      });
    }

    syncSend();
    pintarMsgs();
    cargarHistorial();
  }

  function mountAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("[data-sol-desk-chat]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  global.SolDeskChat = {
    mount: mount,
    mountAll: mountAll,
  };
  global.SolDeskChatLocal = global.SolDeskChatLocal || {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mountAll(); });
  } else {
    mountAll();
  }
})(window);
