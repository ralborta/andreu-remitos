(function () {
  var AVISO = "Finanzas todavía no tiene un agente de consulta. No muestro saldos ni vencimientos inventados.";

  document.addEventListener("click", function (e) {
    var root = e.target.closest("[data-sol-chat]");
    if (!root) return;
    var btn = e.target.closest("button");
    if (!btn || !root.contains(btn)) return;
    var input = root.querySelector("input");
    var out = root.querySelector("[data-sol-chat-out]");
    var label = (btn.textContent || "").replace(/\s+/g, " ").trim();
    var fold = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (btn.className.indexOf("sol-chat-chip") >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (input) input.value = label;
      if (out) out.textContent = AVISO;
      return;
    }
    if (fold.indexOf("consultar") === 0) {
      e.preventDefault();
      e.stopPropagation();
      if (out) out.textContent = input && input.value.trim() ? AVISO : "Escribí la consulta. " + AVISO;
    }
  }, true);
})();
