import { createBot, createProvider, createFlow, addKeyword, EVENTS } from "@builderbot/bot";
import { JsonFileDB as Database } from "@builderbot/database-json";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { forwardToAndreu, mountFileRoutes } from "./andreu-api.js";
import { getSessionSnapshot, readQrPng } from "./whatsapp-session.js";

const PORT = Number(process.env.PORT ?? 3008);
const SESSION_NAME = process.env.BOT_SESSION_NAME?.trim() || "andreu";
const PUBLIC_BASE =
  process.env.BOT_PUBLIC_URL?.trim() || `http://127.0.0.1:${PORT}`;

const andreuHandler = async (ctx, { provider, fallBack }) => {
  try {
    await forwardToAndreu(ctx, provider, { publicBaseUrl: PUBLIC_BASE });
  } catch (err) {
    console.error("[andreu-bot] forward error:", err.message);
    return fallBack(
      "Hubo un problema al procesar tu mensaje. Probá de nuevo en unos segundos o contactá a tráfico.",
    );
  }
};

const andreuFlows = [
  EVENTS.WELCOME,
  EVENTS.MEDIA,
  EVENTS.VOICE_NOTE,
  EVENTS.LOCATION,
  EVENTS.ACTION,
].map((ev) => addKeyword(ev).addAction(andreuHandler));

const main = async () => {
  const adapterFlow = createFlow(andreuFlows);
  const adapterProvider = createProvider(Provider, {
    name: "andreu",
    version: [2, 3000, 1035824857],
    groupsIgnore: true,
  });
  const adapterDB = new Database({ filename: process.env.BOT_DB_PATH || "db.json" });

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  mountFileRoutes(adapterProvider.server);

  /** Envío desde la API Andreu (lib/builderbot-send.mjs) */
  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body ?? {};
      await bot.sendMessage(number, message || " ", { media: urlMedia ?? null });
      return res.end(JSON.stringify({ status: "ok" }));
    }),
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body ?? {};
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    }),
  );

  adapterProvider.server.get("/health", (_req, res) => {
    const snap = getSessionSnapshot(adapterProvider);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snap));
  });

  adapterProvider.server.get("/v1/whatsapp/status", (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getSessionSnapshot(adapterProvider)));
  });

  adapterProvider.server.get("/v1/whatsapp/qr", (_req, res) => {
    const buf = readQrPng();
    if (!buf?.length) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "QR no disponible aún" }));
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });

  /** Raíz — misma imagen QR (compat Easypanel / navegador directo) */
  adapterProvider.server.get("/", (_req, res) => {
    const buf = readQrPng();
    if (!buf?.length) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        "<html><body><p>QR no listo. Si WhatsApp está desconectado, esperá unos segundos y recargá.</p></body></html>",
      );
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });

  httpServer(PORT);
  console.log(`[andreu-bot] WhatsApp Baileys escuchando en :${PORT}`);
  console.log(`[andreu-bot] API Andreu → ${process.env.ANDREU_API_URL || "http://localhost:3001"}`);
};

main().catch((err) => {
  console.error("[andreu-bot] fatal:", err);
  process.exit(1);
});
