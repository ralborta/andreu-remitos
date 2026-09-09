# SOL Demo Rooms — backoffice demo temporal (3 días) para prospectos

## Qué es
Salas demo únicas por cliente en Easypanel: imitación del backoffice SOL (mapa, rutas, 10 agentes, FAQ), 100% datos ficticios, link con vencimiento.

## Vendedor
1. Abrir `/admin`
2. Login con `DEMO_ADMIN_PASSWORD`
3. Crear room (empresa, contacto, foco, días)
4. Copiar link `/r/<token>` y enviarlo al cliente

## Cliente
- Entra al link → mesa demo con mapa/rutas, agentes, viajes, FAQ
- Al vencer → pantalla “Demo expirada”

## Env
- `DEMO_ADMIN_PASSWORD` — clave del panel vendedor
- `DEMO_PUBLIC_BASE_URL` — URL pública del servicio (para armar links copiables), ej. `https://infra-demo-sol.wd75db.easypanel.host`
- `DATA_DIR` — default `/app/data` (montar volumen)

## Local
```bash
cd demo-sol
npm install
DEMO_ADMIN_PASSWORD=demo DEMO_PUBLIC_BASE_URL=http://localhost:3010 npm run dev
```
