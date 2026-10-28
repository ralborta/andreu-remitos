(function () {
  var lista = [];
  var choferes = {};
  var abiertas = {};
  var filtro = "todos";
  var selected = null;
  var conv = null;
  var remito = null;
  var tab = "remito";
  var remitos = [];
  var busy = false;
  var sessionError = false;
  var typingTimer = null;

  var FILTRO_ON = "px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-semibold text-xs shadow-sm whitespace-nowrap transition";
  var FILTRO_OFF = "px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold text-xs whitespace-nowrap shadow-sm transition";
  var FILTRO_DOT_OFF = "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold text-xs whitespace-nowrap shadow-sm transition";
  var FILTRO_DOT_ON = "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-semibold text-xs shadow-sm whitespace-nowrap transition";
  var TAB_ON = "flex-1 py-1.5 text-center bg-white rounded-md text-slate-900 shadow-xs uppercase font-extrabold";
  var TAB_OFF = "flex-1 py-1.5 text-center text-slate-500 hover:text-slate-800 uppercase transition";

  function $(id) { return document.getElementById(id); }
  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  var toastTimer = null;
  var choferPanel = null;

  function aviso(text) {
    var el = $("sol-wa-aviso");
    if (el) el.textContent = text;
  }

  function toast(text, kind) {
    var el = $("sol-wa-toast");
    if (!el) {
      aviso(text);
      return;
    }
    var styles = {
      warn: "bg-amber-50 border-amber-200 text-amber-800",
      ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
      info: "bg-slate-900 border-slate-800 text-white",
      off: "bg-rose-50 border-rose-200 text-rose-700",
    };
    el.className =
      "absolute left-1/2 -translate-x-1/2 top-[4.25rem] z-20 max-w-[min(92%,420px)] px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-lg pointer-events-none " +
      (styles[kind] || styles.info);
    el.textContent = text;
    el.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add("hidden");
    }, 3200);
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", credentials: "include" };
    if (opts.body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = opts.body;
    }
    return fetch("/backend" + path, init).then(function (r) {
      var ct = r.headers.get("content-type") || "";
      var parse = ct.indexOf("application/json") >= 0 ? r.json() : r.text();
      return parse.catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var msg = (data && (data.message || data.error)) || ("HTTP " + r.status);
          var err = new Error(msg);
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function nombreDe(row) {
    var tel = digits(row.telefono);
    var ch = choferes[tel];
    return row.nombre || (ch && ch.nombre) || "Chofer";
  }
  function iniciales(nombre) {
    var parts = String(nombre || "CH").trim().split(/\s+/).filter(Boolean);
    var a = (parts[0] || "C").charAt(0);
    var b = parts.length > 1 ? parts[1].charAt(0) : (parts[0] || "H").charAt(1) || "";
    return (a + b).toUpperCase();
  }
  function formatPhone(p) {
    var d = digits(p);
    if (d.indexOf("549") === 0 && d.length >= 12) {
      return "+54 9 " + d.slice(3, 5) + " " + d.slice(5, 9) + (d.length > 9 ? "-" + d.slice(9) : "");
    }
    if (d.indexOf("54") === 0 && d.length > 10) return "+54 " + d.slice(2);
    return d ? "+" + d : "—";
  }
  function horaLista(iso) {
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    var diff = (start - day) / 86400000;
    if (diff === 0) return dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    if (diff === 1) return "Ayer";
    return dt.getDate() + "/" + (dt.getMonth() + 1);
  }
  function horaMensaje(iso) {
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    var h = dt.getHours();
    var m = String(dt.getMinutes()).padStart(2, "0");
    var ap = h >= 12 ? "p. m." : "a. m.";
    var h12 = h % 12 || 12;
    return String(h12).padStart(2, "0") + ":" + m + " " + ap;
  }
  function fechaLarga(iso) {
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }
  function sinResponder(row) {
    var u = row.ultimo_mensaje;
    if (!u) return false;
    if (u.tipo === "note") return false;
    return u.dir === "in" && u.from !== "human" && u.from !== "bot";
  }
  function tieneIncidencia(row) {
    return Boolean(abiertas[digits(row.telefono)]);
  }
  function textoUltimo(row) {
    var u = row.ultimo_mensaje;
    if (!u) return "Sin mensajes";
    if (u.tipo === "image") return u.texto || "Foto";
    if (u.tipo === "audio") return u.texto || u.transcripcion || "Nota de voz";
    if (u.tipo === "note") return "Nota interna";
    return u.texto || "Mensaje";
  }
  function mediaUrl(url) {
    if (!url) return "";
    var u = String(url).trim();
    if (!u) return "";
    if (u.indexOf("/backend/") === 0) return u;
    if (u.indexOf("/api/media/") === 0) return "/backend" + u;
    var file = u.match(/\/v1\/files\/([a-fA-F0-9]+)/i);
    if (file) return "/backend/api/media/bot/" + file[1];
    return u;
  }
  function remitoPorTelefono(tel) {
    var d = digits(tel);
    if (d.length < 8) return null;
    var tail = d.slice(-10);
    for (var i = 0; i < remitos.length; i++) {
      var p = digits(remitos[i].telefono_chofer);
      if (p && (p === d || p.slice(-10) === tail)) return remitos[i];
    }
    return null;
  }
  function remitoPorId(id) {
    if (!id) return null;
    for (var i = 0; i < remitos.length; i++) if (remitos[i].id === id) return remitos[i];
    return null;
  }
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<]+/g, function (url) {
      return '<a class="font-mono text-[11px] text-blue-600 break-all underline hover:text-blue-800 block" href="' + url + '" target="_blank" rel="noreferrer">' + url + "</a>";
    });
  }

  function filtradas() {
    var q = fold($("sol-wa-buscar") && $("sol-wa-buscar").value);
    var qDigits = q.replace(/\D/g, "");
    return lista.filter(function (row) {
      if (filtro === "tsb" && row.tenant !== "tsb") return false;
      if (filtro === "sleer" && !sinResponder(row)) return false;
      if (filtro === "inc" && !tieneIncidencia(row)) return false;
      if (!q) return true;
      var nombre = fold(nombreDe(row));
      var tel = digits(row.telefono);
      if (nombre.indexOf(q) >= 0) return true;
      if (qDigits.length >= 4 && tel.indexOf(qDigits) >= 0) return true;
      return false;
    });
  }

  function pintarFiltros() {
    var todos = lista.length;
    var tsb = lista.filter(function (r) { return r.tenant === "tsb"; }).length;
    var leer = lista.filter(sinResponder).length;
    var inc = lista.filter(tieneIncidencia).length;
    var map = {
      "sol-wa-f-todos": ["Todos (" + todos + ")", filtro === "todos", false],
      "sol-wa-f-tsb": ["TransitOne (" + tsb + ")", filtro === "tsb", false],
      "sol-wa-f-leer": ["Sin leer (" + leer + ")", filtro === "sleer", true],
      "sol-wa-f-inc": ["Incidencias abiertas (" + inc + ")", filtro === "inc", true],
    };
    Object.keys(map).forEach(function (id) {
      var btn = $(id);
      if (!btn) return;
      var dot = btn.querySelector("span.rounded-full");
      btn.className = map[id][1] ? (map[id][2] ? FILTRO_DOT_ON : FILTRO_ON) : (map[id][2] ? FILTRO_DOT_OFF : FILTRO_OFF);
      if (dot && dot.parentNode === btn) {
        var label = btn.lastChild;
        if (label && label.nodeType === 3) label.textContent = " " + map[id][0];
        else btn.appendChild(document.createTextNode(" " + map[id][0]));
      } else {
        btn.textContent = map[id][0];
      }
    });
  }

  function article(row) {
    var on = selected === row.telefono;
    var nombre = nombreDe(row);
    var tel = digits(row.telefono);
    var preview = textoUltimo(row);
    var out = row.ultimo_mensaje && row.ultimo_mensaje.dir === "out";
    var badges = "";
    if (row.tenant === "tsb") badges += '<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold text-[10px]">TransitOne</span>';
    else if (row.tenant) badges += '<span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">' + esc(row.tenant) + "</span>";
    if (tieneIncidencia(row)) badges += '<span class="px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-semibold text-[10px]">Incidencia</span>';
    var cls = on
      ? "p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/90 flex items-start gap-2.5 cursor-pointer shadow-xs relative transition"
      : "p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-start gap-2.5 cursor-pointer transition";
    var avatar = on
      ? "w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 ml-1"
      : "w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0";
    var nombreCls = on ? "font-bold text-xs text-slate-900 truncate" : "font-semibold text-xs text-slate-800 truncate";
    var previewHtml = out
      ? '<div class="flex items-center gap-1 text-slate-500 text-xs truncate mt-1"><i class="fa-solid fa-check-double text-[11px] text-blue-500"></i><span class="truncate">' + esc(preview) + "</span></div>"
      : '<p class="text-xs truncate mt-1 ' + (on ? "text-slate-800 font-semibold" : "text-slate-500") + '">' + esc(preview) + "</p>";
    return '<article data-tel="' + esc(row.telefono) + '" class="' + cls + '">' +
      (on ? '<div class="w-1 absolute inset-y-2 left-1 bg-blue-600 rounded-full"></div>' : "") +
      '<div class="' + avatar + '">' + esc(iniciales(nombre)) + "</div>" +
      '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-1">' +
      '<span class="' + nombreCls + '">' + esc(nombre) + "</span>" +
      '<span class="text-[11px] ' + (on ? "font-medium text-slate-500" : "text-slate-400") + ' whitespace-nowrap">' + esc(horaLista(row.updated_at)) + "</span></div>" +
      '<div class="flex items-center gap-1.5 mt-0.5">' + badges +
      '<span class="font-mono text-[11px] text-slate-400 truncate">' + esc(formatPhone(tel)) + "</span></div>" +
      previewHtml +
      (row.bot_pausado ? '<p class="text-[10px] text-amber-600 mt-1">Bot pausado</p>' : "") +
      "</div></article>";
  }

  function pintarLista() {
    var box = $("sol-wa-lista");
    if (!box) return;
    pintarFiltros();
    var rows = filtradas();
    if (!rows.length) {
      box.innerHTML = '<p class="p-4 text-xs text-slate-500">' +
        (lista.length ? "No hay contactos con ese filtro." : "Sin conversaciones todavía. Aparecen cuando un chofer escribe por WhatsApp.") +
        "</p>";
      return;
    }
    box.innerHTML = rows.map(article).join("");
  }

  function burbuja(msg, nombre) {
    var incoming = msg.dir === "in" && msg.from !== "human";
    var nota = msg.tipo === "note";
    var cuerpo = "";
    if (msg.tipo === "image") {
      var src = mediaUrl(msg.imagen_url);
      if (src) {
        cuerpo += '<a href="' + esc(src) + '" target="_blank" rel="noreferrer" class="block overflow-hidden rounded-lg bg-white/60">' +
          '<img src="' + esc(src) + '" alt="Foto" class="max-h-64 w-full object-contain"></a>';
      } else {
        cuerpo += '<p class="text-xs">Foto</p>';
      }
    } else if (msg.tipo === "audio") {
      cuerpo += '<p class="text-xs">Nota de voz</p>';
      if (msg.transcripcion) cuerpo += '<p class="text-xs leading-relaxed">' + linkify(msg.transcripcion) + "</p>";
    }
    if (msg.texto && msg.tipo !== "audio") cuerpo += '<p class="text-xs leading-relaxed">' + linkify(msg.texto) + "</p>";
    var hora = '<div class="flex items-center justify-end gap-1 text-[11px] text-slate-400 pt-0.5"><span>' + esc(horaMensaje(msg.at)) + "</span>";
    if (!incoming) hora += '<i class="fa-solid fa-check-double text-[11px] text-blue-500"></i>';
    hora += "</div>";
    if (incoming) {
      return '<div class="flex flex-col items-start"><div class="max-w-[80%] bg-emerald-50/80 border border-emerald-200/80 text-slate-900 rounded-2xl rounded-tl-xs p-3 shadow-xs space-y-1">' +
        '<span class="font-bold text-[10px] text-emerald-800 uppercase tracking-wider block">' + esc(nombre) + "</span>" +
        cuerpo + hora + "</div></div>";
    }
    var tag = nota ? "Nota interna" : (msg.from === "bot" ? "Agente automático" : "Despacho");
    var tagCls = msg.from === "bot"
      ? "px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] uppercase"
      : "px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold text-[10px] uppercase";
    return '<div class="flex flex-col items-end"><div class="max-w-[85%] bg-white border border-slate-200/90 text-slate-800 rounded-2xl rounded-tr-xs p-3 shadow-xs space-y-1">' +
      '<div class="flex items-center gap-1.5"><span class="' + tagCls + '">' + tag + "</span></div>" +
      cuerpo + hora + "</div></div>";
  }

  function pintarHilo() {
    var box = $("sol-wa-hilo");
    if (!box) return;
    if (!conv) {
      box.innerHTML = '<p class="text-xs text-slate-500">Elegí un contacto para ver los mensajes.</p>';
      return;
    }
    var msgs = Array.isArray(conv.mensajes) ? conv.mensajes : [];
    var nombre = nombreDe(conv);
    if (!msgs.length) {
      box.innerHTML = '<p class="text-xs text-slate-500">Sin mensajes todavía.</p>';
      return;
    }
    var html = "";
    var dia = "";
    msgs.forEach(function (msg) {
      var clave = String(msg.at || "").slice(0, 10);
      if (clave && clave !== dia) {
        dia = clave;
        html += '<div class="flex justify-center my-1"><span class="px-3 py-1 rounded-full bg-slate-200/80 text-slate-600 font-bold text-[10px] tracking-wider uppercase shadow-2xs">' +
          esc(fechaLarga(msg.at)) + "</span></div>";
      }
      html += burbuja(msg, nombre);
    });
    if (conv.total_mensajes && conv.total_mensajes > msgs.length) {
      html = '<div class="flex justify-center my-1"><span class="px-3 py-1 rounded-full bg-slate-200/80 text-slate-600 font-bold text-[10px] tracking-wider uppercase shadow-2xs">Últimos ' +
        msgs.length + " de " + conv.total_mensajes + "</span></div>" + html;
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  function pintarCabeza() {
    var nombre = conv ? nombreDe(conv) : "Sin contacto";
    var avatar = $("sol-wa-avatar");
    var title = $("sol-wa-nombre");
    var meta = $("sol-wa-meta");
    var pausa = $("sol-wa-pausar");
    if (avatar) avatar.textContent = conv ? iniciales(nombre) : "—";
    if (title) title.textContent = nombre;
    if (meta) {
      if (!conv) meta.textContent = "Elegí un contacto de la lista.";
      else {
        var extra = conv.bot_pausado
          ? ' • <span class="text-amber-600 font-medium">Bot pausado</span>'
          : "";
        var viaje = remito && (remito.datos || {}).viaje_codigo;
        if (viaje) extra += ' • <span class="font-medium text-slate-700">Viaje ' + esc(viaje) + "</span>";
        meta.innerHTML = '<span class="font-mono text-slate-600">' + esc(formatPhone(conv.telefono)) + "</span>" + extra;
      }
    }
    if (pausa) {
      var spans = pausa.querySelectorAll("span");
      var textSpan = spans.length ? spans[spans.length - 1] : null;
      if (textSpan) textSpan.textContent = conv && conv.bot_pausado ? "Reactivar bot" : "Pausar bot";
      if (conv && conv.bot_pausado) {
        pausa.className =
          "px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold shadow-xs transition";
        pausa.title = "Reactivar bot para este chofer";
      } else {
        pausa.className =
          "px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold shadow-xs transition";
        pausa.title = "Pausar bot para este chofer";
      }
    }
  }

  function choferDeConv() {
    if (!conv) return null;
    var tel = digits(conv.telefono);
    var ch = choferes[tel] || null;
    if (ch) return ch;
    // Match flexible por últimos dígitos
    var keys = Object.keys(choferes);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.slice(-8) === tel.slice(-8) || tel.slice(-8) === k.slice(-8)) return choferes[k];
    }
    return null;
  }

  function ensureChoferPanel() {
    if (choferPanel) return choferPanel;
    choferPanel = document.createElement("div");
    choferPanel.id = "sol-wa-chofer-panel";
    choferPanel.className = "hidden fixed inset-0 z-[10040]";
    choferPanel.innerHTML =
      '<div class="absolute inset-0 bg-slate-900/35" data-sol-wa-ch-bg></div>' +
      '<div class="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] bg-white shadow-2xl flex flex-col sm:rounded-l-2xl max-h-[90vh] sm:max-h-none">' +
      '<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">' +
      '<div><p class="text-sm font-extrabold text-slate-900">Ficha del chofer</p>' +
      '<p class="text-[11px] text-slate-500 font-medium" data-sol-wa-ch-sub>—</p></div>' +
      '<button type="button" data-sol-wa-ch-close class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">' +
      '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      "</div>" +
      '<div class="flex-1 overflow-y-auto p-5 space-y-4" data-sol-wa-ch-body></div>' +
      "</div>";
    document.body.appendChild(choferPanel);
    choferPanel.querySelector("[data-sol-wa-ch-bg]").addEventListener("click", closeChoferPanel);
    choferPanel.querySelector("[data-sol-wa-ch-close]").addEventListener("click", closeChoferPanel);
    return choferPanel;
  }

  function closeChoferPanel() {
    if (choferPanel) choferPanel.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function openChoferPanel() {
    if (!conv) {
      toast("Elegí un contacto para ver al chofer.", "warn");
      return;
    }
    var panel = ensureChoferPanel();
    var ch = choferDeConv();
    var nombre = nombreDe(conv);
    var sub = panel.querySelector("[data-sol-wa-ch-sub]");
    if (sub) sub.textContent = formatPhone(conv.telefono);
    var viaje = remito && (dato("viaje_codigo") || dato("nro_viaje") || dato("ot"));
    var unidad = remito && (dato("patente") || dato("unidad") || dato("tractor"));
    var cliente = remito && (dato("cliente") || dato("remito_cliente"));
    var origen = remito && (dato("procedencia") || dato("origen"));
    var destino = remito && (dato("destino") || dato("destino_nombre"));
    var ruta = [origen, destino].filter(Boolean).join(" → ");
    var body = panel.querySelector("[data-sol-wa-ch-body]");
    body.innerHTML =
      '<div class="flex items-center gap-3">' +
      '<div class="w-14 h-14 rounded-full bg-slate-900 text-white font-bold text-lg flex items-center justify-center">' +
      esc(iniciales(nombre)) +
      "</div>" +
      '<div class="min-w-0">' +
      '<p class="text-base font-extrabold text-slate-900 truncate">' +
      esc(nombre) +
      "</p>" +
      '<p class="text-xs font-mono text-slate-500">' +
      esc(formatPhone(conv.telefono)) +
      "</p>" +
      (conv.bot_pausado
        ? '<p class="text-[11px] font-semibold text-amber-600 mt-1">Bot pausado en este chat</p>'
        : '<p class="text-[11px] font-semibold text-emerald-600 mt-1">Bot activo</p>') +
      "</div></div>" +
      '<div class="grid grid-cols-2 gap-2 text-[11px]">' +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 col-span-2">' +
      '<p class="text-slate-400 font-medium">Documento</p>' +
      '<p class="font-bold text-slate-800 mt-0.5">' +
      esc((ch && ch.documento) || "—") +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">' +
      '<p class="text-slate-400 font-medium">Tipo</p>' +
      '<p class="font-bold text-slate-800 mt-0.5">' +
      esc((ch && ch.observacion) || "—") +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">' +
      '<p class="text-slate-400 font-medium">Estado</p>' +
      '<p class="font-bold text-slate-800 mt-0.5">' +
      esc(ch ? (ch.activo === false ? "Inactivo" : "Activo") : "Sin ficha en parámetros") +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 col-span-2">' +
      '<p class="text-slate-400 font-medium">Viaje vinculado</p>' +
      '<p class="font-bold text-slate-800 mt-0.5">' +
      esc(viaje || "—") +
      (ruta ? ' <span class="font-medium text-slate-500">· ' + esc(ruta) + "</span>" : "") +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">' +
      '<p class="text-slate-400 font-medium">Unidad</p>' +
      '<p class="font-bold text-slate-800 mt-0.5">' +
      esc(unidad || "—") +
      "</p></div>" +
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">' +
      '<p class="text-slate-400 font-medium">Cliente</p>' +
      '<p class="font-bold text-slate-800 mt-0.5 truncate">' +
      esc(cliente || "—") +
      "</p></div>" +
      "</div>" +
      (!ch
        ? '<p class="text-[11px] text-slate-500 leading-relaxed">Este número no está cargado en Parámetros → Choferes. Igual podés chatear; la ficha completa aparece cuando el teléfono coincide.</p>'
        : "");
    panel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function estadoRemito(estado) {
    var map = {
      pendiente_revision: "Pendiente de revisión",
      incompleto: "Incompleto",
      bloqueado: "Bloqueado",
      confirmado: "Confirmado",
      error_lectura: "Error de lectura",
    };
    return map[estado] || estado || "—";
  }
  function dato(key) {
    var d = (remito && remito.datos) || {};
    var v = d[key];
    return v == null || v === "" ? "" : String(v);
  }
  function pintarFoto() {
    var img = $("sol-wa-foto");
    if (!img) return;
    if (!remito || !remito.id || tab !== "remito") {
      img.classList.add("hidden");
      img.removeAttribute("src");
      return;
    }
    img.classList.remove("hidden");
    img.alt = "Remito " + (dato("nro_remito") || dato("nro_guia") || "");
    img.src = "/backend/api/remitos/" + encodeURIComponent(remito.id) + "/imagen";
    img.onerror = function () { img.classList.add("hidden"); };
  }
  function pintarContexto() {
    var doc = $("sol-wa-doc");
    var estado = $("sol-wa-estado");
    var cliente = $("sol-wa-cliente");
    var unidad = $("sol-wa-unidad");
    var merc = $("sol-wa-mercaderia");
    ["sol-wa-viajes", "sol-wa-sla", "sol-wa-score"].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = "—";
    });
    var gps = $("sol-wa-gps");
    var hace = $("sol-wa-gps-hace");
    if (hace) hace.textContent = "—";
    if (gps) gps.textContent = "Sin posición medida";
    if (!remito) {
      if (doc) doc.textContent = "—";
      if (estado) estado.textContent = "Sin remito vinculado";
      if (cliente) cliente.textContent = "—";
      if (unidad) unidad.textContent = "—";
      if (merc) merc.textContent = "—";
      pintarFoto();
      return;
    }
    var nro = dato("nro_guia") || dato("nro_remito") || String(remito.id || "").slice(0, 8);
    var viaje = dato("viaje_codigo") || dato("nro_viaje") || dato("ot");
    var origen = dato("procedencia") || dato("origen");
    var destino = dato("destino") || dato("destino_nombre");
    var ruta = [origen, destino].filter(Boolean).join(" → ");
    if (tab === "viaje") {
      if (doc) doc.textContent = viaje || "—";
      if (estado) estado.textContent = viaje ? "Viaje del remito" : "Sin viaje en el remito";
      if (cliente) cliente.textContent = ruta || "—";
    } else if (tab === "historial") {
      if (doc) doc.textContent = String((conv && conv.mensajes && conv.mensajes.length) || 0);
      if (estado) estado.textContent = "Mensajes en esta conversación";
      if (cliente) cliente.textContent = conv && conv.updated_at ? "Último " + horaLista(conv.updated_at) : "—";
    } else {
      if (doc) doc.textContent = nro ? "#" + nro : "—";
      if (estado) estado.textContent = estadoRemito(remito.estado);
      if (cliente) cliente.textContent = [dato("cliente") || dato("remito_cliente") || dato("conductor") || "—", ruta].filter(Boolean).join(" • ");
    }
    var patente = dato("patente") || dato("patente_chasis") || dato("chasis") || dato("tractor");
    var semi = dato("patente_acoplado") || dato("acoplado") || dato("semi");
    var unidadTxt = [dato("vehiculo") || dato("unidad") || dato("conductor"), patente, semi].filter(Boolean).join(" • ");
    if (unidad) unidad.textContent = unidadTxt || "—";
    var peso = dato("peso_kg") || dato("peso");
    var bultos = dato("cantidad") || dato("total_bultos");
    var mercTxt = [dato("descripcion") || dato("mercaderia") || dato("producto"), bultos ? bultos + " bultos" : "", peso ? peso + " kg" : ""].filter(Boolean).join(" • ");
    if (merc) merc.textContent = mercTxt || "—";
    pintarFoto();
  }

  function pintarTabs() {
    ["remito", "viaje", "historial"].forEach(function (name) {
      var btn = $("sol-wa-tab-" + name);
      if (btn) btn.className = tab === name ? TAB_ON : TAB_OFF;
    });
  }

  function vaciarMuestra() {
    ["sol-wa-viajes", "sol-wa-sla", "sol-wa-score"].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = "—";
    });
    var gps = $("sol-wa-gps");
    var hace = $("sol-wa-gps-hace");
    if (hace) hace.textContent = "—";
    if (gps) gps.textContent = "Sin posición medida";
  }

  function sesion() {
    sessionError = true;
    lista = [];
    conv = null;
    remito = null;
    var box = $("sol-wa-lista");
    if (box) box.innerHTML = '<p class="p-4 text-xs text-slate-500">Hace falta una sesión para ver los mensajes.</p>';
    var hilo = $("sol-wa-hilo");
    if (hilo) hilo.innerHTML = '<p class="text-xs text-slate-500">Hace falta una sesión para ver los mensajes.</p>';
    aviso("Hace falta una sesión para ver los mensajes.");
    pintarCabeza();
    pintarContexto();
    ["sol-wa-f-todos", "sol-wa-f-tsb", "sol-wa-f-leer", "sol-wa-f-inc"].forEach(function (id) {
      var btn = $(id);
      if (!btn) return;
      var label = btn.textContent.replace(/\(\d+\)/, "(—)");
      if (btn.querySelector("span.rounded-full")) {
        var node = btn.lastChild;
        if (node && node.nodeType === 3) node.textContent = " " + label.trim();
      } else btn.textContent = label.trim();
    });
  }

  function abrir(tel) {
    selected = tel;
    pintarLista();
    return api("/api/conversaciones/" + encodeURIComponent(tel) + "?mensajes_limit=300").then(function (data) {
      if (selected !== tel) return;
      var item = lista.find(function (r) { return r.telefono === tel; });
      conv = data;
      conv.telefono = data.telefono || tel;
      conv.total_mensajes = item && item.total_mensajes ? item.total_mensajes : (data.mensajes || []).length;
      pintarCabeza();
      pintarHilo();
      remito = remitoPorId(data.ultimo_remito_id) || remitoPorTelefono(data.telefono || tel);
      pintarCabeza();
      pintarContexto();
      if (!data.ultimo_remito_id || remitoPorId(data.ultimo_remito_id)) return;
      return api("/api/remitos/" + encodeURIComponent(data.ultimo_remito_id)).then(function (row) {
        if (selected !== tel) return;
        remito = row;
        pintarCabeza();
        pintarContexto();
      }).catch(function () {
        if (selected !== tel) return;
        remito = remitoPorTelefono(data.telefono || tel);
        pintarContexto();
      });
    }).catch(function (err) {
      if (err.status === 401) return sesion();
      conv = null;
      var hilo = $("sol-wa-hilo");
      if (hilo) hilo.innerHTML = '<p class="text-xs text-slate-500">' + esc(err.message || "No se pudo abrir la conversación.") + "</p>";
    });
  }

  function cargar() {
    if (busy) return Promise.resolve();
    var previo = selected;
    var sello = "";
    lista.forEach(function (r) { if (r.telefono === selected) sello = r.updated_at || ""; });
    return Promise.all([
      api("/api/conversaciones?limit=200"),
      api("/api/parametros/choferes").catch(function () { return []; }),
      api("/api/incidencias?limit=500").catch(function () { return []; }),
      api("/api/remitos?limit=200").catch(function () { return []; }),
    ]).then(function (pack) {
      sessionError = false;
      lista = Array.isArray(pack[0]) ? pack[0] : [];
      choferes = {};
      (Array.isArray(pack[1]) ? pack[1] : []).forEach(function (ch) {
        [ch.telefono, ch.documento].forEach(function (raw) {
          var tel = digits(raw);
          if (tel.length >= 8) choferes[tel] = ch;
        });
      });
      remitos = (Array.isArray(pack[3]) ? pack[3] : []).slice().sort(function (a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      abiertas = {};
      (Array.isArray(pack[2]) ? pack[2] : []).forEach(function (inc) {
        if (!inc || !inc.telefono || inc.estado === "resuelta") return;
        abiertas[digits(inc.telefono)] = inc;
      });
      aviso("WhatsApp con choferes — respondé desde acá con contexto operativo en tiempo real.");
      if (!selected && lista.length) selected = lista[0].telefono;
      if (selected && !lista.some(function (r) { return r.telefono === selected; })) selected = lista[0] ? lista[0].telefono : null;
      pintarLista();
      vaciarMuestra();
      var nuevo = "";
      lista.forEach(function (r) { if (r.telefono === selected) nuevo = r.updated_at || ""; });
      if (selected && (!conv || previo !== selected || sello !== nuevo)) return abrir(selected);
      if (selected) return;
      conv = null;
      remito = null;
      pintarCabeza();
      pintarHilo();
      pintarContexto();
    }).catch(function (err) {
      if (err.status === 401) sesion();
      else aviso(err.message || "No se pudieron cargar los contactos.");
    });
  }

  function enviar(e) {
    if (e) e.preventDefault();
    if (busy || !conv) return;
    var input = $("sol-wa-texto");
    var texto = input ? input.value.trim() : "";
    if (!texto) return;
    var nota = Boolean($("sol-wa-nota") && $("sol-wa-nota").checked);
    busy = true;
    api("/api/conversaciones/" + encodeURIComponent(conv.telefono) + "/mensajes", {
      method: "POST",
      body: JSON.stringify({ texto: texto, nota_interna: nota }),
    }).then(function () {
      if (input) input.value = "";
      if ($("sol-wa-nota")) $("sol-wa-nota").checked = false;
      return abrir(conv.telefono);
    }).catch(function (err) {
      aviso(err.message || "No se pudo enviar el mensaje.");
    }).then(function () { busy = false; });
  }

  function pausarEste() {
    if (!conv) {
      toast("Elegí un chat para pausar o reactivar el bot.", "warn");
      return;
    }
    if (busy) return;
    var next = !conv.bot_pausado;
    busy = true;
    api("/api/conversaciones/" + encodeURIComponent(conv.telefono) + "/bot-pausado", {
      method: "PATCH",
      body: JSON.stringify({ pausado: next }),
    })
      .then(function () {
        toast(
          next
            ? "Bot pausado — respondés vos hasta reactivarlo."
            : "Bot reactivado para este chofer.",
          next ? "warn" : "ok",
        );
        return abrir(conv.telefono);
      })
      .catch(function (err) {
        toast(err.message || "No se pudo cambiar el bot.", "off");
        aviso(err.message || "No se pudo cambiar el bot.");
      })
      .then(function () {
        busy = false;
      });
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var filtroBtn = t.closest("[data-sol-wa-filtro]");
    var telBtn = t.closest("[data-tel]");
    var tabBtn = t.closest("[data-sol-wa-tab]");
    var atajo = t.closest("[data-sol-wa-atajo]");
    var propio = filtroBtn || telBtn || tabBtn || atajo || t.closest("#sol-wa-actualizar") || t.closest("#sol-wa-pausar") || t.closest("#sol-wa-pausar-todos") || t.closest("#sol-wa-llamar") || t.closest("#sol-wa-chofer") || t.closest("#sol-wa-ver-remito");
    if (propio || t.closest("#sol-wa-form")) ev.stopPropagation();
    if (propio) ev.preventDefault();
    if (filtroBtn) {
      filtro = filtroBtn.getAttribute("data-sol-wa-filtro");
      pintarLista();
      return;
    }
    if (telBtn && telBtn.closest("#sol-wa-lista")) {
      abrir(telBtn.getAttribute("data-tel"));
      return;
    }
    if (tabBtn) {
      tab = tabBtn.getAttribute("data-sol-wa-tab");
      pintarTabs();
      pintarContexto();
      return;
    }
    if (atajo) {
      var input = $("sol-wa-texto");
      if (input) {
        input.value = atajo.getAttribute("data-sol-wa-atajo") || "";
        input.focus();
      }
      return;
    }
    if (t.closest("#sol-wa-actualizar")) {
      cargar();
      return;
    }
    if (t.closest("#sol-wa-pausar")) {
      pausarEste();
      return;
    }
    if (t.closest("#sol-wa-pausar-todos")) {
      toast("La pausa es por chofer. Abrí el chat y usá Pausar bot.", "warn");
      return;
    }
    if (t.closest("#sol-wa-llamar")) {
      toast("Opción NO ACTIVADA — las llamadas aún no están habilitadas.", "off");
      aviso("Llamar: opción NO ACTIVADA.");
      return;
    }
    if (t.closest("#sol-wa-chofer")) {
      openChoferPanel();
      return;
    }
    if (t.closest("#sol-wa-ver-remito")) {
      if (!remito) {
        aviso("Esta conversación no tiene un remito vinculado.");
        return;
      }
      var q = dato("nro_guia") || dato("nro_remito") || remito.id;
      window.top.location.href = "/agentes/remitos?q=" + encodeURIComponent(q);
    }
  }, true);

  var form = $("sol-wa-form");
  if (form) form.addEventListener("submit", enviar);
  var buscar = $("sol-wa-buscar");
  if (buscar) buscar.addEventListener("input", pintarLista);
  var texto = $("sol-wa-texto");
  if (texto) {
    texto.addEventListener("input", function () {
      if (typingTimer) clearTimeout(typingTimer);
      if (!conv || ($("sol-wa-nota") && $("sol-wa-nota").checked) || !texto.value.trim()) return;
      var tel = conv.telefono;
      typingTimer = setTimeout(function () {
        api("/api/conversaciones/" + encodeURIComponent(tel) + "/typing", { method: "POST", body: "{}" }).catch(function () {});
      }, 800);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeChoferPanel();
  });

  vaciarMuestra();
  cargar();
  setInterval(function () {
    if (busy || sessionError) return;
    if (document.activeElement === $("sol-wa-texto")) return;
    cargar();
  }, 12000);
})();
