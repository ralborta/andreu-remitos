/**
 * SOL Modal System - Shared confirmation dialogs
 * Usado para confirmaciones críticas: Cobrar, Conciliar, Recordatorios WhatsApp
 */

(function () {
  var activeModal = null;

  /**
   * Show confirmation modal
   * @param {Object} options - {title, message, confirmText, cancelText, confirmClass, onConfirm, onCancel}
   * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
   */
  function showConfirm(options) {
    return new Promise(function (resolve) {
      closeModal();

      var title = options.title || "Confirmar acción";
      var message = options.message || "¿Estás seguro?";
      var confirmText = options.confirmText || "Confirmar";
      var cancelText = options.cancelText || "Cancelar";
      var confirmClass = options.confirmClass || "bg-slate-900 text-white hover:bg-slate-800";

      var overlay = document.createElement("div");
      overlay.className = "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4";
      overlay.setAttribute("data-sol-modal", "1");

      var modal = document.createElement("div");
      modal.className = "bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden";

      modal.innerHTML =
        '<div class="px-6 py-4 border-b border-slate-200">' +
        '<h3 class="text-lg font-bold text-slate-900">' +
        escapeHtml(title) +
        "</h3>" +
        "</div>" +
        '<div class="px-6 py-4">' +
        '<p class="text-sm text-slate-700 leading-relaxed">' +
        escapeHtml(message) +
        "</p>" +
        "</div>" +
        '<div class="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">' +
        '<button type="button" data-action="cancel" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">' +
        escapeHtml(cancelText) +
        "</button>" +
        '<button type="button" data-action="confirm" class="px-4 py-2 rounded-lg text-sm font-semibold transition ' +
        confirmClass +
        '">' +
        escapeHtml(confirmText) +
        "</button>" +
        "</div>";

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      activeModal = overlay;

      var confirmBtn = modal.querySelector('[data-action="confirm"]');
      var cancelBtn = modal.querySelector('[data-action="cancel"]');

      function handleConfirm() {
        closeModal();
        if (options.onConfirm) options.onConfirm();
        resolve(true);
      }

      function handleCancel() {
        closeModal();
        if (options.onCancel) options.onCancel();
        resolve(false);
      }

      confirmBtn.addEventListener("click", handleConfirm);
      cancelBtn.addEventListener("click", handleCancel);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) handleCancel();
      });

      document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
          handleCancel();
          document.removeEventListener("keydown", escHandler);
        }
      });

      setTimeout(function () {
        confirmBtn.focus();
      }, 100);
    });
  }

  /**
   * Show alert modal (info only, single OK button)
   */
  function showAlert(options) {
    return new Promise(function (resolve) {
      closeModal();

      var title = options.title || "Información";
      var message = options.message || "";

      var overlay = document.createElement("div");
      overlay.className = "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4";
      overlay.setAttribute("data-sol-modal", "1");

      var modal = document.createElement("div");
      modal.className = "bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden";

      modal.innerHTML =
        '<div class="px-6 py-4 border-b border-slate-200">' +
        '<h3 class="text-lg font-bold text-slate-900">' +
        escapeHtml(title) +
        "</h3>" +
        "</div>" +
        '<div class="px-6 py-4">' +
        '<p class="text-sm text-slate-700 leading-relaxed">' +
        escapeHtml(message) +
        "</p>" +
        "</div>" +
        '<div class="px-6 py-4 bg-slate-50 flex items-center justify-end">' +
        '<button type="button" data-action="ok" class="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition">' +
        "Entendido" +
        "</button>" +
        "</div>";

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      activeModal = overlay;

      var okBtn = modal.querySelector('[data-action="ok"]');

      function handleOk() {
        closeModal();
        if (options.onOk) options.onOk();
        resolve(true);
      }

      okBtn.addEventListener("click", handleOk);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) handleOk();
      });

      setTimeout(function () {
        okBtn.focus();
      }, 100);
    });
  }

  function closeModal() {
    if (activeModal) {
      activeModal.remove();
      activeModal = null;
    }
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (typeof window !== "undefined") {
    window.SOL_MODAL = {
      confirm: showConfirm,
      alert: showAlert,
      close: closeModal,
    };
  }
})();
