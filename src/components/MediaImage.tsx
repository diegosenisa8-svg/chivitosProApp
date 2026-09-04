import { useState, type ImgHTMLAttributes } from 'react'
import { mediaUrl } from '../lib/apiBase'

type MediaImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null
  fallback?: string
  /** Iniciales / texto suave si falla la imagen y el fallback */
  placeholderLabel?: string
}

export function MediaImage({
  src,
  fallback = '/logo.png',
  placeholderLabel,
  className,
  alt,
  onError,
  ...props
}: MediaImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    const label = (placeholderLabel || alt || '?').trim().slice(0, 2).toUpperCase() || '?'
    return (
      <span
        className={`media-placeholder${className ? ` ${className}` : ''}`}
        role="img"
        aria-label={alt || 'Sin imagen'}
      >
        {label}
      </span>
    )
  }

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      src={mediaUrl(src)}
      onError={(e) => {
        const img = e.currentTarget
        if (fallback && img.dataset.fb !== '1') {
          img.dataset.fb = '1'
          img.src = fallback
        } else {
          setFailed(true)
        }
        onError?.(e)
      }}
    />
  )
}
