import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, CheckoutInfo, Fulfillment, SelectedModifier } from '../types'

const CART_KEY = 'chivitos-cart-v1'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  toast: string | null
  fulfillment: Fulfillment
  coupon: string
  discount: number
  deliveryFee: number
  setFulfillment: (f: Fulfillment) => void
  setCoupon: (code: string) => void
  applyCoupon: (code: string) => boolean
  addLine: (line: Omit<CartLine, 'key'>) => void
  removeLine: (key: string) => void
  setQuantity: (key: string, quantity: number) => void
  clear: () => void
  showToast: (msg: string) => void
  checkout: CheckoutInfo
  setCheckout: (patch: Partial<CheckoutInfo>) => void
}

const CartContext = createContext<CartContextValue | null>(null)

const defaultCheckout: CheckoutInfo = {
  name: '',
  phone: '',
  fulfillment: 'delivery',
  address: '',
  schedule: 'now',
  scheduleTime: '',
  payment: 'efectivo',
  notes: '',
}

function lineTotal(line: CartLine) {
  const mods = line.modifiers.reduce((s, m) => s + m.price * m.quantity, 0)
  return (line.unitPrice + mods) * line.quantity
}

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() =>
    typeof window === 'undefined' ? [] : loadCart(),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery')
  const [coupon, setCoupon] = useState('')
  const [discountRate, setDiscountRate] = useState(0)
  const [checkout, setCheckoutState] = useState<CheckoutInfo>(defaultCheckout)

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(lines))
  }, [lines])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0)
    const discount = Math.round(subtotal * discountRate * 100) / 100
    const deliveryFee = fulfillment === 'delivery' && subtotal > 0 ? 80 : 0

    return {
      lines,
      count,
      subtotal,
      toast,
      fulfillment,
      coupon,
      discount,
      deliveryFee,
      setFulfillment: (f) => {
        setFulfillment(f)
        setCheckoutState((c) => ({ ...c, fulfillment: f }))
      },
      setCoupon,
      applyCoupon: (code) => {
        const normalized = code.trim().toUpperCase()
        if (normalized === 'CHIVITO10') {
          setDiscountRate(0.1)
          setCoupon(normalized)
          setToast('Cupón aplicado: 10% OFF')
          window.setTimeout(() => setToast(null), 2200)
          return true
        }
        if (normalized === 'PRIMERA') {
          setDiscountRate(0.15)
          setCoupon(normalized)
          setToast('Cupón primera compra: 15% OFF')
          window.setTimeout(() => setToast(null), 2200)
          return true
        }
        setDiscountRate(0)
        setToast('Cupón inválido')
        window.setTimeout(() => setToast(null), 2200)
        return false
      },
      addLine: (line) => {
        const key = `${line.itemId}-${line.sizeLabel || ''}-${JSON.stringify(line.modifiers)}-${line.notes}-${Date.now()}`
        setLines((prev) => [...prev, { ...line, key }])
        setToast('Agregado al pedido ✓')
        window.setTimeout(() => setToast(null), 2200)
      },
      removeLine: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      setQuantity: (key, quantity) => {
        if (quantity <= 0) {
          setLines((prev) => prev.filter((l) => l.key !== key))
          return
        }
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)))
      },
      clear: () => {
        setLines([])
        setDiscountRate(0)
        setCoupon('')
      },
      showToast: (msg) => {
        setToast(msg)
        window.setTimeout(() => setToast(null), 2200)
      },
      checkout: { ...checkout, fulfillment },
      setCheckout: (patch) => setCheckoutState((c) => ({ ...c, ...patch })),
    }
  }, [lines, toast, fulfillment, coupon, discountRate, checkout])

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
  checkout?: CheckoutInfo,
  deliveryFee = 0,
  discount = 0,
) {
  const rows = lines.map((line) => {
    const mods = line.modifiers
      .map((m: SelectedModifier) => {
        const qty = m.quantity > 1 ? `${m.quantity}x ` : ''
        const price = m.price > 0 ? ` (+${m.price.toFixed(2)})` : ''
        return `  · ${qty}${m.groupName}: ${m.optionName}${price}` 
      })
      .join('\n')
    const size = line.sizeLabel ? ` (${line.sizeLabel})` : ''
    const notes = line.notes ? `\n  Nota: ${line.notes}` : ''
    return `• ${line.quantity}x ${line.name}${size} — $${cartLineTotal(line).toFixed(2)}${mods ? `\n${mods}` : ''}${notes}`
  })

  const header = [`Hola! Quiero pedir en *${restaurantName}*:`, '']
  if (checkout?.name) header.push(`Cliente: ${checkout.name}`)
  if (checkout?.phone) header.push(`Tel: ${checkout.phone}`)
  if (checkout) {
    header.push(
      `Tipo: ${checkout.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'}`,
    )
    if (checkout.fulfillment === 'delivery' && checkout.address) {
      header.push(`Dirección: ${checkout.address}`)
    }
    header.push(
      `Horario: ${checkout.schedule === 'now' ? 'Lo antes posible' : checkout.scheduleTime || 'Programado'}`,
    )
    header.push(`Pago: ${checkout.payment}`)
    if (checkout.notes) header.push(`Notas: ${checkout.notes}`)
    header.push('')
  }

  const footer = ['', `Subtotal productos: $${(total - deliveryFee + discount).toFixed(2)}`]
  if (discount > 0) footer.push(`Descuento: -$${discount.toFixed(2)}`)
  if (deliveryFee > 0) footer.push(`Envío: $${deliveryFee.toFixed(2)}`)
  footer.push(`*Total: $${total.toFixed(2)} ${currency}*`)

  return [...header, ...rows, ...footer].join('\n')
}
