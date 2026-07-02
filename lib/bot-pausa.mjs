/**
 * Pausa manual del bot + reactivación automática tras inactividad.
 */

import { setBuilderBotBlacklist } from "./builderbot-send.mjs";
import * as convStore from "../backend/src/db/conversations-store.mjs";

export const BOT_PAUSA_INACTIVIDAD_MS = convStore.BOT_PAUSA_INACTIVIDAD_MS;
export const BOT_PAUSA_INACTIVIDAD_MIN = Math.round(BOT_PAUSA_INACTIVIDAD_MS / 60_000);

/** Revisa inactividad y, si corresponde, reactiva el bot y lo saca de blacklist. */
export async function syncBotPausa(telefono) {
  if (!telefono) return null;
  const { conv, reactivated } = await convStore.reactivarBotSiInactivo(telefono);
  if (reactivated) {
    try {
      await setBuilderBotBlacklist(telefono, "remove");
    } catch {
      /* BuilderBot opcional */
    }
  }
  return conv ?? (await convStore.getConversacion(telefono));
}

export async function isBotPausado(telefono) {
  const conv = await syncBotPausa(telefono);
  return !!conv?.bot_pausado;
}
