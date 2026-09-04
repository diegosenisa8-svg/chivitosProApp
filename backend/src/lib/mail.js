/**
 * Envío de correo por API HTTP (Brevo → Resend).
 * En Railway Hobby el SMTP suele estar bloqueado; por eso no hay fallback SMTP.
 */

export function isMailConfigured() {
  if (process.env.BREVO_API_KEY?.trim()) return true
  if (process.env.RESEND_API_KEY?.trim()) return true
  return false
}

function senderFromEnv() {
  if (process.env.BREVO_API_KEY?.trim()) {
    const email = process.env.BREVO_SENDER_EMAIL?.trim()
    if (!email) {
      throw new Error('Falta BREVO_SENDER_EMAIL (remitente verificado en Brevo).')
    }
    return {
      provider: 'brevo',
      email,
      name: process.env.BREVO_SENDER_NAME?.trim() || 'ChivitosPro',
    }
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    const from = process.env.RESEND_FROM?.trim()
    if (!from) {
      throw new Error('Falta RESEND_FROM (ej. "ChivitosPro <pedidos@tudominio.com>").')
    }
    return { provider: 'resend', from }
  }
  throw new Error('Correo no configurado.')
}

/**
 * @param {{
 *   to: string
 *   subject: string
 *   text: string
 *   html?: string
 *   attachmentBuffer?: Buffer
 *   filename?: string
 *   contentType?: string
 * }} opts
 */
export async function sendEmail(opts) {
  const to = String(opts.to || '').trim().toLowerCase()
  if (!to || !to.includes('@')) {
    throw new Error('Destinatario de correo inválido.')
  }
  const subject = String(opts.subject || '').trim()
  const text = String(opts.text || '').trim()
  if (!subject || !text) {
    throw new Error('Asunto y mensaje son obligatorios.')
  }

  const sender = senderFromEnv()
  const attachment =
    opts.attachmentBuffer && opts.filename
      ? {
          content: Buffer.from(opts.attachmentBuffer).toString('base64'),
          name: opts.filename,
          contentType: opts.contentType || 'application/octet-stream',
        }
      : null

  if (sender.provider === 'brevo') {
    await sendViaBrevo({
      apiKey: process.env.BREVO_API_KEY.trim(),
      sender: { name: sender.name, email: sender.email },
      to,
      subject,
      text,
      html: opts.html,
      attachment,
    })
    return { provider: 'brevo', to }
  }

  await sendViaResend({
    apiKey: process.env.RESEND_API_KEY.trim(),
    from: sender.from,
    to,
    subject,
    text,
    html: opts.html,
    attachment,
  })
  return { provider: 'resend', to }
}

async function sendViaBrevo({ apiKey, sender, to, subject, text, html, attachment }) {
  const body = {
    sender,
    to: [{ email: to }],
    subject,
    textContent: text,
  }
  if (html) body.htmlContent = html
  if (attachment) {
    body.attachment = [{ content: attachment.content, name: attachment.name }]
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('Brevo error', res.status, detail.slice(0, 500))
    throw new Error('No se pudo enviar el correo (Brevo).')
  }
}

async function sendViaResend({ apiKey, from, to, subject, text, html, attachment }) {
  const body = {
    from,
    to: [to],
    subject,
    text,
  }
  if (html) body.html = html
  if (attachment) {
    body.attachments = [
      {
        filename: attachment.name,
        content: attachment.content,
        content_type: attachment.contentType,
      },
    ]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('Resend error', res.status, detail.slice(0, 500))
    throw new Error('No se pudo enviar el correo (Resend).')
  }
}
