import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FulfillmentToggle } from '../components/FulfillmentToggle'
import { MediaImage } from '../components/MediaImage'
import { Toast } from '../components/Toast'
import { useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { formatPrice } from '../lib/format'
import { categoryDisplayImage, isPlaceholderImage } from '../lib/media'
import { getFeaturedItems } from '../lib/menuUtils'

export function MenuPage() {
  const navigate = useNavigate()
  const { count } = useCart()
  const { menu } = useMenu()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(menu.categories[0]?.id || '')
  const [infoOpen, setInfoOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const searching = query.trim().length > 0

  const featured = useMemo(() => getFeaturedItems(menu), [menu])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return menu.categories
    return menu.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.items.length > 0)
  }, [menu, query])

  useEffect(() => {
    if (searching) {
      setExpandedIds(new Set(filtered.map((c) => c.id)))
    }
  }, [searching, filtered])

  useEffect(() => {
    const nodes = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[]
    if (!nodes.length || searching) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActive(visible.target.id)
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0.15, 0.4] },
    )
    nodes.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [filtered, searching, expandedIds])

  function toggleCat(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setActive(id)
  }

  function scrollToCat(id: string) {
    setExpandedIds((prev) => new Set(prev).add(id))
    setActive(id)
    window.requestAnimationFrame(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="page menu-page">
      <Toast />
      <header className="topbar menu-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ‹
        </button>
        <div className="topbar-title-full">
          <img src={menu.restaurant.logo || '/logo.png'} alt="ChivitosPro" />
          <span>{menu.restaurant.name}</span>
          <button type="button" className="info-btn" aria-label="Información" onClick={() => setInfoOpen(true)}>
            i
          </button>
        </div>
        <div className="topbar-actions">
          <Link to="/mis-pedidos" className="icon-btn" aria-label="Mis pedidos" title="Mis pedidos">
            ☰
          </Link>
          <Link to="/cart" className="icon-btn cart-btn" aria-label="Carrito">
            <CartIcon />
            {count > 0 && <span className="cart-badge">{count}</span>}
          </Link>
        </div>
      </header>

      <div className="menu-sticky">
        <div className="search-row">
          <input
            type="search"
            placeholder="Buscar en el menú…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <FulfillmentToggle compact />
        </div>
        {!query && (
          <div className="cat-tabs-wrap">
            <div className="cat-tabs" role="tablist">
              {menu.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active === cat.id}
                  className={active === cat.id ? 'active' : ''}
                  onClick={() => scrollToCat(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <main className="menu-list">
        {!query && featured.length > 0 && (
          <section className="featured">
            <h2>Destacados</h2>
            <div className="featured-row">
              {featured.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="featured-card">
                  <MediaImage src={item.image} alt="" loading="lazy" placeholderLabel={item.name} />
                  <strong>{item.name}</strong>
                  <span>{formatPrice(item.price)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {filtered.map((cat) => {
          const expanded = searching || expandedIds.has(cat.id)
          const thumb = categoryDisplayImage(cat)
          return (
            <section
              key={cat.id}
              className={`category${expanded ? ' is-expanded' : ''}`}
              id={cat.id}
              ref={(el) => {
                sectionRefs.current[cat.id] = el
              }}
            >
              <button
                type="button"
                className="category-head"
                aria-expanded={expanded}
                onClick={() => toggleCat(cat.id)}
              >
                <div className="category-head-left">
                  <MediaImage src={thumb} alt="" className="category-thumb" loading="lazy" />
                  <div className="category-head-text">
                    <h2>{cat.name}</h2>
                    {cat.subtitle && (
                      <p className={expanded ? '' : 'category-teaser'}>
                        {expanded ? cat.subtitle : cat.subtitle.slice(0, 72)}
                        {!expanded && cat.subtitle.length > 72 ? '…' : ''}
                      </p>
                    )}
                    {!expanded && (
                      <span className="category-count">
                        {cat.items.length} producto{cat.items.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <span className="category-chevron" aria-hidden>
                  {expanded ? '▾' : '▸'}
                </span>
              </button>

              {expanded ? (
                <div className="category-body">
                  {!isPlaceholderImage(cat.banner) && cat.id !== 'bebidas' && (
                    <div className="category-banner">
                      <MediaImage src={cat.banner} alt="" loading="lazy" />
                    </div>
                  )}

                  <ul className="item-list">
                    {cat.items.map((item) => (
                      <li key={item.id}>
                        <Link to={`/product/${item.id}`} className="item-row">
                          <MediaImage
                            src={item.image}
                            alt=""
                            className="item-thumb"
                            loading="lazy"
                            placeholderLabel={item.name}
                          />
                          <div className="item-body">
                            <div className="item-line">
                              <h3>
                                {item.name}
                                {item.badge && (
                                  <span className={`chip chip-${item.badge}`}>
                                    {item.badge === 'mas-pedido'
                                      ? 'Más pedido'
                                      : item.badge === 'nuevo'
                                        ? 'Nuevo'
                                        : item.badge === 'combo'
                                          ? 'Combo'
                                          : 'Picante'}
                                  </span>
                                )}
                              </h3>
                              <strong>
                                {formatPrice(item.price)}
                                {item.priceMax != null && ` · ${formatPrice(item.priceMax)}`}
                              </strong>
                            </div>
                            {item.description && <p>{item.description}</p>}
                            <span className="add-pill">Agregar</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          )
        })}

        {filtered.length === 0 && <p className="empty">No encontramos resultados</p>}
      </main>

      {infoOpen && (
        <div className="modal-backdrop" onClick={() => setInfoOpen(false)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{menu.restaurant.name}</h2>
            <p>{menu.restaurant.address}</p>
            <ul className="info-list">
              <li>
                <strong>Horario</strong>
                <span>{menu.restaurant.hoursLabel}</span>
              </li>
              <li>
                <strong>Tiempo estimado</strong>
                <span>
                  {menu.restaurant.etaMin}–{menu.restaurant.etaMax} min
                </span>
              </li>
              <li>
                <strong>Delivery</strong>
                <span>desde {formatPrice(menu.restaurant.deliveryFee || 80)}</span>
              </li>
              <li>
                <strong>Pedido mínimo</strong>
                <span>{formatPrice(menu.restaurant.minOrder || 250)}</span>
              </li>
              <li>
                <strong>Medios de pago</strong>
                <span>Efectivo · POS · Transferencia</span>
              </li>
            </ul>
            <button type="button" className="btn btn-primary" onClick={() => setInfoOpen(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
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
