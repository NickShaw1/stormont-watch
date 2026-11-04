import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { billStages } from '../lib/db/schema'
import { fetchWithRetry, MAX_CONSECUTIVE_FAILURES } from './syncShared'

type Db = ReturnType<typeof drizzle<typeof schema>>

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'
const RECHECK_DAYS = 30
const CONCURRENCY = 1

interface Decision {
  method: string | null
  outcome: string | null
  date: string | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchDecision(documentId: string): Promise<Decision | null> {
  const res = await fetchWithRetry(`${BASE}/GetDivisionResult_JSON?documentId=${documentId}`)
  if (!res) throw new Error(`[syncBillDecisions] API request failed for ${documentId}`)
  const data = await res.json()
  const d = data?.DivisionDetails?.Division
  if (!d) return null
  const eventDate = typeof d.EventDate === 'string' ? d.EventDate.slice(0, 10) : null
  return {
    method: d.DecisionMethod?.trim() || null,
    outcome: d.Outcome?.trim() || null,
    date: eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
  }
}

export async function syncBillDecisions(db: Db, all = false, dryRun = false) {
  console.log(`[syncBillDecisions] Starting${all ? ' (all documents)' : ''}${dryRun ? ' (dry run)' : ''}...`)

  const pending = await db.execute(sql`
    SELECT document_id, plenary_date::date::text AS agenda_date
    FROM bill_stages
    WHERE ${all
      ? sql`TRUE`
      : sql`decision_checked_at IS NULL
        OR (decision_method IS NULL AND plenary_date >= NOW() - ${`${RECHECK_DAYS} days`}::interval)`}
    ORDER BY plenary_date
  `)
  const docs = pending.rows as { document_id: string; agenda_date: string }[]
  console.log(`[syncBillDecisions] Documents to check: ${docs.length}`)
  if (docs.length === 0) return

  let decided = 0
  let none = 0
  let errors = 0
  let dateDiffers = 0
  const byMethod = new Map<string, number>()
  let consecutiveFailures = 0
  let aborted = false

  for (let i = 0; i < docs.length && !aborted; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async d => {
      try {
        return { doc: d, decision: await fetchDecision(d.document_id), failed: false }
      } catch (err) {
        console.error(`[syncBillDecisions] Error fetching ${d.document_id}:`, err)
        return { doc: d, decision: null, failed: true }
      }
    }))
    for (const { doc, decision, failed } of results) {
      if (failed) {
        errors++
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { aborted = true; break }
        continue
      }
      consecutiveFailures = 0
      if (decision) {
        decided++
        byMethod.set(decision.method ?? 'Unknown', (byMethod.get(decision.method ?? 'Unknown') ?? 0) + 1)
        if (decision.date && decision.date !== doc.agenda_date) dateDiffers++
      } else {
        none++
      }
      if (dryRun) continue
      await db.update(billStages)
        .set({
          decisionMethod: decision?.method ?? null,
          decisionOutcome: decision?.outcome ?? null,
          decisionDate: decision?.date ?? null,
          decisionCheckedAt: new Date(),
        })
        .where(eq(billStages.documentId, doc.document_id))
    }
    await sleep(100)
  }

  const methods = [...byMethod.entries()].map(([m, n]) => `${m}: ${n}`).join(', ')
  console.log(`[syncBillDecisions] With a decision: ${decided} (${methods}), no decision: ${none}, decision date differs from agenda date: ${dateDiffers}, errors: ${errors}`)
  if (aborted) {
    throw new Error(`[syncBillDecisions] Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row, the API looks unavailable (${decided + none} checked and saved first)`)
  }
  if (dryRun) {
    console.log('[syncBillDecisions] Dry run, no changes made.')
    return
  }
  console.log('[syncBillDecisions] Done.')
  if (errors > 0 && decided + none === 0) {
    throw new Error(`[syncBillDecisions] Nothing written with ${errors} error(s), possible API failure`)
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const db = drizzle(neon(url), { schema })
  await syncBillDecisions(db, process.argv.includes('--all'), process.argv.includes('--dry-run'))
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bill decisions sync failed:', err)
    process.exit(1)
  })
}
