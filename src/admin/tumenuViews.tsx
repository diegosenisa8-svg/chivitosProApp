import { useEffect, useState, type ReactNode } from 'react'
import { formatMoney } from '../lib/format'
import { SALTO_CENTER, zoneDeliveryFee, zoneHasGeometry } from '../lib/deliveryZones'
import type {
  DeliveryZone,
  MenuData,
  Promotion,
  RestaurantSettings,
  ServiceFee,
} from '../types'
import type { DashboardData } from '../lib/adminApi'
import type { AdminSection } from './nav'
import { DeliveryZonesMap } from './DeliveryZonesMap'
import { RestaurantLocationMap, buildOsmEmbed } from './RestaurantLocationMap'

type ReportsPayload = {
  days: number
  totals: { sales: number; orders: number; avgTicket: number }
  byFulfillment: { delivery: number; pickup: number }
  byPayment: Record<string, number>
  byDay: { date: string; sales: number; orders: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
}

type SaveFn = (partial: Partial<RestaurantSettings>) => Promise<void>

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="tm-switch">
      <span className="tm-switch-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`tm-ios ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
      >
        <span className="tm-ios-knob" />
      </button>
    </label>
  )
}

/** Binary Si/No group used in config wizards (active No = red). */
export function YesNoToggle({
  value,
  onChange,
  yesLabel = 'Si',
  noLabel = 'No',
}: {
  value: boolean
  onChange: (v: boolean) => void
  yesLabel?: string
  noLabel?: string
}) {
  return (
    <div className="tm-yesno">
      <button
        type="button"
        className={`tm-yesno-btn ${value ? 'active-yes' : ''}`}
        onClick={() => onChange(true)}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        className={`tm-yesno-btn ${!value ? 'active-no' : ''}`}
        onClick={() => onChange(false)}
      >
        {noLabel}
      </button>
    </div>
  )
}

function WizardCard({
  title,
  subtitle,
  children,
  onNext,
  nextLabel = 'Siguiente',
  saving,
  nextDisabled,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onNext?: () => void
  nextLabel?: string
  saving?: boolean
  nextDisabled?: boolean
}) {
  return (
    <section className="admin-section tm-wizard">
      <div className="tm-card shadow">
        <div className="tm-card-header">
          <div>
            <h2 className="tm-card-title">{title}</h2>
            {subtitle ? <p className="tm-card-sub">{subtitle}</p> : null}
          </div>
          {onNext ? (
            <button
              type="button"
              className="admin-btn primary tm-next"
              disabled={saving || nextDisabled}
              onClick={onNext}
            >
              {saving ? 'Guardando…' : nextLabel === 'Siguiente' ? 'Siguiente' : nextLabel}
            </button>
          ) : null}
        </div>
        <div className="tm-card-body settings-form">{children}</div>
      </div>
    </section>
  )
}

export function ToggleServiceView({
  title,
  description,
  flag,
  settings,
  saving,
  onSave,
  children,
}: {
  title: string
  description: string
  flag: keyof RestaurantSettings
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
  children?: ReactNode
}) {
  const [on, setOn] = useState(!!settings[flag])
  useEffect(() => setOn(!!settings[flag]), [settings, flag])
  return (
    <WizardCard
      title={title}
      subtitle={description}
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ [flag]: on } as Partial<RestaurantSettings>)}
    >
      <Switch checked={on} onChange={setOn} label="¿Activado?" />
      {on ? children : null}
    </WizardCard>
  )
}

