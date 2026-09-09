/**
 * Cloudflare Worker — enruta empliados.net/demo/* → demo-sol (Easypanel)
 * sin tocar el WordPress del resto del dominio.
 *
 * Deploy (Cloudflare Dashboard → Workers → Create → pegar código):
 * 1. Crear Worker "empliados-demo-proxy"
 * 2. Triggers → Add route: empliados.net/demo*
 * 3. (opcional) también: www.empliados.net/demo*
 *
 * Origen de la app demo:
 *   https://infra-demo-sol.wd75db.easypanel.host
 */
const ORIGIN = "https://infra-demo-sol.wd75db.easypanel.host";

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/demo")) {
      return new Response("Not found", { status: 404 });
    }

    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(ORIGIN).host);
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    const res = await fetch(target, init);
    const out = new Headers(res.headers);
    out.set("x-empliados-demo-proxy", "1");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: out,
    });
  },
};
