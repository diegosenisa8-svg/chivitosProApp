import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { formatMoney, formatPrice } from '../lib/format'
import type { MenuItem, SelectedModifier } from '../types'

type SelMap = Record<string, Record<string, number>>

export function ProductPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addLine } = useCart()
  const { menu } = useMenu()

  const item = useMemo(() => {
    for (const cat of menu.categories) {
      const found = cat.items.find((i) => i.id === id)
      if (found) return found
    }
    return undefined
  }, [menu, id])

  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [sel, setSel] = useState<SelMap>({})
  const [tried, setTried] = useState(false)

  const missingRequired = useMemo(() => {
    if (!item?.modifiers) return []
    return item.modifiers.filter((g) => {
      if (!g.required) return false
      const chosen = sel[g.id] || {}
      const total = Object.values(chosen).reduce((a, b) => a + b, 0)
      return total < g.min
    })
  }, [item, sel])

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

  const total = (item.price + unitExtras) * qty

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

      if (current) {
        delete group[optionId]
      } else {
        const count = Object.values(group).reduce((a, b) => a + b, 0)
        if (count >= max) return prev
        group[optionId] = 1
      }
      return { ...prev, [groupId]: group }
    })
  }

  function changeQty(groupId: string, optionId: string, delta: number) {
    setSel((prev) => {
      const group = { ...(prev[groupId] || {}) }
      const next = (group[optionId] || 0) + delta
      if (next <= 0) delete group[optionId]
      else group[optionId] = next
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
      unitPrice: product.price,
      quantity: qty,
      notes,
      modifiers,
    })
    navigate('/menu')
  }

  return (
    <div className="page product-page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">{item.name.toUpperCase()}</h1>
        <span className="topbar-spacer" />
      </header>

      <div className="product-hero">
        <img src={item.image} alt={item.name} />
      </div>

      {item.description && <p className="product-desc">{item.description}</p>}

      <div className="product-body">
        {(item.modifiers || []).map((group) => {
          const invalid = tried && missingRequired.some((g) => g.id === group.id)
          const chosen = sel[group.id] || {}
          return (
            <section key={group.id} className={`mod-group ${invalid ? 'invalid' : ''}`}>
              <h2>
                {group.name}
                {group.required ? '(Obligatorio)' : ''}
              </h2>
              <ul>
                {group.options.map((opt) => {
                  const q = chosen[opt.id] || 0
                  const checked = q > 0
                  return (
                    <li key={opt.id} className="mod-row">
                      <label>
                        <input
                          type="checkbox"
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
                            <button type="button" onClick={() => changeQty(group.id, opt.id, 1)}>
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
            placeholder="Añada aquí los comentarios sobre este producto"
            rows={3}
          />
        </label>

        <div className="qty-block">
          <span>Cantidad</span>
          <div className="qty-controls">
            <span className="qty-value">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <button type="button" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>
      </div>

      {tried && missingRequired.length > 0 && (
        <div className="error-banner">
          Debe seleccionar al menos un <strong>{missingRequired[0].name}</strong> para este producto.
        </div>
      )}

      <div className="bottom-cta">
        <span className="cta-price">{formatMoney(total, menu.restaurant.currency)}</span>
        <button type="button" className="cta-action" onClick={() => onAdd(item)}>
          Agregar al pedido
        </button>
      </div>
    </div>
  )
}
