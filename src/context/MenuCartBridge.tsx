import { useEffect } from 'react'
import { zoneDeliveryFee } from '../lib/deliveryZones'
import { useCart } from './CartContext'
import { useMenu } from './MenuContext'

/** Sync delivery fee + admin promotions into the cart when menu loads. */
export function MenuCartBridge() {
  const { menu } = useMenu()
  const { setDeliveryFeeBase, registerPromotions, fulfillment, checkout } = useCart()

  useEffect(() => {
    const zones = (menu.restaurant.settings?.deliveryZones || []).filter((z) => z.active)
    if (zones.length === 0) {
      setDeliveryFeeBase(menu.restaurant.deliveryFee ?? 80)
      return
    }
    if (fulfillment !== 'delivery') {
      setDeliveryFeeBase(0)
      return
    }
    const zone = zones.find((z) => z.id === checkout.deliveryZoneId)
    setDeliveryFeeBase(zoneDeliveryFee(zone))
  }, [menu, setDeliveryFeeBase, fulfillment, checkout.deliveryZoneId])

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
