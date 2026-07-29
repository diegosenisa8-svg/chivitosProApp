import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminLogin,
  adminMe,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  fetchAdminMenu,
  fetchAdminOrders,
  fetchCustomers,
  fetchDashboard,
  fetchModifierLibrary,
  fetchReports,
  getAdminToken,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  reorderMenu,
  saveProductModifiers,
  setAdminToken,
  updateOrder,
  updateProduct,
  updateRestaurant,
  uploadImage,
  type AdminCustomer,
  type AdminOrder,
  type AdminUser,
  type DashboardData,
} from '../lib/adminApi'
import { mediaUrl } from '../lib/apiBase'
import { formatMoney } from '../lib/format'
import type { MenuData, MenuItem, ModifierGroup, RestaurantSettings } from '../types'
import '../admin.css'
import { DevPopup } from './DevPopup'
import { NAV, type AdminSection } from './nav'
import { ChatAssistant } from '../components/ChatAssistant'

export function AdminApp() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('admin@chivitospro.com')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [library, setLibrary] = useState<Awaited<ReturnType<typeof fetchModifierLibrary>>>([])
  const [reports, setReports] = useState<Awaited<ReturnType<typeof fetchReports>> | null>(null)
  const [orderFilter, setOrderFilter] = useState('all')
  const [orderQuery, setOrderQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [devOpen, setDevOpen] = useState(false)
  const [devTitle, setDevTitle] = useState('Sección en desarrollo')
  const knownOrderIds = useRef<Set<string>>(new Set())
  const audioCtx = useRef<AudioContext | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2500)
  }

  const showDev = (title?: string) => {
    setDevTitle(title || 'Sección en desarrollo')
    setDevOpen(true)
  }

  const beep = () => {
    try {
      audioCtx.current ||= new AudioContext()
      const ctx = audioCtx.current
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.frequency.value = 880
      g.gain.value = 0.05
      o.start()
      o.stop(ctx.currentTime + 0.25)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      setBooting(false)
      return
    }
    adminMe()
      .then(setAdmin)
      .catch(() => setAdminToken(null))
      .finally(() => setBooting(false))
  }, [])

  const refreshDashboard = useCallback(async () => setDash(await fetchDashboard()), [])
  const refreshMenu = useCallback(async () => {
    const m = await fetchAdminMenu()
    setMenu(m)
    return m
  }, [])
  const refreshOrders = useCallback(async () => {
    const list = await fetchAdminOrders({ status: orderFilter, q: orderQuery })
    if (knownOrderIds.current.size === 0) {
      knownOrderIds.current = new Set(list.map((o) => o.id))
    } else {
      const fresh = list.filter((o) => !knownOrderIds.current.has(o.id) && o.status === 'pending')
      if (fresh.length) {
        beep()
        notify(`${fresh.length} pedido(s) nuevo(s)`)
        fresh.forEach((o) => knownOrderIds.current.add(o.id))
      }
      list.forEach((o) => knownOrderIds.current.add(o.id))
    }
    setOrders(list)
  }, [orderFilter, orderQuery])

  const refreshCustomers = useCallback(async () => {
    setCustomers(await fetchCustomers(customerQuery))
  }, [customerQuery])

  useEffect(() => {
    if (!admin) return
    setError('')
    ;(async () => {
      try {
        if (section === 'dashboard') await refreshDashboard()
        if (section === 'orders' || section === 'take-orders') await refreshOrders()
        if (section === 'clients') await refreshCustomers()
        if (
          section === 'menu' ||
          section === 'modifiers' ||
          section === 'profile' ||
          section === 'schedules' ||
          section === 'delivery-zones' ||
          section === 'payments-taxes' ||
          section === 'alert-call' ||
          section === 'publish' ||
          section === 'preview'
        ) {
          await refreshMenu()
        }
        if (section === 'modifiers') setLibrary(await fetchModifierLibrary())
        if (section === 'reports') setReports(await fetchReports(30))
        if (section === 'pagos' || section === 'marketing') showDev(
          section === 'pagos' ? 'Mercado Pago / PayPal' : 'Marketing / Kickstarter',
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      }
    })()
  }, [admin, section, refreshDashboard, refreshOrders, refreshMenu, refreshCustomers])

  useEffect(() => {
    if (!admin || (section !== 'orders' && section !== 'take-orders' && section !== 'dashboard')) return
    const id = window.setInterval(() => {
      if (section === 'dashboard') refreshDashboard().catch(() => {})
      else refreshOrders().catch(() => {})
    }, 8000)
    return () => window.clearInterval(id)
  }, [admin, section, refreshDashboard, refreshOrders])

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    try {
      setAdmin(await adminLogin(email.trim(), password))
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Error de login')
    }
  }

  const settings: RestaurantSettings = menu?.restaurant.settings || {}
  const maxSales = useMemo(
    () => Math.max(1, ...(dash?.salesByDay.map((d) => d.sales) || [1])),
    [dash],
  )

  async function patchSettings(partial: Partial<RestaurantSettings>) {
    setSaving(true)
    try {
      await updateRestaurant({ settings: { ...settings, ...partial } })
      await refreshMenu()
      notify('Configuración guardada')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (booting) {
    return (
      <div className="admin-shell">
        <p className="admin-muted">Cargando panel…</p>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="admin-shell login">
        <form className="admin-login-card" onSubmit={onLogin}>
          <div className="admin-brand">
            <img src="/logo.png" alt="ChivitosPro" className="admin-logo" />
            <div>
              <h1>ChivitosPro Admin</h1>
              <p>Panel completo de operaciones</p>
            </div>
          </div>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {loginError && <p className="admin-error">{loginError}</p>}
          <button type="submit" className="admin-btn primary">
            Entrar
          </button>
          <button type="button" className="admin-btn ghost" onClick={() => navigate('/')}>
            Volver a la app
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-shell wide">
      <DevPopup open={devOpen} title={devTitle} onClose={() => setDevOpen(false)} />
      {toast && <div className="admin-toast">{toast}</div>}
      <ChatAssistant variant="admin" />

      <aside className="admin-sidebar scroll">
        <div className="admin-brand compact">
          <img src="/logo.png" alt="ChivitosPro" className="admin-logo" />
          <div>
            <strong>ChivitosPro</strong>
            <small>{admin.name}</small>
          </div>
        </div>

        {(['ops', 'config', 'growth'] as const).map((group) => (
          <div key={group} className="nav-group">
            <p className="nav-group-label">
              {group === 'ops' ? 'Operaciones' : group === 'config' ? 'Configuración' : 'Crecimiento'}
            </p>
            {NAV.filter((n) => n.group === group).map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? 'active' : ''}
                onClick={() => {
                  if (item.prodOnly) {
                    setSection(item.id)
                    showDev(item.label)
                    return
                  }
                  setSection(item.id)
                }}
              >
                {item.label}
                {item.prodOnly ? <em className="nav-prod">prod</em> : null}
              </button>
            ))}
          </div>
        ))}

        <div className="admin-sidebar-foot">
          <button type="button" className="admin-btn ghost" onClick={() => navigate('/')}>
            Ver app
          </button>
          <button
            type="button"
            className="admin-btn ghost"
            onClick={() => {
              setAdminToken(null)
              setAdmin(null)
            }}
          >
            Salir
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {error && <p className="admin-error banner">{error}</p>}

        {section === 'dashboard' && dash && (
          <DashboardView dash={dash} maxSales={maxSales} onRefresh={refreshDashboard} />
        )}

        {(section === 'orders' || section === 'take-orders') && (
          <OrdersView
            kiosk={section === 'take-orders'}
            orders={orders}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            orderFilter={orderFilter}
            setOrderFilter={setOrderFilter}
            orderQuery={orderQuery}
            setOrderQuery={setOrderQuery}
            saving={saving}
            onRefresh={refreshOrders}
            onUpdate={async (id, patch) => {
              setSaving(true)
              try {
                const updated = await updateOrder(id, patch)
                setSelectedOrder(updated)
                await refreshOrders()
                notify('Pedido actualizado')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Error')
              } finally {
                setSaving(false)
              }
            }}
          />
        )}

        {section === 'clients' && (
          <ClientsView
            customers={customers}
            query={customerQuery}
            setQuery={setCustomerQuery}
            onRefresh={refreshCustomers}
          />
        )}

        {section === 'menu' && menu && (
          <MenuConfigView
            menu={menu}
            editing={editing}
            setEditing={setEditing}
            saving={saving}
            notify={notify}
            setError={setError}
            setSaving={setSaving}
            refreshMenu={refreshMenu}
            onPreview={() => setSection('preview')}
          />
        )}

        {section === 'modifiers' && menu && (
          <ModifiersView
            menu={menu}
            library={library}
            saving={saving}
            setSaving={setSaving}
            notify={notify}
            setError={setError}
            refresh={async () => {
              await refreshMenu()
              setLibrary(await fetchModifierLibrary())
            }}
          />
        )}

        {section === 'preview' && (
          <section className="admin-section">
            <header className="admin-header">
              <div>
                <h2>Vista previa & Pedido de prueba</h2>
                <p>Abrí la app cliente para validar el menú publicado</p>
              </div>
            </header>
            <div className="admin-card settings-form">
              <p className="admin-muted">
                El menú público usa los mismos datos que editás acá. Podés hacer un pedido de prueba
                desde la app; en local/ngrok verás el popup de pedido de prueba (sin WhatsApp real).
              </p>
              <div className="row-2">
                <button type="button" className="admin-btn primary" onClick={() => navigate('/menu')}>
                  Abrir menú cliente
                </button>
                <button type="button" className="admin-btn" onClick={() => navigate('/checkout')}>
                  Ir a checkout de prueba
                </button>
              </div>
            </div>
          </section>
        )}

        {section === 'profile' && menu && (
          <ProfileView
            menu={menu}
            saving={saving}
            onSave={async (patch) => {
              setSaving(true)
              try {
                await updateRestaurant(patch)
                await refreshMenu()
                notify('Perfil actualizado')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Error')
              } finally {
                setSaving(false)
              }
            }}
          />
        )}

        {section === 'schedules' && menu && (
          <SchedulesView settings={settings} saving={saving} onSave={patchSettings} showDev={showDev} />
        )}

        {section === 'delivery-zones' && menu && (
          <ZonesView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'payments-taxes' && menu && (
          <PaymentsTaxesView
            settings={settings}
            saving={saving}
            onSave={patchSettings}
            showDev={showDev}
          />
        )}

        {section === 'alert-call' && menu && (
          <AlertCallView settings={settings} saving={saving} onSave={patchSettings} showDev={showDev} />
        )}

        {section === 'publish' && menu && (
          <PublishView settings={settings} saving={saving} onSave={patchSettings} showDev={showDev} />
        )}

        {(section === 'pagos' || section === 'marketing') && (
          <section className="admin-section">
            <header className="admin-header">
              <div>
                <h2>{section === 'pagos' ? 'Pagos' : 'Marketing'}</h2>
                <p>Disponible al pasar a producción con credenciales reales</p>
              </div>
              <button type="button" className="admin-btn primary" onClick={() => showDev()}>
                Ver aviso
              </button>
            </header>
            <div className="admin-card settings-form">
              {section === 'pagos' ? (
                <>
                  <ProviderRow name="Mercado Pago" status="Pendiente" onClick={() => showDev('Mercado Pago')} />
                  <ProviderRow name="PayPal" status="Pendiente" onClick={() => showDev('PayPal')} />
                </>
              ) : (
                <>
                  <ProviderRow name="Kickstarter / 1ª compra" status="Demo" onClick={() => showDev('Kickstarter')} />
                  <ProviderRow name="Autopilot" status="Demo" onClick={() => showDev('Autopilot')} />
                  <ProviderRow name="Google Business" status="Demo" onClick={() => showDev('Google Business')} />
                  <ProviderRow name="Códigos QR y Flyers" status="Demo" onClick={() => showDev('QR y Flyers')} />
                </>
              )}
            </div>
          </section>
        )}

        {section === 'reports' && reports && <ReportsView reports={reports} />}
      </main>
    </div>
  )
}

