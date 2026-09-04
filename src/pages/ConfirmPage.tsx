import { useLocation, useNavigate } from 'react-router-dom'
import { formatMoney } from '../lib/format'

export function ConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as {
    total?: number
    eta?: string
    test?: boolean
    orderId?: string
  }
  const shortId = state.orderId ? String(state.orderId).slice(0, 8).toUpperCase() : null

  return (
    <div className="page confirm-page">
      <main className="confirm-card">
        <div className="confirm-check">✓</div>
        <h1>¡Pedido confirmado!</h1>
        {shortId && (
          <p className="confirm-order-number" aria-label={`Número de pedido ${shortId}`}>
            Pedido <strong>#{shortId}</strong>
          </p>
        )}
        <p>
          {state.test
            ? 'Pedido de prueba registrado. Podés seguir el estado en Mis pedidos.'
            : 'Ya armamos tu pedido. Seguí el estado en Mis pedidos (aceptado, en camino, etc.).'}
        </p>
        {state.total != null && (
          <p className="confirm-total">
            Total <strong>{formatMoney(state.total)}</strong>
          </p>
        )}
        {state.eta && <p className="confirm-eta">Tiempo estimado {state.eta} min</p>}
        <button type="button" className="btn btn-primary" onClick={() => navigate('/mis-pedidos')}>
          Ver estado del pedido
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/menu')}>
          Seguir mirando el menú
        </button>
      </main>
    </div>
  )
}
