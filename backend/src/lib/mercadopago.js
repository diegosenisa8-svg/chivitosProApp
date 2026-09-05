import { mergeSettings } from './settings.js'

export function normalizeBin(raw) {
  return String(raw || '').replace(/\D/g, '')
}

/** True if card BIN matches any blocked prefix (6–8 digits). */
export function isBinBlocked(bin, blockedBins = []) {
  const card = normalizeBin(bin)
  if (!card || card.length < 4) return false
  return (blockedBins || []).some((blocked) => {
    const b = normalizeBin(blocked)
    if (b.length < 4) return false
    return card.startsWith(b)
  })
}

export function getMpCredentials() {
  const publicKey = (process.env.MP_PUBLIC_KEY || '').trim()
  const accessToken = (process.env.MP_ACCESS_TOKEN || '').trim()
  return {
    publicKey,
    accessToken,
    configured: Boolean(publicKey && accessToken),
  }
}

export function getPublicPaymentConfig(restaurantSettings) {
  const settings = mergeSettings(restaurantSettings)
  const { publicKey, configured } = getMpCredentials()
  const enabled = Boolean(settings.paymentMethods?.mercadoPago && configured)
  return {
    enabled,
    configured,
    publicKey: enabled || configured ? publicKey : '',
    blockedBins: settings.mercadoPago?.blockedBins || [],
    blockedMessage:
      settings.mercadoPago?.blockedMessage ||
      'Para pagar con BROU Recompensa y acceder al 20% de descuento, seleccioná pago con POS.',
  }
}

export async function createMercadoPagoPayment({
  token,
  transactionAmount,
  installments,
  paymentMethodId,
  issuerId,
  payerEmail,
  description,
  externalReference,
  bin,
}) {
  const { accessToken } = getMpCredentials()
  if (!accessToken) {
    const err = new Error('MP_ACCESS_TOKEN no configurado')
    err.code = 'NO_MP'
    throw err
  }

  const body = {
    transaction_amount: Number(transactionAmount),
    token,
    description: description || 'Pedido ChivitosPro',
    installments: Number(installments) || 1,
    payment_method_id: paymentMethodId,
    external_reference: String(externalReference || ''),
    payer: {
      email: payerEmail || 'cliente@chivitospro.com',
    },
  }
  if (issuerId) body.issuer_id = Number(issuerId)
  // El BIN se usa solo para bloquear tarjetas (BROU) en nuestro backend.
  // No se manda a MP: additional_info.bin no es un parámetro válido en /v1/payments.

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${externalReference || 'mp'}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.cause?.[0]?.description ||
      data?.error ||
      `Mercado Pago error ${res.status}`
    const err = new Error(typeof msg === 'string' ? msg : 'Error de Mercado Pago')
    err.code = 'MP_API'
    err.details = data
    // Errores de tarjeta / token / validación de MP → cliente (no 500).
    err.httpStatus = res.status >= 400 && res.status < 500 ? (res.status === 402 ? 402 : 400) : 502
    throw err
  }
  return data
}
