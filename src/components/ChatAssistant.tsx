import { useEffect, useRef, useState } from 'react'
import { apiUrl, getApiBase } from '../lib/apiBase'

type Msg = { role: 'user' | 'assistant'; text: string }

const WELCOME =
  'Soy el Asistente de ChivitosPro de IA. Preguntame por el menú cargado, precios, demora u horarios.'

export function ChatAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', text: WELCOME }])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    if (getApiBase() === null) {
      setError('API no disponible')
      return
    }

    const next: Msg[] = [...messages, { role: 'user', text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')

    try {
      const res = await fetch(apiUrl('/api/assistant/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setMessages((prev) => [...prev, { role: 'assistant', text: String(data.reply) }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo responder')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-assist">
      <button
        type="button"
        className={`chat-assist-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir asistente de ChivitosPro"
        title="Asistente IA"
      >
        {open ? '×' : '💬'}
      </button>

      {open && (
        <div className="chat-assist-panel" role="dialog" aria-label="Asistente de ChivitosPro">
          <header className="chat-assist-head">
            <div>
              <strong>Asistente de ChivitosPro de IA</strong>
              <span>Menú · demora · horarios</span>
            </div>
            <button type="button" className="chat-assist-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="chat-assist-messages">
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`chat-bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="chat-bubble assistant muted">Escribiendo…</div>}
            <div ref={endRef} />
          </div>
          {error && <p className="chat-assist-error">{error}</p>}
          <form
            className="chat-assist-form"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Qué chivitos tienen?"
              maxLength={500}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
