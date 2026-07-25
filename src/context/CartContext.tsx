import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, SelectedModifier } from '../types'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  toast: string | null
  addLine: (line: Omit<CartLine, 'key'>) => void
  removeLine: (key: string) => void
  clear: () => void
  showToast: (msg: string) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function lineTotal(line: CartLine) {
  const mods = line.modifiers.reduce((s, m) => s + m.price * m.quantity, 0)
  return (line.unitPrice + mods) * line.quantity
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0)

    return {
      lines,
      count,
      subtotal,
      toast,
      addLine: (line) => {
        const key = `${line.itemId}-${JSON.stringify(line.modifiers)}-${line.notes}-${Date.now()}`
        setLines((prev) => [...prev, { ...line, key }])
        setToast('Items added to cart.')
        window.setTimeout(() => setToast(null), 2200)
      },
      removeLine: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
      showToast: (msg) => {
        setToast(msg)
        window.setTimeout(() => setToast(null), 2200)
      },
    }
  }, [lines, toast])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export function cartLineTotal(line: CartLine) {
  const mods = line.modifiers.reduce((s, m) => s + m.price * m.quantity, 0)
  return (line.unitPrice + mods) * line.quantity
}

export function buildWhatsAppMessage(
  restaurantName: string,
  lines: CartLine[],
  total: number,
  currency: string,
) {
  const rows = lines.map((line) => {
    const mods = line.modifiers
      .map((m: SelectedModifier) => {
        const qty = m.quantity > 1 ? `${m.quantity}x ` : ''
        const price = m.price > 0 ? ` (+${m.price.toFixed(2)})` : ''
        return `  · ${qty}${m.groupName}: ${m.optionName}${price}`
      })
      .join('\n')
    const notes = line.notes ? `\n  Nota: ${line.notes}` : ''
    return `• ${line.quantity}x ${line.name} — ${cartLineTotal(line).toFixed(2)}${mods ? `\n${mods}` : ''}${notes}`
  })

  return [
    `Hola! Quiero pedir en *${restaurantName}*:`,
    '',
    ...rows,
    '',
    `*Total: ${currency} ${total.toFixed(2)}*`,
  ].join('\n')
}
