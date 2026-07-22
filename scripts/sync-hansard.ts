import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
import { dateToMandate } from '../lib/constants/mandates'

type Db = ReturnType<typeof drizzle<typeof schema>>

async function syncHansardReports(db: Db) {
  console.log('[syncHansardReports] Fetching all Hansard reports...')
  try {
    const res = await fetch(`${BASE}/hansard.asmx/GetAllHansardReports`)
    if (!res.ok) {
      console.error(`[syncHansardReports] API error ${res.status}`)
      return
    }
    const text = await res.text()
    const matches = text.matchAll(/<HansardComponent>([\s\S]*?)<\/HansardComponent>/g)
    let count = 0
    let skipped = 0
    for (const match of matches) {
      const block = match[1]
      const reportDocId = block.match(/<ReportDocId>(.*?)<\/ReportDocId>/)?.[1]
      const plenaryDate = block.match(/<PlenaryDate>(.*?)<\/PlenaryDate>/)?.[1]
      const sessionName = block.match(/<PlenarySessionName>(.*?)<\/PlenarySessionName>/)?.[1]
      if (!reportDocId || !plenaryDate) {
        console.warn(`[syncHansardReports] Skipping record with missing ${!reportDocId ? 'ReportDocId' : 'PlenaryDate'}`)
        skipped++
        continue
      }
      const dateOnly = plenaryDate.slice(0, 10)
      // Skip reports that predate every tracked mandate (e.g. the 2016-2022 Assembly)
      // rather than letting mandateIdForDate throw and abort the whole sync.
      const reportMandate = dateToMandate(dateOnly)?.id
      if (!reportMandate) {
        skipped++
        continue
      }
      await db
        .insert(schema.hansardReports)
        .values({
          reportDocId,
          plenaryDate: dateOnly,
          sessionName: sessionName ?? null,
          mandate: reportMandate,
        })
        .onConflictDoNothing()
      count++
    }
    if (count === 0 && skipped === 0) {
      console.warn('[syncHansardReports] API returned no Hansard components — possible API failure')
    }
    console.log(`[syncHansardReports] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncHansardReports] Sync error:', err)
  }
}

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
