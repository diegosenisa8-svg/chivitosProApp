import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { apiUrl, getApiBase } from '../lib/apiBase'
import {
  fetchGoogleClientId,
  mountGoogleButton,
  peekGoogleEmail,
} from '../lib/googleSignIn'

export function CustomerAuthPage() {
  const { login, loginWithGoogle } = useCustomerAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const phoneRef = useRef(phone)
  phoneRef.current = phone
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleConfigured, setGoogleConfigured] = useState(true)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const loginWithGoogleRef = useRef(loginWithGoogle)
  loginWithGoogleRef.current = loginWithGoogle

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function setup() {
      setGoogleReady(false)
      if (getApiBase() === null) {
        setGoogleConfigured(false)
        return
      }
      try {
        const { configured, clientId } = await fetchGoogleClientId(apiUrl('/'))
        if (cancelled) return
        if (!configured || !clientId) {
          setGoogleConfigured(false)
          return
        }
        setGoogleConfigured(true)
        const el = googleBtnRef.current
        if (!el) return
        cleanup = await mountGoogleButton({
          container: el,
          clientId,
          text: mode === 'register' ? 'signup_with' : 'continue_with',
          onCredential: async (idToken) => {
            setError('')
            setBusy(true)
            setGoogleEmail(peekGoogleEmail(idToken))
            try {
              await loginWithGoogleRef.current({
                googleIdToken: idToken,
                phone: phoneRef.current.trim() || undefined,
              })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Error con Google')
            } finally {
              setBusy(false)
            }
          },
          onError: (message) => setError(message),
        })
        if (!cancelled) setGoogleReady(true)
      } catch (err) {
        console.warn('Google Sign-In', err)
        if (!cancelled) {
          setGoogleConfigured(false)
          setError(err instanceof Error ? err.message : 'No se pudo cargar Google Sign-In')
        }
      }
    }

    void setup()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [mode])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode !== 'login') return
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page auth-page">
      <main className="auth-card">
        <img src="/logo.png" alt="ChivitosPro" className="auth-logo" />
        <h1>{mode === 'login' ? 'Ingresá' : 'Creá tu cuenta'}</h1>
        <p className="auth-sub">
          {mode === 'register'
            ? 'Para pedir tenés que asociar tu cuenta con Google (email verificado).'
            : 'Pedí y seguí el estado de tus pedidos'}
        </p>

        {mode === 'register' && (
          <label className="field">
            <span>Teléfono (opcional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09X XXX XXX"
              inputMode="tel"
              autoComplete="tel"
              disabled={busy}
            />
          </label>
        )}

        {!googleConfigured ? (
          <p className="error-inline">
            Google Sign-In no está configurado en el servidor. Pedile al admin que cargue
            GOOGLE_CLIENT_ID.
          </p>
        ) : (
          <div className="auth-google-wrap">
            <div ref={googleBtnRef} className="auth-google-btn" aria-label="Continuar con Google" />
            {!googleReady && <p className="auth-muted">Cargando Google…</p>}
            {googleEmail && <p className="auth-muted">Sesión Google: {googleEmail}</p>}
          </div>
        )}

        {mode === 'login' && (
          <>
            <div className="auth-divider">
              <span>o con email</span>
            </div>
            <form onSubmit={onSubmit} className="auth-form">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={busy}
                />
              </label>
              <label className="field">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={1}
                  autoComplete="current-password"
                  disabled={busy}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Esperá…' : 'Ingresar'}
              </button>
            </form>
          </>
        )}

        {error && <p className="error-inline">{error}</p>}

        <button
          type="button"
          className="linkish auth-switch"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError('')
            setGoogleEmail(null)
          }}
          disabled={busy}
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate con Google' : 'Ya tengo cuenta · Ingresar'}
        </button>
      </main>
    </div>
  )
}
