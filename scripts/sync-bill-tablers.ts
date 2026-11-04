import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { billItemTablers } from '../lib/db/schema'
import { fetchWithRetry, MAX_CONSECUTIVE_FAILURES } from './syncShared'

type Db = ReturnType<typeof drizzle<typeof schema>>

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'
const RECENT_DAYS = 30
const CONCURRENCY = 1
const CHUNK = 200

interface ApiTabler {
  TablerPersonID?: string
  TablerName?: string
  TablerTitle?: string
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchTablers(documentId: string): Promise<ApiTabler[]> {
  const res = await fetchWithRetry(`${BASE}/GetPlenaryTablers_JSON?documentId=${documentId}`)
  if (!res) throw new Error(`[syncBillTablers] API request failed for ${documentId}`)
  const data = await res.json()
  const raw = data?.TablerList?.Tabler
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

export async function syncBillTablers(db: Db, all = false, dryRun = false) {
  console.log(`[syncBillTablers] Starting${all ? ' (all documents)' : ''}${dryRun ? ' (dry run)' : ''}...`)

  const pending = await db.execute(sql`
    SELECT bs.document_id, bs.mandate
    FROM bill_stages bs
    WHERE NOT EXISTS (SELECT 1 FROM bill_item_tablers t WHERE t.document_id = bs.document_id)
      ${all ? sql`` : sql`AND bs.plenary_date >= NOW() - ${`${RECENT_DAYS} days`}::interval`}
    ORDER BY bs.plenary_date
  `)
  const docs = pending.rows as { document_id: string; mandate: string }[]
  console.log(`[syncBillTablers] Documents to fetch: ${docs.length}`)
  if (docs.length === 0) return

  const rows: (typeof billItemTablers.$inferInsert)[] = []
  let empty = 0
  let errors = 0
  let consecutiveFailures = 0
  let aborted = false
  for (let i = 0; i < docs.length && !aborted; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async d => {
      try {
        return { doc: d, tablers: await fetchTablers(d.document_id) as ApiTabler[] | null }
      } catch (err) {
        console.error(`[syncBillTablers] Error fetching ${d.document_id}:`, err)
        return { doc: d, tablers: null }
      }
    }))
    for (const { doc, tablers } of results) {
      if (tablers === null) {
        errors++
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { aborted = true; break }
        continue
      }
      consecutiveFailures = 0
      if (tablers.length === 0) empty++
      tablers.forEach((t, idx) => {
        if (!t.TablerName) return
        rows.push({
          documentId: doc.document_id,
          tablerOrder: idx + 1,
          personId: t.TablerPersonID?.trim() || null,
          tablerName: t.TablerName.trim(),
          tablerTitle: t.TablerTitle?.trim() || null,
          mandate: doc.mandate,
          updatedAt: new Date(),
        })
      })
    }
    await sleep(100)
  }

  console.log(`[syncBillTablers] Tabler rows: ${rows.length}, documents with no tablers: ${empty}, errors: ${errors}`)

  if (dryRun) {
    console.log('[syncBillTablers] Dry run, no changes made.')
    return
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(billItemTablers).values(rows.slice(i, i + CHUNK)).onConflictDoUpdate({
      target: [billItemTablers.documentId, billItemTablers.tablerOrder],
      set: {
        personId: sql`excluded.person_id`,
        tablerName: sql`excluded.tabler_name`,
        tablerTitle: sql`excluded.tabler_title`,
        mandate: sql`excluded.mandate`,
        updatedAt: sql`now()`,
      },
    })
  }
  console.log(`[syncBillTablers] Done. Rows written: ${rows.length}`)

  if (aborted) {
    throw new Error(`[syncBillTablers] Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row, the API looks unavailable (${rows.length} rows saved first)`)
  }
  if (errors > 0 && rows.length === 0) {
    throw new Error(`[syncBillTablers] Zero rows written with ${errors} error(s) — possible API failure`)
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const db = drizzle(neon(url), { schema })
  await syncBillTablers(db, process.argv.includes('--all'), process.argv.includes('--dry-run'))
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bill tablers sync failed:', err)
    process.exit(1)
  })
}
