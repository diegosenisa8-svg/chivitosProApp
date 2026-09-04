import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { FulfillmentToggle } from '../components/FulfillmentToggle'
import { MercadoPagoCardBrick } from '../components/MercadoPagoCardBrick'
import { useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useMenu } from '../context/MenuContext'
import {
  fetchPaymentConfig,
  payWithMercadoPago,
  submitOrder,
  type PaymentConfig,
} from '../lib/api'
import { formatMoney } from '../lib/format'
import { resolveDelivery } from '../lib/deliveryZones'
import { scrollToFirst } from '../lib/scrollToError'
import type { CheckoutInfo } from '../types'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { menu } = useMenu()
  const { customer, getToken } = useCustomerAuth()
  const {
    lines,
    subtotal,
    discount,
    deliveryFee,
    fulfillment,
    coupon,
    checkout,
    setCheckout,
    clear,
  } = useCart()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [testPopup, setTestPopup] = useState(false)
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null)
  const [binBlocked, setBinBlocked] = useState(false)
  const [mpError, setMpError] = useState('')
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'ok' | 'error'>('idle')
  const [geoError, setGeoError] = useState('')
  const orderIdempotencyKey = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  )

  function nextIdempotencyKey() {
    orderIdempotencyKey.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  const total = Math.max(0, subtotal - discount + deliveryFee)
  const r = menu.restaurant
  // La zona sale de la ubicación del cliente con la misma regla que aplica el
  // backend. Acá es solo para mostrarla; lo que se cobra lo decide el servidor.
  const delivery = resolveDelivery(
    r.settings?.deliveryZones,
    checkout.location ? { lat: checkout.location.lat, lng: checkout.location.lng } : null,
    r.deliveryFee ?? 80,
  )
  const selectedZone = delivery.zone
  const pm = r.settings?.paymentMethods || {}
  const transfer = r.settings?.transferPayment || {}
  const isLocal =
    import.meta.env.DEV ||
    ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
    /\.ngrok(-free)?\.(dev|app|io)$/i.test(window.location.hostname)

  useEffect(() => {
    if (!customer) return
    setCheckout({
      name: checkout.name || customer.name,
      phone: checkout.phone || customer.phone || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  useEffect(() => {
    fetchPaymentConfig()
      .then(setPayConfig)
      .catch(() =>
        setPayConfig({
          enabled: false,
          configured: false,
          publicKey: '',
          blockedBins: [],
          blockedMessage: '',
        }),
      )
  }, [])

  const mpAvailable = Boolean(payConfig?.enabled && payConfig.publicKey)
  const onBinBlockedChange = useCallback((blocked: boolean) => {
    setBinBlocked(blocked)
    if (blocked) setMpError('')
  }, [])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoState('error')
      setGeoError('Este navegador no permite compartir la ubicación. Probá desde el celular.')
      return
    }
    setGeoState('asking')
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCheckout({
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        })
        setGeoState('ok')
        setErrors((prev) => {
          if (!prev.location) return prev
          const next = { ...prev }
          delete next.location
          return next
        })
      },
      (err) => {
        setGeoState('error')
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Necesitamos tu ubicación para llevarte el pedido. Activala en los permisos del navegador y tocá Reintentar.'
            : 'No pudimos obtener tu ubicación. Salí al aire libre o probá de nuevo.',
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Se pide apenas entra al checkout con delivery: sin ubicación no hay pedido.
  useEffect(() => {
    if (fulfillment === 'delivery' && !checkout.location && geoState === 'idle') {
      requestLocation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment])

  function validate() {
    const next: Record<string, string> = {}
    if (!checkout.name.trim()) next.name = 'Ingresá tu nombre'
    if (!checkout.phone.trim() || checkout.phone.replace(/\D/g, '').length < 8) {
      next.phone = 'Ingresá un teléfono válido'
    }
    if (fulfillment === 'delivery' && !checkout.location) {
      next.location = 'Activá tu ubicación para poder pedir delivery'
    }
    if (fulfillment === 'delivery' && !checkout.addressDetail.trim()) {
      next.addressDetail = 'Ingresá el número de casa o apartamento'
    }
    if (checkout.schedule === 'later' && !checkout.scheduleTime) {
      next.scheduleTime = 'Elegí un horario'
    }
    // Fuera de rango no hay zona de la cual tomar el mínimo: se usa el general,
    // igual que en backend/src/lib/pricing.js.
    const minOrder =
      fulfillment === 'delivery' && !delivery.outOfRange && selectedZone?.minOrder
        ? selectedZone.minOrder
        : r.minOrder || 0
    if (fulfillment === 'delivery' && subtotal < minOrder) {
      next.min = `El mínimo de pedido es ${formatMoney(minOrder)}`
    }
    setErrors(next)
    const keys = Object.keys(next)
    if (keys.length) {
      const order = ['name', 'phone', 'location', 'addressDetail', 'scheduleTime', 'min']
      const first = order.find((k) => next[k]) || keys[0]
      requestAnimationFrame(() => {
        scrollToFirst([`[data-field="${first}"]`, '.error-inline'])
      })
      return false
    }
    return true
  }

  function checkoutWithZone(): CheckoutInfo {
    if (fulfillment !== 'delivery') return { ...checkout, fulfillment }
    const zoneLabel = delivery.outOfRange
      ? 'FUERA DE ZONA — confirmar con el cliente si se puede llegar'
      : selectedZone?.name
        ? `Zona: ${selectedZone.name}${
            delivery.fee > 0 ? ` (envío ${formatMoney(delivery.fee)})` : ' (envío gratis)'
          }`
        : delivery.fee > 0
          ? `Envío ${formatMoney(delivery.fee)}`
          : ''
    const notes = [checkout.notes.trim(), zoneLabel].filter(Boolean).join(' · ')
    return { ...checkout, fulfillment, notes }
  }

  async function finishNonCard() {
    if (!lines.length || busy) return
    if (!validate()) return
    setBusy(true)
    setMpError('')

    let order
    try {
      order = await submitOrder(
        lines,
        r.currency,
        checkoutWithZone(),
        { couponCode: coupon, idempotencyKey: orderIdempotencyKey.current },
        getToken(),
      )
    } catch (e) {
      // Nunca confirmar un pedido que no llegó a la API: antes se mostraba
      // "¡Pedido confirmado!" igual y el cliente esperaba comida que nadie
      // estaba preparando.
      setBusy(false)
      if (isLocal) {
        setTestPopup(true)
        return
      }
      setMpError(e instanceof Error ? e.message : 'No se pudo registrar el pedido')
      return
    }

    if (isLocal) {
      setBusy(false)
      setTestPopup(true)
      return
    }

    nextIdempotencyKey()
    clear()
    setBusy(false)
    navigate('/confirm', {
      state: {
        orderId: order?.id,
        total: order?.total ?? total,
        eta: `${r.etaMin}–${r.etaMax}`,
      },
    })
  }

  async function handleMpPay(data: {
    token: string
    paymentMethodId: string
    issuerId?: string | number
    installments: number
    bin?: string
    payerEmail?: string
  }) {
    if (binBlocked) {
      throw new Error(payConfig?.blockedMessage || 'BIN bloqueado')
    }
    if (!validate()) {
      throw new Error('Completá los datos del pedido')
    }
    setBusy(true)
    setMpError('')
    try {
      const order = await submitOrder(
        lines,
        r.currency,
        { ...checkoutWithZone(), payment: 'mercadopago' },
        { couponCode: coupon, idempotencyKey: orderIdempotencyKey.current },
        getToken(),
      )
      if (!order?.id) throw new Error('No se pudo crear el pedido')

      const result = await payWithMercadoPago({
        orderId: order.id,
        paymentToken: order.paymentToken,
        token: data.token,
        paymentMethodId: data.paymentMethodId,
        issuerId: data.issuerId,
        installments: data.installments,
        bin: data.bin,
        payerEmail: data.payerEmail,
      })

      nextIdempotencyKey()
      clear()
      navigate('/confirm', {
        state: {
          orderId: order.id,
          total: order.total ?? total,
          eta: `${r.etaMin}–${r.etaMax}`,
          mp: result.mpStatus,
          paid: result.approved,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de pago'
      setMpError(msg)
      throw e
    } finally {
      setBusy(false)
    }
  }

  function closeTestPopup() {
    setTestPopup(false)
    clear()
    navigate('/confirm', {
      state: { total, eta: `${r.etaMin}–${r.etaMax}`, test: true },
    })
  }

  if (!lines.length && !testPopup) {
    return (
      <div className="page">
        <p className="empty">No hay ítems para checkout</p>
        <button type="button" className="linkish" onClick={() => navigate('/menu')}>
          Ir al menú
        </button>
      </div>
    )
  }

  const paymentOptions: { value: CheckoutInfo['payment']; label: string; show: boolean }[] = [
    { value: 'efectivo', label: 'Efectivo', show: pm.efectivo !== false },
    { value: 'pos', label: 'POS al recibir/retirar', show: pm.pos !== false },
    { value: 'transferencia', label: 'Transferencia', show: pm.transferencia !== false },
    { value: 'mercadopago', label: 'Tarjeta (Mercado Pago)', show: mpAvailable },
  ]

  return (
    <div className="page checkout-page">
      <Toast />
      {testPopup && (
        <div className="modal-backdrop centered" role="dialog" aria-modal="true">
          <div className="modal sheet test-order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-check">✓</div>
            <h2>Pedido de prueba enviado</h2>
            <p>Modo local: el pedido quedó registrado en el admin.</p>
            <button type="button" className="btn btn-primary" onClick={closeTestPopup}>
              Entendido
            </button>
          </div>
        </div>
      )}
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <h1 className="topbar-heading">Checkout</h1>
        <span className="topbar-spacer" />
      </header>

      <main className="checkout-body">
        <FulfillmentToggle />

        <label className={`field${errors.name ? ' field--error' : ''}`} data-field="name">
          <span>Nombre</span>
          <input
            value={checkout.name}
            onChange={(e) => setCheckout({ name: e.target.value })}
            placeholder="Tu nombre"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <em>{errors.name}</em>}
        </label>

        <label className={`field${errors.phone ? ' field--error' : ''}`} data-field="phone">
          <span>Teléfono</span>
          <input
            value={checkout.phone}
            onChange={(e) => setCheckout({ phone: e.target.value })}
            placeholder="09X XXX XXX"
            inputMode="tel"
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone && <em>{errors.phone}</em>}
        </label>

        {fulfillment === 'delivery' && (
          <>
            <fieldset
              className={`field geo-box${errors.location ? ' field--error' : ''}`}
              data-field="location"
            >
              <legend>Ubicación de entrega</legend>
              <p className="field-hint">
                Necesitamos tu ubicación exacta para llevarte el pedido. No hace falta que
                escribas la calle.
              </p>

              {!checkout.location ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={requestLocation}
                    disabled={geoState === 'asking'}
                  >
                    {geoState === 'asking'
                      ? 'Obteniendo ubicación…'
                      : geoState === 'error'
                        ? 'Reintentar'
                        : 'Usar mi ubicación'}
                  </button>
                  {geoError && <em>{geoError}</em>}
                  {errors.location && <em>{errors.location}</em>}
                </>
              ) : (
                <div className={`geo-status${delivery.outOfRange ? ' geo-status--warn' : ''}`}>
                  <strong>
                    {delivery.outOfRange
                      ? 'Estás fuera de las zonas de reparto'
                      : selectedZone?.name
                        ? `Zona: ${selectedZone.name}`
                        : 'Ubicación lista'}
                  </strong>
                  <span>
                    {delivery.outOfRange
                      ? `Se cobra el envío más alto (${formatMoney(delivery.fee)}) y el local confirma si puede llegar.`
                      : delivery.fee > 0
                        ? `Envío ${formatMoney(delivery.fee)}`
                        : 'Envío gratis'}
                  </span>
                  {checkout.location.accuracy != null && (
                    <span
                      className={checkout.location.accuracy > 150 ? 'geo-accuracy-poor' : undefined}
                    >
                      Precisión ±{Math.round(checkout.location.accuracy)} m
                      {checkout.location.accuracy > 150
                        ? ' — poco precisa. Si no es tu dirección, actualizá la ubicación.'
                        : ''}
                    </span>
                  )}
                  <button type="button" className="linkish" onClick={requestLocation}>
                    Actualizar ubicación
                  </button>
                </div>
              )}
            </fieldset>

            <label
              className={`field${errors.addressDetail ? ' field--error' : ''}`}
              data-field="addressDetail"
            >
              <span>Número de casa o apartamento</span>
              <input
                value={checkout.addressDetail}
                onChange={(e) => {
                  const addressDetail = e.target.value
                  setCheckout({ addressDetail })
                  if (addressDetail.trim()) {
                    setErrors((prev) => {
                      if (!prev.addressDetail) return prev
                      const next = { ...prev }
                      delete next.addressDetail
                      return next
                    })
                  }
                }}
                placeholder="Ej: 1234, apto 3"
                aria-invalid={Boolean(errors.addressDetail)}
              />
              {errors.addressDetail && <em>{errors.addressDetail}</em>}
            </label>

            <label className="field">
              <span>
                Referencia para el repartidor <small>(opcional)</small>
              </span>
              <input
                value={checkout.addressReference}
                onChange={(e) => setCheckout({ addressReference: e.target.value })}
                placeholder="Ej: casa de reja verde, timbre del fondo"
              />
            </label>
          </>
        )}

        <fieldset
          className={`field${errors.scheduleTime ? ' field--error' : ''}`}
          data-field="scheduleTime"
        >
          <legend>Horario</legend>
          <label className="radio">
            <input
              type="radio"
              checked={checkout.schedule === 'now'}
              onChange={() => setCheckout({ schedule: 'now' })}
            />
            Lo antes posible
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={checkout.schedule === 'later'}
              onChange={() => setCheckout({ schedule: 'later' })}
            />
            Programar
          </label>
          {checkout.schedule === 'later' && (
            <input
              type="time"
              value={checkout.scheduleTime}
              onChange={(e) => setCheckout({ scheduleTime: e.target.value })}
            />
          )}
          {errors.scheduleTime && <em>{errors.scheduleTime}</em>}
        </fieldset>

        <label className="field">
          <span>Método de pago</span>
          <select
            value={checkout.payment}
            onChange={(e) => {
              setBinBlocked(false)
              setMpError('')
              setCheckout({
                payment: e.target.value as CheckoutInfo['payment'],
              })
            }}
          >
            {paymentOptions
              .filter((o) => o.show)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </select>
        </label>

        {checkout.payment === 'transferencia' && (
          <div className="transfer-box">
            <strong>Datos para transferir</strong>
            {transfer.bank ? <p>Banco: {transfer.bank}</p> : null}
            {transfer.holder ? <p>Titular: {transfer.holder}</p> : null}
            {transfer.alias ? <p>Alias: <code>{transfer.alias}</code></p> : null}
            {transfer.cbu ? <p>CBU/cuenta: <code>{transfer.cbu}</code></p> : null}
            <p className="field-hint">
              {transfer.instructions ||
                'Transferí el total y guardá el comprobante. El local te contactará si hace falta.'}
            </p>
          </div>
        )}

        {checkout.payment === 'mercadopago' && mpAvailable && payConfig && (
          <div className="mp-checkout-block">
            <p className="field-hint">
              Pagá con tarjeta acá. Si es BROU Recompensa, te vamos a pedir usar POS para el 20%.
            </p>
            {mpError && <p className="error-inline">{mpError}</p>}
            <MercadoPagoCardBrick
              publicKey={payConfig.publicKey}
              amount={total}
              blockedBins={payConfig.blockedBins}
              blockedMessage={payConfig.blockedMessage}
              onBlockedChange={onBinBlockedChange}
              onPay={handleMpPay}
            />
          </div>
        )}

        <label className="field">
          <span>Notas del pedido</span>
          <textarea
            rows={2}
            value={checkout.notes}
            onChange={(e) => setCheckout({ notes: e.target.value })}
            placeholder="Timbre, piso, etc."
          />
        </label>

        {errors.min && (
          <p className="error-inline" data-field="min" role="alert">
            {errors.min}
          </p>
        )}

        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div>
              <span>Descuento</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          )}
          <div>
            <span>Envío</span>
            <span>{deliveryFee > 0 ? formatMoney(deliveryFee) : 'Gratis'}</span>
          </div>
          <div className="total-row">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
      </main>

      {checkout.payment !== 'mercadopago' && (
        <div className="bottom-cta single">
          <button type="button" className="cta-action full" disabled={busy} onClick={finishNonCard}>
            {busy ? 'Enviando…' : `Confirmar · ${formatMoney(total)}`}
          </button>
        </div>
      )}
    </div>
  )
}
