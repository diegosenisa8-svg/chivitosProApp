import type { ImgHTMLAttributes } from 'react'
import { mediaUrl } from '../lib/apiBase'

type MediaImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null
  fallback?: string
}

export function MediaImage({ src, fallback = '/logo.png', onError, ...props }: MediaImageProps) {
  return (
    <img
      {...props}
      src={mediaUrl(src)}
      onError={(e) => {
        const img = e.currentTarget
        if (!img.src.endsWith(fallback)) {
          img.src = fallback
        }
        onError?.(e)
      }}
    />
  )
}