export function DeliveryZonesFullView({
  settings,
  saving,
  onSave,
  restaurantLat = SALTO_CENTER.lat,
  restaurantLng = SALTO_CENTER.lng,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
  restaurantLat?: number
  restaurantLng?: number
}) {
  const [enabled, setEnabled] = useState(settings.deliveryEnabled !== false)
  const [zones, setZones] = useState<DeliveryZone[]>(settings.deliveryZones || [])
  const [selectedId, setSelectedId] = useState<string | null>(
    settings.deliveryZones?.[0]?.id || null,
  )
  const [markMode, setMarkMode] = useState(false)
  const [draftPolygon, setDraftPolygon] = useState<{ lat: number; lng: number }[]>([])
  useEffect(() => {
    setEnabled(settings.deliveryEnabled !== false)
    const incoming = settings.deliveryZones || []
    setZones(
      incoming.map((z, i) => ({
        ...z,
        freeDelivery: z.freeDelivery ?? z.fee === 0,
        lat: z.lat ?? SALTO_CENTER.lat + (i - 2) * 0.008,
        lng: z.lng ?? SALTO_CENTER.lng + (i - 2) * 0.008,
        radiusKm: z.radiusKm ?? 1.5,
        shape: z.shape || 'polygon',
        polygon: z.polygon || [],
      })),
    )
  }, [settings])

  const selected = zones.find((z) => z.id === selectedId) || null

  function patchZone(id: string, patch: Partial<DeliveryZone>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  }

  function startMarking() {
    if (!selected) return
    if (selected.shape === 'polygon') {
      setDraftPolygon(selected.polygon?.length ? [...selected.polygon] : [])
    } else {
      setDraftPolygon([])
    }
    setMarkMode(true)
  }

  function stopMarking() {
    setMarkMode(false)
    setDraftPolygon([])
  }

  function closePolygon() {
    if (!selectedId || draftPolygon.length < 3) return
    const centroidLat = draftPolygon.reduce((s, p) => s + p.lat, 0) / draftPolygon.length
    const centroidLng = draftPolygon.reduce((s, p) => s + p.lng, 0) / draftPolygon.length
    patchZone(selectedId, {
      shape: 'polygon',
      polygon: draftPolygon,
      lat: centroidLat,
      lng: centroidLng,
    })
    stopMarking()
  }

  function addZone() {
    const id = `z${Date.now()}`
    const next: DeliveryZone = {
      id,
      name: 'Nueva zona',
      color: '#4a90e2',
      fee: 100,
      minOrder: 250,
      shape: 'polygon',
      feeByDistance: false,
      freeDelivery: false,
      active: true,
      lat: SALTO_CENTER.lat,
      lng: SALTO_CENTER.lng,
      radiusKm: 1.5,
      polygon: [],
    }
    setZones((prev) => [...prev, next])
    setSelectedId(id)
    setDraftPolygon([])
    setMarkMode(true)
  }

  return (
    <WizardCard
      title="Entrega"
      subtitle="Configuración → Horarios y servicios → Entrega. Dibujá el límite clickeando nodos en el mapa."
      saving={saving}
      nextLabel="Guardar zonas"
      onNext={() => {
        stopMarking()
        return onSave({ deliveryEnabled: enabled, deliveryZones: zones })
      }}
    >
      <Switch checked={enabled} onChange={setEnabled} label="¿Ofrecen entrega a domicilio?" />
      {enabled && (
        <div className="delivery-zones-layout">
          <div className="delivery-zones-map-col">
            <DeliveryZonesMap
              zones={zones}
              selectedId={selectedId}
              selectedName={selected?.name}
              restaurantLat={restaurantLat || SALTO_CENTER.lat}
              restaurantLng={restaurantLng || SALTO_CENTER.lng}
              markMode={markMode && !!selectedId}
              drawShape={selected?.shape === 'circle' ? 'circle' : 'polygon'}
              draftPolygon={draftPolygon}
              onSelectZone={(id) => {
                setSelectedId(id)
                stopMarking()
              }}
              onMapClick={(lat, lng) => {
                if (!selectedId || !selected) return
                if (selected.shape === 'circle') {
                  patchZone(selectedId, { lat, lng })
                  stopMarking()
                  return
                }
                setDraftPolygon((prev) => [...prev, { lat, lng }])
              }}
              onDraftChange={setDraftPolygon}
              height={560}
            />
          </div>

          <div className="delivery-zones-list-col">
            <div className="delivery-zones-list-head">
              <strong>Zonas de entrega</strong>
              <span className="admin-muted">{zones.filter((z) => z.active).length} activas</span>
            </div>

            <div className="delivery-zones-guide" role="note">
              <strong>Cómo dibujar una zona</strong>
              <ol>
                <li>Creá o elegí una zona y usá forma libre.</li>
                <li>
                  Tocá <em>Marcar en el mapa</em> y dibujá nodos con clic.
                </li>
                <li>Arrastrá los nodos numerados para ajustar el borde.</li>
                <li>El punto blanco del borde agrega un nodo en el medio.</li>
                <li>
                  Tocá <em>Cerrar zona</em> y después Guardar.
                </li>
              </ol>
            </div>

            <ul className="delivery-zones-list">
              {zones.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    className={`delivery-zone-item${selectedId === z.id ? ' selected' : ''}`}
                    onClick={() => {
                      setSelectedId(z.id)
                      stopMarking()
                    }}
                  >
                    <span className="delivery-zone-dot" style={{ background: z.color }} />
                    <span className="delivery-zone-meta">
                      <strong>{z.name}</strong>
                      <em>
                        {!z.active
                          ? 'Inactiva'
                          : z.freeDelivery || z.fee === 0
                            ? 'Sin costo de envío'
                            : `Envío ${formatMoney(z.fee)}`}
                        {z.shape === 'polygon' && z.polygon && z.polygon.length >= 3
                          ? ` · ${z.polygon.length} nodos`
                          : ''}
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button type="button" className="admin-btn" onClick={addZone}>
              + Agregar nueva zona
            </button>

            {selected ? (
              <div className="mod-group-edit delivery-zone-editor">
                <h4>Editar: {selected.name}</h4>
                {!zoneHasGeometry(selected) && (
                  <p className="range-warning" role="status">
                    Esta zona todavía no tiene límite dibujado — no se está aplicando
                  </p>
                )}

                <label>
                  Forma de la zona
                  <select
                    value={selected.shape || 'polygon'}
                    onChange={(e) => {
                      const shape = e.target.value as 'circle' | 'polygon'
                      patchZone(selected.id, { shape })
                      stopMarking()
                    }}
                  >
                    <option value="polygon">Libre (polígono — click nodos)</option>
                    <option value="circle">Círculo (un clic + radio)</option>
                  </select>
                </label>

                <button
                  type="button"
                  className={`admin-btn primary delivery-mark-btn${markMode ? ' armed' : ''}`}
                  onClick={() => (markMode ? stopMarking() : startMarking())}
                >
                  {markMode
                    ? 'Cancelar marcado'
                    : selected.shape === 'circle'
                      ? '📍 Marcar centro en el mapa'
                      : '📍 Marcar límite en el mapa (nodos)'}
                </button>

                {markMode && (selected.shape || 'polygon') === 'polygon' ? (
                  <div className="delivery-polygon-tools">
                    <p className="delivery-mark-active">
                      {draftPolygon.length} nodos · <strong>arrastrá</strong> los números para
                      mover · punto blanco del borde para agregar en el medio · clic vacío para
                      sumar al final
                    </p>
                    <div className="row-2">
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={draftPolygon.length === 0}
                        onClick={() => setDraftPolygon((p) => p.slice(0, -1))}
                      >
                        ← Borrar último
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={draftPolygon.length === 0}
                        onClick={() => setDraftPolygon([])}
                      >
                        Reiniciar
                      </button>
                    </div>
                    <button
                      type="button"
                      className="admin-btn primary"
                      disabled={draftPolygon.length < 3}
                      onClick={closePolygon}
                    >
                      ✓ Cerrar zona ({draftPolygon.length} nodos)
                    </button>
                  </div>
                ) : markMode ? (
                  <p className="delivery-mark-active">
                    Modo activo: un clic ubica el centro de <strong>{selected.name}</strong>.
                  </p>
                ) : null}

                <label>
                  Nombre
                  <input
                    value={selected.name}
                    onChange={(e) => patchZone(selected.id, { name: e.target.value })}
                  />
                </label>
                <div className="row-2">
                  <label>
                    Color
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => patchZone(selected.id, { color: e.target.value })}
                    />
                  </label>
                  <label className="check" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => patchZone(selected.id, { active: e.target.checked })}
                    />
                    Zona activa
                  </label>
                </div>

                <Switch
                  checked={!!selected.freeDelivery || selected.fee === 0}
                  onChange={(v) =>
                    patchZone(selected.id, {
                      freeDelivery: v,
                      fee: v ? 0 : selected.fee || 80,
                    })
                  }
                  label="Sin costo de envío en esta zona"
                />

                {!selected.freeDelivery && selected.fee !== 0 ? (
                  <label>
                    Costo de envío (UYU)
                    <input
                      type="number"
                      min={0}
                      value={selected.fee}
                      onChange={(e) =>
                        patchZone(selected.id, {
                          fee: Number(e.target.value) || 0,
                          freeDelivery: false,
                        })
                      }
                    />
                  </label>
                ) : (
                  <p className="admin-muted">
                    Pedidos delivery en esta zona: envío gratis. Retiro en local: siempre sin
                    envío.
                  </p>
                )}

                <label>
                  Monto mínimo del pedido (UYU)
                  <input
                    type="number"
                    min={0}
                    value={selected.minOrder ?? 0}
                    onChange={(e) =>
                      patchZone(selected.id, { minOrder: Number(e.target.value) || 0 })
                    }
                  />
                </label>

                {selected.shape === 'circle' ? (
                  <label>
                    Radio de cobertura (km)
                    <input
                      type="range"
                      min={0.4}
                      max={5}
                      step={0.1}
                      value={selected.radiusKm ?? 1.5}
                      onChange={(e) =>
                        patchZone(selected.id, { radiusKm: Number(e.target.value) || 1.5 })
                      }
                    />
                    <span className="admin-muted">{(selected.radiusKm ?? 1.5).toFixed(1)} km</span>
                  </label>
                ) : (
                  <p className="admin-muted">
                    {selected.polygon && selected.polygon.length >= 3
                      ? `Polígono guardado con ${selected.polygon.length} nodos.`
                      : 'Todavía no hay polígono: usá Marcar en el mapa y cerrá la zona.'}
                  </p>
                )}

                <p className="admin-muted">
                  Preview: si el cliente elige delivery en esta zona, se suma{' '}
                  <strong>
                    {zoneDeliveryFee(selected) > 0
                      ? formatMoney(zoneDeliveryFee(selected))
                      : 'gratis'}
                  </strong>
                  .
                </p>

                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => {
                    if (!confirm(`¿Eliminar la zona "${selected.name}"?`)) return
                    setZones((prev) => prev.filter((z) => z.id !== selected.id))
                    setSelectedId(null)
                    stopMarking()
                  }}
                >
                  Eliminar zona
                </button>
              </div>
            ) : (
              <p className="admin-muted">Seleccioná una zona para editarla o creá una nueva.</p>
            )}
          </div>
        </div>
      )}
    </WizardCard>
  )
}

