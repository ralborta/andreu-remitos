/** Config no secreta para el cliente (Maps, etc.). Requiere sesión. */
export default async function configRoutes(fastify) {
  fastify.get("/client", async () => {
    // Preferir key de Maps JS (fleet); no pisar Geocoding/Places con la vieja sola.
    const googleMapsApiKey =
      process.env.GOOGLE_MAPS_JS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      null;
    return {
      googleMapsApiKey,
      googleMapsEnabled: Boolean(googleMapsApiKey),
    };
  });
}
