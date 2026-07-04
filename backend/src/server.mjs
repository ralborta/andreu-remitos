import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import remitosRoutes from "./routes/remitos.mjs";
import webhooksRoutes from "./routes/webhooks.mjs";
import conversacionesRoutes from "./routes/conversaciones.mjs";
import parametrosRoutes from "./routes/parametros.mjs";
import planillasRoutes from "./routes/planillas.mjs";
import destinosRoutes from "./routes/destinos.mjs";
import authRoutes from "./routes/auth.mjs";
import monitorRoutes from "./routes/monitor.mjs";
import { registerAuthGuard } from "./plugins/auth-guard.mjs";
import { ensureSeedAdmin } from "./db/users-store.mjs";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, "../.env") });

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });

await registerAuthGuard(app);
await ensureSeedAdmin();

app.get("/health", async () => ({ ok: true, service: "andreu-api" }));

await app.register(authRoutes, { prefix: "/api/auth" });

await app.register(remitosRoutes, { prefix: "/api/remitos" });
await app.register(webhooksRoutes, { prefix: "/api/webhooks" });
await app.register(conversacionesRoutes, { prefix: "/api/conversaciones" });
await app.register(parametrosRoutes, { prefix: "/api/parametros" });
await app.register(planillasRoutes, { prefix: "/api/planillas" });
await app.register(destinosRoutes, { prefix: "/api/destinos" });
await app.register(monitorRoutes, { prefix: "/api/monitor" });

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
