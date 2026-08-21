const fs = require('fs')
const nav = fs.readFileSync('src/admin/nav.ts', 'utf8')
const app = fs.readFileSync('src/admin/AdminApp.tsx', 'utf8')
const css = fs.readFileSync('src/admin.css', 'utf8')
const views = fs.readFileSync('src/admin/tumenuViews.tsx', 'utf8')

const modules = ['config', 'marketing', 'reports', 'online', 'other']
const modOk = modules.every((m) => nav.includes(`id: '${m}'`))
const icons = ['settings', 'marketing', 'reports', 'online', 'other']
const iconOk = icons.every((i) => nav.includes(`icon: '${i}'`))
const railSvg = app.includes('RailIcon') && fs.existsSync('src/admin/RailIcon.tsx')
const topbar = app.includes('tm-topbar') && css.includes('.tm-topbar')
const dblClick = app.includes('moduleArmed') && app.includes('primer clic')
const wizard = views.includes('tm-wizard') && views.includes('Siguiente')
const switches = views.includes('tm-toggle') && css.includes('.tm-toggle.on')
const orange = css.includes('--tm-accent')
const sans = css.includes(".tm-shell .admin-header h2") && css.includes("'DM Sans'")
const coolGray = css.includes('#f4f5f7') && css.includes('#e5e7eb')
const utf8 = app.includes('Contraseña') && app.includes('Sí') && !app.includes('ContraseÃ')

const required = [
  'profile-address', 'profile-location', 'profile-website', 'profile-product-type', 'profile-confirm',
  'schedules-pickup', 'schedules-delivery', 'schedules-reservation', 'schedules-dinein', 'schedules-hours', 'schedules-scheduled',
  'pay-taxes', 'pay-methods', 'take-orders-app', 'take-orders-alert', 'menu', 'modifiers',
  'publish-privacy', 'publish-facebook', 'publish-smartlinks', 'publish-web', 'publish-widget', 'publish-app',
  'pagos-providers', 'pagos-tips', 'pagos-deposit',
  'mkt-kickstarter', 'mkt-kickstarter-first', 'mkt-kickstarter-invite', 'mkt-autopilot', 'mkt-autopilot-campaigns',
  'mkt-scanner', 'mkt-google', 'mkt-promos', 'mkt-promos-list', 'mkt-promos-templates', 'mkt-qr',
  'dashboard', 'sales-trend', 'sales-summary', 'menu-insights-categories', 'menu-insights-items', 'online-funnel',
  'report-clients-metrics', 'report-reservations', 'google-ranking', 'website-visits', 'delivery-map',
  'connectivity-health', 'promotions-stats', 'report-orders', 'report-clients',
  'print-overview', 'print-printers', 'print-templates', 'print-history',
  'widget-scheduled-limit', 'widget-auto-orders', 'widget-service-fees', 'widget-fulfillment', 'widget-hcaptcha',
  'widget-billing', 'integrations-catalog', 'integrations-yours',
  'other-notifications', 'other-languages',
]
const itemIds = [...nav.matchAll(/\{ id: '([^']+)', label:/g)].map((m) => m[1])
const missing = required.filter((r) => !itemIds.includes(r))

const wires = {
  promos: views.includes('PromotionsListView'),
  zones: views.includes('DeliveryZonesFullView'),
  orders: app.includes('report-orders'),
  mp: app.includes('PagosMpView'),
  menu: app.includes('MenuConfigView'),
  hours: views.includes('HoursFullView'),
  langs: views.includes('LanguagesView'),
}

console.log('PASS1_structure', { modOk, iconOk, railSvg, topbar, dblClick, sections: required.length, missing })
console.log('PASS2_aesthetics', { wizard, switches, orange, sans, coolGray, utf8 })
console.log('PASS3_wiring', wires)
const all = [
  modOk, iconOk, railSvg, topbar, dblClick, missing.length === 0,
  wizard, switches, orange, sans, coolGray, utf8,
  ...Object.values(wires),
]
console.log('ALL_OK', all.every(Boolean), '/', all.length)
