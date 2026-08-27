import { useState } from 'react'
import {
  assignModifierGroupToCategory,
  assignModifierGroupToProduct,
  unassignModifierGroupFromCategory,
  unassignModifierGroupFromProduct,
} from '../lib/adminApi'
import type { ModifierLibraryGroup } from '../types'

type Props = {
  library: ModifierLibraryGroup[]
  categoryId?: string | null
  productId?: string | null
  categoryName?: string
  productName?: string
  assignedGroupIds?: string[]
  saving: boolean
  setSaving: (v: boolean) => void
  notify: (m: string) => void
  setError: (m: string) => void
  onChanged: () => Promise<void>
  onManage?: () => void
}

export function ModifierLibraryPanel({
  library,
  categoryId,
  productId,
  categoryName,
  productName,
  assignedGroupIds = [],
  saving,
  setSaving,
  notify,
  setError,
  onChanged,
  onManage,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const assigned = new Set(assignedGroupIds)

  async function assignToCategory(groupId: string) {
    if (!categoryId) return
    setSaving(true)
    try {
      await assignModifierGroupToCategory(categoryId, groupId)
      await onChanged()
      notify(`Grupo asignado a ${categoryName || 'la categoría'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function unassignFromCategory(groupId: string) {
    if (!categoryId) return
    if (!confirm('¿Quitar este grupo de todos los productos de la categoría?')) return
    setSaving(true)
    try {
      await unassignModifierGroupFromCategory(categoryId, groupId)
      await onChanged()
      notify('Grupo quitado de la categoría')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function assignToProduct(groupId: string) {
    if (!productId) return
    setSaving(true)
    try {
      await assignModifierGroupToProduct(productId, groupId)
      await onChanged()
      notify(`Grupo asignado a ${productName || 'el producto'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function unassignFromProduct(groupId: string) {
    if (!productId) return
    setSaving(true)
    try {
      await unassignModifierGroupFromProduct(productId, groupId)
      await onChanged()
      notify('Grupo quitado del producto')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const targetLabel = productId
    ? productName || 'producto'
    : categoryId
      ? categoryName || 'categoría'
      : null

  return (
    <aside className="modifier-library-panel">
      <div className="modifier-library-head">
        <h3>Opcionales y agregados</h3>
        <p className="admin-muted">
          {targetLabel
            ? `Asigná grupos a ${targetLabel}.`
            : 'Elegí una categoría o producto para asignar grupos.'}
        </p>
      </div>

      <ul className="modifier-library-list">
        {library.map((g) => {
          const isAssigned = assigned.has(g.id)
          const open = expandedId === g.id
          return (
            <li key={g.id} className={`modifier-library-item${open ? ' open' : ''}`}>
              <button
                type="button"
                className="modifier-library-item-head"
                onClick={() => setExpandedId(open ? null : g.id)}
              >
                <span className="modifier-library-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
                <span className="modifier-library-item-title">
                  <strong>{g.name}</strong>
                  <small className="admin-muted">
                    {g.options.length} opts
                    {g.usedByCategories.length ? ` · ${g.usedByCategories.length} cat.` : ''}
                    {g.usedByProducts.length ? ` · ${g.usedByProducts.length} prod.` : ''}
                  </small>
                </span>
                {isAssigned && <span className="modifier-tag on">Asignado</span>}
              </button>

              {open && (
                <div className="modifier-library-item-body">
                  <ul className="modifier-option-preview">
                    {g.options.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        {o.name}
                        {o.price > 0 ? ` (+${o.price})` : ''}
                      </li>
                    ))}
                    {g.options.length > 6 && <li>+{g.options.length - 6} más</li>}
                  </ul>

                  {(g.usedByCategories.length > 0 || g.usedByProducts.length > 0) && (
                    <div className="modifier-usage">
                      {g.usedByCategories.length > 0 && (
                        <p>
                          <strong>Categorías:</strong>{' '}
                          {g.usedByCategories.map((c) => c.name).join(', ')}
                        </p>
                      )}
                      {g.usedByProducts.length > 0 && (
                        <p>
                          <strong>Productos:</strong>{' '}
                          {g.usedByProducts
                            .slice(0, 8)
                            .map((p) => p.name)
                            .join(', ')}
                          {g.usedByProducts.length > 8 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {categoryId && !productId &&
                    (isAssigned ? (
                      <button
                        type="button"
                        className="admin-btn ghost full"
                        disabled={saving}
                        onClick={() => unassignFromCategory(g.id)}
                      >
                        Quitar de categoría
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn primary full"
                        disabled={saving}
                        onClick={() => assignToCategory(g.id)}
                      >
                        Asignar a toda la categoría
                      </button>
                    ))}

                  {productId &&
                    (isAssigned ? (
                      <button
                        type="button"
                        className="admin-btn ghost full"
                        disabled={saving}
                        onClick={() => unassignFromProduct(g.id)}
                      >
                        Quitar de este producto
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn primary full"
                        disabled={saving}
                        onClick={() => assignToProduct(g.id)}
                      >
                        Asignar a este producto
                      </button>
                    ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {library.length === 0 && (
        <p className="admin-muted modifier-library-empty">
          Todavía no hay grupos. Creá el primero en Opcionales y agregados.
        </p>
      )}

      {onManage && (
        <button type="button" className="admin-btn modifier-library-manage" onClick={onManage}>
          Gestionar biblioteca
        </button>
      )}
    </aside>
  )
}
