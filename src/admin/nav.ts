export type AdminSection =
  // Configuración › Perfil
  | 'profile-address'
  | 'profile-location'
  | 'profile-website'
  | 'profile-product-type'
  | 'profile-confirm'
  // Configuración › Horarios y servicios
  | 'schedules-pickup'
  | 'schedules-delivery'
  | 'schedules-reservation'
  | 'schedules-dinein'
  | 'schedules-hours'
  | 'schedules-scheduled'
  // Configuración › Payment & taxes
  | 'pay-taxes'
  | 'pay-methods'
  // Configuración › Tomar pedidos
  | 'take-orders-app'
  | 'take-orders-alert'
  // Configuración › Menú
  | 'menu'
  | 'modifiers'
  | 'preview'
  // Configuración › Publicar en
  | 'publish-privacy'
  | 'publish-facebook'
  | 'publish-smartlinks'
  | 'publish-web'
  | 'publish-widget'
  | 'publish-app'
  // Configuración › Pagos
  | 'pagos-providers'
  | 'pagos-tips'
  | 'pagos-deposit'
  // Marketing
  | 'mkt-kickstarter'
  | 'mkt-kickstarter-first'
  | 'mkt-kickstarter-invite'
  | 'mkt-autopilot'
  | 'mkt-autopilot-campaigns'
  | 'mkt-scanner'
  | 'mkt-google'
  | 'mkt-promos'
  | 'mkt-promos-list'
  | 'mkt-promos-templates'
  | 'mkt-qr'
  // Reportes
  | 'dashboard'
  | 'sales-trend'
  | 'sales-summary'
  | 'menu-insights-categories'
  | 'menu-insights-items'
  | 'online-funnel'
  | 'report-clients-metrics'
  | 'report-reservations'
  | 'google-ranking'
  | 'website-visits'
  | 'delivery-map'
  | 'connectivity-health'
  | 'promotions-stats'
  | 'report-orders'
  | 'report-clients'
  // Pedidos en línea
  | 'print-overview'
  | 'print-printers'
  | 'print-templates'
  | 'print-history'
  | 'widget-scheduled-limit'
  | 'widget-auto-orders'
  | 'widget-service-fees'
  | 'widget-fulfillment'
  | 'widget-hcaptcha'
  | 'widget-billing'
  | 'integrations-catalog'
  | 'integrations-yours'
  // Otro
  | 'other-notifications'
  | 'other-languages'
  // Compat / empleado
  | 'orders'
  | 'take-orders'
  | 'clients'
  | 'profile'
  | 'schedules'
  | 'delivery-zones'
  | 'payments-taxes'
  | 'alert-call'
  | 'publish'
  | 'pagos'
  | 'reports'
  | 'marketing'

export type AdminRole = 'admin' | 'empleado'

export type NavLeaf = {
  id: AdminSection
  label: string
  roles?: AdminRole[]
}

export type NavGroup = {
  id: string
  label: string
  items: NavLeaf[]
}

export type NavModule = {
  id: 'config' | 'marketing' | 'reports' | 'online' | 'other'
  label: string
  icon: string
  groups: NavGroup[]
  roles?: AdminRole[]
}

