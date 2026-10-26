(function () {
  var SALUDO = "Te ayudo a consultar viajes, remitos, incidencias y toda la operación logística en tiempo real.";
  var conv = "";
  var ultima = "";

  function $(id) { return document.getElementById(id); }
  function fold(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function decir(texto) {
    var el = $("sol-torre-chat");
    if (el) el.textContent = texto;
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

  function preguntar(text) {
    var q = String(text || "").trim();
    if (!q) return;
    decir("Consultando…");
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
      ultima = (res.message && res.message.text) || "Sin respuesta.";
      decir(ultima);
    }).catch(function (err) {
      decir(err.status === 401 ? "Hace falta una sesión para consultar la operación." : (err.message || "No pude consultar."));
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var chip = btn.getAttribute("data-q");
    if (chip) {
      e.preventDefault();
      e.stopPropagation();
      var box = $("sol-torre-pregunta");
      if (box) box.value = chip;
      preguntar(chip);
      return;
    }
    if (btn.id === "sol-torre-enviar") {
      e.preventDefault();
      e.stopPropagation();
      var input = $("sol-torre-pregunta");
      preguntar(input ? input.value : "");
      if (input) input.value = "";
      return;
    }
    var label = fold(btn.textContent || "");
    if (label.indexOf("nueva conversacion") >= 0) {
      e.preventDefault();
      e.stopPropagation();
      conv = "";
      ultima = "";
      var pregunta = $("sol-torre-pregunta");
      if (pregunta) pregunta.value = "";
      decir(SALUDO);
      return;
    }
    if (label === "historial") {
      e.preventDefault();
      e.stopPropagation();
      decir(ultima || "Todavía no hay una consulta en esta conversación.");
    }
  }, true);

  var pregunta = $("sol-torre-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    preguntar(pregunta.value);
    pregunta.value = "";
  });
})();
