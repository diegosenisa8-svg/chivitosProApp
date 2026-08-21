export const DEFAULT_SETTINGS = {
  alertPhone: '',
  orderAppEnabled: true,
  alertCallEnabled: true,
  scheduledOrdersEnabled: true,
  tableReservationEnabled: false,
  dineInEnabled: false,
  servicesPaused: false,
  separatePickupDeliveryHours: false,
  schedules: [
    { id: 's1', label: 'Martes–Jueves', open: '19:00', close: '00:00', service: 'all' },
    { id: 's2', label: 'Viernes–Sábado', open: '19:00', close: '00:30', service: 'all' },
    { id: 's3', label: 'Domingo', open: '19:00', close: '23:50', service: 'all' },
  ],
  exceptions: [],
  deliveryZones: [
    { id: 'z1', name: 'Centro', color: '#e23b2e', fee: 80, active: true },
    { id: 'z2', name: 'Cerro / Dos Naciones', color: '#f5a623', fee: 100, active: true },
    { id: 'z3', name: 'Salto Nuevo / Ceibal', color: '#f7d046', fee: 120, active: true },
    { id: 'z4', name: 'La Amarilla', color: '#2bbbad', fee: 110, active: true },
    { id: 'z5', name: 'Este', color: '#4caf50', fee: 130, active: true },
  ],
  paymentMethods: {
    efectivo: true,
    transferencia: true,
    pos: true,
    mercadoPago: false,
    paypal: false,
  },
  mercadoPago: {
    blockedBins: [],
    blockedMessage:
      'Para pagar con BROU Recompensa y acceder al 20% de descuento, seleccioná pago con POS.',
  },
  taxes: { enabled: false, rate: 0, label: 'IVA' },
  marketing: {
    firstOrderPromo: true,
    kickstarter: false,
    autopilot: false,
    googleBusiness: false,
  },
  publish: {
    webMenu: true,
    qrFlyers: true,
    social: false,
  },
}

export function mergeSettings(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {}
  return {
    ...DEFAULT_SETTINGS,
    ...incoming,
    paymentMethods: {
      ...DEFAULT_SETTINGS.paymentMethods,
      ...(incoming.paymentMethods || {}),
    },
    mercadoPago: {
      ...DEFAULT_SETTINGS.mercadoPago,
      ...(incoming.mercadoPago || {}),
      blockedBins: Array.isArray(incoming.mercadoPago?.blockedBins)
        ? incoming.mercadoPago.blockedBins
            .map((b) => String(b).replace(/\D/g, ''))
            .filter((b) => b.length >= 4 && b.length <= 8)
        : DEFAULT_SETTINGS.mercadoPago.blockedBins,
      blockedMessage:
        typeof incoming.mercadoPago?.blockedMessage === 'string' &&
        incoming.mercadoPago.blockedMessage.trim()
          ? incoming.mercadoPago.blockedMessage.trim()
          : DEFAULT_SETTINGS.mercadoPago.blockedMessage,
    },
    taxes: { ...DEFAULT_SETTINGS.taxes, ...(incoming.taxes || {}) },
    marketing: { ...DEFAULT_SETTINGS.marketing, ...(incoming.marketing || {}) },
    publish: { ...DEFAULT_SETTINGS.publish, ...(incoming.publish || {}) },
    schedules: Array.isArray(incoming.schedules)
      ? incoming.schedules
      : DEFAULT_SETTINGS.schedules,
    exceptions: Array.isArray(incoming.exceptions)
      ? incoming.exceptions
      : DEFAULT_SETTINGS.exceptions,
    deliveryZones: Array.isArray(incoming.deliveryZones)
      ? incoming.deliveryZones
      : DEFAULT_SETTINGS.deliveryZones,
  }
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48)
}
