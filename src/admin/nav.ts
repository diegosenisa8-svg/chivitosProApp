export type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'take-orders'
  | 'menu'
  | 'modifiers'
  | 'profile'
  | 'schedules'
  | 'delivery-zones'
  | 'payments-taxes'
  | 'alert-call'
  | 'publish'
  | 'pagos'
  | 'reports'
  | 'marketing'
  | 'preview'

export type NavItem = {
  id: AdminSection
  label: string
  group: 'ops' | 'config' | 'growth'
  prodOnly?: boolean
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'ops' },
  { id: 'orders', label: 'Pedidos', group: 'ops' },
  { id: 'take-orders', label: 'App toma de pedidos', group: 'ops' },
  { id: 'menu', label: 'Configuración del menú', group: 'ops' },
  { id: 'modifiers', label: 'Opcionales y agregados', group: 'ops' },
  { id: 'preview', label: 'Vista previa / Pedido prueba', group: 'ops' },
  { id: 'profile', label: 'Perfil', group: 'config' },
  { id: 'schedules', label: 'Horarios y servicios', group: 'config' },
  { id: 'delivery-zones', label: 'Zonas de entrega', group: 'config' },
  { id: 'payments-taxes', label: 'Payment methods & taxes', group: 'config' },
  { id: 'alert-call', label: 'Llamada de alerta', group: 'config' },
  { id: 'publish', label: 'Publicar en', group: 'config' },
  { id: 'pagos', label: 'Pagos (MP / PayPal)', group: 'config', prodOnly: true },
  { id: 'reports', label: 'Reportes', group: 'growth' },
  { id: 'marketing', label: 'Marketing / Kickstarter', group: 'growth', prodOnly: true },
]
