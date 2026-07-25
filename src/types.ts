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
}
