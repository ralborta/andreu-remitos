(function () {
  var conv = "";

  function $(id) { return document.getElementById(id); }

  function decir(texto) {
    var p = $("sol-met-chat");
    if (p) p.textContent = texto;
  }

  function preguntar(q) {
    q = String(q || "").replace(/\s+/g, " ").trim();
    if (!q) return;
    decir("Consultando…");
    fetch("/backend/api/agents/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "viajes", message: q, conversationId: conv || undefined, tenant: "tsb" })
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error((data && (data.error || data.message)) || "No pude consultar.");
          err.status = r.status;
          throw err;
        }
        return data;
      });
    }).then(function (data) {
      if (data && data.conversationId) conv = data.conversationId;
      decir((data && data.message && data.message.text) || "Sin respuesta.");
    }).catch(function (err) {
      decir(err.status === 401 ? "Hace falta una sesión para consultar la operación." : (err.message || "No pude consultar."));
    });
  }

  document.addEventListener("click", function (e) {
    var root = e.target.closest("#sol-met-chat-box");
    if (!root) return;
    var btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var input = $("sol-met-pregunta");
    if (String(btn.className).indexOf("sol-chat-chip") >= 0) {
      var q = (btn.textContent || "").replace(/\s+/g, " ").trim();
      if (input) input.value = q;
      preguntar(q);
      return;
    }
    preguntar(input ? input.value : "");
    if (input) input.value = "";
  }, true);

  var pregunta = $("sol-met-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    preguntar(pregunta.value);
    pregunta.value = "";
  });
})();
