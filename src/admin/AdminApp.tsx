import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminLogin,
  adminMe,
  assignModifierGroupToCategory,
  assignModifierGroupToProduct,
  createCategory,
  createProduct,
  createModifierLibraryGroup,
  deleteModifierLibraryGroup,
  deleteProduct,
  fetchAdminMenu,
  fetchAdminOrders,
  fetchCustomers,
  fetchDashboard,
  fetchModifierLibrary,
  fetchMercadoPagoStatus,
  fetchReports,
  getAdminToken,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  replaceMenuCatalog,
  saveProductModifiers,
  setAdminToken,
  unassignModifierGroupFromCategory,
  unassignModifierGroupFromProduct,
  updateModifierLibraryGroup,
  updateOrder,
  updateProduct,
  updateRestaurant,
  uploadImage,
  type AdminCustomer,
  type AdminOrder,
  type AdminUser,
  type DashboardData,
  type MercadoPagoAdminStatus,
} from '../lib/adminApi'
import { mediaUrl } from '../lib/apiBase'
import { formatMoney } from '../lib/format'
import type { MenuData, MenuItem, ModifierGroup, ModifierLibraryGroup, RestaurantSettings } from '../types'
import '../admin.css'
import './menu-editor.css'
import { DevPopup } from './DevPopup'
import { ModifierLibraryPanel } from './ModifierLibraryPanel'
import {
  defaultSectionForRole,
  LEGACY_SECTION_MAP,
  moduleOfSection,
  modulesForRole,
  sectionAllowed,
  type AdminSection,
  type NavModule,
} from './nav'
import {
  DeliveryZonesFullView,
  ExtendedReportsView,
  HoursFullView,
  LanguagesView,
  MarketingHubView,
  NotificationsView,
  OnlineOrderingConfigView,
  OrderAppDeviceView,
  PayMethodsChannelsView,
  ProfileExtraViews,
  PublishChannelView,
  TaxesView,
  TipsDepositView,
  ToggleServiceView,
} from './tumenuViews'
import { RailIcon } from './RailIcon'

