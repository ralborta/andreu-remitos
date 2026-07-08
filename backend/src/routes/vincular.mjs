import { fetchBaileysWhatsappQr } from "../services/baileys-qr.mjs";

function vincularBotUrl() {
  return (
    process.env.VINCULAR_BAILEYS_BOT_URL?.trim().replace(/\/$/, "") ||
    process.env.BAILEYS_BOT_URL?.trim().replace(/\/$/, "") ||
    ""
  );
}

export default async function vincularRoutes(fastify) {
  /** Público — pantalla vincular.nivel41.com */
  fastify.get("/whatsapp/qr", async () => {
    return fetchBaileysWhatsappQr(vincularBotUrl());
  });
}
