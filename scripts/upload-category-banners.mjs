/**
 * Sube banners de categoría al API admin (Postgres MediaFile).
 * Uso: node scripts/upload-category-banners.mjs [API_URL]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = (process.argv[2] || 'https://chivitosproapp-production.up.railway.app').replace(/\/$/, '')
const ASSETS =
  process.env.ASSETS_DIR ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-senis-OneDrive-Documentos-chivitosProApp/assets',
  )

/** categoryId → archivo en assets (match por substring del nombre) */
const MAP = [
  { id: 'pizza-muzzarella', match: '3a2291fd-5289' },
  { id: 'empanadas', match: 'fd8a00b7-906c' },
  { id: 'crea-tu-hamburguesa', match: '6ee969fc-5b47-4b3c-9e68-83185377db94-84fe91e8' },
  { id: 'hamburguesas', match: 'ed78465c-3924' },
  { id: 'chivitos-al-pan-y-al-plato', match: '6ee969fc-5b47-4b3c-9e68-83185377db94__1_' },
  { id: 'combo-kids', match: '68fd5423-e7e4' },
  { id: 'guarniciones', match: 'f467c352-a0e7' },
  { id: 'milanesas', match: 'f72b1e02-d765' },
  { id: 'chuleton', match: '46ef7325-5583-4e21-935b-a44b355723c2-e9ad7706' },
  { id: 'pollo-frito-american-style', match: 'b6d1914f-7132-4ff3-bfce-e49058c8a808-86c2d8f9' },
  { id: 'picada-para-2', match: '8731fe18-90e3' },
  { id: 'vegetarianos', match: 'edde371c-8f1f' },
  { id: 'sandwiches', match: '967c49b9-2355' },
  { id: 'ensaladas', match: 'ensaladas4419' },
  { id: 'helados-dely', match: 'helados_dely' },
  { id: 'refrescos', match: 'refrescos-21c19e' },
  { id: 'cervezas', match: 'cervezas-31594d' },
  { id: 'dr-lemon', match: 'dr._lemon' },
]

function findFile(match) {
  const files = fs.readdirSync(ASSETS)
  const hit = files.find((f) => f.includes(match) && /\.(png|jpe?g|webp)$/i.test(f))
  return hit ? path.join(ASSETS, hit) : null
}

async function login() {
  const attempts = [
    { email: 'admin@chivitospro.com', password: 'chivitos2026' },
    { email: 'empleado@chivitospro.com', password: 'empleado2026' },
  ]
  for (const a of attempts) {
    const res = await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.token) {
      console.log('Login OK', a.email)
      return data.token
    }
    console.log('Login fail', a.email, res.status)
  }
  throw new Error('No se pudo autenticar')
}

async function upload(token, filePath) {
  const buf = fs.readFileSync(filePath)
  const form = new FormData()
  const blob = new Blob([buf], { type: 'image/png' })
  form.append('file', blob, path.basename(filePath))
  const res = await fetch(`${API}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`upload ${res.status} ${JSON.stringify(data)}`)
  return data.url
}

async function patchCategory(token, id, banner) {
  const res = await fetch(`${API}/api/admin/categories/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ banner }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`patch ${id} ${res.status} ${JSON.stringify(data)}`)
  return data
}

async function main() {
  console.log('API', API)
  console.log('ASSETS', ASSETS)
  if (!fs.existsSync(ASSETS)) throw new Error('No existe carpeta assets')

  const token = await login()

  for (const row of MAP) {
    const file = findFile(row.match)
    if (!file) {
      console.log('SKIP (sin archivo)', row.id, row.match)
      continue
    }
    try {
      const url = await upload(token, file)
      await patchCategory(token, row.id, url)
      console.log('OK', row.id, '→', url, path.basename(file))
    } catch (e) {
      console.error('FAIL', row.id, e.message)
    }
  }

  const live = await fetch(`${API}/api/menu`).then((r) => r.json())
  console.log('\nBanners actuales:')
  for (const c of live.categories || []) {
    console.log(`- ${c.name}: ${c.banner}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
