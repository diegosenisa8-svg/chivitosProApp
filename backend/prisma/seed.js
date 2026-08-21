import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma.js'
import { loadBundledMenu, replaceMenuCatalog } from '../src/lib/replaceMenu.js'

const force = process.argv.includes('--force') || process.env.FORCE_MENU_SEED === '1'

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'chivitos2026'
  const name = process.env.ADMIN_NAME || 'Admin ChivitosPro'
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, role: 'admin' },
    create: { email, name, passwordHash, role: 'admin' },
  })
  console.log(`Admin OK: ${email} / ${password}`)
}

async function ensureEmployee() {
  const email = (process.env.EMPLOYEE_EMAIL || 'empleado@chivitospro.com').toLowerCase()
  const password = process.env.EMPLOYEE_PASSWORD || 'empleado2026'
  const name = process.env.EMPLOYEE_NAME || 'Empleado ChivitosPro'
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, role: 'empleado' },
    create: { email, name, passwordHash, role: 'empleado' },
  })
  console.log(`Empleado OK: ${email}`)
}

async function main() {
  await ensureAdmin()
  await ensureEmployee()

  const existing = await prisma.category.count()
  if (existing > 0 && !force) {
    console.log('Seed skipped (menu already present). Use --force or FORCE_MENU_SEED=1 to reset.')
    return
  }

  const { path, menu } = loadBundledMenu()
  console.log(`Loading menu from ${path}`)
  const result = await replaceMenuCatalog(menu, { wipeOrders: true })
  console.log(`Seed OK: ${result.categories} categorías, ${result.products} productos`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
