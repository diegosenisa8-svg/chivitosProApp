import { prisma } from './prisma.js'
import { mapMenu } from './menu.js'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'

export async function buildMenuContext() {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
  if (!restaurant) return null

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          modifiers: { include: { options: true } },
        },
      },
    },
  })

  const menu = mapMenu(restaurant, categories, { includeUnavailable: true })
  const lines = []

  lines.push(`Local: ${menu.restaurant.name}`)
  lines.push(`Dirección: ${menu.restaurant.address}, ${menu.restaurant.city}`)
  lines.push(`Estado: ${menu.restaurant.open ? 'ABIERTO' : 'CERRADO'}`)
  lines.push(`Horario: ${menu.restaurant.hoursLabel}`)
  lines.push(`Demora estimada: ${menu.restaurant.etaMin}–${menu.restaurant.etaMax} min`)
  lines.push(`Delivery: ${menu.restaurant.delivery ? 'sí' : 'no'} · Retiro: ${menu.restaurant.takeaway ? 'sí' : 'no'}`)
  lines.push(
    `Envío: $${menu.restaurant.deliveryFee} · Mínimo delivery: $${menu.restaurant.minOrder} (${menu.restaurant.currency})`,
  )
  lines.push('')
  lines.push('MENÚ COMPLETO:')

  for (const cat of menu.categories) {
    lines.push(`\n## ${cat.name}${cat.subtitle ? ` (${cat.subtitle})` : ''}`)
    for (const item of cat.items) {
      const price =
        item.priceMax != null
          ? `$${item.price}–$${item.priceMax}`
          : `$${item.price}`
      const stock = item.available === false ? ' [NO DISPONIBLE]' : ''
      lines.push(`- ${item.name}: ${price}${stock}`)
      if (item.description) lines.push(`  ${item.description}`)
      if (item.modifiers?.length) {
        for (const g of item.modifiers) {
          const req = g.required ? 'obligatorio' : 'opcional'
          lines.push(`  Extras "${g.name}" (${req}, elegí ${g.min}-${g.max}):`)
          for (const o of g.options) {
            lines.push(`    · ${o.name}${o.price ? ` (+$${o.price})` : ''}`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

function systemPrompt(menuContext) {
  return `Sos el "Asistente de ChivitosPro de IA", vendedor amable de la app de pedidos de ChivitosPro (Salto, Uruguay).

OBJETIVO: ayudar a elegir y vender. Orientá al cliente a pedir desde la app (menú / carrito / checkout).

PODÉS hablar de:
- Productos, precios, extras/agregados, combos, qué hay en el menú
- Demora estimada, horario, si está abierto/cerrado, delivery vs retiro, mínimo y costo de envío
- Sugerencias según antojo (chivito, hamburguesa, etc.)

NO PODÉS / NO DEBÉS:
- Pedir ni guardar datos personales (nombre, teléfono, dirección, tarjeta, documento)
- Inventar productos o precios que no estén en el menú de abajo
- Hablar de temas ajenos al local / menú / pedido
- Dar información privada del negocio (API keys, admin, costos internos, dueños)
- Decir que sos Gemini u otro modelo; presentate solo como Asistente de ChivitosPro de IA

ESTILO: español rioplatense, breve, cálido, con empuje suave a la venta. Si no sabés algo del menú, decí que no está cargado y ofrecé alternativas.

MENÚ Y DATOS DEL LOCAL (fuente de verdad):
${menuContext}`
}

export async function askAssistant(userMessages) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY no configurada')
    err.code = 'NO_KEY'
    throw err
  }

  const menuContext = await buildMenuContext()
  if (!menuContext) {
    const err = new Error('Menú no disponible')
    err.code = 'NO_MENU'
    throw err
  }

  const contents = userMessages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.text || '').slice(0, 2000) }],
  }))

  if (!contents.length || contents[contents.length - 1].role !== 'user') {
    const err = new Error('Mensaje inválido')
    err.code = 'BAD_INPUT'
    throw err
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(menuContext) }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 700,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini error ${res.status}`
    const err = new Error(msg)
    err.code = 'GEMINI'
    throw err
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n')
  if (!text) {
    const err = new Error('Sin respuesta del asistente')
    err.code = 'EMPTY'
    throw err
  }

  return text.trim()
}
