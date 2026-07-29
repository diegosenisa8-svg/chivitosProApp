# Deploy en Railway (Front + Back + Postgres)

Repo: `https://github.com/diegosenisa8-svg/chivitosProApp`

Vas a crear **3 cosas** en un mismo proyecto Railway:

1. **PostgreSQL** (plugin)
2. **API** (servicio GitHub, root `backend`)
3. **Web** (servicio GitHub, root `/`)

---

## A) Con la web de Railway (recomendado)

### 1. Proyecto + base

1. Entrá a [railway.app/new](https://railway.app/new)
2. **Deploy a GitHub repo** → elegí `diegosenisa8-svg/chivitosProApp`
3. Si te crea un servicio solo, no importa: lo vamos a configurar
4. **+ New** → **Database** → **PostgreSQL**

### 2. Servicio API (back)

1. **+ New** → **GitHub Repo** → mismo repo `chivitosProApp`
2. Nombre sugerido: `api`
3. Settings del servicio:
   - **Root Directory:** `backend`
   - **Watch Paths:** `backend/**`
4. Variables (`Variables`):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | un string largo random |
| `CORS_ORIGIN` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `ADMIN_EMAIL` | `admin@chivitospro.com` |
| `ADMIN_PASSWORD` | `chivitos2026` |
| `ADMIN_NAME` | `Admin ChivitosPro` |
| `GEMINI_API_KEY` | tu API key de Google AI Studio (asistente del chat) |

5. **Settings → Networking → Generate Domain**
6. Deploy (automático al conectar el repo)

Health: `https://TU-API.up.railway.app/health`

> Si el servicio Web todavía no existe, poné temporalmente `CORS_ORIGIN=*` y después cambiálo.

### 3. Servicio Web (front)

1. **+ New** → **GitHub Repo** → mismo repo
2. Nombre sugerido: `web`
3. Settings:
   - **Root Directory:** `/` (vacío / raíz)
   - Builder: Docker (usa `Dockerfile` de la raíz)
   - **Watch Paths:** `src/**`, `public/**`, `index.html`, `vite.config.ts`, `package.json`, `Dockerfile`
4. Variables:

| Variable | Valor |
|---|---|
| `API_URL` | `https://${{BackchivitosProApp.RAILWAY_PUBLIC_DOMAIN}}` (o el nombre de tu servicio API) |

> `API_URL` es **runtime**: el front hace proxy de `/api` → back. No hace falta `VITE_API_URL` en producción.

5. **Generate Domain**
6. Deploy

App: `https://TU-FRONT.up.railway.app`  
Admin: `https://TU-FRONT.up.railway.app/admin`

---

## B) Con Railway CLI (comandos)

### Instalar y login

```bash
npm i -g @railway/cli
railway login
```

### Crear / linkear proyecto

```bash
# Desde la carpeta del repo
cd chivitosProApp

# Crear proyecto nuevo o linkear uno existente
railway init
# → Create a new project  (o link)
```

### Agregar Postgres

```bash
railway add --database postgres
```

### Crear servicios y linkear el repo en el dashboard

La forma estable de “seleccionar el repo” es en el dashboard:

1. Abrí el proyecto: `railway open`
2. Creá dos servicios desde GitHub (mismo repo):
   - `api` → Root Directory `backend`
   - `web` → Root Directory `/`
3. Generá dominio en cada uno

### Setear variables por CLI

```bash
# Listá servicios
railway service

# --- API ---
railway service link api
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'
railway variables set JWT_SECRET='cambia-este-secreto-largo'
railway variables set CORS_ORIGIN='https://${{web.RAILWAY_PUBLIC_DOMAIN}}'
railway variables set ADMIN_EMAIL='admin@chivitospro.com'
railway variables set ADMIN_PASSWORD='chivitos2026'
railway variables set ADMIN_NAME='Admin ChivitosPro'

# --- WEB ---
railway service link web
railway variables set VITE_API_URL='https://${{api.RAILWAY_PUBLIC_DOMAIN}}'
```

> En algunos planes/UI conviene pegar las referencias `${{...}}` desde el panel Variables → **Add Reference**.

### Redeploy

```bash
# Redeploy API
railway service link api
railway up --detach

# Redeploy Web (desde la raíz del monorepo)
railway service link web
railway up --detach
```

O desde GitHub: cualquier push a `main` redeploya si el servicio está conectado al repo.

### Ver logs / abrir

```bash
railway logs
railway open
railway domain
```

---

## Checklist rápido

1. Postgres healthy  
2. API `/health` → `{"ok":true,...}`  
3. Web abre el menú  
4. `/admin` login `admin@chivitospro.com` / `chivitos2026`  
5. `CORS_ORIGIN` apunta al dominio del Web  
6. `VITE_API_URL` apunta al dominio de la API (sin `/` final)

---

## Notas

- El start de la API corre `prisma migrate deploy` + seed (admin + menú si está vacío).
- El Web sirve `dist` con `serve -s` (SPA OK).
- No hace falta Cloudflare Pages si usás Railway para el front.
- Las imágenes subidas van a `/uploads` en el disco del API. Sin un **Volume** en Railway se pierden al redeploy; montá un volume en `/app/uploads` (o la ruta del contenedor) si querés persistencia.
