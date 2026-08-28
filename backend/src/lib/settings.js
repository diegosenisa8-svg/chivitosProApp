export const DEFAULT_SETTINGS = {
  alertPhone: '',
  orderAppEnabled: true,
  alertCallEnabled: true,
  scheduledOrdersEnabled: false,
  tableReservationEnabled: false,
  dineInEnabled: true,
  dineInAnonymous: false,
  pickupEnabled: true,
  deliveryEnabled: true,
  servicesPaused: false,
  separatePickupDeliveryHours: false,
  productType: 'Food',
  timezone: 'America/Montevideo',
  country: 'Uruguay',
  postalCode: '',
  phoneExtra: '',
  websiteUrl: '',
  accountConfirmed: true,
  schedules: [
    { id: 's1', label: 'Martes–Jueves', open: '19:00', close: '00:00', service: 'all' },
    { id: 's2', label: 'Viernes–Sábado', open: '19:00', close: '00:30', service: 'all' },
    { id: 's3', label: 'Domingo', open: '19:00', close: '23:50', service: 'all' },
  ],
  exceptions: [],
  deliveryZones: [
    {
      id: 'z1',
      name: 'Centro',
      color: '#e23b2e',
      fee: 0,
      minOrder: 250,
      shape: 'circle',
      feeByDistance: false,
      freeDelivery: true,
      active: true,
      lat: -31.3883,
      lng: -57.9601,
      radiusKm: 1.4,
    },
    {
      id: 'z2',
      name: 'Cerro / Dos Naciones',
      color: '#2e7d32',
      fee: 100,
      minOrder: 300,
      shape: 'circle',
      feeByDistance: false,
      freeDelivery: false,
      active: true,
      lat: -31.372,
      lng: -57.978,
      radiusKm: 1.6,
    },
    {
      id: 'z3',
      name: 'Costanera',
      color: '#1565c0',
      fee: 80,
      minOrder: 280,
      shape: 'circle',
      feeByDistance: false,
      freeDelivery: false,
      active: true,
      lat: -31.395,
      lng: -57.985,
      radiusKm: 1.3,
    },
    {
      id: 'z4',
      name: 'La Amarilla',
      color: '#c0ca33',
      fee: 110,
      minOrder: 300,
      shape: 'circle',
      feeByDistance: false,
      freeDelivery: false,
      active: true,
      lat: -31.405,
      lng: -57.95,
      radiusKm: 1.5,
    },
    {
      id: 'z5',
      name: 'Barrio Norte',
      color: '#ef6c00',
      fee: 90,
      minOrder: 280,
      shape: 'circle',
      feeByDistance: false,
      freeDelivery: false,
      active: true,
      lat: -31.38,
      lng: -57.945,
      radiusKm: 1.3,
    },
  ],
  paymentMethods: {
    efectivo: true,
    transferencia: true,
    pos: true,
    mercadoPago: false,
    paypal: false,
  },
  transferPayment: {
    bank: 'BROU',
    holder: 'ChivitosPro',
    alias: 'chivitos.pro.mp',
    cbu: '',
    instructions: 'Transferí el total y enviá el comprobante por WhatsApp al local.',
  },
  paymentByChannel: {
    efectivo: { delivery: true, pickup: true, dineIn: true },
    tarjeta: { delivery: false, pickup: true, dineIn: true },
    online: { delivery: true, pickup: true, dineIn: false },
  },
  mercadoPago: {
    blockedBins: [],
    blockedMessage:
      'Para pagar con BROU Recompensa y acceder al 20% de descuento, seleccioná pago con POS.',
  },
  taxes: {
    enabled: false,
    rate: 0,
    label: 'Sales Tax',
    includedInPrice: true,
    category: 'Food',
    deliveryTaxRate: 0,
    currency: 'UYU',
  },
  tips: {
    enabled: false,
    askNoCutlery: true,
    presets: [10, 15, 20],
  },
  reservationDeposit: {
    enabled: false,
    amount: 0,
  },
  orderDevice: {
    paired: true,
    platform: 'Android',
    osVersion: '14',
    deviceId: 'chivitos-device-001',
    appVersion: '3.2.1',
    lastHeartbeatAt: null,
  },
  marketing: {
    firstOrderPromo: true,
    kickstarter: true,
    autopilot: false,
    googleBusiness: false,
    inviteEnabled: true,
  },
  promotions: [
    {
      id: 'p1',
      title: '20% de descuento en pizza',
      description: '',
      code: 'PIZZA20',
      type: 'percent',
      value: 20,
      active: true,
      used: 28,
      createdAt: '2026-07-01',
      associatedTo: 'Web',
      image: '',
    },
    {
      id: 'p2',
      title: 'EL SEGUNDO CHIVITO 50%OFF',
      description: '',
      code: 'CHIVITO50',
      type: 'percent',
      value: 50,
      active: false,
      used: 95,
      createdAt: '2023-01-15',
      associatedTo: 'Web',
      image: '',
    },
  ],
  autopilotCampaigns: [
    {
      id: 'c1',
      name: 'Clientes inactivos 30 días',
      status: 'paused',
      channel: 'email',
      sent: 0,
    },
  ],
  publish: {
    webMenu: true,
    qrFlyers: true,
    social: false,
    privacyPolicy: 'Tus datos se usan solo para gestionar pedidos de ChivitosPro.',
    facebookPage: '',
    smartLink: '',
    widgetEnabled: true,
    whiteLabelApp: false,
  },
  orderWidget: {
    scheduledLimit: 20,
    autoAccept: false,
    autoAcceptVia: 'printer',
    fulfillmentMode: 'default',
    hcaptcha: false,
    billingDetail: 'optional',
  },
  serviceFees: [],
  printers: [{ id: 'pr1', name: 'Cocina 80mm', connected: true, type: 'thermal' }],
  printTemplates: [{ id: 't1', name: 'Ticket 80mm', width: 80 }],
  printHistory: [],
  integrations: [],
  notifications: {
    staffEmails: ['admin@chivitospro.com'],
    customerFromEmail: 'pedidos@chivitospro.com',
  },
  languages: {
    default: 'es',
    enabled: ['es', 'es-UY', 'en', 'pt-BR'],
  },
  siteStats: {
    visitors7d: 420,
    visitorsPrev: 380,
    funnel: { visit: 1000, cart: 220, checkout: 140, order: 95 },
  },
}