function ProviderRow({
  name,
  status,
  onClick,
}: {
  name: string
  status: string
  onClick: () => void
}) {
  return (
    <div className="provider-row">
      <div>
        <strong>{name}</strong>
        <span className="pill off">{status}</span>
      </div>
      <button type="button" className="admin-btn" onClick={onClick}>
        Configurar
      </button>
    </div>
  )
}

function DashboardView({
  dash,
  maxSales,
  onRefresh,
}: {
  dash: DashboardData
  maxSales: number
  onRefresh: () => void
}) {
  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Dashboard</h2>
          <p>Rendimiento en vivo · auto-actualiza</p>
        </div>
        <button type="button" className="admin-btn" onClick={onRefresh}>
          Actualizar
        </button>
      </header>
      <div className="kpi-grid">
        <div className="kpi accent">
          <span>Ventas hoy</span>
          <strong>{formatMoney(dash.kpis.salesToday)}</strong>
        </div>
        <div className="kpi">
          <span>Pedidos hoy</span>
          <strong>{dash.kpis.ordersToday}</strong>
        </div>
        <div className="kpi">
          <span>Ventas 7 días</span>
          <strong>{formatMoney(dash.kpis.salesWeek)}</strong>
        </div>
        <div className="kpi">
          <span>Ticket promedio</span>
          <strong>{formatMoney(dash.kpis.avgTicket)}</strong>
        </div>
        <div className="kpi warn">
          <span>Pedidos abiertos</span>
          <strong>{dash.kpis.openOrders}</strong>
        </div>
        <div className="kpi">
          <span>Productos</span>
          <strong>{dash.kpis.products}</strong>
        </div>
      </div>
      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Ventas últimos 7 días</h3>
          <div className="bars">
            {dash.salesByDay.map((d) => (
              <div key={d.date} className="bar-col">
                <div className="bar" style={{ height: `${Math.max(8, (d.sales / maxSales) * 140)}px` }} />
                <span>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h3>Más vendidos</h3>
          <ul className="rank-list">
            {dash.topProducts.map((p, i) => (
              <li key={p.name}>
                <span>
                  <em>{i + 1}</em> {p.name}
                </span>
                <strong>
                  {p.qty} · {formatMoney(p.revenue)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ClientsView({
  customers,
  query,
  setQuery,
  onRefresh,
}: {
  customers: AdminCustomer[]
  query: string
  setQuery: (v: string) => void
  onRefresh: () => void
}) {
  function formatLastOrder(iso: string) {
    try {
      return new Date(iso).toLocaleString('es-UY', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Clientes</h2>
          <p>Quienes pidieron desde la app · nombre, última compra y WhatsApp</p>
        </div>
        <button type="button" className="admin-btn" onClick={onRefresh}>
          Actualizar
        </button>
      </header>

      <div className="filters">
        <input
          placeholder="Buscar por nombre o teléfono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onRefresh()}
        />
        <button type="button" className="admin-btn" onClick={onRefresh}>
          Buscar
        </button>
      </div>

      <div className="admin-card list clients-list">
        {customers.length === 0 ? (
          <p className="admin-muted" style={{ padding: 16 }}>
            Todavía no hay clientes. Cuando alguien finalice un pedido en la app, aparece acá.
          </p>
        ) : (
          customers.map((c) => (
            <div key={c.id} className="client-row">
              <div>
                <strong>{c.name}</strong>
                <span>
                  {c.phone}
                  {c.orderCount > 1 ? ` · ${c.orderCount} pedidos` : ' · 1 pedido'}
                </span>
                <span className="client-last">Última vez: {formatLastOrder(c.lastOrderAt)}</span>
              </div>
              {c.whatsappUrl ? (
                <a
                  className="admin-btn primary"
                  href={c.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              ) : (
                <span className="admin-muted">Sin WA</span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function OrdersView({
  kiosk,
  orders,
  selectedOrder,
  setSelectedOrder,
  orderFilter,
  setOrderFilter,
  orderQuery,
  setOrderQuery,
  saving,
  onRefresh,
  onUpdate,
}: {
  kiosk: boolean
  orders: AdminOrder[]
  selectedOrder: AdminOrder | null
  setSelectedOrder: (o: AdminOrder | null) => void
  orderFilter: string
  setOrderFilter: (v: string) => void
  orderQuery: string
  setOrderQuery: (v: string) => void
  saving: boolean
  onRefresh: () => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const list = kiosk
    ? orders.filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
    : orders

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>{kiosk ? 'App de toma de pedidos' : 'Pedidos'}</h2>
          <p>
            {kiosk
              ? 'Vista cocina / mostrador · sonido al llegar pedido nuevo'
              : 'Gestión completa · auto-refresh 8s'}
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={onRefresh}>
          Actualizar
        </button>
      </header>
      {!kiosk && (
        <div className="filters">
          <input
            placeholder="Buscar cliente, teléfono o ID"
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRefresh()}
          />
          <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button type="button" className="admin-btn" onClick={onRefresh}>
            Filtrar
          </button>
        </div>
      )}
      <div className={`admin-grid-2 orders-layout ${kiosk ? 'kiosk' : ''}`}>
        <div className="admin-card list">
          {list.length === 0 && <p className="admin-muted">No hay pedidos</p>}
          {list.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`order-row ${selectedOrder?.id === o.id ? 'active' : ''}`}
              onClick={() => setSelectedOrder(o)}
            >
              <div>
                <strong>{o.customerName || 'Cliente'}</strong>
                <span>
                  {o.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'} ·{' '}
                  {new Date(o.createdAt).toLocaleString('es-UY')}
                </span>
              </div>
              <div className="order-row-right">
                <span className={`status-pill status-${o.status}`}>
                  {ORDER_STATUS_LABELS[o.status]}
                </span>
                <strong>{formatMoney(o.total)}</strong>
              </div>
            </button>
          ))}
        </div>
        <div className="admin-card detail">
          {!selectedOrder ? (
            <p className="admin-muted">Seleccioná un pedido</p>
          ) : (
            <OrderDetail
              order={selectedOrder}
              saving={saving}
              kiosk={kiosk}
              onUpdate={(patch) => onUpdate(selectedOrder.id, patch)}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function OrderDetail({
  order,
  saving,
  kiosk,
  onUpdate,
}: {
  order: AdminOrder
  saving: boolean
  kiosk?: boolean
  onUpdate: (patch: Record<string, unknown>) => Promise<void>
}) {
  return (
    <div className="order-detail" id="print-order">
      <div className="order-detail-top">
        <div>
          <h3>{order.customerName || 'Cliente'}</h3>
          <p>{order.phone || 'Sin teléfono'}</p>
          <small>#{order.id.slice(0, 8)}</small>
        </div>
        <span className={`status-pill status-${order.status}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>
      <div className="meta-grid">
        <div>
          <span>Tipo</span>
          <strong>{order.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'}</strong>
        </div>
        <div>
          <span>Pago</span>
          <strong>{order.payment}</strong>
        </div>
        <div>
          <span>Horario</span>
          <strong>{order.schedule === 'now' ? 'Ahora' : order.scheduleTime || 'Programado'}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{formatMoney(order.total)}</strong>
        </div>
      </div>
      {order.address && (
        <p>
          <strong>Dirección:</strong> {order.address}
        </p>
      )}
      {order.notes && (
        <p>
          <strong>Notas:</strong> {order.notes}
        </p>
      )}
      <h4>Ítems</h4>
      <ul className="items-list">
        {order.items.map((i) => (
          <li key={i.id}>
            <span>
              {i.quantity}x {i.name}
              {i.sizeLabel ? ` (${i.sizeLabel})` : ''}
            </span>
            <strong>{formatMoney(i.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <div className="status-actions">
        {kiosk && order.status === 'pending' && (
          <>
            <button
              type="button"
              className="admin-btn primary"
              disabled={saving}
              onClick={() => onUpdate({ status: 'confirmed' })}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="admin-btn danger"
              disabled={saving}
              onClick={() => onUpdate({ status: 'cancelled' })}
            >
              Rechazar
            </button>
          </>
        )}
        {ORDER_STATUS_FLOW.map((s) => (
          <button
            key={s}
            type="button"
            disabled={saving || order.status === s}
            className={`admin-btn ${order.status === s ? 'primary' : ''}`}
            onClick={() => onUpdate({ status: s })}
          >
            {ORDER_STATUS_LABELS[s]}
          </button>
        ))}
        <button type="button" className="admin-btn" onClick={() => window.print()}>
          Imprimir ticket
        </button>
      </div>
    </div>
  )
}

function MenuConfigView({
  menu,
  editing,
  setEditing,
  saving,
  notify,
  setError,
  setSaving,
  refreshMenu,
  onPreview,
}: {
  menu: MenuData
  editing: MenuItem | null
  setEditing: (i: MenuItem | null) => void
  saving: boolean
  notify: (m: string) => void
  setError: (m: string) => void
  setSaving: (v: boolean) => void
  refreshMenu: () => Promise<MenuData>
  onPreview: () => void
}) {
  const [newCatName, setNewCatName] = useState('')
  const [openCatId, setOpenCatId] = useState<string | null>(null)

  const openCat = menu.categories.find((c) => c.id === openCatId) || null

  const startNewProduct = (categoryId: string) => {
    setEditing({
      id: `__new__:${categoryId}`,
      name: '',
      description: '',
      price: 0,
      image: '/logo.png',
      available: true,
      featured: false,
      modifiers: [],
    })
  }

  const saveProduct = async (payload: {
    name: string
    description: string
    price: number
    priceMax: number | null
    image: string
    available: boolean
    featured: boolean
    categoryId?: string
    modifiers: Array<{
      id: string
      name: string
      required: boolean
      min: number
      max: number
      allowQuantity?: boolean
      options: { id: string; name: string; price: number }[]
    }>
  }) => {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = editing.id.startsWith('__new__:')
      const categoryId = isNew ? editing.id.slice('__new__:'.length) : payload.categoryId
      let productId = editing.id
      if (isNew) {
        const created = await createProduct({
          categoryId,
          name: payload.name,
          description: payload.description,
          price: payload.price,
          priceMax: payload.priceMax,
          image: payload.image,
          available: payload.available,
          featured: payload.featured,
        })
        productId = created.id
      } else {
        await updateProduct(editing.id, {
          name: payload.name,
          description: payload.description,
          price: payload.price,
          priceMax: payload.priceMax,
          image: payload.image,
          available: payload.available,
          featured: payload.featured,
        })
      }
      await saveProductModifiers(productId, payload.modifiers)
      const m = await refreshMenu()
      const found = m.categories.flatMap((c) => c.items).find((i) => i.id === productId)
      setEditing(found || null)
      notify(isNew ? 'Producto creado' : 'Producto guardado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Configuración del menú</h2>
          <p>
            {editing
              ? 'Editando producto'
              : openCat
                ? `Productos en ${openCat.name}`
                : 'Todas las categorías · tocá una para ver sus productos'}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="admin-btn" onClick={onPreview}>
            Vista previa & Pedido de prueba
          </button>
          <button type="button" className="admin-btn" onClick={() => refreshMenu()}>
            Actualizar
          </button>
        </div>
      </header>

      {editing ? (
        <div className="admin-card detail menu-editor-full">
          <button
            type="button"
            className="admin-btn ghost menu-back-btn"
            onClick={() => setEditing(null)}
          >
            ← Volver a {openCat?.name || 'categoría'}
          </button>
          <ProductEditor
            item={editing}
            saving={saving}
            onCancel={() => setEditing(null)}
            onDelete={async () => {
              if (editing.id.startsWith('__new__:')) {
                setEditing(null)
                return
              }
              if (!confirm('¿Eliminar producto?')) return
              setSaving(true)
              try {
                await deleteProduct(editing.id)
                setEditing(null)
                await refreshMenu()
                notify('Producto eliminado')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Error')
              } finally {
                setSaving(false)
              }
            }}
            onSave={saveProduct}
          />
        </div>
      ) : openCat ? (
        <div className="admin-card list menu-drill">
          <div className="menu-drill-head">
            <button
              type="button"
              className="admin-btn ghost menu-back-btn"
              onClick={() => setOpenCatId(null)}
            >
              ← Todas las categorías
            </button>
            <div className="menu-drill-title">
              <img
                src={mediaUrl(openCat.banner || openCat.items[0]?.image || '/logo.png')}
                alt=""
              />
              <div>
                <h3>{openCat.name}</h3>
                <span>
                  {openCat.items.length} producto{openCat.items.length === 1 ? '' : 's'}
                  {openCat.subtitle ? ` · ${openCat.subtitle}` : ''}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => startNewProduct(openCat.id)}
            >
              + Agregar producto
            </button>
          </div>

          {openCat.items.length === 0 ? (
            <p className="admin-muted" style={{ padding: 16 }}>
              Esta categoría todavía no tiene productos. Agregá el primero.
            </p>
          ) : (
            openCat.items.map((item, itemIndex) => (
              <div key={item.id} className="product-row menu-product-card">
                <img src={mediaUrl(item.image)} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {formatMoney(item.price)}
                    {item.modifiers?.length ? ` · ${item.modifiers.length} extras` : ''}
                    {item.description ? ` · ${item.description}` : ''}
                  </span>
                </div>
                <div className="product-row-actions">
                  <button
                    type="button"
                    className="admin-btn ghost"
                    title="Subir"
                    disabled={itemIndex === 0}
                    onClick={async () => {
                      const ids = openCat.items.map((i) => i.id)
                      ;[ids[itemIndex - 1], ids[itemIndex]] = [ids[itemIndex], ids[itemIndex - 1]]
                      await reorderMenu({
                        products: ids.map((id, i) => ({
                          id,
                          sortOrder: i,
                          categoryId: openCat.id,
                        })),
                      })
                      await refreshMenu()
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    title="Bajar"
                    disabled={itemIndex === openCat.items.length - 1}
                    onClick={async () => {
                      const ids = openCat.items.map((i) => i.id)
                      ;[ids[itemIndex + 1], ids[itemIndex]] = [ids[itemIndex], ids[itemIndex + 1]]
                      await reorderMenu({
                        products: ids.map((id, i) => ({
                          id,
                          sortOrder: i,
                          categoryId: openCat.id,
                        })),
                      })
                      await refreshMenu()
                    }}
                  >
                    ↓
                  </button>
                  <span className={`pill ${item.available === false ? 'off' : 'on'}`}>
                    {item.available === false ? 'Off' : 'On'}
                  </span>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setEditing(item)}
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="admin-card settings-form" style={{ marginBottom: 16 }}>
            <div className="row-2">
              <input
                placeholder="Nueva categoría"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn primary"
                disabled={saving || !newCatName.trim()}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await createCategory({ name: newCatName.trim() })
                    setNewCatName('')
                    await refreshMenu()
                    notify('Categoría creada')
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Error')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                + Categoría
              </button>
            </div>
          </div>

          <div className="menu-cat-cards">
            {menu.categories.map((cat, catIndex) => {
              const thumb = cat.banner || cat.items[0]?.image || '/logo.png'
              return (
                <div key={cat.id} className="menu-cat-card">
                  <button
                    type="button"
                    className="menu-cat-card-main"
                    onClick={() => setOpenCatId(cat.id)}
                  >
                    <span className="menu-cat-handle" aria-hidden>
                      ☰
                    </span>
                    <img src={mediaUrl(thumb)} alt="" />
                    <span className="menu-cat-card-text">
                      <strong>{cat.name}</strong>
                      <span>
                        {cat.subtitle ||
                          `${cat.items.length} producto${cat.items.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                    <span className="menu-cat-chevron" aria-hidden>
                      ›
                    </span>
                  </button>
                  <div className="cat-actions menu-cat-card-actions">
                    <button
                      type="button"
                      className="admin-btn ghost"
                      disabled={catIndex === 0}
                      title="Subir"
                      onClick={async () => {
                        const ids = menu.categories.map((c) => c.id)
                        ;[ids[catIndex - 1], ids[catIndex]] = [ids[catIndex], ids[catIndex - 1]]
                        await reorderMenu({
                          categories: ids.map((id, i) => ({ id, sortOrder: i })),
                        })
                        await refreshMenu()
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-btn ghost"
                      disabled={catIndex === menu.categories.length - 1}
                      title="Bajar"
                      onClick={async () => {
                        const ids = menu.categories.map((c) => c.id)
                        ;[ids[catIndex + 1], ids[catIndex]] = [ids[catIndex], ids[catIndex + 1]]
                        await reorderMenu({
                          categories: ids.map((id, i) => ({ id, sortOrder: i })),
                        })
                        await refreshMenu()
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="admin-btn danger"
                      title="Eliminar"
                      onClick={async () => {
                        if (!confirm(`¿Eliminar categoría ${cat.name}?`)) return
                        await deleteCategory(cat.id)
                        await refreshMenu()
                        notify('Categoría eliminada')
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function ProductEditor({
  item,
  saving,
  onSave,
  onDelete,
  onCancel,
}: {
  item: MenuItem
  saving: boolean
  onSave: (payload: {
    name: string
    description: string
    price: number
    priceMax: number | null
    image: string
    available: boolean
    featured: boolean
    categoryId?: string
    modifiers: Array<{
      id: string
      name: string
      required: boolean
      min: number
      max: number
      allowQuantity?: boolean
      options: { id: string; name: string; price: number }[]
    }>
  }) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const isNew = item.id.startsWith('__new__:')
  const [form, setForm] = useState({
    name: item.name,
    description: item.description || '',
    price: String(item.price || ''),
    priceMax: item.priceMax != null ? String(item.priceMax) : '',
    image: item.image || '/logo.png',
    available: item.available !== false,
    featured: !!item.featured,
  })
  const [groups, setGroups] = useState<ModifierGroup[]>(item.modifiers || [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    setForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price || ''),
      priceMax: item.priceMax != null ? String(item.priceMax) : '',
      image: item.image || '/logo.png',
      available: item.available !== false,
      featured: !!item.featured,
    })
    setGroups(item.modifiers || [])
    setUploadError('')
  }, [item])

  async function onPickFile(file: File | null) {
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const result = await uploadImage(file)
      setForm((f) => ({ ...f, image: result.url }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      className="product-editor"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          name: form.name.trim(),
          description: form.description,
          price: Number(form.price) || 0,
          priceMax: form.priceMax === '' ? null : Number(form.priceMax),
          image: form.image.trim() || '/logo.png',
          available: form.available,
          featured: form.featured,
          modifiers: groups.map((g) => ({
            id: g.id,
            name: g.name,
            required: g.required,
            min: g.min,
            max: g.max,
            allowQuantity: g.allowQuantity,
            options: g.options,
          })),
        })
      }}
    >
      <h3 style={{ margin: 0 }}>{isNew ? 'Nuevo producto' : 'Editar producto'}</h3>

      <div className="preview">
        <img src={mediaUrl(form.image)} alt="" />
      </div>

      <label className="upload-box">
        <span>Cargar imagen desde la PC</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={uploading || saving}
          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
        />
      </label>
      {uploading && <p className="admin-muted">Subiendo imagen…</p>}
      {uploadError && <p className="admin-error">{uploadError}</p>}

      <label>
        URL imagen (opcional / alternativa)
        <input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} />
      </label>

      <label>
        Nombre
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          placeholder="Ej. Hamburguesa Pro"
        />
      </label>
      <label>
        Descripción
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>
      <div className="row-2">
        <label>
          Precio
          <input
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            required
          />
        </label>
        <label>
          Precio max (opcional)
          <input
            type="number"
            min="0"
            step="1"
            value={form.priceMax}
            onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
          />
        </label>
      </div>
      <div className="checks">
        <label className="check">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
          />
          Disponible
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          />
          Destacado
        </label>
      </div>

      <h4>Subproductos / extras</h4>
      <p className="admin-muted">Grupos tipo guarnición, dips, carnes extras…</p>
      {groups.map((g, gi) => (
        <div key={g.id} className="mod-group-edit">
          <div className="row-2">
            <input
              value={g.name}
              placeholder="Nombre del grupo"
              onChange={(e) => {
                const next = [...groups]
                next[gi] = { ...g, name: e.target.value }
                setGroups(next)
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) => {
                  const next = [...groups]
                  next[gi] = { ...g, required: e.target.checked, min: e.target.checked ? Math.max(1, g.min) : 0 }
                  setGroups(next)
                }}
              />
              Obligatorio
            </label>
          </div>
          {g.options.map((o, oi) => (
            <div key={o.id} className="row-2">
              <input
                value={o.name}
                placeholder="Opción"
                onChange={(e) => {
                  const next = [...groups]
                  const opts = [...g.options]
                  opts[oi] = { ...o, name: e.target.value }
                  next[gi] = { ...g, options: opts }
                  setGroups(next)
                }}
              />
              <input
                type="number"
                value={o.price}
                title="Precio extra"
                onChange={(e) => {
                  const next = [...groups]
                  const opts = [...g.options]
                  opts[oi] = { ...o, price: Number(e.target.value) || 0 }
                  next[gi] = { ...g, options: opts }
                  setGroups(next)
                }}
              />
              <button
                type="button"
                className="admin-btn ghost"
                onClick={() => {
                  const next = [...groups]
                  next[gi] = { ...g, options: g.options.filter((_, i) => i !== oi) }
                  setGroups(next)
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="row-2">
            <button
              type="button"
              className="admin-btn ghost"
              onClick={() => {
                const next = [...groups]
                next[gi] = {
                  ...g,
                  options: [...g.options, { id: `opt-${Date.now()}`, name: 'Nueva opción', price: 0 }],
                }
                setGroups(next)
              }}
            >
              + Opción
            </button>
            <button
              type="button"
              className="admin-btn danger"
              onClick={() => setGroups(groups.filter((_, i) => i !== gi))}
            >
              Quitar grupo
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn"
        onClick={() =>
          setGroups([
            ...groups,
            {
              id: `grp-${Date.now()}`,
              name: 'Nuevo grupo',
              required: false,
              min: 0,
              max: 1,
              options: [{ id: `opt-${Date.now()}`, name: 'Opción', price: 0 }],
            },
          ])
        }
      >
        + Grupo de extras
      </button>

      <button type="submit" className="admin-btn primary" disabled={saving || uploading || !form.name.trim()}>
        {saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar cambios'}
      </button>
      <button type="button" className="admin-btn ghost" disabled={saving} onClick={onCancel}>
        Cancelar
      </button>
      {!isNew && (
        <button type="button" className="admin-btn danger" disabled={saving} onClick={onDelete}>
          Eliminar producto
        </button>
      )}
    </form>
  )
}

function ModifiersView({
  menu,
  library,
  saving,
  setSaving,
  notify,
  setError,
  refresh,
}: {
  menu: MenuData
  library: Awaited<ReturnType<typeof fetchModifierLibrary>>
  saving: boolean
  setSaving: (v: boolean) => void
  notify: (m: string) => void
  setError: (m: string) => void
  refresh: () => Promise<void>
}) {
  const products = menu.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.name })))
  const [productId, setProductId] = useState(products[0]?.id || '')
  const product = products.find((p) => p.id === productId)
  const [groups, setGroups] = useState<ModifierGroup[]>(product?.modifiers || [])

  useEffect(() => {
    setGroups(product?.modifiers || [])
  }, [productId, product])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Opcionales y agregados</h2>
          <p>Biblioteca de extras y asignación por producto (como TuMenuWeb)</p>
        </div>
      </header>
      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Biblioteca</h3>
          <ul className="rank-list">
            {library.map((g) => (
              <li key={g.id}>
                <span>
                  <strong>{g.name}</strong>
                  <small className="admin-muted"> · {g.usedBy.length} productos</small>
                </span>
                <strong>{g.options.length} opts</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="admin-card settings-form">
          <label>
            Producto
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category} · {p.name}
                </option>
              ))}
            </select>
          </label>
          {groups.map((g, gi) => (
            <div key={g.id} className="mod-group-edit">
              <div className="row-2">
                <input
                  value={g.name}
                  onChange={(e) => {
                    const next = [...groups]
                    next[gi] = { ...g, name: e.target.value }
                    setGroups(next)
                  }}
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={g.required}
                    onChange={(e) => {
                      const next = [...groups]
                      next[gi] = { ...g, required: e.target.checked }
                      setGroups(next)
                    }}
                  />
                  Obligatorio
                </label>
              </div>
              {g.options.map((o, oi) => (
                <div key={o.id} className="row-2">
                  <input
                    value={o.name}
                    onChange={(e) => {
                      const next = [...groups]
                      const opts = [...g.options]
                      opts[oi] = { ...o, name: e.target.value }
                      next[gi] = { ...g, options: opts }
                      setGroups(next)
                    }}
                  />
                  <input
                    type="number"
                    value={o.price}
                    onChange={(e) => {
                      const next = [...groups]
                      const opts = [...g.options]
                      opts[oi] = { ...o, price: Number(e.target.value) }
                      next[gi] = { ...g, options: opts }
                      setGroups(next)
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="admin-btn ghost"
                onClick={() => {
                  const next = [...groups]
                  next[gi] = {
                    ...g,
                    options: [
                      ...g.options,
                      { id: `opt-${Date.now()}`, name: 'Nueva opción', price: 0 },
                    ],
                  }
                  setGroups(next)
                }}
              >
                + Opción
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              setGroups([
                ...groups,
                {
                  id: `grp-${Date.now()}`,
                  name: 'Nuevo grupo',
                  required: false,
                  min: 0,
                  max: 1,
                  options: [{ id: `opt-${Date.now()}`, name: 'Opción', price: 0 }],
                },
              ])
            }
          >
            + Grupo de extras
          </button>
          <button
            type="button"
            className="admin-btn primary"
            disabled={saving || !productId}
            onClick={async () => {
              setSaving(true)
              try {
                await saveProductModifiers(
                  productId,
                  groups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    required: g.required,
                    min: g.min,
                    max: g.max,
                    allowQuantity: g.allowQuantity,
                    options: g.options,
                  })),
                )
                await refresh()
                notify('Extras guardados')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Error')
              } finally {
                setSaving(false)
              }
            }}
          >
            Guardar extras del producto
          </button>
        </div>
      </div>
    </section>
  )
}

function ProfileView({
  menu,
  saving,
  onSave,
}: {
  menu: MenuData
  saving: boolean
  onSave: (patch: Record<string, unknown>) => Promise<void>
}) {
  const r = menu.restaurant
  const [form, setForm] = useState({
    name: r.name,
    address: r.address,
    phone: r.phone || '',
    whatsapp: r.whatsapp,
    hoursLabel: r.hoursLabel || '',
    open: r.open,
  })
  useEffect(() => {
    setForm({
      name: r.name,
      address: r.address,
      phone: r.phone || '',
      whatsapp: r.whatsapp,
      hoursLabel: r.hoursLabel || '',
      open: r.open,
    })
  }, [r])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Perfil</h2>
          <p>Datos del local</p>
        </div>
      </header>
      <form
        className="admin-card settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(form)
        }}
      >
        <label className="check big">
          <input
            type="checkbox"
            checked={form.open}
            onChange={(e) => setForm((f) => ({ ...f, open: e.target.checked }))}
          />
          Local abierto
        </label>
        <label>
          Nombre
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label>
          Dirección
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </label>
        <div className="row-2">
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label>
            WhatsApp
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Horario (texto)
          <input
            value={form.hoursLabel}
            onChange={(e) => setForm((f) => ({ ...f, hoursLabel: e.target.value }))}
          />
        </label>
        <button type="submit" className="admin-btn primary" disabled={saving}>
          Guardar perfil
        </button>
      </form>
    </section>
  )
}

function SchedulesView({
  settings,
  saving,
  onSave,
  showDev,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
  showDev: (t?: string) => void
}) {
  const [schedules, setSchedules] = useState(settings.schedules || [])
  useEffect(() => setSchedules(settings.schedules || []), [settings.schedules])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Horarios y servicios</h2>
          <p>Recoger, entrega, reserva, local, pedidos programados</p>
        </div>
      </header>
      <div className="admin-card settings-form">
        <label className="check big">
          <input
            type="checkbox"
            checked={!settings.servicesPaused}
            onChange={(e) => onSave({ servicesPaused: !e.target.checked })}
          />
          Servicios activos (desmarcar = pausa)
        </label>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.scheduledOrdersEnabled !== false}
              onChange={(e) => onSave({ scheduledOrdersEnabled: e.target.checked })}
            />
            Pedidos programados
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!settings.tableReservationEnabled}
              onChange={(e) => onSave({ tableReservationEnabled: e.target.checked })}
            />
            Reserva de mesa
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!settings.dineInEnabled}
              onChange={(e) => onSave({ dineInEnabled: e.target.checked })}
            />
            Local / salón
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!settings.separatePickupDeliveryHours}
              onChange={(e) => onSave({ separatePickupDeliveryHours: e.target.checked })}
            />
            Horarios distintos retiro / delivery
          </label>
        </div>
        <h3>¿Cuándo estás abierto?</h3>
        {schedules.map((s, i) => (
          <div key={s.id} className="row-2">
            <input
              value={s.label}
              onChange={(e) => {
                const next = [...schedules]
                next[i] = { ...s, label: e.target.value }
                setSchedules(next)
              }}
            />
            <input
              value={s.open}
              onChange={(e) => {
                const next = [...schedules]
                next[i] = { ...s, open: e.target.value }
                setSchedules(next)
              }}
            />
            <input
              value={s.close}
              onChange={(e) => {
                const next = [...schedules]
                next[i] = { ...s, close: e.target.value }
                setSchedules(next)
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            setSchedules([
              ...schedules,
              { id: `s-${Date.now()}`, label: 'Nuevo', open: '19:00', close: '00:00', service: 'all' },
            ])
          }
        >
          Añadir horario
        </button>
        <button
          type="button"
          className="admin-btn primary"
          disabled={saving}
          onClick={() => onSave({ schedules })}
        >
          Guardar horarios
        </button>
        <button type="button" className="admin-btn ghost" onClick={() => showDev('Día especial / festivo')}>
          Añadir día especial / festivo
        </button>
      </div>
    </section>
  )
}

function ZonesView({
  settings,
  saving,
  onSave,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
}) {
  const [zones, setZones] = useState(settings.deliveryZones || [])
  useEffect(() => setZones(settings.deliveryZones || []), [settings.deliveryZones])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Zonas de entrega</h2>
          <p>Zonas de Salto con costo de envío (mapa editable en producción)</p>
        </div>
      </header>
      <div className="zones-map-mock admin-card">
        <p>Mapa de zonas · Salto, Uruguay</p>
        <div className="zones-swatches">
          {zones.map((z) => (
            <span key={z.id} style={{ background: z.color }}>
              {z.name}
            </span>
          ))}
        </div>
      </div>
      <div className="admin-card settings-form">
        {zones.map((z, i) => (
          <div key={z.id} className="zone-row">
            <input
              type="color"
              value={z.color}
              onChange={(e) => {
                const next = [...zones]
                next[i] = { ...z, color: e.target.value }
                setZones(next)
              }}
            />
            <input
              value={z.name}
              onChange={(e) => {
                const next = [...zones]
                next[i] = { ...z, name: e.target.value }
                setZones(next)
              }}
            />
            <input
              type="number"
              value={z.fee}
              onChange={(e) => {
                const next = [...zones]
                next[i] = { ...z, fee: Number(e.target.value) }
                setZones(next)
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={z.active}
                onChange={(e) => {
                  const next = [...zones]
                  next[i] = { ...z, active: e.target.checked }
                  setZones(next)
                }}
              />
              Activa
            </label>
          </div>
        ))}
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            setZones([
              ...zones,
              {
                id: `z-${Date.now()}`,
                name: 'Nueva zona',
                color: '#888888',
                fee: 100,
                active: true,
              },
            ])
          }
        >
          + Zona
        </button>
        <button
          type="button"
          className="admin-btn primary"
          disabled={saving}
          onClick={() => onSave({ deliveryZones: zones })}
        >
          Guardar zonas
        </button>
      </div>
    </section>
  )
}

function PaymentsTaxesView({
  settings,
  saving,
  onSave,
  showDev,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
  showDev: (t?: string) => void
}) {
  const pm = settings.paymentMethods || {}
  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Payment methods & taxes</h2>
          <p>Medios de pago del checkout y tributos</p>
        </div>
      </header>
      <div className="admin-card settings-form">
        {(['efectivo', 'transferencia', 'pos'] as const).map((key) => (
          <label key={key} className="check">
            <input
              type="checkbox"
              checked={pm[key] !== false}
              onChange={(e) =>
                onSave({ paymentMethods: { ...pm, [key]: e.target.checked } })
              }
            />
            {key}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={false} onChange={() => showDev('Mercado Pago')} />
          Mercado Pago (producción)
        </label>
        <label className="check">
          <input type="checkbox" checked={false} onChange={() => showDev('PayPal')} />
          PayPal (producción)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={!!settings.taxes?.enabled}
            onChange={(e) =>
              onSave({ taxes: { ...(settings.taxes || { rate: 0, label: 'IVA' }), enabled: e.target.checked } })
            }
          />
          Impuestos habilitados
        </label>
        <button type="button" className="admin-btn primary" disabled={saving} onClick={() => onSave({})}>
          Guardado automático al marcar
        </button>
      </div>
    </section>
  )
}

function AlertCallView({
  settings,
  saving,
  onSave,
  showDev,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
  showDev: (t?: string) => void
}) {
  const [phone, setPhone] = useState(settings.alertPhone || '')
  useEffect(() => setPhone(settings.alertPhone || ''), [settings.alertPhone])
  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Llamada de alerta</h2>
          <p>Si no llega el pedido a la app de toma en tiempo real</p>
        </div>
      </header>
      <div className="admin-card settings-form">
        <label className="check big">
          <input
            type="checkbox"
            checked={settings.alertCallEnabled !== false}
            onChange={(e) => onSave({ alertCallEnabled: e.target.checked })}
          />
          Llamada / alerta habilitada
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.orderAppEnabled !== false}
            onChange={(e) => onSave({ orderAppEnabled: e.target.checked })}
          />
          App de toma de pedidos
        </label>
        <label>
          Número del supervisor
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+598 ..." />
        </label>
        <div className="row-2">
          <button
            type="button"
            className="admin-btn primary"
            disabled={saving}
            onClick={() => onSave({ alertPhone: phone })}
          >
            Guardar número
          </button>
          <button type="button" className="admin-btn" onClick={() => showDev('Escuchar notificación / llamada')}>
            Escuchar notificación…
          </button>
        </div>
      </div>
    </section>
  )
}

function PublishView({
  settings,
  saving,
  onSave,
  showDev,
}: {
  settings: RestaurantSettings
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
  showDev: (t?: string) => void
}) {
  const pub = settings.publish || {}
  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Publicar en</h2>
          <p>Canales donde se muestra el menú</p>
        </div>
      </header>
      <div className="admin-card settings-form">
        <label className="check">
          <input
            type="checkbox"
            checked={pub.webMenu !== false}
            onChange={(e) => onSave({ publish: { ...pub, webMenu: e.target.checked } })}
          />
          Menú web (PWA)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={!!pub.qrFlyers}
            onChange={(e) => onSave({ publish: { ...pub, qrFlyers: e.target.checked } })}
          />
          QR y flyers
        </label>
        <label className="check">
          <input type="checkbox" checked={!!pub.social} onChange={() => showDev('Publicar en redes')} />
          Redes sociales (producción)
        </label>
        <button type="button" className="admin-btn" disabled={saving} onClick={() => showDev('Escáner del sitio')}>
          Escáner del sitio web
        </button>
      </div>
    </section>
  )
}

function ReportsView({ reports }: { reports: Awaited<ReturnType<typeof fetchReports>> }) {
  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Reportes</h2>
          <p>Últimos {reports.days} días</p>
        </div>
      </header>
      <div className="kpi-grid">
        <div className="kpi accent">
          <span>Ventas</span>
          <strong>{formatMoney(reports.totals.sales)}</strong>
        </div>
        <div className="kpi">
          <span>Pedidos</span>
          <strong>{reports.totals.orders}</strong>
        </div>
        <div className="kpi">
          <span>Ticket promedio</span>
          <strong>{formatMoney(reports.totals.avgTicket)}</strong>
        </div>
        <div className="kpi">
          <span>Delivery</span>
          <strong>{reports.byFulfillment.delivery}</strong>
        </div>
        <div className="kpi">
          <span>Retiro</span>
          <strong>{reports.byFulfillment.pickup}</strong>
        </div>
      </div>
      <div className="admin-card">
        <h3>Top productos</h3>
        <ul className="rank-list">
          {reports.topProducts.map((p, i) => (
            <li key={p.name}>
              <span>
                <em>{i + 1}</em> {p.name}
              </span>
              <strong>
                {p.qty} · {formatMoney(p.revenue)}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
