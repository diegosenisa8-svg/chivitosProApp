import { useEffect } from 'react'
import { resolveDelivery } from '../lib/deliveryZones'
import { useCart } from './CartContext'
import { useMenu } from './MenuContext'

/** Sync delivery fee + admin promotions into the cart when menu loads. */
export function MenuCartBridge() {
  const { menu } = useMenu()
  const { setDeliveryFeeBase, registerPromotions, fulfillment, checkout } = useCart()

  const lat = checkout.location?.lat
  const lng = checkout.location?.lng

  useEffect(() => {
    if (fulfillment !== 'delivery') {
      setDeliveryFeeBase(0)
      return
    }
    // El costo sale de la ubicación del cliente, no de una zona que él elija.
    const { fee } = resolveDelivery(
      menu.restaurant.settings?.deliveryZones,
      lat != null && lng != null ? { lat, lng } : null,
      menu.restaurant.deliveryFee ?? 80,
    )
    setDeliveryFeeBase(fee)
  }, [menu, setDeliveryFeeBase, fulfillment, lat, lng])

  useEffect(() => {
    const promos = (menu.restaurant.settings?.promotions || []).map((p) => ({
      code: p.code,
      type: p.type,
      value: p.value,
      active: p.active,
    }))
    registerPromotions(promos)
  }, [menu, registerPromotions])

  return null
}
