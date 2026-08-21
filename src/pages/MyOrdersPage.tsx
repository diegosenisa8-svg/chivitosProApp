import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useMenu } from '../context/MenuContext'
import { fetchMyOrders, type CustomerOrder } from '../lib/customerApi'
import { formatMoney } from '../lib/format'
import type { SelectedModifier } from '../types'

const ACTIVE = new Set(['pending', 'confirmed', 'preparing', 'ready', 'delivering'])

export function MyOrdersPage() {
  const navigate = useNavigate()
  const { menu } = useMenu()
  const { addLine, clear, showToast, setCheckout, setFulfillment } = useCart()
  const { customer, logout, getToken } = useCustomerAuth()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const list = await fetchMyOrders(getToken())
      setOrders(list)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    load()
    const id = window.setInterval(() => load().catch(() => {}), 10000)
    return () => window.clearInterval(id)
  }, [load])

  const active = useMemo(() => orders.filter((o) => ACTIVE.has(o.status)), [orders])
  const history = useMemo(() => orders.filter((o) => !ACTIVE.has(o.status)), [orders])

  function reorder(order: CustomerOrder) {
    const products = new Map(
      menu.categories.flatMap((c) => c.items.map((i) => [i.id, i] as const)),
    )
    const lines: Array<{
      itemId: string
      name: string
      unitPrice: number
      quantity: number
      notes: string
      modifiers: SelectedModifier[]
      sizeLabel?: string
    }> = []
    const skipped: string[] = []

    for (const item of order.items) {
      const product = products.get(item.productId)
      if (!product || product.available === false) {
        skipped.push(item.name)
        continue
      }
      const mods = Array.isArray(item.modifiers) ? (item.modifiers as SelectedModifier[]) : []
      lines.push({
        itemId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        notes: item.notes || '',
        modifiers: mods,
        sizeLabel: item.sizeLabel || undefined,
      })
    }

    if (!lines.length) {
      showToast('Ningún producto de ese pedido está disponible ahora')
      return
    }

    clear()
    lines.forEach((l) => addLine(l))
    setFulfillment(order.fulfillment === 'pickup' ? 'pickup' : 'delivery')
    setCheckout({
      name: customer?.name || order.customerName || '',
      phone: customer?.phone || order.phone || '',
      fulfillment: order.fulfillment === 'pickup' ? 'pickup' : 'delivery',
      address: order.address || '',
      payment: (order.payment as 'efectivo' | 'pos' | 'transferencia' | 'mercadopago') || 'efectivo',
      notes: order.notes || '',
      schedule: 'now',
      scheduleTime: '',
    })
    showToast(
      skipped.length
        ? `Pedido armado · ${skipped.length} ítem(s) no disponibles`
        : 'Pedido anterior cargado en el carrito',
    )
    navigate('/cart')
  }

  return (
    <div className="page orders-page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/menu')} aria-label="Menú">
          ‹
        </button>
        <h1 className="topbar-heading">Mis pedidos</h1>
        <button type="button" className="linkish" onClick={logout}>
          Salir
        </button>
      </header>

      <main className="orders-body">
        <p className="orders-hello">Hola, {customer?.name?.split(' ')[0] || 'cliente'}</p>
        {loading && <p className="empty">Cargando…</p>}
        {error && <p className="error-inline">{error}</p>}

        {active.length > 0 && (
          <section className="orders-section">
            <h2>En curso</h2>
            {active.map((o) => (
              <article key={o.id} className={`order-status-card status-${o.status}`}>
                <div className="order-status-top">
                  <strong>#{o.id.slice(0, 8).toUpperCase()}</strong>
                  <span className="order-status-pill">{o.statusLabel}</span>
                </div>
                <p className="order-status-msg">
                  Tu pedido está <strong>{o.statusLabel.toLowerCase()}</strong>
                  {o.status === 'delivering' ? ' 🛵' : ''}
                </p>
                <p className="order-status-meta">
                  {o.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'} · {formatMoney(o.total)}
                </p>
                <ul>
                  {o.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity}x {i.name}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        )}

        <section className="orders-section">
          <h2>Anteriores</h2>
          {history.length === 0 && !loading ? (
            <p className="empty">Todavía no tenés pedidos finalizados.</p>
          ) : (
            history.map((o) => (
              <article key={o.id} className="order-history-card">
                <div className="order-status-top">
                  <strong>#{o.id.slice(0, 8).toUpperCase()}</strong>
                  <span>{o.statusLabel}</span>
                </div>
                <p className="order-status-meta">
                  {new Date(o.createdAt).toLocaleString('es-UY')} · {formatMoney(o.total)}
                </p>
                <ul>
                  {o.items.slice(0, 4).map((i) => (
                    <li key={i.id}>
                      {i.quantity}x {i.name}
                    </li>
                  ))}
                  {o.items.length > 4 && <li>+{o.items.length - 4} más</li>}
                </ul>
                {o.status !== 'cancelled' && (
                  <button type="button" className="btn btn-primary" onClick={() => reorder(o)}>
                    Pedir de nuevo
                  </button>
                )}
              </article>
            ))
          )}
        </section>

        <button type="button" className="btn btn-ghost" onClick={() => navigate('/menu')}>
          Ir al menú
        </button>
      </main>
    </div>
  )
}
