/**
 * Store POD — capa de compatibilidad sobre evidencias (type=POD).
 * @deprecated Preferir evidence-store.mjs para código nuevo.
 */
import {
  listEvidence,
  getEvidence,
  getEvidenceDialogByTelefono,
  createEvidence,
  updateEvidence,
  decideEvidence,
  resumenEvidence,
} from "./evidence-store.mjs";

export async function listPods(opts = {}) {
  return listEvidence({ ...opts, type: "POD" });
}

export async function getPod(idOrCodigo) {
  const row = getEvidence(idOrCodigo);
  if (!row || (row.type && row.type !== "POD")) return null;
  return row;
}

export async function getPodPendientePorTelefono(telefono) {
  return getEvidenceDialogByTelefono(telefono, { type: "POD" });
}

export async function crearPod(body = {}) {
  return createEvidence({ ...body, type: "POD" });
}

export async function actualizarPod(id, patch = {}) {
  return updateEvidence(id, patch);
}

export async function decidirPod(id, opts = {}) {
  return decideEvidence(id, opts);
}

export async function resumenPods() {
  return resumenEvidence({ type: "POD" });
}
