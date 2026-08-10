/** Config no secreta para el cliente (Maps, etc.). Requiere sesión. */
export default async function configRoutes(fastify) {
  fastify.get("/client", async () => ({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() || null,
    googleMapsEnabled: Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim()),
  }));
}
