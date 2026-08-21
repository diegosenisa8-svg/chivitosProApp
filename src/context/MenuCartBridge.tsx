import { useEffect } from 'react'
import { useCart } from './CartContext'
import { useMenu } from './MenuContext'

/** Sync delivery fee + admin promotions into the cart when menu loads. */
export function MenuCartBridge() {
  const { menu } = useMenu()
  const { setDeliveryFeeBase, registerPromotions } = useCart()

  useEffect(() => {
    const zones = (menu.restaurant.settings?.deliveryZones || []).filter((z) => z.active)
    const minFee =
      zones.length > 0
        ? Math.min(...zones.map((z) => z.fee))
        : menu.restaurant.deliveryFee ?? 80
    setDeliveryFeeBase(minFee)

    const promos = (menu.restaurant.settings?.promotions || []).map((p) => ({
      code: p.code,
      type: p.type,
      value: p.value,
      active: p.active,
    }))
    registerPromotions(promos)
  }, [menu, setDeliveryFeeBase, registerPromotions])

  return null
}
