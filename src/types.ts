export type ModifierOption = {
  id: string
  name: string
  price: number
}

export type ModifierGroup = {
  id: string
  name: string
  required: boolean
  min: number
  max: number
  allowQuantity?: boolean
  options: ModifierOption[]
}

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  priceMax?: number
  image: string
  modifiers?: ModifierGroup[]
  badge?: 'mas-pedido' | 'nuevo' | 'picante' | 'combo'
  featured?: boolean
  available?: boolean
}

export type Category = {
  id: string
  name: string
  subtitle: string
  banner: string
  items: MenuItem[]
}

export type Restaurant = {
  name: string
  address: string
  city: string
  country: string
  open: boolean
  distanceKm: number
  delivery: boolean
  takeaway: boolean
  currency: string
  whatsapp: string
  logo: string
  hero: string
  mapEmbed: string
  lat: number
  lng: number
  etaMin?: number
  etaMax?: number
  deliveryFee?: number
  minOrder?: number
  hoursLabel?: string
  phone?: string
  settings?: RestaurantSettings
}

export type RestaurantSettings = {
  alertPhone?: string
  orderAppEnabled?: boolean
  alertCallEnabled?: boolean
  scheduledOrdersEnabled?: boolean
  tableReservationEnabled?: boolean
  dineInEnabled?: boolean
  servicesPaused?: boolean
  separatePickupDeliveryHours?: boolean
  schedules?: {
    id: string
    label: string
    open: string
    close: string
    service?: string
  }[]
  exceptions?: { id: string; date: string; label: string; closed?: boolean }[]
  deliveryZones?: {
    id: string
    name: string
    color: string
    fee: number
    active: boolean
  }[]
  paymentMethods?: Record<string, boolean>
  taxes?: { enabled: boolean; rate: number; label: string }
  marketing?: Record<string, boolean>
  publish?: Record<string, boolean>
}

export type MenuData = {
  restaurant: Restaurant
  categories: Category[]
}

export type SelectedModifier = {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  price: number
  quantity: number
}

export type CartLine = {
  key: string
  itemId: string
  name: string
  unitPrice: number
  quantity: number
  notes: string
  modifiers: SelectedModifier[]
  sizeLabel?: string
}

export type Fulfillment = 'delivery' | 'pickup'

export type CheckoutInfo = {
  name: string
  phone: string
  fulfillment: Fulfillment
  address: string
  schedule: 'now' | 'later'
  scheduleTime: string
  payment: 'efectivo' | 'pos' | 'transferencia'
  notes: string
}
