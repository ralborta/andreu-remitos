/**
 * Utilidades de formato centralizadas para SOL
 * Garantiza consistencia en números, fechas, monedas y estados en toda la app.
 */

// ============================================================================
// NÚMEROS Y MONEDA (es-AR)
// ============================================================================

/**
 * Formatea número con separador de miles (punto) y decimales (coma).
 * @param {number} value - Número a formatear
 * @param {number} decimals - Cantidad de decimales (default: 2)
 * @returns {string} - Ej: 1.234,56
 */
function formatNumber(value, decimals) {
  if (value == null || isNaN(value)) return "—";
  decimals = decimals != null ? decimals : 2;
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatea moneda en pesos argentinos.
 * @param {number} amount - Monto
 * @param {boolean} compact - Si true, usa formato compacto (1,2M)
 * @returns {string} - Ej: $1.234.567,00 o $1,2M
 */
function formatCurrency(amount, compact) {
  if (amount == null || isNaN(amount)) return "—";
  if (compact && Math.abs(amount) >= 1000000) {
    var millions = amount / 1000000;
    return "$" + formatNumber(millions, 1) + "M";
  }
  return "$" + formatNumber(amount, 2);
}

/**
 * Formatea peso/tonelaje con 1 decimal.
 * @param {number} tons - Toneladas
 * @returns {string} - Ej: 1,8 t
 */
function formatWeight(tons) {
  if (tons == null || isNaN(tons)) return "—";
  return formatNumber(tons, 1) + " t";
}

/**
 * Formatea porcentaje.
 * @param {number} value - Valor entre 0 y 1 o entre 0 y 100
 * @param {boolean} isDecimal - Si el valor viene como decimal (0.45 = 45%)
 * @returns {string} - Ej: 45%
 */
function formatPercent(value, isDecimal) {
  if (value == null || isNaN(value)) return "—";
  var pct = isDecimal ? value * 100 : value;
  return formatNumber(pct, 0) + "%";
}

// ============================================================================
// FECHAS Y HORAS (es-AR, America/Argentina/Buenos_Aires)
// ============================================================================

var TZ = "America/Argentina/Buenos_Aires";

/**
 * Formatea fecha en formato corto.
 * @param {string|Date} date - Fecha ISO o Date object
 * @returns {string} - Ej: 04/11/2026
 */
function formatDate(date) {
  if (!date) return "—";
  try {
    var d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: TZ,
    });
  } catch (e) {
    return String(date).slice(0, 10);
  }
}

/**
 * Formatea fecha en formato largo.
 * @param {string|Date} date - Fecha ISO o Date object
 * @returns {string} - Ej: 4 de noviembre de 2026
 */
function formatDateLong(date) {
  if (!date) return "—";
  try {
    var d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    });
  } catch (e) {
    return String(date);
  }
}

/**
 * Formatea hora en formato 24h.
 * @param {string|Date} date - Fecha ISO o Date object
 * @returns {string} - Ej: 14:30
 */
function formatTime(date) {
  if (!date) return "—";
  try {
    var d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    });
  } catch (e) {
    return "—";
  }
}

/**
 * Formatea fecha y hora juntas.
 * @param {string|Date} date - Fecha ISO o Date object
 * @returns {string} - Ej: 04/11/2026 14:30
 */
function formatDateTime(date) {
  if (!date) return "—";
  return formatDate(date) + " " + formatTime(date);
}

/**
 * Formatea fecha relativa (hace X tiempo).
 * @param {string|Date} date - Fecha ISO o Date object
 * @returns {string} - Ej: hace 2 horas, hace 3 días
 */
function formatRelative(date) {
  if (!date) return "—";
  try {
    var d = typeof date === "string" ? new Date(date) : date;
    var now = new Date();
    var diff = now - d;
    var minutes = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "ahora";
    if (minutes < 60) return "hace " + minutes + " min";
    if (hours < 24) return "hace " + hours + " h";
    if (days < 7) return "hace " + days + " días";
    return formatDate(date);
  } catch (e) {
    return "—";
  }
}

// ============================================================================
// ESTADOS Y TRADUCCIONES
// ============================================================================

/**
 * Diccionario de estados en español.
 * Traduce enums del backend (inglés/snake_case) a labels legibles.
 */
