// monitor-status.js - Actualiza dinámicamente el pill/footer de "Monitor SOL Activo"
// Usado en todos los HTMLs de Stitch para mostrar el estado real del sistema

(function() {
  'use strict';

  // Configuración
  const POLL_INTERVAL = 30000; // 30 segundos
  const API_URL = '/backend/api/monitor/status';

  // Estado actual
  let currentStatus = null;

  /**
   * Determina el estado general del sistema
   */
  function determineOverallStatus(data) {
    if (!data) return { status: 'unknown', text: 'Estado desconocido', color: 'gray' };

    const waOk = data.services?.whatsapp?.ok ?? false;
    const apiOk = data.services?.api?.ok ?? true;
    const allOk = data.ok && waOk && apiOk;

    if (allOk) {
      return { status: 'ok', text: 'Monitor SOL Activo', color: 'emerald' };
    } else if (!waOk) {
      return { status: 'degraded', text: 'WhatsApp caído', color: 'rose' };
    } else {
      return { status: 'degraded', text: 'Servicios degradados', color: 'amber' };
    }
  }

  /**
   * Actualiza todos los elementos con el atributo data-sol-monitor-status
   */
  function updateStatusElements(statusInfo) {
    // Buscar todos los elementos con el atributo
    const elements = document.querySelectorAll('[data-sol-monitor-status]');
    
    elements.forEach(el => {
      // Actualizar texto
      const textEl = el.querySelector('span:not([class*="w-"])');
      if (textEl) {
        textEl.textContent = statusInfo.text;
      }

      // Actualizar color del punto
      const dotEl = el.querySelector('[class*="w-"]');
      if (dotEl && dotEl.tagName === 'SPAN') {
        // Remover clases de color antiguas
        dotEl.classList.remove('bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500');
        
        // Agregar clase de color nueva
        if (statusInfo.color === 'emerald') {
          dotEl.classList.add('bg-emerald-500');
        } else if (statusInfo.color === 'rose') {
          dotEl.classList.add('bg-rose-500');
        } else if (statusInfo.color === 'amber') {
          dotEl.classList.add('bg-amber-500');
        }

        // Agregar/remover animación si es error
        if (statusInfo.status !== 'ok') {
          dotEl.classList.add('animate-pulse');
        } else {
          dotEl.classList.remove('animate-pulse');
        }
      }
    });
  }

  /**
   * Obtiene el estado del sistema desde la API
   */
  async function fetchStatus() {
    try {
      const response = await fetch(API_URL, {
        cache: 'no-store',
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[monitor-status] API returned', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('[monitor-status] Error fetching status:', error.message);
      return null;
    }
  }

  /**
   * Actualiza el estado del sistema
   */
  async function updateStatus() {
    const data = await fetchStatus();
    const statusInfo = determineOverallStatus(data);
    
    currentStatus = statusInfo;
    updateStatusElements(statusInfo);
  }

  /**
   * Inicializa el monitoreo
   */
  function init() {
    // Primera actualización inmediata
    updateStatus();

    // Polling cada 30 segundos
    setInterval(updateStatus, POLL_INTERVAL);
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
