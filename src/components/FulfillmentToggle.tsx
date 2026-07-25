import { useCart } from '../context/CartContext'
import type { Fulfillment } from '../types'

export function FulfillmentToggle({ compact = false }: { compact?: boolean }) {
  const { fulfillment, setFulfillment } = useCart()

  function pick(f: Fulfillment) {
    setFulfillment(f)
  }

  return (
    <div className={`fulfill-toggle ${compact ? 'compact' : ''}`} role="group" aria-label="Tipo de pedido">
      <button
        type="button"
        className={fulfillment === 'delivery' ? 'active' : ''}
        onClick={() => pick('delivery')}
      >
        Delivery
      </button>
      <button
        type="button"
        className={fulfillment === 'pickup' ? 'active' : ''}
        onClick={() => pick('pickup')}
      >
        Retiro
      </button>
    </div>
  )
}