export function HoursFullView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const [rows, setRows] = useState(settings.schedules || [])
  const [exceptions, setExceptions] = useState(settings.exceptions || [])
  const [separate, setSeparate] = useState(!!settings.separatePickupDeliveryHours)
  const [paused, setPaused] = useState(!!settings.servicesPaused)
  useEffect(() => {
    setRows(settings.schedules || [])
    setExceptions(settings.exceptions || [])
    setSeparate(!!settings.separatePickupDeliveryHours)
    setPaused(!!settings.servicesPaused)
  }, [settings])

  return (
    <WizardCard
      title="Horario de apertura"
      subtitle="Rangos de días y excepciones"
      saving={saving}
      nextLabel="Guardar"
      onNext={() =>
        onSave({
          schedules: rows,
          exceptions,
          separatePickupDeliveryHours: separate,
          servicesPaused: paused,
        })
      }
    >
      <Switch checked={separate} onChange={setSeparate} label="Horarios distintos retiro / entrega" />
      <Switch checked={paused} onChange={setPaused} label="Servicios de pausa (pausar todo)" />
      {rows.map((r, i) => (
        <div key={r.id} className="mod-option-row">
          <input
            value={r.label}
            placeholder="Martes–Jueves"
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...r, label: e.target.value }
              setRows(next)
            }}
          />
          <input
            value={r.open}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...r, open: e.target.value }
              setRows(next)
            }}
          />
          <input
            value={r.close}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...r, close: e.target.value }
              setRows(next)
            }}
          />
          <button
            type="button"
            className="admin-btn ghost icon-del"
            onClick={() => {
              if (!confirm(`¿Seguro que deseas eliminar el horario "${r.label}"?`)) return
              setRows(rows.filter((_, j) => j !== i))
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn"
        onClick={() =>
          setRows([
            ...rows,
            { id: `s${Date.now()}`, label: 'Nuevo rango', open: '19:00', close: '23:00', service: 'all' },
          ])
        }
      >
        Añadir horario
      </button>
      <h4>Días especiales / festivos</h4>
      <p className="admin-muted" style={{ marginTop: -4 }}>
        Marcá una fecha concreta (feriado, evento) y definí si ese día el local está cerrado o abre
        con otro horario.
      </p>
      {exceptions.map((ex, i) => (
        <div key={ex.id} className="hours-exception-row">
          <label>
            Fecha
            <input
              type="date"
              value={ex.date}
              onChange={(e) => {
                const next = [...exceptions]
                next[i] = { ...ex, date: e.target.value }
                setExceptions(next)
              }}
            />
          </label>
          <label>
            Nombre
            <input
              value={ex.label}
              placeholder="Festivo"
              onChange={(e) => {
                const next = [...exceptions]
                next[i] = { ...ex, label: e.target.value }
                setExceptions(next)
              }}
            />
          </label>
          <label className="check hours-exception-closed">
            <input
              type="checkbox"
              checked={!!ex.closed}
              onChange={(e) => {
                const next = [...exceptions]
                const closed = e.target.checked
                next[i] = {
                  ...ex,
                  closed,
                  open: closed ? undefined : ex.open || '08:00',
                  close: closed ? undefined : ex.close || '12:00',
                }
                setExceptions(next)
              }}
            />
            Cerrado todo el día
          </label>
          {!ex.closed ? (
            <>
              <label>
                Abre
                <input
                  type="time"
                  value={ex.open || '08:00'}
                  onChange={(e) => {
                    const next = [...exceptions]
                    next[i] = { ...ex, open: e.target.value, closed: false }
                    setExceptions(next)
                  }}
                />
              </label>
              <label>
                Cierra
                <input
                  type="time"
                  value={ex.close || '12:00'}
                  onChange={(e) => {
                    const next = [...exceptions]
                    next[i] = { ...ex, close: e.target.value, closed: false }
                    setExceptions(next)
                  }}
                />
              </label>
            </>
          ) : (
            <span className="admin-muted hours-exception-note">Sin atención ese día</span>
          )}
          <button
            type="button"
            className="admin-btn ghost icon-del"
            onClick={() => setExceptions(exceptions.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn"
        onClick={() =>
          setExceptions([
            ...exceptions,
            {
              id: `e${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              label: 'Festivo',
              closed: false,
              open: '08:00',
              close: '12:00',
            },
          ])
        }
      >
        Añadir día especial/festivo
      </button>
    </WizardCard>
  )
}

export function TaxesView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const t = settings.taxes || { enabled: false, rate: 0, label: 'IVA' }
  const [form, setForm] = useState({
    includedInPrice: t.includedInPrice !== false,
    label: t.label || 'IVA',
    category: t.category || 'Comida',
    rate: String(t.rate || 0),
    deliveryTaxRate: String(t.deliveryTaxRate || 0),
    currency: t.currency || 'UYU',
    enabled: !!t.enabled,
  })
  return (
    <WizardCard
      title="Impuestos"
      subtitle="Tributación y Moneda"
      saving={saving}
      nextLabel="Guardar"
      onNext={() =>
        onSave({
          taxes: {
            enabled: form.enabled,
            includedInPrice: form.includedInPrice,
            label: form.label,
            category: form.category,
            rate: Number(form.rate) || 0,
            deliveryTaxRate: Number(form.deliveryTaxRate) || 0,
            currency: form.currency,
          },
        })
      }
    >
      <Switch
        checked={form.includedInPrice}
        onChange={(v) => setForm((f) => ({ ...f, includedInPrice: v }))}
        label="Los precios del menú ya incluyen impuestos"
      />
      <label>
        Nombre del impuesto
        <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
      </label>
      <label>
        Impuesto para los ítems del menú
        <input
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
      </label>
      <div className="row-2">
        <label>
          Tasa %
          <input
            type="number"
            value={form.rate}
            onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
          />
        </label>
        <label>
          IVA tarifa de envío %
          <input
            type="number"
            value={form.deliveryTaxRate}
            onChange={(e) => setForm((f) => ({ ...f, deliveryTaxRate: e.target.value }))}
          />
        </label>
      </div>
      <label>
        Divisa
        <select
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
        >
          <option value="UYU">UYU – Peso Uruguayo</option>
          <option value="ARS">ARS – Peso Argentino</option>
          <option value="USD">USD – Dólar</option>
        </select>
      </label>
      <p className="admin-muted">
        Es tu responsabilidad confirmar que divisas e impuestos son correctos para la jurisdicción
        aplicable.
      </p>
    </WizardCard>
  )
}

export function PayMethodsChannelsView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const [channels, setChannels] = useState(
    settings.paymentByChannel || {
      efectivo: { delivery: true, pickup: true, dineIn: true },
      tarjeta: { delivery: false, pickup: true, dineIn: true },
      online: { delivery: true, pickup: true, dineIn: false },
    },
  )
  const [methods, setMethods] = useState(
    settings.paymentMethods || {
      efectivo: true,
      transferencia: true,
      pos: true,
      mercadoPago: false,
      paypal: false,
    },
  )

  return (
    <WizardCard
      title="Métodos de pago"
      subtitle="Habilitación independiente por canal de cumplimiento"
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ paymentByChannel: channels, paymentMethods: methods })}
    >
      {(['efectivo', 'tarjeta', 'online'] as const).map((key) => (
        <div key={key} className="mod-group-edit">
          <strong>{key === 'online' ? 'Pagos en línea' : key === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}</strong>
          <div className="checks">
            {(['delivery', 'pickup', 'dineIn'] as const).map((ch) => (
              <label key={ch} className="check">
                <input
                  type="checkbox"
                  checked={!!channels[key]?.[ch]}
                  onChange={(e) =>
                    setChannels((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], [ch]: e.target.checked },
                    }))
                  }
                />
                {ch === 'delivery' ? 'A domicilio' : ch === 'pickup' ? 'Para llevar' : 'Local'}
              </label>
            ))}
          </div>
        </div>
      ))}
      <h4>Pasarelas</h4>
      {Object.entries(methods).map(([k, v]) => (
        <Switch
          key={k}
          checked={!!v}
          onChange={(on) => setMethods((m) => ({ ...m, [k]: on }))}
          label={k}
        />
      ))}
    </WizardCard>
  )
}

export function OrderAppDeviceView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const d = settings.orderDevice || {}
  const last = d.lastHeartbeatAt
    ? new Date(d.lastHeartbeatAt).toLocaleString()
    : 'hace unos segundos'
  return (
    <WizardCard
      title="App de toma de pedidos"
      subtitle="Dispositivo Android dedicado para recepción en tiempo real"
      saving={saving}
      nextLabel="Guardar"
      onNext={() =>
        onSave({
          orderAppEnabled: settings.orderAppEnabled !== false,
          orderDevice: {
            ...d,
            paired: true,
            lastHeartbeatAt: new Date().toISOString(),
          },
        })
      }
    >
      <Switch
        checked={settings.orderAppEnabled !== false}
        onChange={(v) => onSave({ orderAppEnabled: v })}
        label="App de toma de pedidos activa"
      />
      <div className="tm-kv">
        <div>
          <span>Dispositivo</span>
          <strong>{d.platform || 'Android'}</strong>
        </div>
        <div>
          <span>Versión OS</span>
          <strong>{d.osVersion || '—'}</strong>
        </div>
        <div>
          <span>ID del dispositivo</span>
          <strong>{d.deviceId || '—'}</strong>
        </div>
        <div>
          <span>Versión de la app</span>
          <strong>{d.appVersion || '—'}</strong>
        </div>
        <div>
          <span>Último control de conexión exitoso</span>
          <strong>{last}</strong>
        </div>
      </div>
      <p className="admin-muted">
        Abrí la sección operativa desde Reportes › Pedidos o usá el modo kiosk del personal.
      </p>
    </WizardCard>
  )
}

export function PromotionsListView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const [list, setList] = useState<Promotion[]>(settings.promotions || [])
  const [editing, setEditing] = useState<Promotion | null>(null)
  useEffect(() => setList(settings.promotions || []), [settings])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Tus promociones</h2>
          <p>Cupones y descuentos canjeables en el checkout</p>
        </div>
        <button
          type="button"
          className="admin-btn primary"
          onClick={() =>
            setEditing({
              id: `p${Date.now()}`,
              title: 'Nueva promoción',
              description: '',
              code: `PROMO${Math.floor(Math.random() * 9000 + 1000)}`,
              type: 'percent',
              value: 10,
              active: true,
              used: 0,
              createdAt: new Date().toISOString().slice(0, 10),
              associatedTo: 'Web',
            })
          }
        >
          Añadir promoción
        </button>
      </header>

      {editing && (
        <div className="admin-card settings-form tm-card">
          <h3>{editing.id.startsWith('p') && list.every((x) => x.id !== editing.id) ? 'Nueva' : 'Editar'}</h3>
          <label>
            Título (máx. 35)
            <input
              maxLength={35}
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <small className="admin-muted">
              {editing.title.length}/35
            </small>
          </label>
          <label>
            Descripción (máx. 100)
            <input
              maxLength={100}
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </label>
          <div className="row-2">
            <label>
              Cupón
              <input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Tipo
              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({ ...editing, type: e.target.value as 'percent' | 'fixed' })
                }
              >
                <option value="percent">% de descuento</option>
                <option value="fixed">Monto fijo</option>
              </select>
            </label>
          </div>
          <label>
            Valor
            <input
              type="number"
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) || 0 })}
            />
          </label>
          <Switch
            checked={editing.active}
            onChange={(v) => setEditing({ ...editing, active: v })}
            label="Estado activo"
          />
          <div className="product-editor-actions">
            <button
              type="button"
              className="admin-btn primary"
              disabled={saving}
              onClick={async () => {
                const exists = list.some((x) => x.id === editing.id)
                const next = exists
                  ? list.map((x) => (x.id === editing.id ? editing : x))
                  : [...list, editing]
                setList(next)
                await onSave({ promotions: next })
                setEditing(null)
              }}
            >
              Guardar
            </button>
            <button type="button" className="admin-btn ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Cupón</th>
              <th>Usado</th>
              <th>Creado</th>
              <th>Asociado a</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className={`pill ${p.active ? 'on' : 'off'}`}>{p.active ? 'Activa' : 'Inactiva'}</span>
                </td>
                <td>{p.title}</td>
                <td>
                  <code>{p.code}</code>
                </td>
                <td>{p.used}</td>
                <td>{p.createdAt}</td>
                <td>{p.associatedTo || '—'}</td>
                <td>
                  <button type="button" className="admin-btn ghost" onClick={() => setEditing(p)}>
                    ✎
                  </button>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={async () => {
                      if (!confirm(`¿Seguro que deseas eliminar "${p.title}"?`)) return
                      const next = list.filter((x) => x.id !== p.id)
                      setList(next)
                      await onSave({ promotions: next })
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ServiceFeesView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const [fees, setFees] = useState<ServiceFee[]>(settings.serviceFees || [])
  useEffect(() => setFees(settings.serviceFees || []), [settings])
  return (
    <WizardCard
      title="Tarifas de servicios"
      subtitle="Líneas adicionales a la factura del cliente"
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ serviceFees: fees })}
    >
      {fees.map((f, i) => (
        <div key={f.id} className="mod-group-edit">
          <div className="row-2">
            <input
              value={f.name}
              onChange={(e) => {
                const next = [...fees]
                next[i] = { ...f, name: e.target.value }
                setFees(next)
              }}
            />
            <select
              value={f.type}
              onChange={(e) => {
                const next = [...fees]
                next[i] = { ...f, type: e.target.value as ServiceFee['type'] }
                setFees(next)
              }}
            >
              <option value="convenience">Tarifa de conveniencia</option>
              <option value="cash_discount">Descuento en efectivo</option>
              <option value="holiday">Recargo feriado</option>
              <option value="other">Otras</option>
            </select>
          </div>
          <div className="row-2">
            <input
              type="number"
              value={f.amount}
              onChange={(e) => {
                const next = [...fees]
                next[i] = { ...f, amount: Number(e.target.value) || 0 }
                setFees(next)
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => {
                  const next = [...fees]
                  next[i] = { ...f, active: e.target.checked }
                  setFees(next)
                }}
              />
              Activa
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn"
        onClick={() =>
          setFees([
            ...fees,
            {
              id: `sf${Date.now()}`,
              name: 'Nueva tarifa',
              type: 'convenience',
              amount: 0,
              active: true,
            },
          ])
        }
      >
        Agregar tarifa
      </button>
    </WizardCard>
  )
}

export function LanguagesView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const all = [
    'es',
    'es-UY',
    'es-AR',
    'es-MX',
    'en',
    'pt-BR',
    'pt',
    'fr',
    'it',
    'de',
    'zh',
    'ja',
  ]
  const [enabled, setEnabled] = useState(settings.languages?.enabled || ['es'])
  const def = settings.languages?.default || 'es'
  return (
    <WizardCard
      title="Idiomas soportados"
      subtitle="Traducción del sitio público de pedidos"
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ languages: { default: def, enabled } })}
    >
      <div className="tm-lang-grid">
        {all.map((lang) => {
          const locked = lang === def
          const on = enabled.includes(lang) || locked
          return (
            <label key={lang} className="check">
              <input
                type="checkbox"
                disabled={locked}
                checked={on}
                onChange={(e) => {
                  if (locked) return
                  setEnabled((prev) =>
                    e.target.checked ? [...prev, lang] : prev.filter((x) => x !== lang),
                  )
                }}
              />
              {lang}
              {locked ? <em className="nav-prod">DEFECTO</em> : null}
            </label>
          )
        })}
      </div>
    </WizardCard>
  )
}

export function NotificationsView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const [emails, setEmails] = useState(settings.notifications?.staffEmails || [])
  const [from, setFrom] = useState(settings.notifications?.customerFromEmail || '')
  const [extra, setExtra] = useState('')
  return (
    <WizardCard
      title="Notificaciones"
      subtitle="Ajustes para el personal del restaurante"
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ notifications: { staffEmails: emails, customerFromEmail: from } })}
    >
      <ul className="rank-list">
        {emails.map((em, i) => (
          <li key={em}>
            <span>
              {em} {i === 0 ? '🔒' : ''}
            </span>
            {i > 0 ? (
              <button
                type="button"
                className="admin-btn danger"
                onClick={() => setEmails(emails.filter((_, j) => j !== i))}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="row-2">
        <input
          placeholder="Agregue un nuevo correo"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            if (!extra.trim()) return
            setEmails([...emails, extra.trim()])
            setExtra('')
          }}
        >
          Agregar
        </button>
      </div>
      <label>
        Dirección de correo electrónico del cliente (remitente)
        <input value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
    </WizardCard>
  )
}

export function ExtendedReportsView({
  section,
  dash,
  reports,
  settings,
}: {
  section: AdminSection
  dash: DashboardData | null
  reports: ReportsPayload | null
  settings: RestaurantSettings
}) {
  const funnel = settings.siteStats?.funnel || { visit: 0, cart: 0, checkout: 0, order: 0 }
  const promos = settings.promotions || []

  if (section === 'sales-trend') {
    const days = reports?.byDay?.length
      ? reports.byDay
      : dash?.salesByDay || []
    const maxSales = Math.max(1, ...days.map((d) => d.sales))
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Ventas · Tendencia</h2>
            <p>Evolución diaria de ventas (últimos días)</p>
          </div>
        </header>
        <div className="admin-card">
          <div className="bars">
            {days.map((d) => (
              <div key={d.date} className="bar-col">
                <div
                  className="bar"
                  style={{ height: `${Math.max(8, (d.sales / maxSales) * 140)}px` }}
                  title={`${d.date}: ${formatMoney(d.sales)} · ${d.orders} pedidos`}
                />
                <small>{d.date.slice(5)}</small>
              </div>
            ))}
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ventas</th>
              <th>Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{formatMoney(d.sales)}</td>
                <td>{d.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  if (section === 'sales-summary') {
    const totals = reports?.totals || {
      sales: dash?.kpis.salesToday || 0,
      orders: dash?.kpis.ordersToday || 0,
      avgTicket: dash?.kpis.avgTicket || 0,
    }
    const byF = reports?.byFulfillment || { delivery: 0, pickup: 0 }
    const byPay = reports?.byPayment || {}
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Ventas · Resumen</h2>
            <p>Foto del período: totales, canal y método de pago</p>
          </div>
        </header>
        <div className="kpi-grid">
          <div className="kpi">
            <span>Ventas</span>
            <strong>{formatMoney(totals.sales)}</strong>
          </div>
          <div className="kpi">
            <span>Pedidos</span>
            <strong>{totals.orders}</strong>
          </div>
          <div className="kpi">
            <span>Ticket promedio</span>
            <strong>{formatMoney(totals.avgTicket)}</strong>
          </div>
        </div>
        <div className="kpi-grid">
          <div className="kpi">
            <span>Delivery</span>
            <strong>{formatMoney(byF.delivery)}</strong>
          </div>
          <div className="kpi">
            <span>Retiro</span>
            <strong>{formatMoney(byF.pickup)}</strong>
          </div>
        </div>
        <ul className="rank-list admin-card">
          {Object.entries(byPay).map(([method, amount]) => (
            <li key={method}>
              <span>
                <strong>{method}</strong>
              </span>
              <strong>{formatMoney(amount as number)}</strong>
            </li>
          ))}
          {!Object.keys(byPay).length ? (
            <li>
              <span className="admin-muted">Sin desglose de pagos en el período</span>
            </li>
          ) : null}
        </ul>
      </section>
    )
  }

  if (section === 'menu-insights-categories' || section === 'menu-insights-items') {
    const items = reports?.topProducts || dash?.topProducts || []
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>
              Análisis del menú ·{' '}
              {section === 'menu-insights-categories' ? 'Categorías' : 'Productos'}
            </h2>
          </div>
        </header>
        <ul className="rank-list admin-card">
          {items.map((it) => (
            <li key={it.name}>
              <span>
                <strong>{it.name}</strong>
                <small className="admin-muted"> · {it.qty} uds</small>
              </span>
              <strong>{formatMoney(it.revenue)}</strong>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (section === 'online-funnel') {
    const max = Math.max(1, funnel.visit)
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Funnel del sitio web</h2>
            <p>Visita → carrito → checkout → pedido</p>
          </div>
        </header>
        <div className="admin-card settings-form">
          {(
            [
              ['Visitas', funnel.visit],
              ['Carrito', funnel.cart],
              ['Checkout', funnel.checkout],
              ['Pedido', funnel.order],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="tm-funnel-row">
              <span>{label}</span>
              <div className="tm-funnel-bar">
                <i style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <strong>{n}</strong>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (section === 'promotions-stats') {
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Estadísticas de promociones</h2>
          </div>
        </header>
        <ul className="rank-list admin-card">
          {promos.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.title}</strong>
                <small className="admin-muted"> · {p.code}</small>
              </span>
              <strong>{p.used} usos</strong>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (section === 'website-visits') {
    const v = settings.siteStats?.visitors7d || 0
    const prev = settings.siteStats?.visitorsPrev || 0
    const delta = prev ? Math.round(((v - prev) / prev) * 100) : 0
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Visitas del sitio web</h2>
          </div>
        </header>
        <div className="kpi-grid">
          <div className="kpi">
            <span>Últimos 7 días</span>
            <strong>{v}</strong>
            <small className="admin-muted">{delta >= 0 ? '+' : ''}{delta}% vs período anterior</small>
          </div>
        </div>
      </section>
    )
  }

  if (section === 'connectivity-health') {
    const d = settings.orderDevice
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Salud de conectividad</h2>
          </div>
        </header>
        <div className="admin-card">
          <p>
            App toma de pedidos:{' '}
            <span className={`pill ${d?.paired ? 'on' : 'off'}`}>
              {d?.paired ? 'En línea' : 'Sin conexión'}
            </span>
          </p>
          <p className="admin-muted">
            Dispositivo {d?.deviceId} · v{d?.appVersion}
          </p>
        </div>
      </section>
    )
  }

  if (section === 'delivery-map') {
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Mapa del pedido a domicilio</h2>
          </div>
        </header>
        <div className="zones-map-mock admin-card">
          <div className="zones-swatches">
            {(settings.deliveryZones || [])
              .filter((z) => z.active)
              .map((z) => (
                <span key={z.id} style={{ background: z.color }}>
                  {z.name} · {formatMoney(z.fee)}
                </span>
              ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>{section}</h2>
          <p>Reporte operativo</p>
        </div>
      </header>
      <div className="admin-card">
        <p className="admin-muted">Datos agregados según pedidos registrados en el sistema.</p>
        <div className="kpi-grid">
          <div className="kpi">
            <span>Pedidos hoy</span>
            <strong>{dash?.kpis.ordersToday ?? '—'}</strong>
          </div>
          <div className="kpi">
            <span>Ventas hoy</span>
            <strong>{formatMoney(dash?.kpis.salesToday || 0)}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export function MarketingHubView({
  section,
  settings,
  saving,
  onSave,
  menu,
}: {
  section: AdminSection
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
  menu: MenuData | null
}) {
  const m = settings.marketing || {}
  const url = typeof window !== 'undefined' ? window.location.origin : ''

  if (section === 'mkt-promos-list') {
    return <PromotionsListView settings={settings} saving={saving} onSave={onSave} />
  }

  if (section === 'mkt-promos-templates') {
    const templates = [
      { title: '20% off primera compra', type: 'percent' as const, value: 20 },
      { title: 'Envío gratis', type: 'fixed' as const, value: 80 },
      { title: '2x1 chivitos', type: 'percent' as const, value: 50 },
    ]
    return (
      <section className="admin-section">
        <header className="admin-header">
          <div>
            <h2>Promociones prefabricadas</h2>
          </div>
        </header>
        <div className="admin-grid-2">
          {templates.map((t) => (
            <div key={t.title} className="admin-card settings-form">
              <strong>{t.title}</strong>
              <button
                type="button"
                className="admin-btn primary"
                disabled={saving}
                onClick={async () => {
                  const promo: Promotion = {
                    id: `p${Date.now()}`,
                    title: t.title.slice(0, 35),
                    code: `TMP${Math.floor(Math.random() * 9000 + 1000)}`,
                    type: t.type,
                    value: t.value,
                    active: true,
                    used: 0,
                    createdAt: new Date().toISOString().slice(0, 10),
                    associatedTo: 'Web',
                  }
                  await onSave({ promotions: [...(settings.promotions || []), promo] })
                }}
              >
                Activar plantilla
              </button>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (section === 'mkt-qr') {
    const link = `${url}/menu`
    return (
      <WizardCard title="Códigos QR y Flyers" subtitle="Material para mesa y campañas offline">
        <p>
          Enlace de pedidos: <code>{link}</code>
        </p>
        <div className="tm-qr-preview">
          <img
            alt="QR"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`}
          />
        </div>
        <a className="admin-btn primary" href={link} target="_blank" rel="noreferrer">
          Abrir menú
        </a>
      </WizardCard>
    )
  }

  if (section === 'mkt-autopilot' || section === 'mkt-autopilot-campaigns') {
    return (
      <WizardCard
        title={section === 'mkt-autopilot' ? 'Piloto automático · Visión general' : 'Sus campañas'}
        subtitle="Campañas automáticas de reactivación"
        saving={saving}
        nextLabel="Guardar"
        onNext={() => onSave({ marketing: { ...m, autopilot: !!m.autopilot } })}
      >
        <Switch
          checked={!!m.autopilot}
          onChange={(v) => onSave({ marketing: { ...m, autopilot: v } })}
          label="Piloto automático activo"
        />
        <ul className="rank-list">
          {(settings.autopilotCampaigns || []).map((c) => (
            <li key={c.id}>
              <span>
                <strong>{c.name}</strong>
                <small className="admin-muted">
                  {' '}
                  · {c.channel} · {c.status}
                </small>
              </span>
              <strong>{c.sent} enviados</strong>
            </li>
          ))}
        </ul>
      </WizardCard>
    )
  }

  if (section === 'mkt-scanner') {
    return (
      <WizardCard title="Optimización web" subtitle="Escáner del sitio de pedidos">
        <ul className="rank-list">
          <li>
            <span>HTTPS / dominio</span>
            <span className="pill on">OK</span>
          </li>
          <li>
            <span>Menú con imágenes</span>
            <span className="pill on">OK</span>
          </li>
          <li>
            <span>Horarios publicados</span>
            <span className="pill on">OK</span>
          </li>
          <li>
            <span>Zonas de entrega</span>
            <span className={`pill ${(settings.deliveryZones || []).length ? 'on' : 'off'}`}>
              {(settings.deliveryZones || []).length ? 'OK' : 'Revisar'}
            </span>
          </li>
        </ul>
      </WizardCard>
    )
  }

  if (section === 'mkt-google') {
    return (
      <WizardCard
        title="Google Business"
        subtitle="Visión general"
        saving={saving}
        nextLabel="Guardar"
        onNext={() => onSave({ marketing: { ...m, googleBusiness: !!m.googleBusiness } })}
      >
        <Switch
          checked={!!m.googleBusiness}
          onChange={(v) => onSave({ marketing: { ...m, googleBusiness: v } })}
          label="Ficha Google Business vinculada"
        />
        <p className="admin-muted">
          Dominio sugerido: {typeof settings.publish?.smartLink === 'string' ? settings.publish.smartLink : url}
        </p>
      </WizardCard>
    )
  }

  // Kickstarter + overview promos
  const checks = [
    { ok: !!menu?.categories?.length, label: 'Menú publicado' },
    { ok: !!m.firstOrderPromo, label: 'Promo primera compra' },
    { ok: settings.publish?.webMenu !== false, label: 'Página web activa' },
    { ok: (settings.deliveryZones || []).some((z) => z.active), label: 'Zonas de entrega' },
  ]
  return (
    <WizardCard
      title={
        section === 'mkt-kickstarter-first'
          ? 'Promoción de la primera compra'
          : section === 'mkt-kickstarter-invite'
            ? 'Invita a clientes potenciales'
            : section === 'mkt-promos'
              ? 'Promociones · Visión general'
              : 'Arranque · Visión general'
      }
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ marketing: m })}
    >
      {checks.map((c) => (
        <div key={c.label} className="provider-row">
          <strong>{c.label}</strong>
          <span className={`pill ${c.ok ? 'on' : 'off'}`}>{c.ok ? '✓' : 'Pendiente'}</span>
        </div>
      ))}
      <Switch
        checked={!!m.firstOrderPromo}
        onChange={(v) => onSave({ marketing: { ...m, firstOrderPromo: v } })}
        label="Fomentar el primer pedido (banner)"
      />
      <Switch
        checked={!!m.inviteEnabled}
        onChange={(v) => onSave({ marketing: { ...m, inviteEnabled: v } })}
        label="Invitaciones a clientes potenciales"
      />
    </WizardCard>
  )
}

export function PublishChannelView({
  section,
  settings,
  saving,
  onSave,
}: {
  section: AdminSection
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const p = settings.publish || {}
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [form, setForm] = useState({
    privacyPolicy: String(p.privacyPolicy || ''),
    facebookPage: String(p.facebookPage || ''),
    smartLink: String(p.smartLink || origin),
    webMenu: p.webMenu !== false,
    widgetEnabled: p.widgetEnabled !== false,
    whiteLabelApp: !!p.whiteLabelApp,
    qrFlyers: p.qrFlyers !== false,
    social: !!p.social,
  })

  return (
    <WizardCard
      title={
        section === 'publish-privacy'
          ? 'Política de privacidad'
          : section === 'publish-facebook'
            ? 'Facebook'
            : section === 'publish-smartlinks'
              ? 'Smart links'
              : section === 'publish-widget'
                ? 'Widget HTML'
                : section === 'publish-app'
                  ? 'Aplicación móvil con su marca'
                  : 'Página Web'
      }
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ publish: form })}
    >
      {section === 'publish-privacy' && (
        <label>
          Política
          <textarea
            rows={6}
            value={form.privacyPolicy}
            onChange={(e) => setForm((f) => ({ ...f, privacyPolicy: e.target.value }))}
          />
        </label>
      )}
      {section === 'publish-facebook' && (
        <label>
          URL página Facebook
          <input
            value={form.facebookPage}
            onChange={(e) => setForm((f) => ({ ...f, facebookPage: e.target.value }))}
          />
        </label>
      )}
      {section === 'publish-smartlinks' && (
        <label>
          Smart link
          <input
            value={form.smartLink}
            onChange={(e) => setForm((f) => ({ ...f, smartLink: e.target.value }))}
          />
        </label>
      )}
      {section === 'publish-web' && (
        <>
          <Switch
            checked={form.webMenu}
            onChange={(v) => setForm((f) => ({ ...f, webMenu: v }))}
            label="Sitio web optimizado para ventas"
          />
          <p className="admin-muted">Terminación del sitio web ✓</p>
          <a className="admin-btn" href="/menu" target="_blank" rel="noreferrer">
            Ver y editar el sitio web
          </a>
        </>
      )}
      {section === 'publish-widget' && (
        <>
          <Switch
            checked={form.widgetEnabled}
            onChange={(v) => setForm((f) => ({ ...f, widgetEnabled: v }))}
            label="Widget habilitado"
          />
          <label>
            Código embebible
            <textarea
              rows={4}
              readOnly
              value={`<iframe src="${origin}/menu" width="100%" height="700" style="border:0"></iframe>`}
            />
          </label>
        </>
      )}
      {section === 'publish-app' && (
        <Switch
          checked={form.whiteLabelApp}
          onChange={(v) => setForm((f) => ({ ...f, whiteLabelApp: v }))}
          label="Solicitar app blanca (white-label)"
        />
      )}
    </WizardCard>
  )
}

export function OnlineOrderingConfigView({
  section,
  settings,
  saving,
  onSave,
}: {
  section: AdminSection
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const w = settings.orderWidget || {}
  const [form, setForm] = useState({
    scheduledLimit: w.scheduledLimit ?? 20,
    autoAccept: !!w.autoAccept,
    autoAcceptVia: w.autoAcceptVia || 'printer',
    fulfillmentMode: w.fulfillmentMode || 'default',
    hcaptcha: !!w.hcaptcha,
    billingDetail: w.billingDetail || 'optional',
  })
  useEffect(() => {
    const next = settings.orderWidget || {}
    setForm({
      scheduledLimit: next.scheduledLimit ?? 20,
      autoAccept: !!next.autoAccept,
      autoAcceptVia: next.autoAcceptVia || 'printer',
      fulfillmentMode: next.fulfillmentMode || 'default',
      hcaptcha: !!next.hcaptcha,
      billingDetail: next.billingDetail || 'optional',
    })
  }, [settings])

  if (section === 'widget-service-fees') {
    return <ServiceFeesView settings={settings} saving={saving} onSave={onSave} />
  }

  if (
    section === 'print-overview' ||
    section === 'print-printers' ||
    section === 'print-templates' ||
    section === 'print-history'
  ) {
    return (
      <WizardCard
        title={
          section === 'print-printers'
            ? 'Impresoras'
            : section === 'print-templates'
              ? 'Plantillas'
              : section === 'print-history'
                ? 'Historial de impresión'
                : 'Impresión · Visión General'
        }
        saving={saving}
        nextLabel="Guardar"
        onNext={() => onSave({ printers: settings.printers, printTemplates: settings.printTemplates })}
      >
        {(settings.printers || []).map((pr) => (
          <div key={pr.id} className="provider-row">
            <div>
              <strong>{pr.name}</strong>
              <span className={`pill ${pr.connected ? 'on' : 'off'}`}>
                {pr.connected ? 'Conectada' : 'Desconectada'}
              </span>
            </div>
            <small className="admin-muted">{pr.type}</small>
          </div>
        ))}
        {(settings.printTemplates || []).map((t) => (
          <div key={t.id} className="provider-row">
            <strong>{t.name}</strong>
            <span>{t.width}mm</span>
          </div>
        ))}
        {(settings.printHistory || []).length === 0 && section === 'print-history' ? (
          <p className="admin-muted">Sin impresiones registradas todavía.</p>
        ) : null}
      </WizardCard>
    )
  }

  if (section === 'integrations-catalog' || section === 'integrations-yours') {
    const catalog = [
      'Custom integration',
      'Spoonity QuickPay',
      'Tookan',
      'Shipday',
      'Google Tag Manager',
      'Spoonity post-order rewards',
    ]
    return (
      <WizardCard
        title={section === 'integrations-catalog' ? 'Catálogo' : 'Tus integraciones'}
      >
        {section === 'integrations-yours' && (settings.integrations || []).length === 0 ? (
          <p className="admin-muted">Nada aquí todavía.</p>
        ) : null}
        {catalog.map((name) => (
          <div key={name} className="provider-row">
            <strong>{name}</strong>
            <button
              type="button"
              className="admin-btn"
              disabled={saving}
              onClick={() =>
                onSave({
                  integrations: [
                    ...(settings.integrations || []),
                    { id: `i${Date.now()}`, name, status: 'connected' },
                  ],
                })
              }
            >
              Agregar
            </button>
          </div>
        ))}
      </WizardCard>
    )
  }

  return (
    <WizardCard
      title={
        section === 'widget-scheduled-limit'
          ? 'Límite de pedidos programados'
          : section === 'widget-auto-orders'
            ? 'Pedidos automáticos'
            : section === 'widget-fulfillment'
              ? 'Opciones de cumplimiento'
              : section === 'widget-hcaptcha'
                ? 'hCaptcha'
                : 'Detalle de facturación en checkout'
      }
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ orderWidget: form })}
    >
      {section === 'widget-scheduled-limit' && (
        <label>
          Máximo de pedidos programados simultáneos
          <input
            type="number"
            value={form.scheduledLimit}
            onChange={(e) => setForm((f) => ({ ...f, scheduledLimit: Number(e.target.value) || 0 }))}
          />
        </label>
      )}
      {section === 'widget-auto-orders' && (
        <>
          <Switch
            checked={form.autoAccept}
            onChange={(v) => setForm((f) => ({ ...f, autoAccept: v }))}
            label="¿Desea activar la aceptación automática de pedidos?"
          />
          <label>
            Mecanismo
            <select
              value={form.autoAcceptVia}
              onChange={(e) => setForm((f) => ({ ...f, autoAcceptVia: e.target.value }))}
            >
              <option value="printer">With printer</option>
              <option value="pos">With POS</option>
            </select>
          </label>
        </>
      )}
      {section === 'widget-fulfillment' && (
        <label>
          Modo
          <select
            value={form.fulfillmentMode}
            onChange={(e) => setForm((f) => ({ ...f, fulfillmentMode: e.target.value }))}
          >
            <option value="default">Predeterminado</option>
            <option value="low-contact">Exposición mínima (sin contacto)</option>
          </select>
        </label>
      )}
      {section === 'widget-hcaptcha' && (
        <Switch
          checked={form.hcaptcha}
          onChange={(v) => setForm((f) => ({ ...f, hcaptcha: v }))}
          label="Activar hCaptcha en checkout"
        />
      )}
      {section === 'widget-billing' && (
        <label>
          Datos de facturación
          <select
            value={form.billingDetail}
            onChange={(e) => setForm((f) => ({ ...f, billingDetail: e.target.value }))}
          >
            <option value="optional">Opcional</option>
            <option value="required">Obligatorio (RUT/CI)</option>
            <option value="hidden">No solicitar</option>
          </select>
        </label>
      )}
    </WizardCard>
  )
}

