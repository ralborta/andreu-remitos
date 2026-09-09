# Domino público: empliados.net/demo/{cliente}

La app genera links así:

- `https://empliados.net/demo/transportes-acme`
- `https://empliados.net/demo/public` (demo permanente)

`empliados.net` hoy es WordPress (Cloudflare). Para que `/demo/*` llegue a la app
sin romper el sitio, hace falta un **Worker** con route `empliados.net/demo*`.

## Pasos Cloudflare (2 minutos)

1. Workers & Pages → Create → Worker
2. Pegar el código de `empliados-demo-proxy.js`
3. Deploy
4. Settings → Triggers → Add route:
   - `empliados.net/demo*`
   - (opcional) `www.empliados.net/demo*`
5. Listo. Probar: https://empliados.net/demo/public

## Mientras tanto

Sigue funcionando:

- https://infra-demo-sol.wd75db.easypanel.host/demo/public
- https://sol.nivel41.com/demo/public (si el path /demo en Easypanel está activo)
