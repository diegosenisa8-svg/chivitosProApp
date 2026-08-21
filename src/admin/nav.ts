export type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'take-orders'
  | 'clients'
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

export type AdminRole = 'admin' | 'empleado'

export type NavItem = {
  id: AdminSection
  label: string
  group: 'ops' | 'config' | 'growth'
  prodOnly?: boolean
  /** Si falta, solo admin. */
  roles?: AdminRole[]
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'ops', roles: ['admin'] },
  { id: 'orders', label: 'Pedidos', group: 'ops', roles: ['admin', 'empleado'] },
  { id: 'take-orders', label: 'App toma de pedidos', group: 'ops', roles: ['admin'] },
  { id: 'clients', label: 'Clientes', group: 'ops', roles: ['admin'] },
  { id: 'menu', label: 'Configuración del menú', group: 'ops', roles: ['admin', 'empleado'] },
  { id: 'modifiers', label: 'Opcionales y agregados', group: 'ops', roles: ['admin'] },
  { id: 'preview', label: 'Vista previa / Pedido prueba', group: 'ops', roles: ['admin'] },
  { id: 'profile', label: 'Perfil', group: 'config', roles: ['admin'] },
  { id: 'schedules', label: 'Horarios y servicios', group: 'config', roles: ['admin'] },
  { id: 'delivery-zones', label: 'Zonas de entrega', group: 'config', roles: ['admin'] },
  { id: 'payments-taxes', label: 'Payment methods & taxes', group: 'config', roles: ['admin'] },
  { id: 'alert-call', label: 'Llamada de alerta', group: 'config', roles: ['admin'] },
  { id: 'publish', label: 'Publicar en', group: 'config', roles: ['admin'] },
  { id: 'pagos', label: 'Pagos (Mercado Pago)', group: 'config', roles: ['admin'] },
  { id: 'reports', label: 'Reportes', group: 'growth', roles: ['admin'] },
  { id: 'marketing', label: 'Marketing / Kickstarter', group: 'growth', roles: ['admin'], prodOnly: true },
]

export function navForRole(role: string): NavItem[] {
  const r = (role === 'empleado' ? 'empleado' : 'admin') as AdminRole
  return NAV.filter((item) => (item.roles || ['admin']).includes(r))
}

export function defaultSectionForRole(role: string): AdminSection {
  return role === 'empleado' ? 'orders' : 'dashboard'
}
