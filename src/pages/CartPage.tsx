import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildWhatsAppMessage,
  cartLineTotal,
  useCart,
} from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { submitOrder } from '../lib/api'
import { formatMoney, formatPrice } from '../lib/format'

export function CartPage() {
  const navigate = useNavigate()
  const { lines, subtotal, removeLine } = useCart()
  const { menu } = useMenu()
  const r = menu.restaurant
  const [busy, setBusy] = useState(false)

  async function processOrder() {
    if (!lines.length || busy) return
    setBusy(true)
    try {
      await submitOrder(lines, r.currency)
    } catch {
      // Si la API falla, igual abrimos WhatsApp
    }

    const msg = buildWhatsAppMessage(r.name, lines, subtotal, r.currency)
    const url = `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
    setBusy(false)
  }

  return (
    <div className="page cart-page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">MI PEDIDO</h1>
        <span className="topbar-spacer" />
      </header>

      {lines.length === 0 ? (
        <div className="empty">
          <p>Tu pedido está vacío</p>
          <button type="button" className="linkish" onClick={() => navigate('/menu')}>
            Ver menú
          </button>
        </div>
      ) : (
        <main className="cart-body">
          <ul className="cart-lines">
            {lines.map((line) => (
              <li key={line.key} className="cart-line">
                <div className="cart-line-top">
                  <strong>
                    {line.quantity}x {line.name}
                  </strong>
                  <div className="cart-line-actions">
                    <span>{formatPrice(cartLineTotal(line))}</span>
                    <button type="button" onClick={() => removeLine(line.key)} aria-label="Quitar">
                      ×
                    </button>
                  </div>
                </div>
                {line.modifiers.map((m, idx) => (
                  <p key={`${m.optionId}-${idx}`} className="cart-mod">
                    {m.quantity > 1 ? `${m.quantity}x ` : ''}
                    {m.groupName}: {m.optionName}
                    {m.price > 0 ? ` +${formatPrice(m.price * m.quantity)}` : ''}
                  </p>
                ))}
                {line.notes && <p className="cart-mod">Nota: {line.notes}</p>}
              </li>
            ))}
          </ul>

          <button type="button" className="coupon">
            CUPÓN DE DESCUENTO
          </button>

          <div className="totals">
            <div>
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, r.currency)}</span>
            </div>
            <div className="total-row">
              <span>Total</span>
              <strong>{formatMoney(subtotal, r.currency)}</strong>
            </div>
          </div>
        </main>
      )}

      {lines.length > 0 && (
        <div className="bottom-cta">
          <div className="cta-total">
            <span>TOTAL</span>
            <strong>{formatMoney(subtotal, r.currency)}</strong>
          </div>
          <button type="button" className="cta-action" onClick={processOrder} disabled={busy}>
            {busy ? 'Procesando…' : 'Procesar Pedido'}
          </button>
        </div>
      )}
    </div>
  )
}
