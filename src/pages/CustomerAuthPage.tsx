import { useState, type FormEvent } from 'react'
import { useCustomerAuth } from '../context/CustomerAuthContext'

export function CustomerAuthPage() {
  const { login, register } = useCustomerAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else {
        await register({
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim() || undefined,
        })
      }
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
          Creá tu cuenta para pedir y ver el estado de tus pedidos
        </p>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <label className="field">
                <span>Nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09X XXX XXX"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {error && <p className="error-inline">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Esperá…' : mode === 'login' ? 'Ingresar' : 'Registrarme'}
          </button>
        </form>

        <button
          type="button"
          className="linkish auth-switch"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError('')
          }}
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : 'Ya tengo cuenta · Ingresar'}
        </button>
      </main>
    </div>
  )
}
