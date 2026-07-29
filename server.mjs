/**
 * Servidor de producción del front en Railway.
 * - Sirve el build SPA (dist)
 * - Proxy /api y /health → API_URL (servicio back)
 */
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3000)
const apiTarget = (process.env.API_URL || process.env.VITE_API_URL || '').replace(/\/$/, '')
const dist = path.join(__dirname, 'dist')

const app = express()

if (apiTarget) {
  console.log(`Proxy /api + /health → ${apiTarget}`)
  app.use(
    createProxyMiddleware({
      target: apiTarget,
      changeOrigin: true,
      xfwd: true,
      pathFilter: (pathname) =>
        pathname.startsWith('/api') || pathname === '/health' || pathname.startsWith('/uploads'),
    }),
  )
} else {
  console.warn('API_URL no definida: /api no tendrá proxy al backend')
}

app.use(express.static(dist, { index: false }))

// SPA fallback (Express 5: no usar '*')
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next(err)
  })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`ChivitosPro web on 0.0.0.0:${port}`)
})
