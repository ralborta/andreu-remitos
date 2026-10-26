(function () {
  var viajes = [];
  var incidencias = [];
  var resumenInc = null;
  var serie = "viajes";
  var sesion = false;

  function $(id) { return document.getElementById(id); }
  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }
  function fold(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function n(value) {
    return new Intl.NumberFormat("es-AR").format(value || 0);
  }
  function cuando(row) {
    var d = new Date(row && (row.createdAt || row.fecha));
    return isNaN(d.getTime()) ? null : d;
  }
  function enDias(row, dias) {
    var d = cuando(row);
    if (!d) return false;
    var corte = new Date();
    corte.setHours(0, 0, 0, 0);
    corte.setDate(corte.getDate() - (dias - 1));
    return d >= corte;
  }

  function api(path) {
    return fetch("/backend" + path, { credentials: "include" }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || data.message || "No pude leer analítica");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function tiposOrdenados() {
    var map = {};
    incidencias.forEach(function (row) {
      var label = row.tipoLabel && row.tipoLabel !== "—" ? row.tipoLabel : "Otro";
      map[label] = (map[label] || 0) + 1;
    });
    return Object.keys(map).map(function (label) {
      return { label: label, n: map[label] };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  function pintarDonut() {
    var orden = tiposOrdenados();
    var total = incidencias.length;
    var top = orden.slice(0, 5);
    var resto = orden.slice(5).reduce(function (sum, item) { return sum + item.n; }, 0);
    var filas = top.slice();
    if (orden.length > 5) filas.push({ label: "Otros", n: resto });
    while (filas.length < 6) filas.push({ label: "—", n: 0 });
    setText("sol-an-donut-total", n(total));
    setText("sol-an-donut-sub", total
      ? "Distribución de las " + n(total) + " incidencias cargadas"
      : "No hay incidencias cargadas");
    setText("sol-an-donut-nota", "Sin comparación contra el mes anterior.");
    var arcs = document.querySelectorAll("svg circle[stroke-width='14']");
    var circ = 238.76;
    var offset = 0;
    filas.forEach(function (fila, i) {
      setText("sol-an-tipo-label-" + i, fila.label);
      setText("sol-an-tipo-n-" + i, n(fila.n));
      setText("sol-an-tipo-p-" + i, total ? (Math.round((fila.n / total) * 1000) / 10).toLocaleString("es-AR") + "%" : "—");
      var arc = arcs[i + 1];
      if (!arc) return;
      var len = total ? (fila.n / total) * circ : 0;
      arc.setAttribute("stroke-dasharray", len + " " + circ);
      arc.setAttribute("stroke-dashoffset", String(-offset));
      offset += len;
    });
  }

  function pintarSerie() {
    var semana = viajes.filter(function (row) { return enDias(row, 7); });
    var desvios = incidencias.filter(function (row) {
      return enDias(row, 7) && (row.tipo === "desvio_ruta" || fold(row.tipoLabel).indexOf("desvio") >= 0);
    });
    if (serie === "tiempo") {
      setText("sol-an-semana", "—");
      setText("sol-an-prom", "—");
      setText("sol-an-sla-pond", "sin medición");
      setText("sol-an-actualizado", "No hay medición de entregas en ventana. La curva del dibujo no es una serie real.");
      return;
    }
    if (serie === "desvios") {
      setText("sol-an-semana", n(desvios.length) + " desvíos");
      setText("sol-an-prom", semana.length ? n(Math.round((desvios.length / 7) * 10) / 10) + " /día" : "—");
      setText("sol-an-sla-pond", "sin medición");
      setText("sol-an-actualizado", "Desvíos de los últimos 7 días. La curva del dibujo no es la serie medida.");
      return;
    }
    setText("sol-an-semana", n(semana.length) + " viajes");
    setText("sol-an-prom", n(Math.round((semana.length / 7) * 10) / 10) + " viajes/día");
    setText("sol-an-sla-pond", "sin medición");
    setText("sol-an-actualizado", "Conteo real de los últimos 7 días. La curva del dibujo no es la serie medida.");
  }

  function pintarZonas() {
    for (var i = 0; i < 6; i++) {
      setText("sol-an-zona-" + i, "—");
      var bar = $("sol-an-zona-bar-" + i);
      if (bar) bar.style.width = "0%";
    }
  }

  function pintar() {
    var recientes = viajes.filter(function (row) { return enDias(row, 30); });
    var base = recientes.length ? recientes : viajes;
    setText("sol-an-viajes", n(base.length));
    setText("sol-an-viajes-delta", "—");
    setText("sol-an-sla", "—");
    setText("sol-an-alertas", n(resumenInc ? resumenInc.abiertas : incidencias.length));
    setText("sol-an-alertas-crit", (resumenInc ? resumenInc.alta : 0) + " críticas abiertas");
    setText("sol-an-ciclo", "—");
    pintarSerie();
    pintarDonut();
    pintarZonas();
  }

  function sesionOff(mensaje) {
    sesion = true;
    ["sol-an-viajes", "sol-an-sla", "sol-an-alertas", "sol-an-ciclo", "sol-an-semana", "sol-an-prom", "sol-an-sla-pond", "sol-an-donut-total"].forEach(function (id) {
      setText(id, "—");
    });
    setText("sol-an-viajes-delta", "—");
    setText("sol-an-alertas-crit", "—");
    setText("sol-an-chat", mensaje || "Hace falta una sesión para consultar la cola.");
    pintarZonas();
  }

  function topClientes(limite) {
    var map = {};
    viajes.forEach(function (row) {
      var nombre = String(row.cliente || "").trim();
      if (!nombre || nombre === "—") return;
      map[nombre] = (map[nombre] || 0) + 1;
    });
    return Object.keys(map).map(function (nombre) {
      return { nombre: nombre, n: map[nombre] };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, limite);
  }

  function responder(text) {
    var q = fold(text);
    var out = $("sol-an-chat");
    if (!q) return;
    if (sesion) {
      if (out) out.textContent = "Hace falta una sesión para consultar la cola.";
      return;
    }
    if (q.indexOf("zona") >= 0 || q.indexOf("sla") >= 0) {
      if (out) out.textContent = "No hay medición de SLA por zona ni de entregas en ventana. Los viajes cargados son " + n(viajes.length) + ".";
      return;
    }
    if (q.indexOf("alerta") >= 0 || q.indexOf("critic") >= 0) {
      var abiertas = resumenInc ? resumenInc.abiertas : incidencias.length;
      var altas = resumenInc ? resumenInc.alta : 0;
      var hoy = incidencias.filter(function (row) { return enDias(row, 1); }).length;
      if (out) out.textContent = "Hay " + n(abiertas) + " incidencias abiertas, " + n(altas) + " de criticidad alta. Hoy entraron " + n(hoy) + ".";
      return;
    }
    if (q.indexOf("cliente") >= 0) {
      var top = topClientes(5);
      if (!top.length) {
        if (out) out.textContent = "Los viajes cargados no tienen cliente para armar ese ranking.";
        return;
      }
      if (out) out.textContent = top.map(function (item, i) {
        return (i + 1) + ". " + item.nombre + " (" + n(item.n) + ")";
      }).join(" · ");
      return;
    }
    if (q.indexOf("incidencia") >= 0 || q.indexOf("tendencia") >= 0 || q.indexOf("carga") >= 0) {
      var tipos = tiposOrdenados().slice(0, 4);
      if (!tipos.length) {
        if (out) out.textContent = "No hay incidencias cargadas.";
        return;
      }
      if (out) out.textContent = "Incidencias cargadas: " + tipos.map(function (item) {
        return item.label + " " + n(item.n);
      }).join(", ") + ". No hay serie histórica para hablar de tendencia.";
      return;
    }
    if (out) out.textContent = "Hay " + n(viajes.length) + " viajes y " + n(incidencias.length) + " incidencias en la cola. SLA, ciclo y variación porcentual no están medidos.";
  }

  function marcarSerie(btn) {
    document.querySelectorAll("[data-serie]").forEach(function (el) {
      el.className = "px-2.5 py-1 rounded-md hover:text-slate-900 transition-colors";
    });
    btn.className = "px-2.5 py-1 rounded-md bg-white text-slate-900 font-semibold shadow-2xs";
    serie = btn.getAttribute("data-serie") || "viajes";
    pintarSerie();
  }

  document.addEventListener("click", function (e) {
    var serieBtn = e.target.closest("[data-serie]");
    if (serieBtn) {
      e.preventDefault();
      e.stopPropagation();
      marcarSerie(serieBtn);
      return;
    }
    var btn = e.target.closest("button");
    if (!btn) return;
    var label = fold(btn.textContent || "");
    if (btn.id === "sol-an-consultar" || label === "consultar") {
      e.preventDefault();
      e.stopPropagation();
      var box = $("sol-an-pregunta");
      responder(box ? box.value : "");
      return;
    }
    if (label.indexOf("zona con menor sla") >= 0 || label.indexOf("alertas criticas") >= 0 || label.indexOf("clientes con mas viajes") >= 0 || label.indexOf("tendencia de incidencias") >= 0) {
      e.preventDefault();
      e.stopPropagation();
      var input = $("sol-an-pregunta");
      if (input) input.value = (btn.textContent || "").trim();
      responder(btn.textContent);
      return;
    }
    if (label.indexOf("exportar reporte") >= 0 || label.indexOf("configurar alerta") >= 0 || label.indexOf("ver detalle") >= 0 || label.indexOf("ver historial") >= 0) {
      e.preventDefault();
      e.stopPropagation();
      setText("sol-an-chat", "Esa acción no está disponible en esta pantalla. Puedo consultar viajes, incidencias y clientes de la cola.");
    }
  }, true);

  var pregunta = $("sol-an-pregunta");
  if (pregunta) pregunta.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    responder(pregunta.value);
  });

  Promise.all([
    api("/api/viajes?limit=500"),
    api("/api/incidencias?limit=500"),
    api("/api/incidencias/resumen"),
  ]).then(function (res) {
    viajes = Array.isArray(res[0]) ? res[0] : [];
    incidencias = Array.isArray(res[1]) ? res[1] : [];
    resumenInc = res[2] || null;
    pintar();
    setText("sol-an-chat", "Consulto la cola real. SLA, tiempos de ciclo y variaciones no están medidos.");
  }).catch(function (err) {
    if (err.status === 401) sesionOff("Hace falta una sesión para consultar la cola.");
    else setText("sol-an-chat", err.message || "No pude consultar analítica.");
  });
})();
