/**
 * High-bar validation vs docs/_diseno_frontend_extract.md (TuMenuWeb design spec).
 * Run twice before ship: node scripts/validate-tumenu-design.cjs
 */
const fs = require('fs')

const nav = fs.readFileSync('src/admin/nav.ts', 'utf8')
const app = fs.readFileSync('src/admin/AdminApp.tsx', 'utf8')
const css = fs.readFileSync('src/admin.css', 'utf8')
const views = fs.readFileSync('src/admin/tumenuViews.tsx', 'utf8')
const indexCss = fs.readFileSync('src/index.css', 'utf8')

const fails = []
function ok(name, cond, detail) {
  if (!cond) fails.push(`${name}: ${detail || 'failed'}`)
  return !!cond
}

// —— Tokens (spec §1.1–1.4)
ok('bg_body', css.includes('#f5f3f0') || css.includes('#F5F3F0'), 'body #F5F3F0')
ok('rail_bg', css.includes('#f0eeeb') || css.includes('#F0EEEB'), 'rail #F0EEEB')
ok('accent_icon', css.includes('#ff7b01') || css.includes('#FF7B01'), 'icon accent #FF7B01')
ok('accent_button', css.includes('#f08b18') || css.includes('#F08B18'), 'button #F08B18')
ok('success', css.includes('#5ac15e') || css.includes('#5AC15E'), 'success #5AC15E')
ok('danger', css.includes('#ef4e4b') || css.includes('#EF4E4B'), 'danger #EF4E4B')
ok('text_main', css.includes('#424242'), 'text #424242')
ok('text_muted', css.includes('#808080'), 'muted #808080')
ok('border', css.includes('#cccccc') || css.includes('#CCCCCC'), 'border #CCCCCC')
ok('two_oranges', css.includes('--accent-icon') && css.includes('--accent-button'), 'separate orange vars')
ok('open_sans_css', css.includes("Open Sans"), 'Open Sans in admin.css')
ok('open_sans_load', indexCss.includes('Open+Sans') || indexCss.includes('Open Sans'), 'font loaded')
ok('btn_radius', css.includes('border-radius: 3px') && css.includes('.tm-shell .admin-btn'), 'btn radius 3px')
ok('card_radius', css.includes('border-radius: 6px') && css.includes('.tm-card'), 'card radius 6px')
ok('card_shadow', css.includes('0 1px 6px rgba(0, 0, 0, 0.35)') || css.includes('0px 1px 6px'), 'wizard shadow')
ok('menu_ci_shadow', css.includes('0 1px 4px rgba(0, 0, 0, 0.15)') || css.includes('0px 1px 4px'), 'menu-ci shadow')
ok('kpi_shadow', css.includes('0 2px 4px rgba(0, 0, 0, 0.075)') || css.includes('0px 2px 4px'), 'kpi shadow')
ok('input_inset', css.includes('inset 1px 1px 3px'), 'input inset shadow')
ok('ios_switch', css.includes('.tm-ios') && css.includes('border-radius: 18px'), 'iOS switch pill')
ok('ios_on_green', views.includes('tm-ios') && css.includes('.tm-ios.on'), 'switch ON green')

// —— Shell (§2)
ok('topbar', app.includes('tm-topbar') && app.includes('tm-topbar-logo') && app.includes('tm-user'), 'topbar logo+user')
ok('rail_no_logo', !/tm-rail[\s\S]{0,200}tm-rail-logo/.test(app), 'logo not in rail (in topbar)')
ok('rail_light', !css.includes('.tm-rail') || !/#0f172a|#1e293b/.test(css.match(/\.tm-rail\s*\{[^}]+\}/)?.[0] || ''), 'rail not dark slate')
ok('rail_active_white', /\.tm-rail-btn\.active\s*\{[^}]*background:\s*#fff/.test(css), 'active rail white bg')
ok('module_title', app.includes('tm-module-title'), 'uppercase module title')
ok('dbl_click', app.includes('moduleArmed') && app.includes('primer clic'), 'two-click rail')
ok('tooltip', css.includes('.tm-tooltip') && app.includes('tm-tooltip'), 'dark tooltip')

// —— Modules (§2.2)
const modules = ['config', 'marketing', 'reports', 'online', 'other']
ok('five_modules', modules.every((m) => nav.includes(`id: '${m}'`)), '5 modules')

// —— Components
ok('wizard_card', views.includes('tm-card') && views.includes('tm-card-header') && views.includes('Siguiente'), 'wizard card header')
ok('yesno', views.includes('YesNoToggle') && css.includes('.tm-yesno'), 'Si/No toggle')
ok('primary_btn_token', css.includes('var(--accent-button)'), 'primary uses accent-button')
ok('success_preview', css.includes('var(--success)') && css.includes('header-actions'), 'green preview CTA')

// —— Structure wiring (functional map still required)
const required = [
  'profile-address', 'menu', 'modifiers', 'dashboard', 'report-orders', 'report-clients',
  'mkt-promos', 'mkt-qr', 'print-overview', 'widget-fulfillment', 'other-notifications', 'other-languages',
]
const itemIds = [...nav.matchAll(/\{ id: '([^']+)', label:/g)].map((m) => m[1])
ok('core_sections', required.every((r) => itemIds.includes(r)), `missing ${required.filter((r) => !itemIds.includes(r))}`)
ok('utf8', app.includes('Contraseña') && !app.includes('ContraseÃ'), 'utf8 intact')

const pass = fails.length === 0
console.log(JSON.stringify({ pass, fails, checked: fails.length === 0 ? 'all' : fails.length }, null, 2))
process.exit(pass ? 0 : 1)
