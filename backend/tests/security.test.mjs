/**
 * Pruebas de las dos reglas que, si se rompen, comprometen el sistema entero:
 * quién puede entrar al panel, y quién decide cuánto cuesta un pedido.
 *
 * No tocan la base: todo lo que se prueba acá son funciones puras.
 *   node --test tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba-suficientemente-largo-1234'
const SECRET = process.env.JWT_SECRET

const { signToken, signCustomerTokenLike, verifyAdminToken } = await (async () => {
  const auth = await import('../src/lib/auth.js')
  return {
    signToken: auth.signToken,
    verifyAdminToken: auth.verifyAdminToken,
    signCustomerTokenLike: (id) => jwt.sign({ sub: id, typ: 'customer' }, SECRET, { expiresIn: '7d' }),
  }
})()

const { priceOrder, OrderError } = await import('../src/lib/pricing.js')
const { canTransition } = await import('../src/lib/validation.js')

// ---------------------------------------------------------------- auth ----

test('un token de cliente no sirve como token de admin', () => {
  const result = verifyAdminToken(signCustomerTokenLike('cliente-1'))
  assert.ok(result.error, 'el token de cliente debería ser rechazado')
})

test('un token de admin sin typ (emitido antes del fix) queda invalidado', () => {
  const viejo = jwt.sign({ sub: 'a1', role: 'admin' }, SECRET, { expiresIn: '7d' })
  assert.ok(verifyAdminToken(viejo).error)
})

test('token ausente, vacío o con firma inválida se rechazan', () => {
  assert.ok(verifyAdminToken(null).error)
  assert.ok(verifyAdminToken('').error)
  assert.ok(verifyAdminToken('abc.def.ghi').error)
  assert.ok(verifyAdminToken(jwt.sign({ sub: 'a1', typ: 'admin' }, 'otro-secreto')).error)
})

test('un token de admin válido pasa y conserva rol y versión de sesión', () => {
  const token = signToken({ id: 'a1', email: 'a@x.com', role: 'admin', name: 'A', tokenVersion: 3 })
  const { payload, error } = verifyAdminToken(token)
  assert.equal(error, undefined)
  assert.equal(payload.typ, 'admin')
  assert.equal(payload.role, 'admin')
  assert.equal(payload.ver, 3)
})

// ------------------------------------------------------------- pricing ----

const restaurant = {
  open: true,
  delivery: true,
  takeaway: true,
  deliveryFee: 80,
  minOrder: 250,
  settings: {
    promotions: [{ code: 'PIZZA20', type: 'percent', value: 20, active: true }],
    deliveryZones: [
      { id: 'z1', name: 'Centro', fee: 0, minOrder: 250, active: true, freeDelivery: true,
        shape: 'circle', lat: -31.3883, lng: -57.9601, radiusKm: 1.4 },
      { id: 'z2', name: 'Cerro', fee: 100, minOrder: 300, active: true,
        shape: 'circle', lat: -31.372, lng: -57.978, radiusKm: 1.6 },
    ],
  },
}

const products = [
  {
    id: 'chivito',
    name: 'Chivito',
    price: 300,
    priceMax: 450,
    available: true,
    modifiers: [
      {
        externalId: 'extras',
        name: 'Extras',
        required: false,
        min: 0,
        max: 2,
        allowQuantity: false,
        options: [
          { externalId: 'queso', name: 'Queso', price: 50 },
          { externalId: 'panceta', name: 'Panceta', price: 70 },
        ],
      },
    ],
  },
  { id: 'agua', name: 'Agua', price: 60, priceMax: null, available: true, modifiers: [] },
  { id: 'agotado', name: 'Agotado', price: 100, priceMax: null, available: false, modifiers: [] },
]

const EN_CERRO = { lat: -31.372, lng: -57.978, accuracy: 12 }
const EN_CENTRO = { lat: -31.3883, lng: -57.9601, accuracy: 8 }
const LEJOS = { lat: -31.62, lng: -58.25, accuracy: 20 }

const baseBody = {
  fulfillment: 'delivery',
  location: EN_CERRO,
  addressDetail: 'Casa 1234',
  items: [{ productId: 'chivito', quantity: 1, notes: '', modifiers: [] }],
}

test('el precio manipulado por el cliente se ignora: manda el de la base', () => {
  const priced = priceOrder({
    restaurant,
    products,
    body: {
      ...baseBody,
      // Un atacante mandando un chivito a $1 y envío negativo:
      subtotal: 1,
      discount: 9999,
      deliveryFee: -500,
      items: [
        { productId: 'chivito', quantity: 1, notes: '', unitPrice: 1, lineTotal: 1, modifiers: [] },
      ],
    },
  })
  assert.equal(priced.items[0].unitPrice, 300)
  assert.equal(priced.subtotal, 300)
  assert.equal(priced.discount, 0)
  assert.equal(priced.deliveryFee, 100)
  assert.equal(priced.total, 400)
})

test('el precio del modificador sale de la base, no del body', () => {
  const priced = priceOrder({
    restaurant,
    products,
    body: {
      ...baseBody,
      items: [
        {
          productId: 'chivito',
          quantity: 2,
          notes: '',
          modifiers: [{ groupId: 'extras', optionId: 'queso', quantity: 1, price: -1000 }],
        },
      ],
    },
  })
  assert.equal(priced.items[0].modifiers[0].price, 50)
  assert.equal(priced.items[0].lineTotal, 700) // (300 + 50) * 2
})

test('"Porción grande" cobra priceMax; sin tamaño cobra el precio base', () => {
  const grande = priceOrder({
    restaurant,
    products,
    body: { ...baseBody, items: [{ productId: 'chivito', quantity: 1, notes: '', sizeLabel: 'Porción grande', modifiers: [] }] },
  })
  assert.equal(grande.items[0].unitPrice, 450)
  assert.equal(grande.items[0].sizeLabel, 'Porción grande')
})

test('un producto inexistente o sin stock se rechaza', () => {
  assert.throws(
    () => priceOrder({ restaurant, products, body: { ...baseBody, items: [{ productId: 'inventado', quantity: 1, notes: '', modifiers: [] }] } }),
    OrderError,
  )
  assert.throws(
    () => priceOrder({ restaurant, products, body: { ...baseBody, items: [{ productId: 'agotado', quantity: 1, notes: '', modifiers: [] }] } }),
    OrderError,
  )
})

test('un modificador que no pertenece al producto se rechaza', () => {
  assert.throws(
    () =>
      priceOrder({
        restaurant,
        products,
        body: {
          ...baseBody,
          items: [{ productId: 'chivito', quantity: 1, notes: '', modifiers: [{ groupId: 'extras', optionId: 'trufa', quantity: 1 }] }],
        },
      }),
    OrderError,
  )
})

test('se respeta el máximo de opciones de un grupo', () => {
  assert.throws(
    () =>
      priceOrder({
        restaurant,
        products,
        body: {
          ...baseBody,
          items: [
            {
              productId: 'chivito',
              quantity: 1,
              notes: '',
              modifiers: [
                { groupId: 'extras', optionId: 'queso', quantity: 2 },
                { groupId: 'extras', optionId: 'panceta', quantity: 2 },
              ],
            },
          ],
        },
      }),
    OrderError,
  )
})

test('el cupón se resuelve contra la configuración, no contra el body', () => {
  const conCupon = priceOrder({ restaurant, products, body: { ...baseBody, couponCode: 'pizza20' } })
  assert.equal(conCupon.discount, 60) // 20% de 300
  assert.equal(conCupon.coupon, 'PIZZA20')

  const inventado = priceOrder({ restaurant, products, body: { ...baseBody, couponCode: 'NO-EXISTE' } })
  assert.equal(inventado.discount, 0)
})

test('la zona la resuelven las coordenadas, no el cliente', () => {
  const centro = priceOrder({ restaurant, products, body: { ...baseBody, location: EN_CENTRO } })
  assert.equal(centro.zone.id, 'z1')
  assert.equal(centro.deliveryFee, 0) // Centro tiene envío gratis
  assert.equal(centro.outOfRange, false)

  const cerro = priceOrder({ restaurant, products, body: baseBody })
  assert.equal(cerro.zone.id, 'z2')
  assert.equal(cerro.deliveryFee, 100)
})

test('sin ubicación no se puede pedir delivery', () => {
  const sinUbicacion = { ...baseBody }
  delete sinUbicacion.location
  assert.throws(() => priceOrder({ restaurant, products, body: sinUbicacion }), OrderError)

  // Una coordenada inventada fuera de rango terrestre tampoco vale.
  assert.throws(
    () => priceOrder({ restaurant, products, body: { ...baseBody, location: { lat: 0, lng: 0 } } }),
    OrderError,
  )
})

test('el número de casa o apto es obligatorio en delivery', () => {
  const sinDetalle = { ...baseBody, addressDetail: '   ' }
  assert.throws(() => priceOrder({ restaurant, products, body: sinDetalle }), OrderError)
})

test('fuera de todas las zonas: entra marcado y paga la tarifa más alta', () => {
  const lejos = priceOrder({ restaurant, products, body: { ...baseBody, location: LEJOS } })
  assert.equal(lejos.outOfRange, true)
  assert.equal(lejos.zone, null)
  assert.equal(lejos.deliveryFee, 100) // la más cara de las zonas activas
  assert.equal(lejos.location.lat, LEJOS.lat)
  assert.equal(lejos.location.accuracy, 20)
})

test('se aplica el mínimo de pedido de la zona resuelta', () => {
  // Agua ($60) contra el mínimo de $300 de la zona Cerro.
  assert.throws(
    () => priceOrder({ restaurant, products, body: { ...baseBody, items: [{ productId: 'agua', quantity: 1, notes: '', modifiers: [] }] } }),
    OrderError,
  )
})

test('el retiro en el local no pide ubicación ni número de casa', () => {
  const pickup = priceOrder({
    restaurant,
    products,
    body: { fulfillment: 'pickup', items: [{ productId: 'chivito', quantity: 1, notes: '', modifiers: [] }] },
  })
  assert.equal(pickup.location, null)
  assert.equal(pickup.outOfRange, false)
})

test('con el local cerrado o los servicios pausados no se toman pedidos', () => {
  assert.throws(() => priceOrder({ restaurant: { ...restaurant, open: false }, products, body: baseBody }), OrderError)
  assert.throws(
    () =>
      priceOrder({
        restaurant: { ...restaurant, settings: { ...restaurant.settings, servicesPaused: true } },
        products,
        body: baseBody,
      }),
    OrderError,
  )
})

test('retiro en el local no paga envío ni mínimo de delivery', () => {
  const pickup = priceOrder({
    restaurant,
    products,
    body: { fulfillment: 'pickup', items: [{ productId: 'agua', quantity: 1, notes: '', modifiers: [] }] },
  })
  assert.equal(pickup.deliveryFee, 0)
  assert.equal(pickup.total, 60)
})

// --------------------------------------------------- geometría de zonas ---

const { findZoneAtPoint, pointInPolygon, haversineKm } = await import('../src/lib/geo.js')

test('zona con polígono: adentro entra, afuera no', () => {
  const cuadrado = [
    { lat: -31.40, lng: -57.98 },
    { lat: -31.40, lng: -57.94 },
    { lat: -31.36, lng: -57.94 },
    { lat: -31.36, lng: -57.98 },
  ]
  assert.equal(pointInPolygon({ lat: -31.38, lng: -57.96 }, cuadrado), true)
  assert.equal(pointInPolygon({ lat: -31.50, lng: -57.96 }, cuadrado), false)

  const zonas = [{ id: 'p1', name: 'Polígono', active: true, shape: 'polygon', polygon: cuadrado, fee: 55 }]
  assert.equal(findZoneAtPoint(zonas, { lat: -31.38, lng: -57.96 }).id, 'p1')
  assert.equal(findZoneAtPoint(zonas, { lat: -31.50, lng: -57.96 }), null)
})

test('las zonas inactivas se ignoran', () => {
  const zonas = [
    { id: 'off', name: 'Apagada', active: false, shape: 'circle', lat: -31.38, lng: -57.96, radiusKm: 5 },
  ]
  assert.equal(findZoneAtPoint(zonas, { lat: -31.38, lng: -57.96 }), null)
})

test('haversine mide distancias razonables', () => {
  const d = haversineKm({ lat: -31.3883, lng: -57.9601 }, { lat: -31.372, lng: -57.978 })
  assert.ok(d > 1 && d < 4, `distancia inesperada: ${d}`)
})

// ------------------------------------------ configuración pública ---------

const { publicSettings } = await import('../src/lib/menu.js')

test('el menú público no expone la configuración interna del local', () => {
  const s = publicSettings({
    alertPhone: '099111222',
    notifications: { staffEmails: ['dueno@chivitospro.com'] },
    printers: [{ id: 'pr1', name: 'Cocina' }],
    integrations: [{ id: 'x', token: 'secreto' }],
    siteStats: { visitors7d: 420 },
    paymentMethods: { efectivo: true, transferencia: false },
    promotions: [
      { code: 'ACTIVA', type: 'percent', value: 10, active: true, used: 28 },
      { code: 'GUARDADA', type: 'percent', value: 50, active: false, used: 95 },
    ],
  })

  assert.equal(s.alertPhone, undefined)
  assert.equal(s.notifications, undefined)
  assert.equal(s.printers, undefined)
  assert.equal(s.integrations, undefined)
  assert.equal(s.siteStats, undefined)
  // Los datos bancarios solo viajan si la transferencia está habilitada.
  assert.equal(s.transferPayment, undefined)
  // Las promociones inactivas no se publican, ni el contador de usos.
  assert.deepEqual(s.promotions.map((p) => p.code), ['ACTIVA'])
  assert.equal(s.promotions[0].used, undefined)
})

test('el menú público sí trae lo que el checkout necesita', () => {
  const s = publicSettings({
    paymentMethods: { efectivo: true, transferencia: true },
    transferPayment: { bank: 'BROU', alias: 'chivitos.pro' },
    deliveryZones: [
      { id: 'z1', name: 'Centro', fee: 0, active: true },
      { id: 'z9', name: 'Vieja', fee: 50, active: false },
    ],
  })

  assert.equal(s.paymentMethods.efectivo, true)
  assert.equal(s.transferPayment.alias, 'chivitos.pro')
  assert.deepEqual(s.deliveryZones.map((z) => z.id), ['z1'])
})

// ------------------------------------------------- estados de un pedido ----

test('un pedido cancelado no puede pasar a entregado', () => {
  assert.equal(canTransition('cancelled', 'delivered'), false)
  assert.equal(canTransition('cancelled', 'pending'), true)
  assert.equal(canTransition('delivered', 'cancelled'), true)
  assert.equal(canTransition('delivered', 'preparing'), false)
  assert.equal(canTransition('pending', 'preparing'), true)
})
