(function () {
  var PAGE = 17;
  var rows = [];
  var live = false;
  var selectedId = null;
  var showAll = false;
  var conv = null;
  var fileInput = null;

  function $(id) { return document.getElementById(id); }
  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null || value === "" ? "—" : String(value);
  }
  function setKeepIcon(id, value) {
    var el = $(id);
    if (!el) return;
    var node = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3 && String(el.childNodes[i].textContent).trim()) node = el.childNodes[i];
    }
    if (node) node.textContent = " " + value;
    else el.appendChild(document.createTextNode(" " + value));
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", credentials: "include" };
    if (opts.body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = opts.body;
    }
    if (opts.form) {
      init.body = opts.form;
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

  function d(row) { return row.datos || {}; }
  function pick(row) {
    var x = d(row);
    return {
      nro: String(x.nro_guia || x.nro_remito || row.id.slice(0, 8)),
      viaje: String(x.viaje_codigo || x.nro_viaje || x.ot || "—"),
      fecha: String(x.fecha_guia || x.fecha_remito || x.fecha || ""),
      hora: String(x.hora || ""),
      chofer: String(x.conductor || x.chofer || "—"),
      patente: String(x.patente || x.chasis || x.tractor || x.patente_chasis || "—"),
      semi: String(x.acoplado || x.semi || x.patente_acoplado || ""),
      cliente: String(x.cliente || row.tenant || "—"),
      origen: String(x.procedencia || x.origen || "—"),
      destino: String(x.destino || x.destino_nombre || x.cliente || "—"),
      peso: x.peso_kg != null && x.peso_kg !== "" ? x.peso_kg : x.peso,
      bultos: x.total_bultos,
    };
  }
  function fechaCorta(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + "/" + m[2];
    var dmy = String(iso || "").match(/(\d{1,2})[\/.\-](\d{1,2})/);
    if (dmy) return dmy[1].padStart(2, "0") + "/" + dmy[2].padStart(2, "0");
    return "—";
  }
  function horaDe(row, p) {
    if (p.hora) return String(p.hora).slice(0, 5);
    if (!row.created_at) return "";
    try { return new Date(row.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function grupo(estado) {
    if (estado === "confirmado") return "confirmado";
    if (estado === "incompleto") return "incompleto";
    return "revision";
  }
  function confianza(row) {
    var r = d(row).resumen && d(row).resumen.campos_extraidos;
    if (r && r.total) return Math.round(((r.ok || 0) / r.total) * 100);
    return null;
  }
  function ocrBadge(row) {
    var c = confianza(row);
    if (row.estado === "confirmado") {
      return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="ph-bold ph-check-circle"></i> ' + (c != null ? c + "% Validado" : "Validado") + "</span>";
    }
    if (row.estado === "incompleto" || row.estado === "pendiente_revision") {
      return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><i class="ph-bold ph-magnifying-glass"></i> ' + (c != null ? c + "% " : "") + "Revisión manual</span>";
    }
    return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200"><i class="ph-bold ph-pencil"></i> ' + esc(row.estado || "Pendiente") + "</span>";
  }
  function confBadge(row) {
    if (row.estado === "confirmado") {
      return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"><i class="ph-bold ph-check-double"></i> Conforme</span>';
    }
    var v = row.validacion;
    var motivo = (v && v.errores && v.errores[0]) || (v && v.faltantes && v.faltantes[0]) || "";
    if (motivo) {
      return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><i class="ph-bold ph-warning-circle"></i> ' + esc(motivo) + "</span>";
    }
    return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"><i class="ph-bold ph-clock-countdown"></i> ' + esc(row.estado === "incompleto" ? "Pendiente" : "En revisión") + "</span>";
  }

  function filtradas() {
    var q = fold($("sol-rem-buscar") && $("sol-rem-buscar").value);
    var est = $("sol-rem-estado") ? $("sol-rem-estado").value : "todos";
    var ten = $("sol-rem-tenant") ? $("sol-rem-tenant").value : "";
    return rows.filter(function (row) {
      if (est !== "todos" && grupo(row.estado) !== est) return false;
      var p = pick(row);
      if (ten && fold(row.tenant) !== fold(ten) && fold(p.cliente) !== fold(ten)) return false;
      if (!q) return true;
      var blob = fold([p.nro, p.chofer, p.patente, p.semi, p.cliente, p.origen, p.destino, p.viaje, row.tenant].join(" "));
      var digits = q.replace(/\D/g, "");
      if (blob.indexOf(q) >= 0) return true;
      return digits.length >= 3 && String(p.nro).replace(/\D/g, "").indexOf(digits) >= 0;
    });
  }

  function rowHtml(row, active) {
    var p = pick(row);
    var cls = active
      ? "bg-indigo-50/40 hover:bg-indigo-50/60 transition-colors border-l-4 border-l-indigo-600"
      : "hover:bg-slate-50/80 transition-colors";
    var unidad = [p.semi, p.patente].filter(function (x) { return x && x !== "—"; }).join(" · ") || "—";
    return '<tr data-id="' + esc(row.id) + '" class="' + cls + '">' +
      '<td class="py-3.5 px-4"><div class="font-bold font-mono text-slate-900 text-sm">#' + esc(p.nro) + '</div>' +
      '<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 mt-0.5"><i class="ph-fill ph-whatsapp-logo text-emerald-600"></i> ' + esc(row.tenant || "remito") + "</span></td>" +
      '<td class="py-3.5 px-4 font-mono font-medium text-slate-800">' + esc(p.viaje) + "</td>" +
      '<td class="py-3.5 px-4 font-mono text-slate-600"><div>' + esc(fechaCorta(p.fecha)) + '</div><div class="text-[11px] text-slate-400">' + esc(horaDe(row, p)) + "</div></td>" +
      '<td class="py-3.5 px-4"><div class="font-bold text-slate-900">' + esc(p.chofer) + '</div><div class="text-[11px] text-slate-500 font-mono">' + esc(unidad) + "</div></td>" +
      '<td class="py-3.5 px-4 font-semibold text-slate-900">' + esc(p.cliente) + "</td>" +
      '<td class="py-3.5 px-4"><div class="flex items-center gap-1.5 font-medium text-slate-800"><span>' + esc(p.origen) + '</span><i class="ph-bold ph-arrow-right text-slate-400 text-[10px]"></i><span class="font-bold text-indigo-900">' + esc(p.destino) + "</span></div></td>" +
      '<td class="py-3.5 px-4">' + ocrBadge(row) + "</td>" +
      '<td class="py-3.5 px-4">' + confBadge(row) + "</td>" +
      '<td class="py-3.5 px-4 text-right"><div class="flex items-center justify-end gap-2">' +
      '<button type="button" data-act="ver" class="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 rounded-md border border-indigo-200 shadow-xs transition-colors">Ver remito</button>' +
      '<button type="button" data-act="mas" class="p-1 text-slate-400 hover:text-slate-600"><i class="ph-bold ph-dots-three-vertical text-base"></i></button>' +
      "</div></td></tr>";
  }

  function pintar() {
    var body = $("sol-rem-body");
    if (!body || !live) return;
    var list = filtradas();
    if (!list.some(function (r) { return r.id === selectedId; })) selectedId = list[0] ? list[0].id : null;
    var slice = showAll ? list : list.slice(0, PAGE);
    body.innerHTML = slice.map(function (row) { return rowHtml(row, row.id === selectedId); }).join("") ||
      '<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay remitos con esos filtros.</td></tr>';
    var pie = $("sol-rem-pie");
    if (pie) pie.innerHTML = 'Mostrando <strong class="text-slate-700 font-mono">' + slice.length + '</strong> de <strong class="text-slate-700 font-mono">' + list.length + "</strong> remitos";
    var rev = rows.filter(function (r) { return grupo(r.estado) === "revision" || r.estado === "incompleto"; }).length;
    document.querySelectorAll("span").forEach(function (s) {
      if (/en revisión inmediata/.test(s.textContent)) s.textContent = rev + " en revisión inmediata";
    });
    document.querySelectorAll("a").forEach(function (a) {
      if (fold(a.textContent).indexOf("remitos en gestion") >= 0) {
        var badge = a.querySelector("span");
        if (badge) badge.textContent = String(rev);
      }
    });
    var sel = rows.filter(function (r) { return r.id === selectedId; })[0] || slice[0];
    if (sel) inspeccion(sel);
    kpis();
  }

  function kpis() {
    var hoy = new Date();
    var nHoy = rows.filter(function (r) {
      var t = new Date(r.procesado_at || r.created_at || 0);
      return r.estado === "confirmado" && t.getFullYear() === hoy.getFullYear() && t.getMonth() === hoy.getMonth() && t.getDate() === hoy.getDate();
    }).length;
    setText("sol-rem-kpi-hoy", String(nHoy));
    var confs = rows.map(confianza).filter(function (n) { return n != null; });
    setText("sol-rem-kpi-ocr", confs.length ? (confs.reduce(function (a, b) { return a + b; }, 0) / confs.length).toFixed(1).replace(".", ",") + "%" : "—");
    setText("sol-rem-kpi-tiempo", "—");
    var ok = rows.filter(function (r) { return r.estado === "confirmado"; }).length;
    setText("sol-rem-kpi-legible", rows.length ? Math.round((ok / rows.length) * 1000) / 10 + "%" : "—");
  }

  function checklist(row) {
    var title = null;
    document.querySelectorAll("span").forEach(function (s) {
      if (s.textContent.indexOf("Checklist de Validación") >= 0) title = s;
    });
    var grid = title && title.nextElementSibling;
    if (!grid) return;
    var labels = grid.querySelectorAll("span");
    var v = row.validacion || {};
    var msgs = [].concat(v.faltantes || [], v.errores || []).slice(0, 4);
    if (!msgs.length) msgs = v.valido ? ["Sin observaciones del motor", "Listo para procesar", "Datos persistidos", "Foto asociada"] : ["Sin checklist del motor", "Revisá los campos", "No hay sello detectado", "No hay firma detectada"];
    for (var i = 0; i < labels.length && i < msgs.length; i++) labels[i].textContent = msgs[i];
  }

  function inspeccion(row) {
    var p = pick(row);
    var c = confianza(row);
    setText("sol-rem-activo", "#" + p.nro);
    setKeepIcon("sol-rem-conf", "Estado: " + (row.estado || "—") + (c != null ? " · " + c + "%" : ""));
    setKeepIcon("sol-rem-archivo", row.imagen_path ? String(row.imagen_path).split("/").pop() : "sin archivo");
    setText("sol-rem-legal", p.nro);
    setText("sol-rem-fecha", (fechaCorta(p.fecha) === "—" ? "Sin fecha" : p.fecha) + (horaDe(row, p) ? " " + horaDe(row, p) : ""));
    setText("sol-rem-dador", p.origen);
    setText("sol-rem-destino", p.destino);
    setText("sol-rem-chofer", p.chofer);
    var carga = [];
    if (p.bultos != null && p.bultos !== "") carga.push(p.bultos + " bultos");
    if (p.peso != null && p.peso !== "") carga.push(p.peso + " kg");
    setText("sol-rem-carga", carga.join(" · ") || "—");
    setText("sol-rem-sync", "Sync ID: " + row.id);
    setText("sol-rem-rnum", "R_NUM: " + p.nro);
    setText("sol-rem-doc-empresa", p.cliente);
    setText("sol-rem-doc-chofer", p.chofer);
    setText("sol-rem-doc-patente", p.patente);
    setText("sol-rem-doc-origen", p.origen);
    setText("sol-rem-doc-destino", p.destino);
    setText("sol-rem-doc-total", p.bultos != null && p.bultos !== "" ? "TOTAL " + p.bultos : "TOTAL");
    setText("sol-rem-doc-peso", p.peso != null && p.peso !== "" ? p.peso + " KG" : "—");
    checklist(row);
  }

  function fillTenants() {
    var sel = $("sol-rem-tenant");
    if (!sel) return;
    var current = sel.value;
    var seen = {};
    var opts = ['<option value="">Todos los clientes / tenants</option>'];
    rows.forEach(function (row) {
      var p = pick(row);
      [row.tenant, p.cliente].forEach(function (name) {
        if (!name || name === "—" || seen[name]) return;
        seen[name] = true;
        opts.push('<option value="' + esc(name) + '">' + esc(name) + "</option>");
      });
    });
    sel.innerHTML = opts.join("");
    sel.value = current;
  }

  function filtrarMuestra() {
    if (live) return;
    var q = fold($("sol-rem-buscar") && $("sol-rem-buscar").value);
    var est = $("sol-rem-estado") ? $("sol-rem-estado").value : "todos";
    var ten = fold($("sol-rem-tenant") && $("sol-rem-tenant").value);
    var n = 0;
    document.querySelectorAll("#sol-rem-body tr").forEach(function (tr) {
      var blob = fold(tr.textContent);
      var ok = (!q || blob.indexOf(q) >= 0) && (!ten || blob.indexOf(ten) >= 0);
      if (est === "confirmado") ok = ok && /validado|conforme/.test(blob);
      if (est === "revision") ok = ok && /revision|revisar|diferencia/.test(blob);
      if (est === "incompleto") ok = ok && /pendiente/.test(blob);
      tr.classList.toggle("hidden", !ok);
      if (ok) n += 1;
    });
    var pie = $("sol-rem-pie");
    if (pie) pie.innerHTML = 'Mostrando <strong class="text-slate-700 font-mono">' + n + "</strong> remitos";
  }

  function load() {
    return api("/api/remitos?limit=500").then(function (data) {
      rows = Array.isArray(data) ? data : [];
      live = true;
      fillTenants();
      pintar();
    }).catch(function (err) {
      live = false;
      var out = $("sol-rem-chat-out");
      if (out && err && err.status === 401) {
        out.textContent = "La mesa de muestra sigue visible. Para ver, aprobar y subir remitos reales hace falta una sesión.";
      } else if (out) {
        out.textContent = err.message || "No pude cargar los remitos.";
      }
    });
  }

  function seleccionar(id, abrir) {
    selectedId = id;
    pintar();
    var sec = document.querySelector('[data-purpose="active-receipt-inspection"]');
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    if (abrir) window.open("/backend/api/remitos/" + encodeURIComponent(id) + "/imagen", "_blank");
  }

  function aprobar() {
    if (!selectedId) return;
    var out = $("sol-rem-sync");
    api("/api/remitos/procesar", { method: "POST", body: JSON.stringify({ ids: [selectedId] }) }).then(function (res) {
      var ok = res.procesados && res.procesados.length;
      var err = res.errores && res.errores[0];
      if (out) out.textContent = ok ? "Procesado" : ((err && err.motivos && err.motivos.join(" · ")) || "No se procesó");
      return load();
    }).catch(function (err) {
      if (out) out.textContent = err.message || "No se pudo procesar";
    });
  }

  function subir(file) {
    if (!file) return;
    var fd = new FormData();
    fd.append("tenant", "tsb");
    fd.append("file", file);
    var out = $("sol-rem-chat-out");
    if (out) out.textContent = "Subiendo " + file.name + "…";
    api("/api/remitos/ingest", { method: "POST", form: fd }).then(function (row) {
      if (out) out.textContent = "Remito cargado: " + (pick(row).nro || row.id);
      return load().then(function () { if (row && row.id) seleccionar(row.id, false); });
    }).catch(function (err) {
      if (out) out.textContent = err.message || "No pude subir el remito";
    });
  }

  function pedirReenvio() {
    var row = rows.filter(function (r) { return r.id === selectedId; })[0];
    var tel = row && String(row.telefono_chofer || "").replace(/\D/g, "");
    var p = row ? pick(row) : null;
    if (!tel) {
      var out = $("sol-rem-chat-out");
      if (out) out.textContent = "Este remito no tiene teléfono de chofer para pedir el reenvío.";
      return;
    }
    var text = "Hola. Reenviá la foto del remito " + (p ? p.nro : "") + ", por favor.";
    window.open("https://wa.me/" + tel + "?text=" + encodeURIComponent(text), "_blank");
  }

  function preguntar(text) {
    var q = String(text || "").trim();
    if (!q) return;
    var out = $("sol-rem-chat-out");
    if (out) out.textContent = "Consultando…";
    api("/api/agents/chat", {
      method: "POST",
      body: JSON.stringify({ agentId: "remitos", message: q, conversationId: conv || undefined }),
    }).then(function (res) {
      conv = res.conversationId || conv;
      if (out) out.textContent = (res.message && res.message.text) || "Sin respuesta.";
    }).catch(function (err) {
      if (out) out.textContent = err.message || "No pude consultar remitos.";
    });
  }

  function ensureFile() {
    if (fileInput) return fileInput;
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,.pdf";
    fileInput.className = "hidden";
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) subir(fileInput.files[0]);
      fileInput.value = "";
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button, a");
    if (!btn) return;
    var label = fold(btn.textContent || btn.getAttribute("title") || "");
    if (label === "ver remito" || (btn.getAttribute("data-act") === "ver")) {
      var tr = btn.closest("tr");
      if (tr && tr.getAttribute("data-id")) {
        e.preventDefault();
        seleccionar(tr.getAttribute("data-id"), true);
      }
      return;
    }
    if (btn.getAttribute("data-act") === "mas") {
      var host = btn.closest("tr");
      if (host && host.getAttribute("data-id")) seleccionar(host.getAttribute("data-id"), true);
      return;
    }
    if (label.indexOf("aprobar y sincronizar") >= 0) { e.preventDefault(); aprobar(); return; }
    if (label.indexOf("pedir reenvio") >= 0) { e.preventDefault(); pedirReenvio(); return; }
    if (label.indexOf("subir") >= 0) { e.preventDefault(); ensureFile().click(); return; }
    if (label.indexOf("sincronizar tms") >= 0 || btn.getAttribute("title") === "Actualizar datos") { load(); return; }
    if (label.indexOf("ver registro historico") >= 0) { e.preventDefault(); showAll = !showAll; pintar(); return; }
    if (label.indexOf("resumen del agente") >= 0) {
      e.preventDefault();
      if ($("sol-rem-estado")) $("sol-rem-estado").value = "todos";
      window.scrollTo({ top: 0, behavior: "smooth" });
      pintar();
      return;
    }
    if (label.indexOf("remitos en gestion") >= 0) {
      e.preventDefault();
      if ($("sol-rem-estado")) $("sol-rem-estado").value = "revision";
      var table = document.getElementById("remitos-operational-table");
      if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
      pintar();
      return;
    }
    if (label.indexOf("planilla tsb") >= 0) {
      e.preventDefault();
      window.open("/backend/api/planillas/tsb/export", "_blank");
      return;
    }
    var chip = btn.closest('[data-purpose="conversational-assistant"] button');
    if (chip && label && label !== "enviar") {
      var input = chip.parentElement && chip.parentElement.parentElement.querySelector("input");
      preguntar(btn.textContent);
      return;
    }
    if (label === "enviar") {
      var box = document.querySelector('[data-purpose="conversational-assistant"] input');
      if (box) { preguntar(box.value); box.value = ""; }
    }
  }, true);

  var body = $("sol-rem-body");
  if (body) body.addEventListener("click", function (e) {
    if (e.target.closest("button")) return;
    var tr = e.target.closest("tr");
    if (tr && tr.getAttribute("data-id")) seleccionar(tr.getAttribute("data-id"), false);
  });
  var buscar = $("sol-rem-buscar");
  var qParam = "";
  try { qParam = new URLSearchParams(window.top.location.search).get("q") || ""; } catch (e) {}
  if (!qParam) qParam = new URLSearchParams(location.search).get("q") || "";
  if (qParam && buscar) buscar.value = qParam;
  if (buscar) buscar.addEventListener("input", function () { if (live) pintar(); else filtrarMuestra(); });
  var estado = $("sol-rem-estado");
  if (estado) estado.addEventListener("change", function () { showAll = false; if (live) pintar(); else filtrarMuestra(); });
  var tenant = $("sol-rem-tenant");
  if (tenant) tenant.addEventListener("change", function () { showAll = false; if (live) pintar(); else filtrarMuestra(); });

  load();
})();
