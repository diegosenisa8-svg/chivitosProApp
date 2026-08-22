import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { cartLineTotal, useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { mediaUrl } from '../lib/apiBase'
import { formatMoney, formatPrice } from '../lib/format'
import { getFeaturedItems } from '../lib/menuUtils'

export function CartPage() {
  const navigate = useNavigate()
  const {
    lines,
    subtotal,
    removeLine,
    setQuantity,
    discount,
    deliveryFee,
    fulfillment,
    coupon,
    applyCoupon,
  } = useCart()
  const { menu } = useMenu()
  const [code, setCode] = useState(coupon)

  const total = Math.max(0, subtotal - discount + deliveryFee)
  const upsell = useMemo(
    () =>
      getFeaturedItems(menu, 10)
        .filter((i) => !lines.some((l) => l.itemId === i.id))
        .filter((i) => /bebida|coca|fanta|sprite|papas|postre|helado/i.test(i.name + i.id) || i.badge)
        .slice(0, 3),
    [menu, lines],
  )

  return (
    <div className="page cart-page">
      <Toast />
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">Mi pedido</h1>
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
                  <div>
                    <strong>{line.name}</strong>
                    {line.sizeLabel && <p className="cart-mod">{line.sizeLabel}</p>}
                  </div>
                  <button type="button" onClick={() => removeLine(line.key)} aria-label="Quitar">
                    ×
                  </button>
                </div>
                {line.modifiers.map((m, idx) => (
                  <p key={`${m.optionId}-${idx}`} className="cart-mod">
                    {m.quantity > 1 ? `${m.quantity}x ` : ''}
                    {m.groupName}: {m.optionName}
                    {m.price > 0 ? ` +${formatPrice(m.price * m.quantity)}` : ''}
                  </p>
                ))}
                {line.notes && <p className="cart-mod">Nota: {line.notes}</p>}
                <div className="cart-line-bottom">
                  <div className="qty-controls sm">
                    <button type="button" onClick={() => setQuantity(line.key, line.quantity - 1)}>
                      −
                    </button>
                    <span className="qty-value">{line.quantity}</span>
                    <button type="button" onClick={() => setQuantity(line.key, line.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <strong>{formatPrice(cartLineTotal(line))}</strong>
                </div>
              </li>
            ))}
          </ul>

          {upsell.length > 0 && (
            <section className="upsell">
              <h2>¿Sumás algo más?</h2>
              <div className="upsell-row">
                {upsell.map((u) => (
                  <Link key={u.id} to={`/product/${u.id}`} className="upsell-card">
                    <img src={mediaUrl(u.image)} alt="" />
                    <span>{u.name}</span>
                    <strong>{formatPrice(u.price)}</strong>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="coupon-box">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Cupón de descuento"
              autoComplete="off"
            />
            <button type="button" className="btn btn-secondary" onClick={() => applyCoupon(code)}>
              Aplicar
            </button>
          </div>

          <div className="totals">
            <div>
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div>
                <span>Descuento ({coupon})</span>
                <span>-{formatMoney(discount)}</span>
              </div>
            )}
            <div>
              <span>{fulfillment === 'delivery' ? 'Envío' : 'Retiro'}</span>
              <span>{deliveryFee > 0 ? formatMoney(deliveryFee) : 'Gratis'}</span>
            </div>
            <div className="total-row">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <p className="eta-line">
              Tiempo estimado {menu.restaurant.etaMin}–{menu.restaurant.etaMax} min
            </p>
          </div>
        </main>
      )}

      {lines.length > 0 && (
        <div className="bottom-cta single">
          <button type="button" className="cta-action full" onClick={() => navigate('/checkout')}>
            Continuar · {formatMoney(total)}
          </button>
        </div>
      )}
    </div>
  )
}
