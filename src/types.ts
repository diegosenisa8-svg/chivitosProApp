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
  modifierGroups?: { id: string; name: string }[]
}

export type ModifierLibraryGroup = {
  id: string
  name: string
  required: boolean
  min: number
  max: number
  allowQuantity?: boolean
  sortOrder?: number
  options: ModifierOption[]
  usedByCategories: { id: string; name: string }[]
  usedByProducts: { id: string; name: string }[]
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

export type LatLng = { lat: number; lng: number }

export type DeliveryZone = {
  id: string
  name: string
  color: string
  /** Costo de envío en UYU. 0 = sin costo / zona gratis. */
  fee: number
  minOrder?: number
  shape?: 'circle' | 'polygon'
  feeByDistance?: boolean
  active: boolean
  /** Centro de la zona (mapa Salto) — para shape=circle. */
  lat?: number
  lng?: number
  /** Radio en km para shape=circle. */
  radiusKm?: number
  /** Vértices del polígono (shape=polygon). Mínimo 3. */
  polygon?: LatLng[]
  /** Si true, no se suma costo de envío (fee se trata como 0). */
  freeDelivery?: boolean
}

export type Promotion = {
  id: string
  title: string
  description?: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  active: boolean
  used: number
  createdAt: string
  associatedTo?: string
  image?: string
}

export type ServiceFee = {
  id: string
  name: string
  type: 'convenience' | 'cash_discount' | 'holiday' | 'other'
  amount: number
  percent?: boolean
  active: boolean
}

export type RestaurantSettings = {
  alertPhone?: string
  orderAppEnabled?: boolean
  alertCallEnabled?: boolean
  scheduledOrdersEnabled?: boolean
  tableReservationEnabled?: boolean
  dineInEnabled?: boolean
  dineInAnonymous?: boolean
  pickupEnabled?: boolean
  deliveryEnabled?: boolean
  servicesPaused?: boolean
  separatePickupDeliveryHours?: boolean
  productType?: string
  timezone?: string
  country?: string
  postalCode?: string
  phoneExtra?: string
  websiteUrl?: string
  accountConfirmed?: boolean
  schedules?: {
    id: string
    label: string
    open: string
    close: string
    service?: string
  }[]
  exceptions?: { id: string; date: string; label: string; closed?: boolean }[]
  deliveryZones?: DeliveryZone[]
  paymentMethods?: Record<string, boolean>
  transferPayment?: {
    bank?: string
    holder?: string
    alias?: string
    cbu?: string
    instructions?: string
  }
  paymentByChannel?: Record<string, { delivery?: boolean; pickup?: boolean; dineIn?: boolean }>
  mercadoPago?: {
    blockedBins?: string[]
    blockedMessage?: string
  }
  taxes?: {
    enabled: boolean
    rate: number
    label: string
    includedInPrice?: boolean
    category?: string
    deliveryTaxRate?: number
    currency?: string
  }
  tips?: { enabled: boolean; askNoCutlery?: boolean; presets?: number[] }
  reservationDeposit?: { enabled: boolean; amount: number }
  orderDevice?: {
    paired?: boolean
    platform?: string
    osVersion?: string
    deviceId?: string
    appVersion?: string
    lastHeartbeatAt?: string | null
  }
  marketing?: Record<string, boolean>
  promotions?: Promotion[]
  autopilotCampaigns?: {
    id: string
    name: string
    status: string
    channel: string
    sent: number
  }[]
  publish?: Record<string, boolean | string>
  orderWidget?: {
    scheduledLimit?: number
    autoAccept?: boolean
    autoAcceptVia?: string
    fulfillmentMode?: string
    hcaptcha?: boolean
    billingDetail?: string
  }
  serviceFees?: ServiceFee[]
  printers?: { id: string; name: string; connected: boolean; type: string }[]
  printTemplates?: { id: string; name: string; width: number }[]
  printHistory?: { id: string; at: string; orderId: string; printer: string }[]
  integrations?: { id: string; name: string; status: string }[]
  notifications?: { staffEmails?: string[]; customerFromEmail?: string }
  languages?: { default?: string; enabled?: string[] }
  siteStats?: {
    visitors7d?: number
    visitorsPrev?: number
    funnel?: { visit: number; cart: number; checkout: number; order: number }
  }
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
  /** Zona de entrega elegida (solo delivery). */
  deliveryZoneId?: string
  schedule: 'now' | 'later'
  scheduleTime: string
  payment: 'efectivo' | 'pos' | 'transferencia' | 'mercadopago'
  notes: string
}
