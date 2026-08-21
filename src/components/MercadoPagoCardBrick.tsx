import { useEffect, useMemo, useState } from 'react'
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react'
import { isBinBlocked } from '../lib/api'

type Props = {
  publicKey: string
  amount: number
  blockedBins: string[]
  blockedMessage: string
  onBlockedChange: (blocked: boolean) => void
  onPay: (data: {
    token: string
    paymentMethodId: string
    issuerId?: string | number
    installments: number
    bin?: string
    payerEmail?: string
  }) => Promise<void>
}

export function MercadoPagoCardBrick({
  publicKey,
  amount,
  blockedBins,
  blockedMessage,
  onBlockedChange,
  onPay,
}: Props) {
  const [binBlocked, setBinBlocked] = useState(false)
  const [currentBin, setCurrentBin] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!publicKey) return
    initMercadoPago(publicKey, { locale: 'es-UY' })
    setReady(true)
  }, [publicKey])

  useEffect(() => {
    onBlockedChange(binBlocked)
  }, [binBlocked, onBlockedChange])

  const customization = useMemo(
    () => ({
      visual: {
        style: {
          theme: 'default' as const,
        },
      },
    }),
    [],
  )

  if (!ready || !publicKey) {
    return <p className="empty">Cargando Mercado Pago…</p>
  }

  return (
    <div className={`mp-brick-wrap ${binBlocked ? 'blocked' : ''}`}>
      {binBlocked && (
        <div className="mp-bin-block" role="alert">
          <strong>Tarjeta no disponible acá</strong>
          <p>{blockedMessage}</p>
          <p className="mp-bin-hint">Elegí “POS al recibir/retirar” para usar BROU Recompensa.</p>
        </div>
      )}
      <CardPayment
        locale="es-UY"
        initialization={{ amount: Number(amount.toFixed(2)) }}
        customization={customization}
        onReady={() => undefined}
        onError={(err) => console.warn('MP Brick error', err)}
        onBinChange={(bin) => {
          const digits = String(bin || '').replace(/\D/g, '')
          setCurrentBin(digits)
          setBinBlocked(isBinBlocked(digits, blockedBins))
        }}
        onSubmit={async (formData) => {
          if (isBinBlocked(currentBin, blockedBins)) {
            setBinBlocked(true)
            throw new Error(blockedMessage)
          }
          const token = formData?.token
          const paymentMethodId = formData?.payment_method_id
          if (!token || !paymentMethodId) {
            throw new Error('No se pudo tokenizar la tarjeta')
          }
          await onPay({
            token,
            paymentMethodId,
            issuerId: formData.issuer_id,
            installments: formData.installments || 1,
            bin: currentBin,
            payerEmail: formData.payer?.email,
          })
        }}
      />
    </div>
  )
}