var STATUS_DICT = {
  // Viajes
  "NOT_STARTED": "Sin iniciar",
  "not_started": "Sin iniciar",
  "pending": "Pendiente",
  "PENDING": "Pendiente",
  "confirmed": "Confirmado",
  "CONFIRMED": "Confirmado",
  "en_viaje": "En viaje",
  "en_curso": "En curso",
  "in_progress": "En curso",
  "IN_PROGRESS": "En curso",
  "running": "En curso",
  "RUNNING": "En curso",
  "completed": "Completado",
  "COMPLETED": "Completado",
  "delivered": "Entregado",
  "DELIVERED": "Entregado",
  "cancelled": "Cancelado",
  "CANCELLED": "Cancelado",
  "canceled": "Cancelado",
  
  // Incidencias
  "open": "Abierta",
  "OPEN": "Abierta",
  "in_review": "En revisión",
  "resolved": "Resuelta",
  "RESOLVED": "Resuelta",
  "closed": "Cerrada",
  "CLOSED": "Cerrada",
  
  // Marketing
  "draft": "Borrador",
  "DRAFT": "Borrador",
  "approved": "Aprobado",
  "APPROVED": "Aprobado",
  "active": "Activo",
  "ACTIVE": "Activo",
  "paused": "Pausado",
  "PAUSED": "Pausado",
  "expired": "Vencido",
  "EXPIRED": "Vencido",
  "published": "Publicado",
  "PUBLISHED": "Publicado",
  
  // Content types
  "article": "Artículo",
  "case_study": "Caso de estudio",
  "video": "Video",
  "infographic": "Infografía",
  
  // Agentes/Servicios
  "ready": "Listo",
  "READY": "Listo",
  "offline": "Desconectado",
  "OFFLINE": "Desconectado",
  "error": "Error",
  "ERROR": "Error",
  "awaiting_qr": "Esperando QR",
  "connected": "Conectado",
  "disconnected": "Desconectado",
  
  // Pagos
  "paid": "Pagado",
  "PAID": "Pagado",
  "unpaid": "Pendiente de pago",
  "UNPAID": "Pendiente de pago",
  "overdue": "Vencido",
  "OVERDUE": "Vencido",
};

/**
 * Traduce un estado a español.
 * @param {string} status - Estado en inglés o snake_case
 * @returns {string} - Estado en español
 */
function translateStatus(status) {
  if (!status) return "—";
  var normalized = String(status).trim();
  return STATUS_DICT[normalized] || normalized;
}

/**
 * Obtiene color para badge de estado.
 * @param {string} status - Estado
 * @returns {string} - Color CSS (emerald, blue, amber, rose, slate)
 */
function getStatusColor(status) {
  if (!status) return "slate";
  var s = String(status).toLowerCase();
  
  // Verde: completado, entregado, aprobado, activo, conectado
  if (/completed|delivered|approved|active|resolved|closed|paid|connected|ready/i.test(s)) {
    return "emerald";
  }
  // Azul: en curso, confirmado, publicado
  if (/progress|curso|viaje|confirmed|running|published/i.test(s)) {
    return "blue";
  }
  // Amarillo: pendiente, borrador, pausado, esperando
  if (/pending|draft|paused|awaiting|unpaid/i.test(s)) {
    return "amber";
  }
  // Rojo: cancelado, error, vencido, desconectado
  if (/cancel|error|expired|overdue|offline|disconnected/i.test(s)) {
    return "rose";
  }
  
  return "slate";
}

// ============================================================================
// HELPERS DE UI
// ============================================================================

/**
 * Escapa HTML para prevenir XSS.
 * @param {string} str - String a escapar
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Crea un badge de estado con color apropiado.
 * @param {string} status - Estado
 * @returns {string} - HTML del badge
 */
function statusBadge(status) {
  var label = translateStatus(status);
  var color = getStatusColor(status);
  
  var colors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };
  
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ' +
    (colors[color] || colors.slate) + '">' +
    escapeHtml(label) +
    '</span>';
}

/**
 * Crea un badge de "Dato demo" para números mock.
 * @returns {string} - HTML del badge
 */
function demoBadge() {
  return '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200" title="Número de demostración, no refleja datos reales">' +
    'DEMO' +
    '</span>';
}

// ============================================================================
// EXPORTS (para uso global en todos los *-live.js)
// ============================================================================

if (typeof window !== "undefined") {
  window.SOL_FORMAT = {
    // Números
    number: formatNumber,
    currency: formatCurrency,
    weight: formatWeight,
    percent: formatPercent,
    
    // Fechas
    date: formatDate,
    dateLong: formatDateLong,
    time: formatTime,
    dateTime: formatDateTime,
    relative: formatRelative,
    
    // Estados
    status: translateStatus,
    statusColor: getStatusColor,
    statusBadge: statusBadge,
    
    // UI
    escape: escapeHtml,
    demoBadge: demoBadge,
  };
}
