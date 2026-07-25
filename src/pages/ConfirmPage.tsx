import { useLocation, useNavigate } from 'react-router-dom'
import { formatMoney } from '../lib/format'

export function ConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as { total?: number; eta?: string }

  return (
    <div className="page confirm-page">
      <main className="confirm-card">
        <div className="confirm-check">✓</div>
        <h1>¡Pedido confirmado!</h1>
        <p>Ya armamos tu pedido. Si se abrió WhatsApp, enviá el mensaje para que el local lo reciba.</p>
        {state.total != null && (
          <p className="confirm-total">
            Total <strong>{formatMoney(state.total)}</strong>
          </p>
        )}
        {state.eta && <p className="confirm-eta">Tiempo estimado {state.eta} min</p>}
        <button type="button" className="btn btn-primary" onClick={() => navigate('/menu')}>
          Seguir mirando el menú
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </main>
    </div>
  )
}
