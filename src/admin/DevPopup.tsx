type Props = {
  open: boolean
  title?: string
  onClose: () => void
}

export function DevPopup({ open, title = 'Sección en desarrollo', onClose }: Props) {
  if (!open) return null
  return (
    <div className="dev-popup-overlay" role="dialog" aria-modal="true">
      <div className="dev-popup">
        <h3>{title}</h3>
        <p>
          Ambiente de desarrollo, sección se mostrará al pasar a producción.
        </p>
        <button type="button" className="admin-btn primary" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  )
}
