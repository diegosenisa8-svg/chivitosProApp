# ChivitosPro PWA

App de pedidos estilo delivery para **ChivitosPro** (Salto, Uruguay).

- **Front:** Vite + React + PWA → Cloudflare Pages
- **Back:** Express + Prisma → Railway
- **DB:** PostgreSQL → Railway

## Local

```bash
# Front
npm install
npm run dev

# Back (otra terminal)
cd backend
cp .env.example .env   # ajustar DATABASE_URL
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Front con API:

```bash
# en la raíz
echo VITE_API_URL=http://localhost:8080 > .env
npm run dev
```

Sin `VITE_API_URL`, el front usa el menú estático embebido.

---

## Deploy Railway (DB + API)

1. Creá un proyecto en [Railway](https://railway.app).
2. **Add PostgreSQL**.
3. **New service** → Deploy from GitHub repo `senisabasso-svg/chivitosProApp`.
4. En el servicio API:
   - **Root Directory:** `backend`
   - Variables:
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia al Postgres del proyecto)
     - `PORT` = `8080` (Railway también inyecta `PORT`)
     - `CORS_ORIGIN` = `https://TU-DOMINIO.pages.dev` (y dominios custom si hay)
5. Deploy. El start corre migrate + seed + API.
6. Copiá la URL pública del servicio (ej. `https://chivitos-api.up.railway.app`).

Health check: `GET /health`  
Menú: `GET /api/menu`  
Pedidos: `POST /api/orders`  
Admin: `https://TU-FRONT/admin`

### Panel admin
- URL: `/admin`
- Login default: `admin@chivitospro.com` / `chivitos2026`
- Variables Railway recomendadas:
  - `JWT_SECRET`
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`
  - `CORS_ORIGIN` (debe incluir el dominio de Cloudflare Pages)

El admin permite:
- Dashboard (ventas, ticket, top productos, pedidos abiertos)
- Gestión de pedidos y cambio de estados
- Edición de productos (precio, descripción, imagen, stock, destacado)
- Config del local (abierto/cerrado, horarios, envío, mínimo)

Para reseedear el menú en Railway:

```bash
node prisma/seed.js --force
```

---

## Deploy Cloudflare Pages (Front)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → Connect GitHub.
2. Repo: `senisabasso-svg/chivitosProApp`
3. Build settings:
   - **Framework preset:** Vite
   - **Root directory:** `/` (raíz)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Environment variables (Production):
   - `VITE_API_URL` = `https://TU-API.up.railway.app` (sin slash final)
5. Deploy.

SPA routing ya está en `public/_redirects`.

---

## Checklist post-deploy

1. Railway Postgres ✅  
2. Railway API con `DATABASE_URL` + `CORS_ORIGIN` ✅  
3. Cloudflare Pages con `VITE_API_URL` apuntando a Railway ✅  
4. Probar `/api/menu` desde el browser  
5. Cuando tengas WhatsApp real, actualizar `whatsapp` en DB o en `src/data/menu.json` + `backend/data/menu.json` y reseedear
