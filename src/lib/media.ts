/** Imágenes por defecto del catálogo — no son fotos subidas por el local. */
export function isPlaceholderImage(src?: string | null) {
  if (!src) return true
  return src === '/logo.png' || src === '/hero.png'
}

/** Imagen del rectángulo de categoría en el admin (solo banner, no mezcla con productos). */
export function categoryAdminThumb(banner?: string | null) {
  return isPlaceholderImage(banner) ? '/logo.png' : banner!
}

export function categoryDisplayImage(cat: { banner?: string; items?: { image?: string }[] }) {
  if (!isPlaceholderImage(cat.banner)) return cat.banner!
  const first = cat.items?.[0]?.image
  if (!isPlaceholderImage(first)) return first!
  return '/logo.png'
}
