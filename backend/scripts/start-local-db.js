import EmbeddedPostgres from 'embedded-postgres'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseDir = join(__dirname, '../.data/pg')
mkdirSync(databaseDir, { recursive: true })

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
})

async function main() {
  try {
    await pg.initialise()
  } catch (err) {
    // Already initialized
    if (!String(err?.message || err).toLowerCase().includes('already')) {
      console.warn('init note:', err.message || err)
    }
  }

  await pg.start()
  try {
    await pg.createDatabase('chivitos')
  } catch {
    // exists
  }

  console.log('Embedded Postgres ready on localhost:5433 / db=chivitos')
  console.log('DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/chivitos')

  const keepAlive = () => {}
  setInterval(keepAlive, 60_000)

  process.on('SIGINT', async () => {
    await pg.stop()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await pg.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
