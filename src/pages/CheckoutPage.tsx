import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { FulfillmentToggle } from '../components/FulfillmentToggle'
import { MercadoPagoCardBrick } from '../components/MercadoPagoCardBrick'
import { buildWhatsAppMessage, useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useMenu } from '../context/MenuContext'
import {
  fetchPaymentConfig,
  payWithMercadoPago,
  submitOrder,
  type PaymentConfig,
} from '../lib/api'
import { formatMoney } from '../lib/format'
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

  const total = Math.max(0, subtotal - discount + deliveryFee)
  const r = menu.restaurant
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

  function validate() {
    const next: Record<string, string> = {}
    if (!checkout.name.trim()) next.name = 'Ingresá tu nombre'
    if (!checkout.phone.trim() || checkout.phone.replace(/\D/g, '').length < 8) {
      next.phone = 'Ingresá un teléfono válido'
    }
    if (fulfillment === 'delivery' && !checkout.address.trim()) {
      next.address = 'Ingresá la dirección'
    }
    if (checkout.schedule === 'later' && !checkout.scheduleTime) {
      next.scheduleTime = 'Elegí un horario'
    }
    if (fulfillment === 'delivery' && subtotal < (r.minOrder || 0)) {
      next.min = `El mínimo de pedido es ${formatMoney(r.minOrder || 0)}`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function finishNonCard() {
    if (!lines.length || busy) return
    if (!validate()) return
    setBusy(true)

    try {
      await submitOrder(
        lines,
        r.currency,
        { ...checkout, fulfillment },
        {
          subtotal,
          discount,
          deliveryFee,
        },
        getToken(),
      )
    } catch {
      // En local igual mostramos el popup de prueba
    }

    if (isLocal) {
      setBusy(false)
      setTestPopup(true)
      return
    }

    const msg = buildWhatsAppMessage(
      r.name,
      lines,
      total,
      r.currency,
      { ...checkout, fulfillment },
      deliveryFee,
      discount,
    )
    const url = `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
    clear()
    setBusy(false)
    navigate('/confirm', { state: { total, eta: `${r.etaMin}–${r.etaMax}` } })
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
        { ...checkout, fulfillment, payment: 'mercadopago' },
        { subtotal, discount, deliveryFee },
        getToken(),
      )
      if (!order?.id) throw new Error('No se pudo crear el pedido')

      const result = await payWithMercadoPago({
        orderId: order.id,
        token: data.token,
        paymentMethodId: data.paymentMethodId,
        issuerId: data.issuerId,
        installments: data.installments,
        bin: data.bin,
        payerEmail: data.payerEmail,
      })

      clear()
      navigate('/confirm', {
        state: {
          total,
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
            <p>Modo local: no se abre WhatsApp. El pedido quedó registrado en el admin.</p>
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

        <label className="field">
          <span>Nombre</span>
          <input
            value={checkout.name}
            onChange={(e) => setCheckout({ name: e.target.value })}
            placeholder="Tu nombre"
          />
          {errors.name && <em>{errors.name}</em>}
        </label>

        <label className="field">
          <span>Teléfono</span>
          <input
            value={checkout.phone}
            onChange={(e) => setCheckout({ phone: e.target.value })}
            placeholder="09X XXX XXX"
            inputMode="tel"
          />
          {errors.phone && <em>{errors.phone}</em>}
        </label>

        {fulfillment === 'delivery' && (
          <label className="field">
            <span>Dirección</span>
            <input
              value={checkout.address}
              onChange={(e) => {
                const address = e.target.value
                setCheckout({ address })
                if (address.trim()) {
                  setErrors((prev) => {
                    if (!prev.address) return prev
                    const next = { ...prev }
                    delete next.address
                    return next
                  })
                }
              }}
              placeholder="Calle, número, referencia"
            />
            {errors.address && <em>{errors.address}</em>}
          </label>
        )}

        <fieldset className="field">
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
                'Transferí el total y enviá el comprobante por WhatsApp al confirmar.'}
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

        {errors.min && <p className="error-inline">{errors.min}</p>}

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
