// Manual one-off resync of ministers and committee chairs. Both functions come from
// ./syncShared and rethrow on a critical guard failure (e.g. a near-empty API response).
// If syncMinisters throws, syncCommitteeChairs below is skipped and the process exits
// non-zero — there is no try/catch here to continue past a failed step.
import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { syncMinisters, syncCommitteeChairs } from './syncShared'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  await syncMinisters(db)
  await syncCommitteeChairs(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync structure failed:', err)
  process.exit(1)
})