export function TipsDepositView({
  section,
  settings,
  saving,
  onSave,
}: {
  section: AdminSection
  settings: RestaurantSettings
  saving: boolean
  onSave: SaveFn
}) {
  const tips = settings.tips || { enabled: false, askNoCutlery: true, presets: [10, 15, 20] }
  const dep = settings.reservationDeposit || { enabled: false, amount: 0 }
  const [tipsForm, setTipsForm] = useState(tips)
  const [depForm, setDepForm] = useState(dep)
  useEffect(() => {
    setTipsForm(settings.tips || { enabled: false, askNoCutlery: true, presets: [10, 15, 20] })
    setDepForm(settings.reservationDeposit || { enabled: false, amount: 0 })
  }, [settings])

  if (section === 'pagos-tips') {
    return (
      <WizardCard
        title="Propinas"
        subtitle="Consejos para pagos con tarjeta"
        saving={saving}
        nextLabel="Guardar"
        onNext={() => onSave({ tips: tipsForm })}
      >
        <Switch
          checked={tipsForm.enabled}
          onChange={(v) => setTipsForm((f) => ({ ...f, enabled: v }))}
          label="¿De verdad quieres pedir consejos (propinas)?"
        />
        <Switch
          checked={!!tipsForm.askNoCutlery}
          onChange={(v) => setTipsForm((f) => ({ ...f, askNoCutlery: v }))}
          label="Preguntar si no necesitan cubiertos"
        />
      </WizardCard>
    )
  }
  return (
    <WizardCard
      title="Seña de reserva"
      subtitle="Seña al reservar mesa"
      saving={saving}
      nextLabel="Guardar"
      onNext={() => onSave({ reservationDeposit: depForm })}
    >
      <Switch
        checked={depForm.enabled}
        onChange={(v) => setDepForm((f) => ({ ...f, enabled: v }))}
        label="Cobrar depósito"
      />
      <label>
        Monto (UYU)
        <input
          type="number"
          value={depForm.amount}
          onChange={(e) => setDepForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
        />
      </label>
    </WizardCard>
  )
}

export function ProfileExtraViews({
  section,
  menu,
  saving,
  onSaveRestaurant,
}: {
  section: AdminSection
  menu: MenuData
  settings: RestaurantSettings
  saving: boolean
  onSaveSettings?: SaveFn
  onSaveRestaurant: (patch: Record<string, unknown>) => Promise<void>
}) {
  const r = menu.restaurant
  const [lat, setLat] = useState(r.lat || SALTO_CENTER.lat)
  const [lng, setLng] = useState(r.lng || SALTO_CENTER.lng)

  useEffect(() => {
    setLat(r.lat || SALTO_CENTER.lat)
    setLng(r.lng || SALTO_CENTER.lng)
  }, [r.lat, r.lng])

  if (section !== 'profile-location') return null

  const dirty = Math.abs(lat - (r.lat || 0)) > 1e-7 || Math.abs(lng - (r.lng || 0)) > 1e-7

  return (
    <WizardCard
      title="Ubicación"
      subtitle="Marcá el pin exacto de ChivitosPro en el mapa. Así aparece en la app del cliente."
      saving={saving}
      nextLabel={dirty ? 'Guardar ubicación' : 'Ubicación guardada'}
      nextDisabled={!dirty}
      onNext={() =>
        onSaveRestaurant({
          lat,
          lng,
          mapEmbed: buildOsmEmbed(lat, lng),
        })
      }
    >
      <p className="delivery-zones-guide" role="note">
        Tocá el mapa o arrastrá el marcador hasta la esquina / local exacto. Después guardá.
      </p>
      <RestaurantLocationMap
        lat={lat}
        lng={lng}
        onChange={(nextLat, nextLng) => {
          setLat(nextLat)
          setLng(nextLng)
        }}
      />
      <div className="row-2" style={{ marginTop: 12 }}>
        <label>
          Latitud
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value) || SALTO_CENTER.lat)}
          />
        </label>
        <label>
          Longitud
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value) || SALTO_CENTER.lng)}
          />
        </label>
      </div>
      <p className="admin-muted">
        Coordenadas actuales: {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </WizardCard>
  )
}

