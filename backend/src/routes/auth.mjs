import {
  authCookieName,
  signSessionToken,
  verifyPassword,
} from "../../../lib/auth.mjs";
import {
  getUserById,
  getUserByUsername,
  listUsers,
  createUser,
  updateUser,
  toPublicUser,
} from "../db/users-store.mjs";
import { adminOnly } from "../plugins/auth-guard.mjs";

export default async function authRoutes(fastify) {
  fastify.post("/login", async (request, reply) => {
    const { username, password } = request.body ?? {};
    const user = username ? await getUserByUsername(username) : null;

    if (!user || user.activo === false || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: "Usuario o contraseña incorrectos" });
    }

    const session = toPublicUser(user);
    const token = await signSessionToken(session);

    return {
      ok: true,
      token,
      user: session,
      cookie_name: authCookieName(),
    };
  });

  fastify.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "No autenticado" });
    }
    const row = await getUserById(request.user.id);
    if (!row || row.activo === false) {
      return reply.code(401).send({ error: "Usuario inactivo o inexistente" });
    }
    return { user: toPublicUser(row) };
  });

  fastify.post("/logout", async () => ({ ok: true }));

  fastify.get("/users", { preHandler: adminOnly }, async () => {
    return { users: await listUsers() };
  });

  fastify.post("/users", { preHandler: adminOnly }, async (request, reply) => {
    const { username, password, nombre, rol } = request.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: "username y password requeridos" });
    }
    try {
      const user = await createUser({ username, password, nombre, rol });
      return reply.code(201).send({ user });
    } catch (err) {
      return reply.code(400).send({ error: err.message || "No se pudo crear usuario" });
    }
  });

  fastify.patch("/users/:id", { preHandler: adminOnly }, async (request, reply) => {
    const { rol, nombre, activo } = request.body ?? {};
    try {
      const user = await updateUser(request.params.id, { rol, nombre, activo });
      return { user };
    } catch (err) {
      return reply.code(400).send({ error: err.message || "No se pudo actualizar usuario" });
    }
  });
}
