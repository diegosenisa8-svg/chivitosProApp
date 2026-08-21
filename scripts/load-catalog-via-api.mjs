/**
 * Carga el catálogo embebido (backend/data/menu.json) vía API admin.
 * Usa empleado si admin no autentica. Borra categorías/productos actuales y recrea.
 *
 * Uso:
 *   node scripts/load-catalog-via-api.mjs
 *   node scripts/load-catalog-via-api.mjs https://chivitosproapp-production.up.railway.app
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = (process.argv[2] || 'https://chivitosproapp-production.up.railway.app').replace(/\/$/, '')
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, '../backend/data/menu.json'), 'utf8'))

async function req(method, urlPath, token, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
  }
  return data
}

async function login() {
  const attempts = [
    { email: 'admin@chivitospro.com', password: 'chivitos2026' },
    { email: 'empleado@chivitospro.com', password: 'empleado2026' },
  ]
  for (const a of attempts) {
    try {
      const data = await req('POST', '/api/admin/login', null, a)
      console.log('Login OK:', data.admin?.email, data.admin?.role)
      return data.token
    } catch {
      console.log('Login fail:', a.email)
    }
  }
  throw new Error('No se pudo autenticar')
}

async function main() {
  console.log('API', API)
  const token = await login()

  // Prefer atomic replace if available
  try {
    const result = await req('POST', '/api/admin/menu/replace-catalog', token, {
      confirm: 'REEMPLAZAR',
    })
    console.log('replace-catalog OK', {
      categories: result.categories,
      products: result.products,
      source: result.source,
    })
    const live = await req('GET', '/api/menu', null)
    const n = live.categories.reduce((a, c) => a + (c.items?.length || 0), 0)
    console.log('Live menu:', live.categories.length, 'cats,', n, 'products')
    return
  } catch (e) {
    console.log('replace-catalog no disponible, fallback CRUD:', e.message)
  }

  const current = await req('GET', '/api/admin/menu', token)
  for (const cat of current.categories || []) {
    for (const item of cat.items || []) {
      await req('DELETE', `/api/admin/products/${item.id}`, token)
    }
  }
  for (const cat of current.categories || []) {
    await req('DELETE', `/api/admin/categories/${cat.id}`, token)
  }
  console.log('Wipe OK')

  let products = 0
  for (const cat of menu.categories) {
    await req('POST', '/api/admin/categories', token, {
      id: cat.id,
      name: cat.name,
      subtitle: cat.subtitle || '',
      banner: cat.banner || '/logo.png',
    })
    for (const item of cat.items || []) {
      await req('POST', '/api/admin/products', token, {
        id: item.id,
        categoryId: cat.id,
        name: item.name,
        description: item.description || '',
        price: item.price,
        priceMax: item.priceMax ?? null,
        image: item.image || '/logo.png',
        available: item.available !== false,
        featured: !!item.featured,
      })
      if (item.modifiers?.length) {
        await req('PUT', `/api/admin/products/${item.id}/modifiers`, token, {
          modifiers: item.modifiers,
        })
      }
      products += 1
    }
  }
  console.log('Loaded', menu.categories.length, 'categories,', products, 'products')
  const live = await req('GET', '/api/menu', null)
  const n = live.categories.reduce((a, c) => a + (c.items?.length || 0), 0)
  console.log('Verify live:', live.categories.length, 'cats,', n, 'products')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
