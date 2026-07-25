# AUDIT — ChivitosPro

**Fecha:** 2026-07-25  
**Repo:** `chivitosProApp`  
**Fuente:** código actual + contraste con auditoría FEBROS (PDF) y prompt Cursor  

> Fase 0 hecha. Mejoras del PDF aplicadas (excepto WhatsApp real). Ver commit / working tree actual.

---

## 1. Stack confirmado

| Capa | Tecnología | Evidencia |
|------|------------|-----------|
| Front | Vite 8 + React 19 + TypeScript | `package.json` |
| Router | react-router-dom v7 | `src/App.tsx` |
| PWA | vite-plugin-pwa + workbox | `vite.config.ts`, `src/main.tsx` |
| Back | Express 5 (Node ≥20) | `backend/src/index.js` |
| ORM / DB | Prisma 6 + PostgreSQL | `backend/prisma/schema.prisma` |
| Deploy front | Cloudflare Pages | `wrangler.toml`, `README.md` |
| Deploy back | Railway (Nixpacks; Dockerfile opcional) | `backend/railway.toml` |

---

## 2. Rutas del front

| Ruta | Pantalla |
|------|----------|
| `/` | Home (mapa + card local) |
| `/menu` | Menú por categorías (accordion) |
| `/product/:id` | Detalle + modifiers + cantidad |
| `/cart` | Carrito → WhatsApp |
| `*` | Redirect a `/` |

**No hay** `/admin`, `/checkout` ni rutas de seguimiento.

SPA: `public/_redirects` → `/* /index.html 200`.

---

## 3. Carrito

- Context en memoria: `src/context/CartContext.tsx`
- **Sin persistencia** (se pierde al recargar)
- API: `addLine`, `removeLine`, `clear`, `showToast`

---

## 4. Origen del menú

1. Fallback embebido: `src/data/menu.json`
2. Si hay `VITE_API_URL` → `GET /api/menu` (Postgres vía Prisma)
3. Seed: `backend/data/menu.json` → DB (`backend/prisma/seed.js`)

---

## 5. WhatsApp

| Campo | Valor |
|-------|--------|
| Número | **`59899000000`** (placeholder) |
| Dónde | `src/data/menu.json`, `backend/data/menu.json` → DB → API |
| Uso | `CartPage` abre `https://wa.me/${whatsapp}?text=...` |

**No** está en variable de entorno. En producción el pedido no llega a nadie.

---

## 6. Deploy

### Railway (`backend/railway.toml`)
```
startCommand = "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"
```
- Existe `GET /health`
- **No** hay `healthcheckPath` en `railway.toml`
- `GET /` de la API **no existe** → 404 si abrís la raíz del servicio (esperado)
- Un 404 de plataforma Railway suele ser: root directory mal (`backend`), build fallido, o servicio no levantado

### Cloudflare
- Build: `npm run build` → `dist`
- Env: `VITE_API_URL` = URL Railway

---

## 7. Endpoints backend

| Método | Path | Auth |
|--------|------|------|
| GET | `/health` | No |
| GET | `/api/menu` | No |
| POST | `/api/orders` | No |
| GET | `/api/orders` | No (lista cruda, sin UI) |

Hay persistencia de pedidos en DB, pero el flujo de producto sigue siendo WhatsApp. Errores de `POST /api/orders` se ignoran y se abre WA igual.

**Sin panel admin.**

---

## 8. Veredicto vs problemas del PDF

| Problema PDF | Código actual | Notas |
|--------------|---------------|-------|
| Deploy Railway 404 | Plausible / a diagnosticar en prod | Falta healthcheck en Railway; `/` API = 404 |
| WhatsApp placeholder | **Confirmado** | `59899000000` |
| Sin checkout real | **Confirmado** | No pide nombre/tel/delivery/dirección/horario/pago |
| Sin panel admin | **Confirmado** | Catch-all manda todo a home |
| Imágenes cruzadas | **Confirmado** | ~32 URLs para 88 productos (round-robin) |
| Sin toast al agregar | **Desactualizado** | Hay toast al volver a `/menu` (texto EN: “Items added to cart.”) |
| Sin selector tamaño | **Confirmado** | `priceMax` solo se muestra; siempre cobra `price` |
| Menú sin buscador / tabs sticky | **Confirmado** | Accordion; Bebidas primero |
| Banner mismatch Bebidas | **Confirmado** | Varias categorías usan `/hero.png` |
| Info `(i)` sin función | **Confirmado** | Sin `onClick` |
| Título “CHIVITO…” | **Confirmado** | `.slice(0, 7)` intencional |
| Cupón fake | **Confirmado** | Botón sin lógica |
| Sin stepper en carrito | **Confirmado** | Solo `×` para quitar |
| Delivery/Retiro decorativo | **Confirmado** | Íconos sin selección |
| ABIERTO estático | **Confirmado** | Flag booleano, sin horarios |

---

## 9. Lo que ya funciona bien

- Flujo corto mobile: home → menú → producto → carrito → WhatsApp
- Categorías + modifiers (guarnición / dips / refrescos) en varios productos
- Validación de grupos obligatorios en detalle
- PWA configurada (manifest + SW)
- Backend + seed listos para Railway cuando el deploy esté estable
- Fallback de menú si la API cae

---

## 10. Plan propuesto (impacto / esfuerzo)

### Fase 1 — Quick wins (días) · P0
1. Estabilizar Railway: healthcheck path `/health`, logs, CORS, doc de root `backend`
2. WhatsApp por env (`WHATSAPP_NUMBER` / config) — **número real: pedir a Diego**
3. Toast ES + feedback más visible al agregar
4. Corregir imágenes de bebidas + normalizar nombres + `$` en listado
5. Selector de tamaño cuando hay `priceMax`
6. Stepper de cantidad en carrito
7. Selector Delivery / Retiro funcional (al menos en checkout/WhatsApp)
8. Título completo + modal info `(i)`

### Fase 2 — Salto de valor (semanas) · P1
1. Design system + rebranding food-first (+ dark mode)
2. Buscador + tabs sticky + reordenar (Chivitos/Hamburguesas primero)
3. Checkout estructurado (nombre, tel, entrega, dirección, horario) + guardar orden + WA
4. Panel admin (menú, stock, horarios, pedidos)
5. Upsell + cupones reales
6. Personalización más rica (quitar ingredientes / punto)

### Fase 3 — Liderazgo · P2
Mercado Pago, cuentas/historial, fidelidad, KDS, push, reseñas, analítica.

---

## 11. Decisiones que necesito de vos

1. **¿Número de WhatsApp real del local?** (bloquea P0)
2. **¿URL actual de Railway / Cloudflare** para diagnosticar el 404?
3. **¿Seguimos con WhatsApp como canal principal** (checkout A/B del prompt) o priorizamos admin+MP ya?
4. Confirmación para arrancar: **“OK Fase 1”** o **“dale todo”**

---

## 12. Definition of Done (resumen del prompt)

App apetitosa mobile-first · checkout con datos · WA configurable · admin · fotos correctas · deploy estable · PWA · sin romper lo que ya anda · commits chicos.
