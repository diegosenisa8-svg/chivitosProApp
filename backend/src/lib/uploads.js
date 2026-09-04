import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { prisma } from './prisma.js'

/** Disco local opcional (dev / Volume Railway). Las subidas nuevas van a Postgres. */
export function getUploadDir() {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function mediaPublicPath(id) {
  return `/api/media/${id}`
}

/** @deprecated prefer mediaPublicPath — se mantiene por compat con archivos viejos en disco */
export function uploadPublicPath(filename) {
  return `/uploads/${filename}`
}

/** Detecta JPEG / PNG / WebP por magic bytes (no confiar solo en MIME del cliente). */
export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  // RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export async function saveMediaBuffer({ buffer, originalName, mimeType }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error('El archivo está vacío')
    err.code = 'EMPTY_FILE'
    throw err
  }
  const detected = detectImageMime(buffer)
  if (!detected) {
    const err = new Error('Solo se permiten imágenes JPEG, PNG o WebP')
    err.code = 'INVALID_IMAGE'
    throw err
  }

  const extFromMime =
    detected === 'image/png' ? '.png' : detected === 'image/webp' ? '.webp' : '.jpg'
  const ext = path.extname(originalName || '').toLowerCase()
  const safeExt = ext.match(/^\.(jpe?g|png|webp)$/) ? ext : extFromMime
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`
  const row = await prisma.mediaFile.create({
    data: {
      filename,
      mimeType: detected || mimeType || 'image/jpeg',
      size: buffer.length,
      data: buffer,
    },
  })
  return {
    id: row.id,
    url: mediaPublicPath(row.id),
    filename: row.filename,
    size: row.size,
  }
}

export async function getMediaById(id) {
  return prisma.mediaFile.findUnique({ where: { id } })
}
