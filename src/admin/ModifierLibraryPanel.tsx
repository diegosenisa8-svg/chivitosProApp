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

  return (
    <aside className="menu-editor-side-bar">
      <div className="side-bar-title">Opcionales y agregados</div>

      <div className="side-bar-contents">
        {library.length === 0 ? (
          <p className="side-bar-empty">
            Todavía no hay grupos. Creá el primero con el botón de abajo.
          </p>
        ) : (
          library.map((g) => {
            const isAssigned = assigned.has(g.id)
            const open = expandedId === g.id
            return (
              <div
                key={g.id}
                className={`menu-side-bar-choice${open ? ' expanded' : ''}${isAssigned ? ' highlighted' : ''}`}
              >
                <div className="choice-header">
                  <span className="choice-drag-hover-indicator" aria-hidden>
                    ≡
                  </span>
                  <button
                    type="button"
                    className="choice-title"
                    style={{
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      flex: 1,
                    }}
                    onClick={() => setExpandedId(open ? null : g.id)}
                  >
                    {g.name}
                  </button>
                  <div className="choice-buttons">
                    <button
                      type="button"
                      className="me-btn visible-on-hover"
                      title="Editar grupo"
                      onClick={onManage}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="me-btn"
                      title={open ? 'Contraer' : 'Expandir'}
                      onClick={() => setExpandedId(open ? null : g.id)}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="choice-details">
                    {g.options.length > 0 ? (
                      <ul className="choice-options-list">
                        {g.options.slice(0, 8).map((o) => (
                          <li key={o.id}>
                            <span>{o.name}</span>
                            {o.price > 0 ? <span>+{o.price}</span> : null}
                          </li>
                        ))}
                        {g.options.length > 8 && (
                          <li>
                            <span>+{g.options.length - 8} más</span>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="modifier-usage">Sin opciones todavía.</p>
                    )}

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
                          className="choice-action-btn unassign"
                          disabled={saving}
                          onClick={() => unassignFromCategory(g.id)}
                        >
                          Quitar de categoría
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="choice-action-btn assign"
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
                          className="choice-action-btn unassign"
                          disabled={saving}
                          onClick={() => unassignFromProduct(g.id)}
                        >
                          Quitar de este producto
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="choice-action-btn assign"
                          disabled={saving}
                          onClick={() => assignToProduct(g.id)}
                        >
                          Asignar a este producto
                        </button>
                      ))}

                    {!categoryId && !productId && (
                      <p className="modifier-usage">
                        Expandí una categoría o seleccioná un producto para asignar grupos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="side-bar-bottom">
        <div className="side-bar-bottom-separator" />
        {onManage && (
          <button type="button" className="btn-add-group" onClick={onManage}>
            Agregar Grupo
          </button>
        )}
      </div>
    </aside>
  )
}
