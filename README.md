# ChivitosPro PWA

App de pedidos estilo delivery para **ChivitosPro** (Salto, Uruguay).

- **Front:** Vite + React + PWA → Railway (servicio `web`)
- **Back:** Express + Prisma → Railway (servicio `api`)
- **DB:** PostgreSQL → Railway (plugin aparte)

Guía completa de deploy: [`docs/RAILWAY.md`](docs/RAILWAY.md)

## Local

```bash
# Front
npm install
npm run dev

# Back (otra terminal)
cd backend
cp .env.example .env   # ajustar DATABASE_URL
npm install
npm run db:local       # opcional: Postgres embebido en :5433
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Front con API local:

```bash
# en la raíz
echo VITE_API_URL=http://localhost:8080 > .env
npm run dev
```

Sin `VITE_API_URL`, en local Vite hace proxy de `/api` → `8080`.

---

## Deploy Railway (3 servicios)

Repo: `https://github.com/diegosenisa8-svg/chivitosProApp`

### Comandos CLI

```bash
npm i -g @railway/cli
railway login
cd chivitosProApp
railway init          # crear o linkear proyecto
railway add --database postgres
railway open          # abrir dashboard
```

En el dashboard (mismo repo dos veces):

| Servicio | Root Directory | Variables clave |
|---|---|---|
| **Postgres** | — | (plugin) |
| **api** | `backend` | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET`, `CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| **web** | `/` | `VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |

Generate Domain en `api` y `web`.

### Panel admin

- URL: `/admin`
- Login: `admin@chivitospro.com` / `chivitos2026`

Detalle paso a paso: **[docs/RAILWAY.md](docs/RAILWAY.md)**

---

## Checklist post-deploy

1. Postgres ✅  
2. API `/health` ✅  
3. Web con menú ✅  
4. Admin login ✅  
5. Pedido de prueba ✅  
