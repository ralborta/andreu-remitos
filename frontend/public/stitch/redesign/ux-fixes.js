/**
 * SOL UX Fixes - Mejoras de usabilidad del BACKLOG
 * Formatos consistentes, estados traducidos, validaciones
 */

(function () {
  "use strict";

  // =========================================================================
  // DICCIONARIO DE ESTADOS EN ESPAÑOL
  // =========================================================================
  var STATUS_DICTIONARY = {
    // Viajes
    NOT_STARTED: "Sin asignar",
    SOLICITADO: "Sin asignar",
    SIN_ASIGNAR: "Sin asignar",
    ASIGNADO: "Asignado",
    EN_CURSO: "En viaje",
    EN_VIAJE: "En viaje",
    IN_PROGRESS: "En viaje",
    RUNNING: "En viaje",
    COMPLETADO: "Completado",
    COMPLETED: "Completado",
    CANCELADO: "Cancelado",
    CANCELLED: "Cancelado",

    // Finanzas
    AL_DIA: "Al día",
    PARCIAL: "Pago parcial",
    POR_VENCER: "Por vencer",
    VENCIDA: "Vencida",
    SALDADA: "Saldada",
    PAGADA: "Pagada",

    // Marketing
    DRAFT: "Borrador",
    BORRADOR: "Borrador",
    APPROVED: "Aprobado",
    APROBADO: "Aprobado",
    PUBLISHED: "Publicado",
    PUBLICADO: "Publicado",

    // Agentes/Servicios
    OFFLINE: "Desconectado",
    DESCONECTADO: "Desconectado",
    EN_HOLD: "En pausa",
    EN_PAUSA: "En pausa",
    PAUSED: "En pausa",
    EN_ESPERA: "Esperando",
    WAITING: "Esperando",
    ONLINE: "En línea",
    ACTIVE: "Activo",
    READY: "Listo",

    // Genéricos
    PENDING: "Pendiente",
    PENDIENTE: "Pendiente",
    IN_REVIEW: "En revisión",
    EN_REVISION: "En revisión",
  };

  // =========================================================================
  // TRADUCIR ESTADOS EN EL DOM
  // =========================================================================
  function translateStatuses() {
    // Buscar todos los badges y chips de estado
    var badges = document.querySelectorAll(
      '[class*="badge"], [class*="chip"], [class*="pill"], [class*="tag"], ' +
        '.status-badge, .status-chip, .estado-badge, ' +
        '[data-status], [data-estado]'
    );

    badges.forEach(function (badge) {
      var text = badge.textContent.trim().toUpperCase().replace(/\s+/g, "_");
      var translated = STATUS_DICTIONARY[text];

      if (translated) {
        // Preservar estructura HTML interna pero cambiar texto
        var icon = badge.querySelector(".material-symbols-outlined");
        if (icon) {
          // Tiene ícono, solo cambiar el texto
          var textNode = Array.from(badge.childNodes).find(function (n) {
            return n.nodeType === 3; // Text node
          });
          if (textNode) {
            textNode.textContent = translated;
          }
        } else {
          // No tiene ícono, reemplazar todo
          badge.textContent = translated;
        }
      }
    });
  }

  // =========================================================================
  // FORMATOS DE NÚMEROS Y MONEDA
  // =========================================================================
  function formatNumber(num, decimals) {
    if (num == null || isNaN(num)) return "—";
    decimals = decimals != null ? decimals : 0;

    // Redondear para evitar artefactos de float
    num = Number(num);
    if (decimals === 0) {
      num = Math.round(num);
    } else {
      num = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    return num.toLocaleString("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatMoney(amount) {
    if (amount == null || isNaN(amount)) return "—";
    return "$" + formatNumber(amount, 0);
  }

  function formatWeight(kg) {
    if (kg == null || isNaN(kg)) return "—";
    var tons = kg / 1000;
    return formatNumber(tons, 1) + " t";
  }

  // Aplicar formatos a elementos con atributos data
  function applyFormats() {
    // Montos de dinero
    document.querySelectorAll("[data-format='money']").forEach(function (el) {
      var value = parseFloat(el.getAttribute("data-value") || el.textContent);
      if (!isNaN(value)) {
        el.textContent = formatMoney(value);
      }
    });

    // Pesos/toneladas
    document.querySelectorAll("[data-format='weight']").forEach(function (el) {
      var value = parseFloat(el.getAttribute("data-value") || el.textContent);
      if (!isNaN(value)) {
        el.textContent = formatWeight(value);
      }
    });

    // Números con decimales
    document.querySelectorAll("[data-format='number']").forEach(function (el) {
      var value = parseFloat(el.getAttribute("data-value") || el.textContent);
      var decimals = parseInt(el.getAttribute("data-decimals") || "0");
      if (!isNaN(value)) {
        el.textContent = formatNumber(value, decimals);
      }
    });
  }

  // =========================================================================
  // FORMATOS DE FECHA
  // =========================================================================
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      var date = new Date(dateStr);
      // Ajustar por timezone local (ART)
      var offset = date.getTimezoneOffset();
      date = new Date(date.getTime() + offset * 60 * 1000);

      var day = String(date.getDate()).padStart(2, "0");
      var month = String(date.getMonth() + 1).padStart(2, "0");
      var year = date.getFullYear();

      return day + "/" + month + "/" + year;
    } catch (e) {
      return dateStr;
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    try {
      var date = new Date(dateStr);
      var offset = date.getTimezoneOffset();
      date = new Date(date.getTime() + offset * 60 * 1000);

      var day = String(date.getDate()).padStart(2, "0");
      var month = String(date.getMonth() + 1).padStart(2, "0");
      var year = date.getFullYear();
      var hours = String(date.getHours()).padStart(2, "0");
      var minutes = String(date.getMinutes()).padStart(2, "0");

      return day + "/" + month + "/" + year + " " + hours + ":" + minutes;
    } catch (e) {
      return dateStr;
    }
  }

  // Aplicar formatos de fecha
  function applyDateFormats() {
    document.querySelectorAll("[data-format='date']").forEach(function (el) {
      var value = el.getAttribute("data-value") || el.textContent;
      el.textContent = formatDate(value);
    });

    document.querySelectorAll("[data-format='datetime']").forEach(function (el) {
      var value = el.getAttribute("data-value") || el.textContent;
      el.textContent = formatDateTime(value);
    });
  }

  // =========================================================================
  // VALIDACIÓN DE FORMULARIOS
  // =========================================================================
  function setupFormValidation() {
    // Validar campos numéricos
    document.querySelectorAll("input[type='number'], input[data-type='number']").forEach(function (input) {
      input.addEventListener("input", function () {
        var value = this.value.trim();
        if (value && isNaN(value)) {
          this.setCustomValidity("Ingresá solo números");
          this.classList.add("border-red-500");
        } else {
          this.setCustomValidity("");
          this.classList.remove("border-red-500");
        }
      });
    });

    // Validar campos de precio/moneda
    document.querySelectorAll("input[data-type='money'], input[data-type='price']").forEach(function (input) {
      input.addEventListener("input", function () {
        var value = this.value.trim().replace(/[$.]/g, "");
        if (value && isNaN(value)) {
          this.setCustomValidity("Ingresá solo números (sin $)");
          this.classList.add("border-red-500");
        } else if (value && parseFloat(value) < 0) {
          this.setCustomValidity("El monto no puede ser negativo");
          this.classList.add("border-red-500");
        } else {
          this.setCustomValidity("");
          this.classList.remove("border-red-500");
        }
      });
    });

    // Validar campos obligatorios
    document.querySelectorAll("input[required], textarea[required], select[required]").forEach(function (input) {
      input.addEventListener("blur", function () {
        if (!this.value.trim()) {
          this.classList.add("border-red-500");
        } else {
          this.classList.remove("border-red-500");
        }
      });
    });
  }

  // =========================================================================
  // TOOLTIPS PARA CAMPOS TRUNCADOS
  // =========================================================================
  function addTooltips() {
    document.querySelectorAll(".truncate, .overflow-hidden.text-ellipsis").forEach(function (el) {
      if (el.scrollWidth > el.clientWidth) {
        el.title = el.textContent;
      }
    });
  }

  // =========================================================================
  // EMPTY STATES
  // =========================================================================
  function improveEmptyStates() {
    // Buscar tablas vacías o sin resultados
    document.querySelectorAll("table tbody").forEach(function (tbody) {
      if (tbody.children.length === 0 || tbody.textContent.trim() === "") {
        var emptyRow = document.createElement("tr");
        emptyRow.innerHTML =
          '<td colspan="100" class="sol-empty-state py-12">' +
          '<div class="flex flex-col items-center gap-4 text-center">' +
          '<span class="material-symbols-outlined sol-empty-icon">inbox</span>' +
          '<p class="sol-empty-title">Sin resultados</p>' +
          '<p class="sol-empty-description">No se encontraron registros que coincidan con los filtros</p>' +
          "</div>" +
          "</td>";
        tbody.appendChild(emptyRow);
      }
    });
  }

  // =========================================================================
  // INICIALIZACIÓN
  // =========================================================================
  function init() {
    translateStatuses();
    applyFormats();
    applyDateFormats();
    setupFormValidation();
    addTooltips();
    improveEmptyStates();
  }

  // Ejecutar al cargar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-aplicar tras actualizaciones dinámicas
  var observer = new MutationObserver(function (mutations) {
    var shouldReapply = false;
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length > 0) {
        shouldReapply = true;
      }
    });
    if (shouldReapply) {
      setTimeout(function () {
        translateStatuses();
        applyFormats();
        applyDateFormats();
        addTooltips();
      }, 100);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Exportar para uso global
  if (typeof window !== "undefined") {
    window.SOL_UX = {
      formatMoney: formatMoney,
      formatWeight: formatWeight,
      formatNumber: formatNumber,
      formatDate: formatDate,
      formatDateTime: formatDateTime,
      translateStatus: function (status) {
        return STATUS_DICTIONARY[status.toUpperCase().replace(/\s+/g, "_")] || status;
      },
    };
  }
})();