export function AdminApp() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('admin@chivitospro.com')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [activeModule, setActiveModule] = useState<NavModule['id']>('reports')
  const [moduleArmed, setModuleArmed] = useState<NavModule['id'] | null>(null)
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [mpStatus, setMpStatus] = useState<MercadoPagoAdminStatus | null>(null)
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [library, setLibrary] = useState<ModifierLibraryGroup[]>([])
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const knownOrderIds = useRef<Set<string>>(new Set())
  const [flashOrderIds, setFlashOrderIds] = useState<string[]>([])
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
      .then((user) => {
        setAdmin(user)
        const def = defaultSectionForRole(user.role)
        setSection(def)
        setActiveModule(moduleOfSection(def) || 'reports')
      })
      .catch(() => setAdminToken(null))
      .finally(() => setBooting(false))
  }, [])

  const refreshDashboard = useCallback(async () => setDash(await fetchDashboard()), [])
  const refreshMenu = useCallback(async () => {
    const m = await fetchAdminMenu()
    setMenu(m)
    return m
  }, [])
  const refreshLibrary = useCallback(async () => {
    const list = await fetchModifierLibrary()
    setLibrary(list)
    return list
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
        setFlashOrderIds((prev) => {
          const next = new Set(prev)
          fresh.forEach((o) => next.add(o.id))
          return [...next]
        })
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
        if (
          section === 'dashboard' ||
          section.startsWith('sales-') ||
          section.startsWith('menu-insights') ||
          section === 'online-funnel' ||
          section === 'report-clients-metrics' ||
          section === 'website-visits' ||
          section === 'promotions-stats'
        ) {
          await refreshDashboard()
        }
        if (
          section === 'orders' ||
          section === 'take-orders' ||
          section === 'take-orders-app' ||
          section === 'report-orders'
        ) {
          await refreshOrders()
        }
        if (section === 'clients' || section === 'report-clients') await refreshCustomers()
        if (section === 'pagos' || section === 'pagos-providers') {
          setMpStatus(await fetchMercadoPagoStatus())
        }
        if (
          section === 'menu' ||
          section === 'modifiers' ||
          section === 'preview' ||
          section.startsWith('profile') ||
          section.startsWith('schedules') ||
          section.startsWith('pay-') ||
          section.startsWith('take-orders') ||
          section.startsWith('publish') ||
          section.startsWith('pagos') ||
          section.startsWith('mkt-') ||
          section.startsWith('widget-') ||
          section.startsWith('print-') ||
          section.startsWith('integrations') ||
          section.startsWith('other-') ||
          section === 'delivery-map' ||
          section === 'connectivity-health' ||
          section === 'promotions-stats' ||
          section === 'online-funnel' ||
          section === 'website-visits' ||
          section === 'delivery-zones' ||
          section === 'payments-taxes' ||
          section === 'alert-call' ||
          section === 'publish' ||
          section === 'schedules' ||
          section === 'profile'
        ) {
          await refreshMenu()
        }
        if (section === 'menu' || section === 'modifiers') await refreshLibrary()
        if (
          section === 'reports' ||
          section.startsWith('sales-') ||
          section.startsWith('menu-insights') ||
          section === 'dashboard'
        ) {
          setReports(await fetchReports(30))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      }
    })()
  }, [admin, section, refreshDashboard, refreshOrders, refreshMenu, refreshLibrary, refreshCustomers])

  useEffect(() => {
    if (!admin) return
    const isEmployee = admin.role === 'empleado'
    const onOrdersView =
      section === 'orders' ||
      section === 'take-orders' ||
      section === 'take-orders-app' ||
      section === 'report-orders'
    const onDashboard = section === 'dashboard' && !isEmployee
    const pollOrders = onOrdersView || isEmployee || section === 'dashboard'
    if (!pollOrders && !onDashboard) return

    const id = window.setInterval(() => {
      if (onDashboard) refreshDashboard().catch(() => {})
      if (pollOrders) refreshOrders().catch(() => {})
    }, 8000)
    return () => window.clearInterval(id)
  }, [admin, section, refreshDashboard, refreshOrders])

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    try {
      const user = await adminLogin(email.trim(), password)
      setAdmin(user)
      const def = defaultSectionForRole(user.role)
      setSection(def)
      setActiveModule(moduleOfSection(def) || 'reports')
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Error de login')
    }
  }

  const modules = useMemo(() => modulesForRole(admin?.role || 'admin'), [admin?.role])
  const flashCount = flashOrderIds.length

  function goSection(id: AdminSection) {
    const mapped = (LEGACY_SECTION_MAP[id] || id) as AdminSection
    setSection(mapped)
    const mod = moduleOfSection(mapped)
    if (mod) setActiveModule(mod)
    setModuleArmed(null)
  }

  useEffect(() => {
    if (!admin) return
    const mapped = (LEGACY_SECTION_MAP[section] || section) as AdminSection
    if (mapped !== section) {
      setSection(mapped)
      return
    }
    if (!sectionAllowed(section, admin.role)) {
      const def = defaultSectionForRole(admin.role)
      setSection(def)
      setActiveModule(moduleOfSection(def) || 'reports')
    }
  }, [admin, section])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.classList.add('admin-tm')
    return () => {
      document.documentElement.classList.remove('admin-tm')
    }
  }, [])

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
              <p>Admin u empleado · panel de operaciones</p>
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
    <div className="admin-shell wide tm-shell">
      <DevPopup open={devOpen} title={devTitle} onClose={() => setDevOpen(false)} />
      {toast && <div className="admin-toast">{toast}</div>}

      <aside className="tm-rail">
        {modules.map((mod) => (
          <button
            key={mod.id}
            type="button"
            className={`tm-rail-btn ${activeModule === mod.id ? 'active' : ''} ${
              moduleArmed === mod.id ? 'armed' : ''
            } ${mod.id === 'reports' && flashCount ? 'nav-flash' : ''}`}
            title={mod.label}
            aria-label={mod.label}
            onClick={() => {
              // Un clic navega (A-01: el doble clic dejaba el riel “muerto”)
              setActiveModule(mod.id)
              setModuleArmed(null)
              const first = mod.groups[0]?.items[0]?.id
              if (first) goSection(first)
            }}
            onMouseEnter={() => setModuleArmed(mod.id)}
            onMouseLeave={() =>
              setModuleArmed((cur) => (cur === mod.id ? null : cur))
            }
          >
            <RailIcon name={mod.icon} />
            <em className="tm-tooltip">{mod.label}</em>
          </button>
        ))}
      </aside>

      <header className="tm-topbar">
        <div className="tm-topbar-left">
          <img src="/logo.png" alt="ChivitosPro" className="tm-topbar-logo" />
          <div className="tm-topbar-brand">
            ChivitosPro
            <span className="tm-caret">▾</span>
          </div>
        </div>
        <div className="tm-topbar-actions">
          {flashCount > 0 ? (
            <button type="button" className="tm-help-btn" onClick={() => goSection('report-orders')}>
              {flashCount} nuevo{flashCount === 1 ? '' : 's'}
            </button>
          ) : null}
          <button
            type="button"
            className="tm-help-btn"
            title="Estamos encantados de ayudarte"
            onClick={() =>
              showDev(
                'Estamos encantados de ayudarte — Ambiente de desarrollo, sección se mostrará al pasar a producción',
              )
            }
          >
            Ayuda
          </button>
          <div className="tm-user tm-user-menu">
            <button
              type="button"
              className="tm-user-toggle"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
            >
              <div className="tm-user-name">{admin.name}</div>
              <div className="tm-user-email">{admin.email}</div>
            </button>
            {userMenuOpen ? (
              <ul className="tm-user-dropdown">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false)
                      setAdminToken(null)
                      setAdmin(null)
                    }}
                  >
                    Cerrar sesión
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="admin-sidebar scroll tm-submenu">
        <p className="tm-module-title">
          {modules.find((m) => m.id === activeModule)?.label || 'Panel'}
        </p>

        {(modules.find((m) => m.id === activeModule)?.groups || []).map((group) => (
          <div key={group.id} className="nav-group">
            <p className="nav-group-label">{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${section === item.id ? 'active' : ''} ${
                  (item.id === 'report-orders' || item.id === 'take-orders-app') && flashCount
                    ? 'nav-flash'
                    : ''
                }`}
                onClick={() => goSection(item.id)}
              >
                <span className="tm-nav-indicator" aria-hidden />
                <span>{item.label}</span>
                {(item.id === 'report-orders' || item.id === 'take-orders-app') && flashCount > 0 ? (
                  <em className="nav-new">
                    {flashCount}
                  </em>
                ) : null}
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

      <main className={`admin-main${section === 'menu' ? ' admin-main--menu-editor' : ''}`}>
        {error && <p className="admin-error banner">{error}</p>}

        {section === 'dashboard' && dash && (
          <DashboardView dash={dash} maxSales={maxSales} onRefresh={refreshDashboard} />
        )}

        {(section === 'orders' ||
          section === 'take-orders' ||
          section === 'take-orders-app' ||
          section === 'report-orders') && (
          <OrdersView
            kiosk={section === 'take-orders' || section === 'take-orders-app'}
            orders={orders}
            selectedOrder={selectedOrder}
            setSelectedOrder={(o) => {
              setSelectedOrder(o)
              if (o) {
                setFlashOrderIds((prev) => prev.filter((id) => id !== o.id))
              }
            }}
            flashOrderIds={flashOrderIds}
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
                setFlashOrderIds((prev) => prev.filter((x) => x !== id))
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

        {(section === 'clients' || section === 'report-clients') && (
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
            library={library}
            editing={editing}
            setEditing={setEditing}
            saving={saving}
            notify={notify}
            setError={setError}
            setSaving={setSaving}
            refreshMenu={refreshMenu}
            refreshLibrary={refreshLibrary}
            onPreview={() => goSection('preview')}
            onManageLibrary={() => goSection('modifiers')}
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
              await refreshLibrary()
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

        {(section === 'profile' || section === 'profile-address') && menu && (
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

        {menu &&
          (section === 'profile-location' ||
            section === 'profile-website' ||
            section === 'profile-product-type' ||
            section === 'profile-confirm') && (
            <ProfileExtraViews
              section={section}
              menu={menu}
              settings={settings}
              saving={saving}
              onSaveSettings={patchSettings}
            />
          )}

        {section === 'schedules-pickup' && (
          <ToggleServiceView
            title="Recoger"
            description="¿Ofrecen recogida desde su ubicación?"
            flag="pickupEnabled"
            settings={settings}
            saving={saving}
            onSave={patchSettings}
          />
        )}

        {(section === 'schedules-delivery' || section === 'delivery-zones') && (
          <DeliveryZonesFullView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'schedules-reservation' && (
          <ToggleServiceView
            title="Reserva de mesa"
            description="Los clientes pueden reservar mesa desde el sitio"
            flag="tableReservationEnabled"
            settings={settings}
            saving={saving}
            onSave={patchSettings}
          />
        )}

        {section === 'schedules-dinein' && (
          <ToggleServiceView
            title="Local"
            description="¿Ofrecen servicios locales? (pedir desde la mesa)"
            flag="dineInEnabled"
            settings={settings}
            saving={saving}
            onSave={async (partial) => {
              if ('dineInEnabled' in partial && !partial.dineInEnabled) {
                await patchSettings({ ...partial, dineInAnonymous: false })
              } else {
                await patchSettings(partial)
              }
            }}
          >
            {settings.dineInEnabled !== false ? (
              <label className="tm-switch">
                <span className="tm-switch-label">Allow guests to order anonymously</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.dineInAnonymous}
                  className={`tm-ios ${settings.dineInAnonymous ? 'on' : 'off'}`}
                  onClick={() => patchSettings({ dineInAnonymous: !settings.dineInAnonymous })}
                >
                  <span className="tm-ios-knob" />
                </button>
              </label>
            ) : null}
          </ToggleServiceView>
        )}

        {(section === 'schedules-hours' || section === 'schedules') && (
          <HoursFullView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'schedules-scheduled' && (
          <ToggleServiceView
            title="Pedidos programados"
            description="Permitir a los clientes solicitar un tiempo de cumplimiento específico"
            flag="scheduledOrdersEnabled"
            settings={settings}
            saving={saving}
            onSave={patchSettings}
          />
        )}

        {(section === 'pay-taxes' || section === 'payments-taxes') && (
          <TaxesView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'pay-methods' && (
          <PayMethodsChannelsView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'take-orders-app' && menu && (
          <>
            <OrderAppDeviceView settings={settings} saving={saving} onSave={patchSettings} />
          </>
        )}

        {(section === 'take-orders-alert' || section === 'alert-call') && (
          <AlertCallView settings={settings} saving={saving} onSave={patchSettings} showDev={showDev} />
        )}

        {section.startsWith('publish-') && (
          <PublishChannelView
            section={section}
            settings={settings}
            saving={saving}
            onSave={patchSettings}
          />
        )}

        {(section === 'pagos' || section === 'pagos-providers') && menu && (
          <PagosMpView
            settings={settings}
            mpStatus={mpStatus}
            saving={saving}
            onSave={async (partial) => {
              await patchSettings(partial)
              setMpStatus(await fetchMercadoPagoStatus())
            }}
            onRefreshStatus={async () => setMpStatus(await fetchMercadoPagoStatus())}
          />
        )}

        {(section === 'pagos-tips' || section === 'pagos-deposit') && (
          <TipsDepositView section={section} settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section.startsWith('mkt-') && (
          <MarketingHubView
            section={section}
            settings={settings}
            saving={saving}
            onSave={patchSettings}
            menu={menu}
          />
        )}

        {(section.startsWith('sales-') ||
          section.startsWith('menu-insights') ||
          section === 'online-funnel' ||
          section === 'report-clients-metrics' ||
          section === 'report-reservations' ||
          section === 'google-ranking' ||
          section === 'website-visits' ||
          section === 'delivery-map' ||
          section === 'connectivity-health' ||
          section === 'promotions-stats') && (
          <ExtendedReportsView
            section={section}
            dash={dash}
            reports={reports}
            settings={settings}
          />
        )}

        {(section.startsWith('print-') ||
          section.startsWith('widget-') ||
          section.startsWith('integrations')) && (
          <OnlineOrderingConfigView
            section={section}
            settings={settings}
            saving={saving}
            onSave={patchSettings}
          />
        )}

        {section === 'other-notifications' && (
          <NotificationsView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'other-languages' && (
          <LanguagesView settings={settings} saving={saving} onSave={patchSettings} />
        )}

        {section === 'reports' && reports && <ReportsView reports={reports} />}
      </main>
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
  flashOrderIds,
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
  flashOrderIds: string[]
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
  const flashSet = useMemo(() => new Set(flashOrderIds), [flashOrderIds])

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>{kiosk ? 'App de toma de pedidos' : 'Pedidos'}</h2>
          <p>
            {kiosk
              ? 'Vista cocina / mostrador · sonido al llegar pedido nuevo'
              : 'Gestión completa · auto-refresh 8s'}
            {flashSet.size > 0 ? ` · ${flashSet.size} nuevo(s) sin ver` : ''}
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
              className={`order-row ${selectedOrder?.id === o.id ? 'active' : ''} ${
                flashSet.has(o.id) ? 'order-flash' : ''
              }`}
              onClick={() => setSelectedOrder(o)}
            >
              <div>
                <strong>
                  {flashSet.has(o.id) ? '● NUEVO · ' : ''}
                  {o.customerName || 'Cliente'}
                </strong>
                <span>
                  {o.fulfillment === 'delivery' ? 'Delivery' : 'Retiro'} ·{' '}
                  {new Date(o.createdAt).toLocaleString('es-UY')}
                </span>
                <span className="order-row-items">
                  {o.items
                    .map((i) => {
                      const mods = Array.isArray(i.modifiers) ? i.modifiers : []
                      const extras = mods
                        .map((m) => {
                          const row = m as { optionName?: string; name?: string }
                          return row.optionName || row.name || ''
                        })
                        .filter(Boolean)
                        .join(', ')
                      return extras
                        ? `${i.quantity}x ${i.name} (${extras})`
                        : `${i.quantity}x ${i.name}`
                    })
                    .slice(0, 2)
                    .join(' · ')}
                  {o.items.length > 2 ? '…' : ''}
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
  const when = new Date(order.createdAt).toLocaleString('es-UY', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  function modifierLines(raw: unknown): string[] {
    if (!Array.isArray(raw) || !raw.length) return []
    return raw.map((m) => {
      const row = m as {
        quantity?: number
        groupName?: string
        groupLabel?: string
        optionName?: string
        name?: string
        price?: number
      }
      const qty = row.quantity && row.quantity > 1 ? `${row.quantity}x ` : ''
      const label = row.optionName || row.name || 'extra'
      const group = row.groupName || row.groupLabel ? `${row.groupName || row.groupLabel}: ` : ''
      const price =
        typeof row.price === 'number' && row.price > 0
          ? ` (+${formatMoney(row.price * (row.quantity || 1))})`
          : ''
      return `+ ${qty}${group}${label}${price}`
    })
  }

  return (
    <div className="order-detail">
      <div className="order-detail-screen no-print">
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
              <div className="item-main">
                <span>
                  {i.quantity}x {i.name}
                  {i.sizeLabel ? ` (${i.sizeLabel})` : ''}
                </span>
                <strong>{formatMoney(i.lineTotal)}</strong>
              </div>
              {modifierLines(i.modifiers).map((line, idx) => (
                <div key={`${i.id}-m-${idx}`} className="item-mod">
                  {line}
                </div>
              ))}
              {i.notes ? <div className="item-mod">* {i.notes}</div> : null}
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
          {order.status !== 'cancelled' ? (
            <button
              type="button"
              className="admin-btn danger"
              disabled={saving}
              onClick={() => {
                if (window.confirm('¿Cancelar este pedido? Se excluye de las ventas del dashboard.')) {
                  onUpdate({ status: 'cancelled' })
                }
              }}
            >
              Cancelar pedido
            </button>
          ) : null}
          <button type="button" className="admin-btn" onClick={() => window.print()}>
            Imprimir ticket 80mm
          </button>
        </div>
      </div>

      <div className="pos-ticket" id="print-order" aria-hidden="true">
        <div className="pos-ticket-inner">
          <p className="pos-brand">CHIVITOSPRO</p>
          <p className="pos-line">Salto, Uruguay</p>
          <p className="pos-sep">--------------------------------</p>
          <p>
            <strong>PEDIDO #{order.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <p>{when}</p>
          <p>{ORDER_STATUS_LABELS[order.status] || order.status}</p>
          <p className="pos-sep">--------------------------------</p>
          <p>Cliente: {order.customerName || '—'}</p>
          <p>Tel: {order.phone || '—'}</p>
          <p>Tipo: {order.fulfillment === 'delivery' ? 'DELIVERY' : 'RETIRO'}</p>
          <p>
            Horario:{' '}
            {order.schedule === 'now' ? 'Lo antes posible' : order.scheduleTime || 'Programado'}
          </p>
          <p>Pago: {order.payment}</p>
          {order.address ? <p>Dir: {order.address}</p> : null}
          {order.notes ? <p>Notas: {order.notes}</p> : null}
          <p className="pos-sep">--------------------------------</p>
          {order.items.map((i) => (
            <div key={i.id} className="pos-item">
              <div className="pos-item-row">
                <span>
                  {i.quantity}x {i.name}
                  {i.sizeLabel ? ` (${i.sizeLabel})` : ''}
                </span>
                <span>{formatMoney(i.lineTotal)}</span>
              </div>
              {modifierLines(i.modifiers).map((line, idx) => (
                <p key={`${i.id}-m-${idx}`} className="pos-mod">
                  {line}
                </p>
              ))}
              {i.notes ? <p className="pos-mod">  * {i.notes}</p> : null}
            </div>
          ))}
          <p className="pos-sep">--------------------------------</p>
          {order.subtotal != null && (
            <div className="pos-item-row">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="pos-item-row">
              <span>Descuento</span>
              <span>-{formatMoney(order.discount)}</span>
            </div>
          )}
          {order.deliveryFee > 0 && (
            <div className="pos-item-row">
              <span>Envío</span>
              <span>{formatMoney(order.deliveryFee)}</span>
            </div>
          )}
          <div className="pos-item-row pos-total">
            <span>TOTAL</span>
            <span>{formatMoney(order.total)}</span>
          </div>
          <p className="pos-sep">--------------------------------</p>
          <p className="pos-thanks">Gracias por tu pedido</p>
          <p className="pos-line">www — ChivitosPro</p>
        </div>
      </div>
    </div>
  )
}

function MenuConfigView({
  menu,
  library,
  editing,
  setEditing,
  saving,
  notify,
  setError,
  setSaving,
  refreshMenu,
  refreshLibrary,
  onPreview,
  onManageLibrary,
}: {
  menu: MenuData
  library: ModifierLibraryGroup[]
  editing: MenuItem | null
  setEditing: (i: MenuItem | null) => void
  saving: boolean
  notify: (m: string) => void
  setError: (m: string) => void
  setSaving: (v: boolean) => void
  refreshMenu: () => Promise<MenuData>
  refreshLibrary: () => Promise<ModifierLibraryGroup[]>
  onPreview: () => void
  onManageLibrary: () => void
}) {
  const [newCatName, setNewCatName] = useState('')
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>([])
  const [focusCategoryId, setFocusCategoryId] = useState<string | null>(null)
  const [focusProductId, setFocusProductId] = useState<string | null>(null)

  const focusCategory = menu.categories.find((c) => c.id === focusCategoryId) || null
  const focusProduct =
    focusCategory?.items.find((i) => i.id === focusProductId) ||
    menu.categories.flatMap((c) => c.items).find((i) => i.id === focusProductId) ||
    null

  const toggleCategory = (catId: string) => {
    setExpandedCatIds((prev) => {
      const open = prev.includes(catId)
      const next = open ? prev.filter((id) => id !== catId) : [...prev, catId]
      if (!open) {
        setFocusCategoryId(catId)
        setFocusProductId(null)
      } else if (focusCategoryId === catId) {
        setFocusCategoryId(next[0] || null)
      }
      return next
    })
  }

  const isExpanded = (catId: string) => expandedCatIds.includes(catId)

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
      // No borrar grupos de la biblioteca: al crear, el backend ya hereda los de la categoría.
      if (payload.modifiers.length > 0) {
        await saveProductModifiers(productId, payload.modifiers)
      }
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

  const refreshAll = async () => {
    await refreshMenu()
    await refreshLibrary()
  }

  const editingCategoryId = editing?.id.startsWith('__new__:')
    ? editing.id.slice('__new__:'.length)
    : null
  const editingCategory =
    menu.categories.find((c) => c.id === editingCategoryId) ||
    (editing && !editing.id.startsWith('__new__:')
      ? menu.categories.find((c) => c.items.some((i) => i.id === editing.id))
      : null) ||
    null

  const panelCategoryId = focusProductId
    ? null
    : editing && !editing.id.startsWith('__new__:')
      ? null
      : editingCategoryId || focusCategoryId
  const panelCategoryName = editingCategory?.name || focusCategory?.name
  const panelProductId =
    editing && !editing.id.startsWith('__new__:')
      ? editing.id
      : focusProductId
  const panelProductName = editing?.name || focusProduct?.name
  const assignedGroupIds = editing
    ? (editing.modifiers || []).map((g) => g.id)
    : focusProduct
      ? (focusProduct.modifiers || []).map((g) => g.id)
      : (focusCategory?.modifierGroups || []).map((g) => g.id)

  return (
    <div className="menu-editor-component">
      <div className="menu-editor-left">
        <div className="menu-editor-top-bar">
          <div className="metb-left">
            <button type="button" className="btn-preview" onClick={onPreview}>
              Vista previa &amp; Pedido de prueba
            </button>
            <button type="button" className="btn-icon" title="Más opciones" aria-label="Más">
              ⋮
            </button>
          </div>
          <div className="menu-editor-toolbar-extra">
            <button type="button" className="btn-light" onClick={() => refreshAll()}>
              Actualizar
            </button>
            <button
              type="button"
              className="btn-light btn-danger-outline"
              disabled={saving}
              onClick={async () => {
                if (
                  !confirm(
                    '¿Seguro que deseas ELIMINAR todo el menú actual y cargar el catálogo TuMenuWeb (18 categorías / ~82 productos)? También se borran los pedidos.',
                  )
                ) {
                  return
                }
                if (!confirm('Última confirmación: esta acción no se puede deshacer. ¿Continuar?'))
                  return
                setSaving(true)
                try {
                  const result = await replaceMenuCatalog()
                  await refreshAll()
                  setEditing(null)
                  setExpandedCatIds([])
                  setFocusCategoryId(null)
                  setFocusProductId(null)
                  notify(`Menú reemplazado: ${result.categories} categorías, ${result.products} productos`)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Error al reemplazar menú')
                } finally {
                  setSaving(false)
                }
              }}
            >
              Cargar catálogo TuMenuWeb
            </button>
            <button type="button" className="btn-primary" onClick={onManageLibrary}>
              Siguiente
            </button>
          </div>
        </div>

        <div className="menu-editor-body">
          {editing ? (
            <div className="menu-editor-product-form">
              <button
                type="button"
                className="menu-back-btn"
                onClick={() => {
                  setEditing(null)
                  setFocusProductId(null)
                }}
              >
                ← Volver al menú
              </button>
              <ProductEditor
                item={editing}
                saving={saving}
                onCancel={() => {
                  setEditing(null)
                  setFocusProductId(null)
                }}
                onDelete={async () => {
                  if (editing.id.startsWith('__new__:')) {
                    setEditing(null)
                    return
                  }
                  if (!confirm(`¿Seguro que deseas eliminar el producto "${editing.name}"?`)) return
                  setSaving(true)
                  try {
                    await deleteProduct(editing.id)
                    setEditing(null)
                    setFocusProductId(null)
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
          ) : (
            <>
              <div className="menu-categories">
                {menu.categories.map((cat) => {
                  const thumb = cat.banner || cat.items[0]?.image || '/logo.png'
                  const expanded = isExpanded(cat.id)
                  const focused = focusCategoryId === cat.id
                  return (
                    <div
                      key={cat.id}
                      className={`menu-ci${expanded ? ' is-expanded' : ''}${focused ? ' keep-hovering highlighted' : ''}`}
                    >
                      <div className="menu-ci-body">
                        <span className="drag-hover-indicator" aria-hidden>
                          ≡
                        </span>
                        <div className="menu-ci-content">
                          <div className="menu-ci-content-left">
                            <div className="menu-ci-image has-image">
                              <img src={mediaUrl(thumb)} alt="" />
                            </div>
                            <div className="menu-ci-details">
                              <div className="menu-ci-title">{cat.name}</div>
                              {cat.subtitle ? (
                                <div className="menu-ci-subtitle">{cat.subtitle}</div>
                              ) : null}
                            </div>
                          </div>
                          <div className="menu-ci-content-right">
                            <button
                              type="button"
                              className="me-btn visible-on-hover"
                              title="Más"
                              aria-label="Más"
                            >
                              ⋮
                            </button>
                            <button
                              type="button"
                              className="me-btn visible-on-hover"
                              title="Editar categoría"
                              onClick={() => {
                                setFocusCategoryId(cat.id)
                                setFocusProductId(null)
                                if (!expanded) toggleCategory(cat.id)
                              }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="me-btn"
                              title={expanded ? 'Contraer' : 'Expandir'}
                              onClick={() => toggleCategory(cat.id)}
                            >
                              {expanded ? '▾' : '▸'}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <>
                            <div
                              className={`choices-list${
                                cat.modifierGroups && cat.modifierGroups.length > 0
                                  ? ''
                                  : ' empty-list'
                              }`}
                            >
                              {(cat.modifierGroups || []).map((g) => (
                                <span key={g.id} className="choice-pill">
                                  {g.name} ×
                                </span>
                              ))}
                            </div>

                            <div className="category-items">
                              {cat.items.map((item) => (
                                <div
                                  key={item.id}
                                  className={`menu-ci is-product${
                                    focusProductId === item.id ? ' selected keep-hovering' : ''
                                  }`}
                                  onClick={() => {
                                    setFocusCategoryId(cat.id)
                                    setFocusProductId(item.id)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      setFocusCategoryId(cat.id)
                                      setFocusProductId(item.id)
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="menu-ci-body">
                                    <div className="menu-ci-content">
                                      <div className="menu-ci-content-left">
                                        <div className="menu-ci-image has-image">
                                          <img src={mediaUrl(item.image)} alt="" />
                                        </div>
                                        <div className="menu-ci-details">
                                          <div className="menu-ci-title">{item.name}</div>
                                          {item.description ? (
                                            <div className="menu-ci-subtitle">{item.description}</div>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div className="menu-ci-content-right">
                                        <span className="item-price">{formatMoney(item.price)}</span>
                                        <button
                                          type="button"
                                          className="me-btn visible-on-hover"
                                          title="Editar producto"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setFocusCategoryId(cat.id)
                                            setFocusProductId(item.id)
                                            setEditing(item)
                                          }}
                                        >
                                          ✎
                                        </button>
                                        <button
                                          type="button"
                                          className="me-btn"
                                          title={item.available === false ? 'Oculto' : 'Visible'}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {item.available === false ? '○' : '✓'}
                                        </button>
                                      </div>
                                    </div>
                                    {(item.modifiers || []).length > 0 && (
                                      <div className="choices-list">
                                        {(item.modifiers || []).map((g) => (
                                          <span key={g.id} className="choice-pill">
                                            {g.name} ×
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              <button
                                type="button"
                                className="btn-add-category"
                                onClick={() => {
                                  setFocusCategoryId(cat.id)
                                  startNewProduct(cat.id)
                                }}
                              >
                                + Agregar producto
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="menu-editor-new-cat">
                <input
                  placeholder="Nueva categoría"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-add-category"
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
                  Agregar categoría
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ModifierLibraryPanel
        library={library}
        categoryId={panelCategoryId}
        productId={panelProductId}
        categoryName={panelCategoryName}
        productName={panelProductName}
        assignedGroupIds={assignedGroupIds}
        saving={saving}
        setSaving={setSaving}
        notify={notify}
        setError={setError}
        onChanged={async () => {
          const m = await refreshMenu()
          await refreshLibrary()
          if (editing && panelProductId) {
            const found = m.categories.flatMap((c) => c.items).find((i) => i.id === panelProductId)
            if (found) setEditing(found)
          }
          if (focusProductId) {
            const found = m.categories.flatMap((c) => c.items).find((i) => i.id === focusProductId)
            if (!found) setFocusProductId(null)
          }
        }}
        onManage={onManageLibrary}
      />
    </div>
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
      {groups.length === 0 ? (
        <p className="admin-muted">
          Los grupos se asignan desde el panel <strong>Opcionales y agregados</strong> a la derecha.
          Si la categoría ya tiene grupos, aparecerán acá al guardar el producto.
        </p>
      ) : (
        <>
          <p className="admin-muted">
            Grupos asignados a este producto. Para agregar o quitar, usá el panel derecho mientras
            editás.
          </p>
          <ul className="modifier-option-preview">
            {groups.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong>
                <span className="admin-muted">
                  {' '}
                  · {g.options.length} opción{g.options.length === 1 ? '' : 'es'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="product-editor-actions">
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
      </div>
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
  library: ModifierLibraryGroup[]
  saving: boolean
  setSaving: (v: boolean) => void
  notify: (m: string) => void
  setError: (m: string) => void
  refresh: () => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(library[0]?.id || null)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const selected = library.find((g) => g.id === selectedId) || null
  const [draft, setDraft] = useState<ModifierLibraryGroup | null>(selected)

  useEffect(() => {
    if (selectedId?.startsWith('__new__')) return
    const found = library.find((g) => g.id === selectedId)
    setDraft(found ? { ...found, options: found.options.map((o) => ({ ...o })) } : null)
  }, [selectedId, library])

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    try {
      if (draft.id.startsWith('__new__')) {
        await createModifierLibraryGroup({
          name: draft.name,
          required: draft.required,
          min: draft.min,
          max: draft.max,
          allowQuantity: draft.allowQuantity,
          options: draft.options.map((o) => ({ name: o.name, price: o.price })),
        })
        notify('Grupo creado')
      } else {
        await updateModifierLibraryGroup(draft.id, {
          name: draft.name,
          required: draft.required,
          min: draft.min,
          max: draft.max,
          allowQuantity: draft.allowQuantity,
          options: draft.options.map((o) => ({ id: o.id, name: o.name, price: o.price })),
        })
        notify('Grupo actualizado en todos los productos')
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  function startNewGroup() {
    const blank: ModifierLibraryGroup = {
      id: `__new__:${Date.now()}`,
      name: 'Nuevo grupo',
      required: false,
      min: 0,
      max: 1,
      options: [{ id: `opt-${Date.now()}`, name: 'Opción', price: 0 }],
      usedByCategories: [],
      usedByProducts: [],
    }
    setSelectedId(blank.id)
    setDraft(blank)
  }

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Opcionales y agregados</h2>
          <p>Creá grupos reutilizables (guarnición, dips, bebidas…) y asignalos desde Configuración del menú</p>
        </div>
        <div className="header-actions">
          <button type="button" className="admin-btn primary" onClick={startNewGroup}>
            + Agregar grupo
          </button>
        </div>
      </header>

      <div className="modifiers-layout">
        <div className="admin-card modifiers-library-list">
          <h3>Biblioteca</h3>
          <ul className="rank-list modifier-rank-list">
            {library.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className={`modifier-rank-btn${selectedId === g.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(g.id)}
                >
                  <span>
                    <strong>{g.name}</strong>
                    <small className="admin-muted">
                      {g.options.length} opts · {g.usedByCategories.length} cat. · {g.usedByProducts.length}{' '}
                      prod.
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card settings-form modifiers-editor">
          {!draft ? (
            <p className="admin-muted">Elegí un grupo de la biblioteca o creá uno nuevo.</p>
          ) : (
            <>
              <h3>{draft.id.startsWith('__new__') ? 'Nuevo grupo' : 'Editar grupo'}</h3>
              <label>
                Nombre del grupo
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej. Guarnición"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.required}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      required: e.target.checked,
                      min: e.target.checked ? Math.max(1, draft.min) : 0,
                    })
                  }
                />
                Obligatorio
              </label>

              <p className="admin-muted">Opciones con precio extra</p>
              {draft.options.map((o, oi) => (
                <div key={o.id} className="mod-option-row">
                  <input
                    value={o.name}
                    placeholder="Ej. Papa con cheddar"
                    onChange={(e) => {
                      const options = [...draft.options]
                      options[oi] = { ...o, name: e.target.value }
                      setDraft({ ...draft, options })
                    }}
                  />
                  <input
                    className="mod-option-price"
                    type="number"
                    value={o.price}
                    aria-label="Precio extra"
                    onChange={(e) => {
                      const options = [...draft.options]
                      options[oi] = { ...o, price: Number(e.target.value) || 0 }
                      setDraft({ ...draft, options })
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn ghost icon-del"
                    title="Eliminar opción"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        options: draft.options.filter((_, i) => i !== oi),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="admin-btn ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    options: [
                      ...draft.options,
                      { id: `opt-${Date.now()}`, name: 'Nueva opción', price: 0 },
                    ],
                  })
                }
              >
                + Opción
              </button>

              {!draft.id.startsWith('__new__') && (
                <div className="modifier-usage">
                  {draft.usedByCategories.length > 0 && (
                    <p>
                      <strong>Categorías:</strong> {draft.usedByCategories.map((c) => c.name).join(', ')}
                    </p>
                  )}
                  {draft.usedByProducts.length > 0 && (
                    <p>
                      <strong>Productos:</strong>{' '}
                      {draft.usedByProducts.map((p) => p.name).join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div className="product-editor-actions">
                <button
                  type="button"
                  className="admin-btn primary"
                  disabled={saving || !draft.name.trim() || draft.options.length === 0}
                  onClick={saveDraft}
                >
                  {saving ? 'Guardando…' : draft.id.startsWith('__new__') ? 'Crear grupo' : 'Guardar grupo'}
                </button>
                {!draft.id.startsWith('__new__') && (
                  <button
                    type="button"
                    className="admin-btn danger"
                    disabled={saving}
                    onClick={async () => {
                      if (!confirm(`¿Eliminar "${draft.name}" de la biblioteca y de todos los productos?`)) return
                      setSaving(true)
                      try {
                        await deleteModifierLibraryGroup(draft.id)
                        setSelectedId(null)
                        await refresh()
                        notify('Grupo eliminado')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Error')
                      } finally {
                        setSaving(false)
                      }
                    }}
                  >
                    Eliminar grupo
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="admin-card modifiers-assign">
          <h3>Asignar por categoría</h3>
          <p className="admin-muted">Expandí una categoría y asigná el grupo seleccionado a todos sus productos.</p>
          <ul className="modifiers-cat-list">
            {menu.categories.map((cat) => {
              const open = expandedCatId === cat.id
              const assigned = new Set((cat.modifierGroups || []).map((g) => g.id))
              return (
                <li key={cat.id} className={`modifiers-cat-item${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="modifiers-cat-head"
                    onClick={() => setExpandedCatId(open ? null : cat.id)}
                  >
                    <span>{open ? '▾' : '▸'}</span>
                    <strong>{cat.name}</strong>
                    <small>{cat.items.length} prod.</small>
                  </button>
                  {open && (
                    <div className="modifiers-cat-body">
                      {(cat.modifierGroups || []).length > 0 && (
                        <div className="menu-cat-mod-tags">
                          {(cat.modifierGroups || []).map((g) => (
                            <span key={g.id} className="modifier-tag on">
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {selected && !selected.id.startsWith('__new__') && (
                        assigned.has(selected.id) ? (
                          <button
                            type="button"
                            className="admin-btn ghost full"
                            disabled={saving}
                            onClick={async () => {
                              setSaving(true)
                              try {
                                await unassignModifierGroupFromCategory(cat.id, selected.id)
                                await refresh()
                                notify(`Grupo quitado de ${cat.name}`)
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Error')
                              } finally {
                                setSaving(false)
                              }
                            }}
                          >
                            Quitar &quot;{selected.name}&quot; de {cat.name}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn primary full"
                            disabled={saving}
                            onClick={async () => {
                              setSaving(true)
                              try {
                                await assignModifierGroupToCategory(cat.id, selected.id)
                                await refresh()
                                notify(`Grupo asignado a ${cat.name}`)
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Error')
                              } finally {
                                setSaving(false)
                              }
                            }}
                          >
                            Asignar &quot;{selected.name}&quot; a todos
                          </button>
                        )
                      )}
                      <ul className="modifiers-product-list">
                        {cat.items.map((item) => (
                          <li key={item.id}>
                            <span>{item.name}</span>
                            {selected &&
                              !selected.id.startsWith('__new__') &&
                              ((item.modifiers || []).some((m) => m.id === selected.id) ? (
                                <button
                                  type="button"
                                  className="admin-btn ghost"
                                  disabled={saving}
                                  onClick={async () => {
                                    setSaving(true)
                                    try {
                                      await unassignModifierGroupFromProduct(item.id, selected.id)
                                      await refresh()
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : 'Error')
                                    } finally {
                                      setSaving(false)
                                    }
                                  }}
                                >
                                  Quitar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-btn"
                                  disabled={saving}
                                  onClick={async () => {
                                    setSaving(true)
                                    try {
                                      await assignModifierGroupToProduct(item.id, selected.id)
                                      await refresh()
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : 'Error')
                                    } finally {
                                      setSaving(false)
                                    }
                                  }}
                                >
                                  Asignar
                                </button>
                              ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
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

function PagosMpView({
  settings,
  mpStatus,
  saving,
  onSave,
  onRefreshStatus,
}: {
  settings: RestaurantSettings
  mpStatus: MercadoPagoAdminStatus | null
  saving: boolean
  onSave: (p: Partial<RestaurantSettings>) => Promise<void>
  onRefreshStatus: () => Promise<void>
}) {
  const pm = settings.paymentMethods || {}
  const mp = settings.mercadoPago || { blockedBins: [], blockedMessage: '' }
  const [binInput, setBinInput] = useState('')
  const [bins, setBins] = useState<string[]>(mp.blockedBins || [])
  const [message, setMessage] = useState(
    mp.blockedMessage ||
      'Para pagar con BROU Recompensa y acceder al 20% de descuento, seleccioná pago con POS.',
  )

  useEffect(() => {
    setBins(mp.blockedBins || [])
    setMessage(
      mp.blockedMessage ||
        'Para pagar con BROU Recompensa y acceder al 20% de descuento, seleccioná pago con POS.',
    )
  }, [mp.blockedBins, mp.blockedMessage])

  function addBin() {
    const digits = binInput.replace(/\D/g, '')
    if (digits.length < 4 || digits.length > 8) {
      alert('Ingresá un BIN de 4 a 8 dígitos (ideal 6 u 8, los que te dé BROU).')
      return
    }
    if (bins.includes(digits)) return
    setBins((prev) => [...prev, digits])
    setBinInput('')
  }

  return (
    <section className="admin-section">
      <header className="admin-header">
        <div>
          <h2>Pagos — Mercado Pago</h2>
          <p>Checkout Bricks + bloqueo de BIN BROU Recompensa</p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void onRefreshStatus()}>
          Actualizar estado
        </button>
      </header>

      <div className="admin-card settings-form" style={{ marginBottom: 16 }}>
        <p className="admin-muted">
          Credenciales en Railway (servicio API): <code>MP_PUBLIC_KEY</code> y{' '}
          <code>MP_ACCESS_TOKEN</code>. No van en el front.
        </p>
        <div className="meta-grid">
          <div>
            <span>Public Key</span>
            <strong>{mpStatus?.hasPublicKey ? 'OK' : 'Falta'}</strong>
          </div>
          <div>
            <span>Access Token</span>
            <strong>{mpStatus?.hasAccessToken ? 'OK' : 'Falta'}</strong>
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={!!pm.mercadoPago}
            disabled={saving}
            onChange={(e) =>
              onSave({ paymentMethods: { ...pm, mercadoPago: e.target.checked } })
            }
          />
          Habilitar Mercado Pago en el checkout
        </label>
        {!mpStatus?.configured && (
          <p className="admin-error">Faltan keys: el checkout no mostrará tarjeta hasta configurarlas.</p>
        )}
      </div>

      <div className="admin-card settings-form">
        <h3>BINs bloqueados (BROU Recompensa)</h3>
        <p className="admin-muted">
          Pedile a BROU los BIN completos (6 u 8 dígitos), crédito y débito. No uses solo 4 dígitos.
        </p>
        <div className="row-2">
          <input
            placeholder="Ej: 548742"
            value={binInput}
            onChange={(e) => setBinInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBin())}
          />
          <button type="button" className="admin-btn" onClick={addBin}>
            + Agregar BIN
          </button>
        </div>
        <div className="bin-list">
          {bins.length === 0 ? (
            <p className="admin-muted">Ningún BIN bloqueado todavía.</p>
          ) : (
            bins.map((b) => (
              <div key={b} className="bin-chip">
                <code>{b}</code>
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => {
                    if (!confirm(`¿Seguro que deseas eliminar el BIN "${b}"?`)) return
                    setBins((prev) => prev.filter((x) => x !== b))
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <label className="field">
          <span>Mensaje al bloquear</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button
          type="button"
          className="admin-btn primary"
          disabled={saving}
          onClick={() =>
            onSave({
              mercadoPago: {
                blockedBins: bins,
                blockedMessage: message.trim(),
              },
            })
          }
        >
          Guardar BINs y mensaje
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
