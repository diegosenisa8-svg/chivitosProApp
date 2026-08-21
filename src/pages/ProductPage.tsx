import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { mediaUrl } from '../lib/apiBase'
import { formatMoney, formatPrice } from '../lib/format'
import { findItem, getFeaturedItems } from '../lib/menuUtils'
import type { MenuItem, SelectedModifier } from '../types'

type SelMap = Record<string, Record<string, number>>

export function ProductPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addLine } = useCart()
  const { menu } = useMenu()
  const item = findItem(menu, id)

  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [sel, setSel] = useState<SelMap>({})
  const [tried, setTried] = useState(false)
  const [size, setSize] = useState<'base' | 'max'>('base')

  const upsell = useMemo(() => {
    if (!item) return []
    return getFeaturedItems(menu, 8)
      .filter((i) => i.id !== item.id)
      .slice(0, 3)
  }, [menu, item])

  const missingRequired = useMemo(() => {
    if (!item?.modifiers) return []
    return item.modifiers.filter((g) => {
      if (!g.required) return false
      const chosen = sel[g.id] || {}
      const total = Object.values(chosen).reduce((a, b) => a + b, 0)
      return total < g.min
    })
  }, [item, sel])

  const unitPrice = item
    ? size === 'max' && item.priceMax != null
      ? item.priceMax
      : item.price
    : 0

  const unitExtras = useMemo(() => {
    if (!item?.modifiers) return 0
    let sum = 0
    for (const g of item.modifiers) {
      const chosen = sel[g.id] || {}
      for (const opt of g.options) {
        const q = chosen[opt.id] || 0
        sum += opt.price * q
      }
    }
    return sum
  }, [item, sel])

  if (!item) {
    return (
      <div className="page">
        <p className="empty">Producto no encontrado</p>
      </div>
    )
  }

  const total = (unitPrice + unitExtras) * qty

  function toggleOption(groupId: string, optionId: string, max: number, allowQuantity?: boolean) {
    setSel((prev) => {
      const group = { ...(prev[groupId] || {}) }
      const current = group[optionId] || 0

      if (allowQuantity) {
        if (current > 0) delete group[optionId]
        else group[optionId] = 1
        return { ...prev, [groupId]: group }
      }

      if (max === 1) {
        return { ...prev, [groupId]: current ? {} : { [optionId]: 1 } }
      }

      if (current) delete group[optionId]
      else {
        const count = Object.values(group).reduce((a, b) => a + b, 0)
        if (count >= max) return prev
        group[optionId] = 1
      }
      return { ...prev, [groupId]: group }
    })
  }

  function changeQty(groupId: string, optionId: string, delta: number, maxPerOption = 5) {
    setSel((prev) => {
      const group = { ...(prev[groupId] || {}) }
      const next = (group[optionId] || 0) + delta
      if (next <= 0) delete group[optionId]
      else group[optionId] = Math.min(maxPerOption, next)
      return { ...prev, [groupId]: group }
    })
  }

  function onAdd(product: MenuItem) {
    setTried(true)
    if (missingRequired.length) return

    const modifiers: SelectedModifier[] = []
    for (const g of product.modifiers || []) {
      const chosen = sel[g.id] || {}
      for (const opt of g.options) {
        const q = chosen[opt.id] || 0
        if (q > 0) {
          modifiers.push({
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            price: opt.price,
            quantity: q,
          })
        }
      }
    }

    addLine({
      itemId: product.id,
      name: product.name,
      unitPrice,
      quantity: qty,
      notes,
      modifiers,
      sizeLabel:
        product.priceMax != null
          ? size === 'max'
            ? 'Porción grande'
            : 'Porción chica'
          : undefined,
    })
    navigate('/menu')
  }

  return (
    <div className="page product-page">
      <Toast />
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">{item.name}</h1>
        <span className="topbar-spacer" />
      </header>

      <div className="product-hero">
        <img src={mediaUrl(item.image)} alt={item.name} />
      </div>

      {item.description && <p className="product-desc">{item.description}</p>}

      <div className="product-body">
        {item.priceMax != null && (
          <section className="size-picker">
            <h2>Tamaño</h2>
            <div className="size-options">
              <button
                type="button"
                className={size === 'base' ? 'active' : ''}
                onClick={() => setSize('base')}
              >
                Chica · {formatPrice(item.price)}
              </button>
              <button
                type="button"
                className={size === 'max' ? 'active' : ''}
                onClick={() => setSize('max')}
              >
                Grande · {formatPrice(item.priceMax)}
              </button>
            </div>
          </section>
        )}

        {(item.modifiers || []).map((group) => {
          const invalid = tried && missingRequired.some((g) => g.id === group.id)
          const chosen = sel[group.id] || {}
          return (
            <section key={group.id} className={`mod-group ${invalid ? 'invalid' : ''}`}>
              <h2>
                {group.name}
                {group.required ? ' (Obligatorio)' : ''}
              </h2>
              <ul>
                {group.options.map((opt) => {
                  const q = chosen[opt.id] || 0
                  const checked = q > 0
                  const single = group.max === 1 && !group.allowQuantity
                  return (
                    <li key={opt.id} className="mod-row">
                      <label>
                        <input
                          type={single ? 'radio' : 'checkbox'}
                          name={single ? `mod-${group.id}` : undefined}
                          checked={checked}
                          onChange={() =>
                            toggleOption(group.id, opt.id, group.max, group.allowQuantity)
                          }
                        />
                        <span>{opt.name}</span>
                      </label>
                      <div className="mod-right">
                        {group.allowQuantity && checked && (
                          <div className="mini-qty">
                            <span>x{q}</span>
                            <button type="button" onClick={() => changeQty(group.id, opt.id, -1)}>
                              −
                            </button>
                            <button
                              type="button"
                              disabled={q >= 5}
                              onClick={() => changeQty(group.id, opt.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                        {opt.price > 0 && <span>+{formatPrice(opt.price)}</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <label className="notes">
          <span>Instrucciones especiales</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: sin cebolla, punto de la carne a punto…"
            rows={3}
          />
        </label>

        <div className="qty-block">
          <span>Cantidad</span>
          <div className="qty-controls">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="qty-value">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>

        {upsell.length > 0 && (
          <section className="upsell">
            <h2>¿Le sumás algo?</h2>
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
      </div>

      {tried && missingRequired.length > 0 && (
        <div className="error-banner">
          Debe seleccionar al menos un <strong>{missingRequired[0].name}</strong> para este producto.
        </div>
      )}

      <div className="bottom-cta">
        <span className="cta-price">{formatMoney(total)}</span>
        <button type="button" className="cta-action" onClick={() => onAdd(item)}>
          Agregar {formatMoney(total)}
        </button>
      </div>
    </div>
  )
}
