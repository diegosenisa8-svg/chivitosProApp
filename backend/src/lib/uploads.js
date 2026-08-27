import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

/** Directorio persistente de imágenes (montar volume en Railway: UPLOAD_DIR=/app/uploads). */
export function getUploadDir() {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function uploadPublicPath(filename) {
  return `/uploads/${filename}`
}
