// Manual one-off resync of Hansard reports. syncHansardReports (from ./syncShared)
// rethrows on a critical guard failure (e.g. a near-empty API response), so this
// process exits non-zero on that failure instead of logging and exiting cleanly.
import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { syncHansardReports } from './syncShared'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  await syncHansardReports(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync Hansard failed:', err)
  process.exit(1)
})