export function resolveSettingsSections(section: AdminSection): boolean {
  return [
    'schedules-pickup',
    'schedules-delivery',
    'schedules-reservation',
    'schedules-dinein',
    'schedules-hours',
    'pay-taxes',
    'pay-methods',
    'take-orders-alert',
    'publish-privacy',
    'publish-facebook',
    'publish-smartlinks',
    'publish-web',
    'publish-widget',
    'publish-app',
    'pagos-tips',
    'pagos-deposit',
    'mkt-kickstarter',
    'mkt-kickstarter-first',
    'mkt-kickstarter-invite',
    'mkt-autopilot',
    'mkt-autopilot-campaigns',
    'mkt-scanner',
    'mkt-google',
    'mkt-promos',
    'mkt-promos-list',
    'mkt-promos-templates',
    'mkt-qr',
    'sales-trend',
    'sales-summary',
    'menu-insights-categories',
    'menu-insights-items',
    'online-funnel',
    'report-clients-metrics',
    'report-reservations',
    'google-ranking',
    'website-visits',
    'delivery-map',
    'connectivity-health',
    'promotions-stats',
    'print-overview',
    'print-printers',
    'print-templates',
    'print-history',
    'widget-scheduled-limit',
    'widget-auto-orders',
    'widget-service-fees',
    'widget-fulfillment',
    'widget-hcaptcha',
    'widget-billing',
    'integrations-catalog',
    'integrations-yours',
    'other-notifications',
    'other-languages',
    'profile-location',
    'take-orders-app',
  ].includes(section)
}
