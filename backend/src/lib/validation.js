import { z } from 'zod'

/**
 * Enums y helpers compartidos entre las rutas públicas y las de admin, para que
 * crear y editar una misma entidad acepten exactamente los mismos valores.
 */

export const ORDER_STATUS = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
])

export const FULFILLMENT = z.enum(['delivery', 'pickup'])

export const PAYMENT_METHODS = z.enum(['efectivo', 'pos', 'transferencia', 'mercadopago'])

/**
 * Estados terminales: desde ellos casi no se sale. El resto se puede mover
 * libremente en cualquier dirección, porque corregir a mano el estado de un
 * pedido en curso es parte de la operación diaria del local.
 */
const TERMINAL_EXITS = {
  delivered: ['cancelled'], // anular un pedido ya entregado
  cancelled: ['pending'], // reactivar un pedido cancelado por error
}

export function canTransition(from, to) {
  if (from === to) return true
  if (from in TERMINAL_EXITS) return TERMINAL_EXITS[from].includes(to)
  return true
}

/** Id de recurso creado por el usuario: solo lo que es seguro poner en una URL. */
export const RESOURCE_ID = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, 'Solo letras, números y guiones')

/**
 * Detalle de un ZodError. Fuera de producción ayuda a depurar; en producción se
 * omite para no publicar la estructura interna de los esquemas.
 */
export function zodDetails(err) {
  if (process.env.NODE_ENV === 'production') return {}
  return { details: err.issues }
}

/**
 * Traduce errores conocidos de Prisma al código HTTP que corresponde, en vez de
 * dejar que caigan al 500 genérico.
 * @returns {{ status: number, body: object } | null}
 */
export function prismaHttpError(err, labels = {}) {
  const notFound = labels.notFound || 'No encontrado'
  const conflict = labels.conflict || 'Ya existe un registro con ese identificador'
  const badRef = labels.badRef || 'Referencia inválida: la entidad relacionada no existe'

  switch (err?.code) {
    case 'P2025':
      return { status: 404, body: { error: notFound } }
    case 'P2002':
      return { status: 409, body: { error: conflict } }
    case 'P2003':
      return { status: 400, body: { error: badRef } }
    default:
      return null
  }
}
