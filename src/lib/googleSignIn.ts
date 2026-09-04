/**
 * Google Identity Services (GSI) helpers for the customer app.
 * Script: https://accounts.google.com/gsi/client
 */

type GoogleCredentialResponse = {
  credential?: string
  select_by?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: string
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_black' | 'filled_blue'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
      locale?: string
    },
  ) => void
  prompt?: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null

export function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sin window'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Sign-In')))
      if (window.google?.accounts?.id) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('No se pudo cargar Google Sign-In'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Decodifica el payload del JWT solo para UI (la verdad la decide el backend). */
export function peekGoogleEmail(idToken: string): string | null {
  try {
    const part = idToken.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { email?: string }
    return payload.email ? String(payload.email).trim().toLowerCase() : null
  } catch {
    return null
  }
}

export async function fetchGoogleClientId(apiBaseUrl: string): Promise<{
  configured: boolean
  clientId: string | null
}> {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  if (fromEnv) return { configured: true, clientId: fromEnv }

  const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/public/auth/google-client-id`)
  const data = (await res.json().catch(() => ({}))) as {
    configured?: boolean
    clientId?: string | null
  }
  if (!res.ok) {
    return { configured: false, clientId: null }
  }
  return {
    configured: Boolean(data.configured && data.clientId),
    clientId: data.clientId || null,
  }
}

/**
 * Inicializa GSI y renderiza el botón en `container`.
 * Devuelve una función cleanup.
 */
export async function mountGoogleButton(opts: {
  container: HTMLElement
  clientId: string
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  onCredential: (idToken: string) => void
  onError?: (message: string) => void
}): Promise<() => void> {
  await loadGoogleScript()
  const id = window.google?.accounts?.id
  if (!id) {
    throw new Error('Google Sign-In no disponible en este navegador.')
  }

  opts.container.replaceChildren()

  id.initialize({
    client_id: opts.clientId,
    callback: (response) => {
      const token = response.credential?.trim()
      if (!token) {
        opts.onError?.('No se recibió la sesión de Google.')
        return
      }
      opts.onCredential(token)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    context: opts.text === 'signup_with' ? 'signup' : 'signin',
  })

  id.renderButton(opts.container, {
    theme: 'outline',
    size: 'large',
    text: opts.text || 'continue_with',
    shape: 'rectangular',
    width: Math.min(360, opts.container.clientWidth || 320),
    locale: 'es',
  })

  return () => {
    opts.container.replaceChildren()
  }
}
