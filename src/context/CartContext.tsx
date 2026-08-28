import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, CheckoutInfo, Fulfillment, SelectedModifier } from '../types'
import { useCustomerAuth } from './CustomerAuthContext'

const CART_PREFIX = 'chivitos-cart-v2:'
const LEGACY_CART_KEY = 'chivitos-cart-v1'

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
  setDeliveryFeeBase: (fee: number) => void
  registerPromotions: (
    promos: { code: string; type: 'percent' | 'fixed'; value: number; active: boolean }[],
  ) => void
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
  deliveryZoneId: '',
  schedule: 'now',
  scheduleTime: '',
  payment: 'efectivo',
  notes: '',
}

function lineTotal(line: CartLine) {
  const mods = line.modifiers.reduce((s, m) => s + m.price * m.quantity, 0)
  return (line.unitPrice + mods) * line.quantity
}

function cartKeyFor(userId: string | null | undefined) {
  return `${CART_PREFIX}${userId || 'guest'}`
}

function loadCart(userId: string | null | undefined): CartLine[] {
  try {
    const key = cartKeyFor(userId)
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as CartLine[]
    if (userId) {
      const legacy = localStorage.getItem(LEGACY_CART_KEY)
      if (legacy) {
        localStorage.removeItem(LEGACY_CART_KEY)
        localStorage.setItem(key, legacy)
        return JSON.parse(legacy) as CartLine[]
      }
    }
    return []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth()
  const userId = customer?.id || null
  const userIdRef = useRef(userId)
  const [lines, setLines] = useState<CartLine[]>(() =>
    typeof window === 'undefined' ? [] : loadCart(null),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery')
  const [coupon, setCoupon] = useState('')
  const [discountRate, setDiscountRate] = useState(0)
  const [discountFixed, setDiscountFixed] = useState(0)
  const [deliveryFeeBase, setDeliveryFeeBase] = useState(80)
  const [promos, setPromos] = useState<
    { code: string; type: 'percent' | 'fixed'; value: number; active: boolean }[]
  >([])
  const [checkout, setCheckoutState] = useState<CheckoutInfo>(defaultCheckout)

  useEffect(() => {
    if (userIdRef.current === userId) return
    userIdRef.current = userId
    setLines(loadCart(userId))
    setCoupon('')
    setDiscountRate(0)
    setDiscountFixed(0)
    if (customer) {
      setCheckoutState((c) => ({
        ...c,
        name: customer.name || c.name,
        phone: customer.phone || c.phone,
      }))
    }
  }, [userId, customer])

  const registerPromotions = useCallback(
    (list: { code: string; type: 'percent' | 'fixed'; value: number; active: boolean }[]) => {
      setPromos(list)
    },
    [],
  )

  useEffect(() => {
    try {
      localStorage.setItem(cartKeyFor(userId), JSON.stringify(lines))
    } catch {
      /* ignore */
    }
  }, [lines, userId])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0)
    const discount = Math.round((subtotal * discountRate + discountFixed) * 100) / 100
    const deliveryFee = fulfillment === 'delivery' && subtotal > 0 ? deliveryFeeBase : 0

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
        setCheckoutState((c) => ({
          ...c,
          fulfillment: f,
          ...(f === 'pickup' ? { deliveryZoneId: '' } : {}),
        }))
      },
      setCoupon,
      setDeliveryFeeBase,
      registerPromotions,
      applyCoupon: (code) => {
        const normalized = code.trim().toUpperCase()
        const fromAdmin = promos.find((p) => p.active && p.code.toUpperCase() === normalized)
        if (fromAdmin) {
          if (fromAdmin.type === 'percent') {
            setDiscountRate(fromAdmin.value / 100)
            setDiscountFixed(0)
          } else {
            setDiscountRate(0)
            setDiscountFixed(fromAdmin.value)
          }
          setCoupon(normalized)
          setToast(`Cupón aplicado: ${fromAdmin.code}`)
          window.setTimeout(() => setToast(null), 2200)
          return true
        }
        if (normalized === 'CHIVITO10') {
          setDiscountRate(0.1)
          setDiscountFixed(0)
          setCoupon(normalized)
          setToast('Cupón aplicado: 10% OFF')
          window.setTimeout(() => setToast(null), 2200)
          return true
        }
        if (normalized === 'PRIMERA') {
          setDiscountRate(0.15)
          setDiscountFixed(0)
          setCoupon(normalized)
          setToast('Cupón primera compra: 15% OFF')
          window.setTimeout(() => setToast(null), 2200)
          return true
        }
        setDiscountRate(0)
        setDiscountFixed(0)
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
        setDiscountFixed(0)
        setCoupon('')
      },
      showToast: (msg) => {
        setToast(msg)
        window.setTimeout(() => setToast(null), 2200)
      },
      checkout: { ...checkout, fulfillment },
      setCheckout: (patch) => setCheckoutState((c) => ({ ...c, ...patch })),
    }
  }, [
    lines,
    toast,
    fulfillment,
    coupon,
    discountRate,
    discountFixed,
    deliveryFeeBase,
    checkout,
    promos,
    registerPromotions,
  ])

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
    header.push(`Tipo: ${checkout.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'}`)
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
