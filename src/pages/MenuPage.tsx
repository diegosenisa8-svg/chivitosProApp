import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { formatPrice } from '../lib/format'

export function MenuPage() {
  const navigate = useNavigate()
  const { count, toast } = useCart()
  const { menu } = useMenu()
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(menu.categories.map((c) => [c.id, true])),
  )

  const title = useMemo(() => menu.restaurant.name.toUpperCase().slice(0, 7), [menu.restaurant.name])

  return (
    <div className="page menu-page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ‹
        </button>
        <div className="topbar-title">
          <span>{title}…</span>
          <button type="button" className="info-btn" aria-label="Información">
            i
          </button>
        </div>
        <Link to="/cart" className="icon-btn cart-btn" aria-label="Carrito">
          <CartIcon />
          {count > 0 && <span className="cart-badge">{count}</span>}
        </Link>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="menu-list">
        {menu.categories.map((cat) => (
          <section key={cat.id} className="category" id={cat.id}>
            <button
              type="button"
              className="category-head"
              onClick={() => setOpen((s) => ({ ...s, [cat.id]: !s[cat.id] }))}
            >
              <div>
                <h2>{cat.name.toUpperCase()}</h2>
                {cat.subtitle && <p>{cat.subtitle}</p>}
              </div>
              <span className={`chev ${open[cat.id] ? 'down' : ''}`}>▾</span>
            </button>

            {open[cat.id] && (
              <>
                <div className="category-banner">
                  <img src={cat.banner} alt={cat.name} />
                </div>
                <ul className="item-list">
                  {cat.items.map((item) => (
                    <li key={item.id}>
                      <Link to={`/product/${item.id}`} className="item-row">
                        <img src={item.image} alt="" className="item-thumb" />
                        <div className="item-body">
                          <div className="item-line">
                            <h3>{item.name}</h3>
                            <strong>
                              {formatPrice(item.price)}
                              {item.priceMax != null && ` / ${formatPrice(item.priceMax)}`}
                            </strong>
                          </div>
                          {item.description && <p>{item.description}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M3 4h2l2.2 11h10.4l1.8-7H7" />
    </svg>
  )
}
