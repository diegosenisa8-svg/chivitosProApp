import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMenu } from '../context/MenuContext'
import { formatMoney } from '../lib/format'

type Order = {
  id: string
  total: number
  status: string
  createdAt: string
  customerName?: string
  items?: { name: string; quantity: number }[]
}

const PIN = 'chivitos'
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function AdminPage() {
  const navigate = useNavigate()
  const { menu, setOpenOverride } = useMenu()
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('chivitos-admin') === '1')
  const [pin, setPin] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authed || !apiBase) return
    ;(async () => {
      try {
        const res = await fetch(`${apiBase}/api/orders`)
        if (!res.ok) throw new Error('No se pudieron cargar pedidos')
        setOrders(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      }
    })()
  }, [authed])

  if (!authed) {
    return (
      <div className="page admin-page">
        <main className="admin-login">
          <h1>Admin ChivitosPro</h1>
          <p>Ingresá el PIN del local</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (pin === PIN) {
                sessionStorage.setItem('chivitos-admin', '1')
                setAuthed(true)
              } else setError('PIN incorrecto')
            }}
          >
            Entrar
          </button>
          {error && <em>{error}</em>}
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
            Volver
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="page admin-page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">Administración</h1>
        <span className="topbar-spacer" />
      </header>

      <main className="admin-body">
        <section className="admin-card">
          <h2>Local</h2>
          <p>
            Estado actual:{' '}
            <strong className={menu.restaurant.open ? 'ok' : 'bad'}>
              {menu.restaurant.open ? 'ABIERTO' : 'CERRADO'}
            </strong>
          </p>
          <div className="admin-actions">
            <button type="button" className="btn btn-primary" onClick={() => setOpenOverride(true)}>
              Abrir local
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpenOverride(false)}>
              Cerrar local
            </button>
          </div>
          <p className="hint">Horario referencia: {menu.restaurant.hoursLabel}</p>
        </section>

        <section className="admin-card">
          <h2>Menú rápido</h2>
          <p>
            {menu.categories.length} categorías ·{' '}
            {menu.categories.reduce((s, c) => s + c.items.length, 0)} productos
          </p>
          <ul className="admin-cats">
            {menu.categories.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <strong>{c.items.length}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-card">
          <h2>Pedidos recientes</h2>
          {!apiBase && <p className="hint">Configurá VITE_API_URL para ver pedidos de la base.</p>}
          {error && <em>{error}</em>}
          {orders.length === 0 ? (
            <p className="hint">Sin pedidos todavía</p>
          ) : (
            <ul className="admin-orders">
              {orders.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.customerName || 'Cliente'}</strong>
                    <span>{new Date(o.createdAt).toLocaleString('es-UY')}</span>
                  </div>
                  <div>
                    <span className="chip">{o.status}</span>
                    <strong>{formatMoney(o.total)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