function mergeArray(incoming, fallback) {
  return Array.isArray(incoming) ? incoming : fallback
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
    transferPayment: {
      ...DEFAULT_SETTINGS.transferPayment,
      ...(incoming.transferPayment || {}),
    },
    paymentByChannel: {
      ...DEFAULT_SETTINGS.paymentByChannel,
      ...(incoming.paymentByChannel || {}),
      efectivo: {
        ...DEFAULT_SETTINGS.paymentByChannel.efectivo,
        ...(incoming.paymentByChannel?.efectivo || {}),
      },
      tarjeta: {
        ...DEFAULT_SETTINGS.paymentByChannel.tarjeta,
        ...(incoming.paymentByChannel?.tarjeta || {}),
      },
      online: {
        ...DEFAULT_SETTINGS.paymentByChannel.online,
        ...(incoming.paymentByChannel?.online || {}),
      },
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
    tips: { ...DEFAULT_SETTINGS.tips, ...(incoming.tips || {}) },
    reservationDeposit: {
      ...DEFAULT_SETTINGS.reservationDeposit,
      ...(incoming.reservationDeposit || {}),
    },
    orderDevice: { ...DEFAULT_SETTINGS.orderDevice, ...(incoming.orderDevice || {}) },
    marketing: { ...DEFAULT_SETTINGS.marketing, ...(incoming.marketing || {}) },
    publish: { ...DEFAULT_SETTINGS.publish, ...(incoming.publish || {}) },
    orderWidget: { ...DEFAULT_SETTINGS.orderWidget, ...(incoming.orderWidget || {}) },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(incoming.notifications || {}),
      staffEmails: mergeArray(
        incoming.notifications?.staffEmails,
        DEFAULT_SETTINGS.notifications.staffEmails,
      ),
    },
    languages: {
      ...DEFAULT_SETTINGS.languages,
      ...(incoming.languages || {}),
      enabled: mergeArray(incoming.languages?.enabled, DEFAULT_SETTINGS.languages.enabled),
    },
    siteStats: { ...DEFAULT_SETTINGS.siteStats, ...(incoming.siteStats || {}) },
    schedules: mergeArray(incoming.schedules, DEFAULT_SETTINGS.schedules),
    exceptions: mergeArray(incoming.exceptions, DEFAULT_SETTINGS.exceptions),
    deliveryZones: mergeArray(incoming.deliveryZones, DEFAULT_SETTINGS.deliveryZones),
    promotions: mergeArray(incoming.promotions, DEFAULT_SETTINGS.promotions),
    autopilotCampaigns: mergeArray(
      incoming.autopilotCampaigns,
      DEFAULT_SETTINGS.autopilotCampaigns,
    ),
    serviceFees: mergeArray(incoming.serviceFees, DEFAULT_SETTINGS.serviceFees),
    printers: mergeArray(incoming.printers, DEFAULT_SETTINGS.printers),
    printTemplates: mergeArray(incoming.printTemplates, DEFAULT_SETTINGS.printTemplates),
    printHistory: mergeArray(incoming.printHistory, DEFAULT_SETTINGS.printHistory),
    integrations: mergeArray(incoming.integrations, DEFAULT_SETTINGS.integrations),
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
