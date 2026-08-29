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

export async function saveMediaBuffer({ buffer, originalName, mimeType }) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg'
  const safeExt = ext.match(/^\.(jpe?g|png|webp|gif)$/) ? ext : '.jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`
  const row = await prisma.mediaFile.create({
    data: {
      filename,
      mimeType: mimeType || 'image/jpeg',
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