export const MODULES: NavModule[] = [
  {
    id: 'config',
    label: 'Configuración',
    icon: 'settings',
    groups: [
      {
        id: 'perfil',
        label: 'Perfil',
        items: [
          { id: 'profile-address', label: 'Dirección' },
          { id: 'profile-location', label: 'Ubicación' },
        ],
      },
      {
        id: 'horarios',
        label: 'Horarios y servicios',
        items: [
          { id: 'schedules-pickup', label: 'Recoger' },
          { id: 'schedules-delivery', label: 'Entrega' },
          { id: 'schedules-reservation', label: 'Reserva de mesa' },
          { id: 'schedules-dinein', label: 'Local' },
          { id: 'schedules-hours', label: 'Horario de apertura' },
        ],
      },
      {
        id: 'payment-taxes',
        label: 'Métodos de pago e impuestos',
        items: [
          { id: 'pay-taxes', label: 'Impuestos' },
          { id: 'pay-methods', label: 'Métodos de pago' },
        ],
      },
      {
        id: 'tomar',
        label: 'Tomar pedidos',
        items: [
          { id: 'take-orders-app', label: 'App de toma de pedidos', roles: ['admin', 'empleado'] },
          { id: 'take-orders-alert', label: 'Llamada de alerta' },
        ],
      },
      {
        id: 'menu-cfg',
        label: 'Configuración del menú',
        items: [
          { id: 'menu', label: 'Configuración del menú', roles: ['admin', 'empleado'] },
          { id: 'modifiers', label: 'Opcionales y agregados' },
          { id: 'preview', label: 'Vista previa & Pedido de prueba' },
        ],
      },
      {
        id: 'publicar',
        label: 'Publicar en',
        items: [
          { id: 'publish-privacy', label: 'Política de privacidad' },
          { id: 'publish-facebook', label: 'Facebook' },
          { id: 'publish-smartlinks', label: 'Enlaces inteligentes' },
          { id: 'publish-web', label: 'Página Web' },
          { id: 'publish-widget', label: 'Widget HTML' },
          { id: 'publish-app', label: 'Aplicación móvil con su marca' },
        ],
      },
      {
        id: 'pagos',
        label: 'Pagos',
        items: [
          { id: 'pagos-providers', label: 'Proveedores' },
          { id: 'pagos-tips', label: 'Propinas' },
          { id: 'pagos-deposit', label: 'Seña de reserva' },
        ],
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'marketing',
    groups: [
      {
        id: 'kickstarter',
        label: 'Arranque',
        items: [
          { id: 'mkt-kickstarter', label: 'Visión general' },
          { id: 'mkt-kickstarter-first', label: 'Promoción de la primera compra' },
          { id: 'mkt-kickstarter-invite', label: 'Invitar a clientes potenciales' },
        ],
      },
      {
        id: 'autopilot',
        label: 'Piloto automático',
        items: [
          { id: 'mkt-autopilot', label: 'Visión general' },
          { id: 'mkt-autopilot-campaigns', label: 'Sus campañas' },
        ],
      },
      {
        id: 'scanner',
        label: 'Escáner del sitio web',
        items: [{ id: 'mkt-scanner', label: 'Optimización web' }],
      },
      {
        id: 'gmb',
        label: 'Google Business',
        items: [{ id: 'mkt-google', label: 'Visión general' }],
      },
      {
        id: 'promos',
        label: 'Promociones',
        items: [
          { id: 'mkt-promos', label: 'Visión general' },
          { id: 'mkt-promos-list', label: 'Tus promociones' },
          { id: 'mkt-promos-templates', label: 'Promociones prefabricadas' },
        ],
      },
      {
        id: 'qr',
        label: 'Códigos QR y Flyers',
        items: [{ id: 'mkt-qr', label: 'Códigos QR y Flyers' }],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: 'reports',
    groups: [
      {
        id: 'orders-clients',
        label: 'Reporte de pedidos y clientes',
        items: [
          { id: 'report-orders', label: 'Pedidos', roles: ['admin', 'empleado'] },
          { id: 'report-clients', label: 'Clientes' },
        ],
      },
      {
        id: 'dash',
        label: 'Panel',
        items: [{ id: 'dashboard', label: 'Panel principal' }],
      },
      {
        id: 'sales',
        label: 'Ventas',
        items: [
          { id: 'sales-trend', label: 'Tendencia' },
          { id: 'sales-summary', label: 'Resumen' },
        ],
      },
      {
        id: 'menu-insights',
        label: 'Análisis del menú',
        items: [
          { id: 'menu-insights-categories', label: 'Categorías' },
          { id: 'menu-insights-items', label: 'Productos' },
        ],
      },
      {
        id: 'online',
        label: 'Pedidos online',
        items: [{ id: 'online-funnel', label: 'Embudo del sitio web' }],
      },
      {
        id: 'more-reports',
        label: 'Más reportes',
        items: [
          { id: 'report-clients-metrics', label: 'Clientes' },
          { id: 'report-reservations', label: 'Reserva de mesa' },
          { id: 'google-ranking', label: 'Ranking Google' },
          { id: 'website-visits', label: 'Visitas del sitio web' },
          { id: 'delivery-map', label: 'Mapa de pedidos a domicilio' },
          { id: 'connectivity-health', label: 'Salud de conectividad' },
          { id: 'promotions-stats', label: 'Estadísticas de promociones' },
        ],
      },
    ],
  },
  {
    id: 'online',
    label: 'Pedidos',
    icon: 'online',
    groups: [
      {
        id: 'print',
        label: 'Impresión (app para hacer pedidos)',
        items: [
          { id: 'print-overview', label: 'Visión General' },
          { id: 'print-printers', label: 'Impresoras' },
          { id: 'print-templates', label: 'Plantillas' },
          { id: 'print-history', label: 'Historial de impresión' },
        ],
      },
      {
        id: 'widget',
        label: 'Widget de pedidos',
        items: [
          { id: 'widget-scheduled-limit', label: 'Límite de pedidos programados' },
          { id: 'widget-auto-orders', label: 'Pedidos automáticos' },
          { id: 'widget-service-fees', label: 'Tarifas de servicios' },
          { id: 'widget-fulfillment', label: 'Opciones de cumplimiento' },
          { id: 'widget-hcaptcha', label: 'hCaptcha' },
          { id: 'widget-billing', label: 'Detalle de facturación en checkout' },
        ],
      },
      {
        id: 'integrations',
        label: 'Integraciones',
        items: [
          { id: 'integrations-catalog', label: 'Catálogo' },
          { id: 'integrations-yours', label: 'Tus integraciones' },
        ],
      },
    ],
  },
  {
    id: 'other',
    label: 'Más',
    icon: 'other',
    groups: [
      {
        id: 'general',
        label: 'General',
        items: [
          { id: 'other-notifications', label: 'Notificaciones' },
          { id: 'other-languages', label: 'Idiomas soportados' },
        ],
      },
    ],
  },
]

/** Alias legacy → sección nueva (compat navegación antigua). */
export const LEGACY_SECTION_MAP: Partial<Record<AdminSection, AdminSection>> = {
  orders: 'report-orders',
  'take-orders': 'take-orders-app',
  clients: 'report-clients',
  profile: 'profile-address',
  schedules: 'schedules-hours',
  'delivery-zones': 'schedules-delivery',
  'payments-taxes': 'pay-methods',
  'alert-call': 'take-orders-alert',
  publish: 'publish-web',
  pagos: 'pagos-providers',
  reports: 'dashboard',
  marketing: 'mkt-promos-list',
  'profile-website': 'profile-address',
  'profile-product-type': 'profile-address',
  'profile-confirm': 'profile-address',
  'schedules-scheduled': 'schedules-hours',
}

export function allLeaves(): NavLeaf[] {
  return MODULES.flatMap((m) => m.groups.flatMap((g) => g.items))
}

export function sectionAllowed(section: AdminSection, role: string): boolean {
  const r = (role === 'empleado' ? 'empleado' : 'admin') as AdminRole
  const leaf = allLeaves().find((l) => l.id === section)
  if (!leaf) return r === 'admin'
  return (leaf.roles || ['admin']).includes(r)
}

export function modulesForRole(role: string): NavModule[] {
  const r = (role === 'empleado' ? 'empleado' : 'admin') as AdminRole
  return MODULES.map((mod) => ({
    ...mod,
    groups: mod.groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => (item.roles || ['admin']).includes(r)),
      }))
      .filter((g) => g.items.length > 0),
  })).filter((m) => m.groups.length > 0)
}

export function defaultSectionForRole(_role: string): AdminSection {
  // Pedidos primero: operación diaria (admin y empleado).
  return 'report-orders'
}

export function moduleOfSection(section: AdminSection): NavModule['id'] | null {
  for (const m of MODULES) {
    if (m.groups.some((g) => g.items.some((i) => i.id === section))) return m.id
  }
  const mapped = LEGACY_SECTION_MAP[section]
  if (mapped) return moduleOfSection(mapped)
  return null
}

export function groupOfSection(section: AdminSection): string | null {
  for (const m of MODULES) {
    for (const g of m.groups) {
      if (g.items.some((i) => i.id === section)) return g.id
    }
  }
  const mapped = LEGACY_SECTION_MAP[section]
  if (mapped) return groupOfSection(mapped)
  return null
}
