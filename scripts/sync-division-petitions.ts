import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { fetchWithRetry, BASE, MAX_CONSECUTIVE_FAILURES } from './syncShared'

type Db = ReturnType<typeof drizzle<typeof schema>>

const RECHECK_DAYS = 14

interface Petition {
  documentId: string
  tabledDate: string | null
  plenaryDate: string | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function dateOnly(raw: unknown): string | null {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null
}

async function fetchPetition(divisionId: string): Promise<Petition | null> {
  const res = await fetchWithRetry(`${BASE}/plenary.asmx/GetMotionPetitionOfConcern_JSON?documentid=${divisionId}`)
  if (!res) throw new Error(`[syncDivisionPetitions] API request failed for division ${divisionId}`)
  const data = await res.json()
  const raw = data?.MotionPetitionOfConcern?.PetitionOfConcern
  const p = Array.isArray(raw) ? raw[0] : raw
  if (!p?.DocumentID) return null
  return { documentId: String(p.DocumentID), tabledDate: dateOnly(p.TabledDate), plenaryDate: dateOnly(p.PlenaryDate) }
}

async function fetchSignatories(petitionId: string): Promise<number> {
  const res = await fetchWithRetry(`${BASE}/plenary.asmx/GetPlenaryTablers_JSON?documentId=${petitionId}`)
  if (!res) throw new Error(`[syncDivisionPetitions] Tablers request failed for petition ${petitionId}`)
  const data = await res.json()
  const raw = data?.TablerList?.Tabler
  const list: { TablerPersonID?: string }[] = !raw ? [] : Array.isArray(raw) ? raw : [raw]
  return list.filter(t => t.TablerPersonID).length
}

export async function syncDivisionPetitions(db: Db, all = false, dryRun = false, from?: string): Promise<string | undefined> {
  console.log(`[syncDivisionPetitions] Starting${all ? ' (all divisions)' : ''}${from ? ` (from ${from})` : ''}${dryRun ? ' (dry run)' : ''}...`)

  const pending = await db.execute(sql`
    SELECT document_id, title
    FROM divisions
    WHERE (${all
      ? sql`TRUE`
      : sql`petition_checked_at IS NULL
          OR division_date >= NOW() - ${`${RECHECK_DAYS} days`}::interval
          OR (petition_document_id IS NOT NULL AND COALESCE(petition_signatories, 0) = 0)`})
      ${from ? sql`AND division_date >= ${from}::date` : sql``}
    ORDER BY division_date
  `)
  const divisions = pending.rows as { document_id: string; title: string | null }[]
  console.log(`[syncDivisionPetitions] Divisions to check: ${divisions.length}`)
  if (divisions.length === 0) return

  let found = 0
  let errors = 0
  let consecutiveFailures = 0
  let aborted = false
  const foundLines: string[] = []

  for (const d of divisions) {
    try {
      const petition = await fetchPetition(d.document_id)
      await sleep(100)
      const signatories = petition ? await fetchSignatories(petition.documentId) : null
      consecutiveFailures = 0
      if (petition) {
        found++
        foundLines.push(`${d.document_id} "${(d.title ?? '').trim().slice(0, 60)}" petition ${petition.documentId}, ${signatories} signatories, tabled ${petition.tabledDate}, plenary ${petition.plenaryDate}`)
        await sleep(100)
      }
      if (dryRun) continue
      await db.execute(sql`
        UPDATE divisions
        SET petition_document_id = ${petition?.documentId ?? null},
            petition_tabled_date = ${petition?.tabledDate ?? null},
            petition_plenary_date = ${petition?.plenaryDate ?? null},
            petition_signatories = ${signatories},
            petition_checked_at = NOW()
        WHERE document_id = ${d.document_id}
      `)
    } catch (err) {
      errors++
      consecutiveFailures++
      console.error(`[syncDivisionPetitions] Error for division ${d.document_id}:`, err)
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = true
        break
      }
    }
    await sleep(100)
  }

  for (const line of foundLines) console.log(`[syncDivisionPetitions] Found: ${line}`)
  console.log(`[syncDivisionPetitions] Checked: ${divisions.length - errors}, with a petition: ${found}, errors: ${errors}`)
  if (aborted) {
    throw new Error(`[syncDivisionPetitions] Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row, the API looks unavailable (checked divisions were saved first)`)
  }
  if (dryRun) {
    console.log('[syncDivisionPetitions] Dry run, no changes made.')
    return
  }
  if (errors > 0 && errors === divisions.length) {
    throw new Error(`[syncDivisionPetitions] Every request failed (${errors}), possible API failure`)
  }
  return errors > 0 ? `${errors} division(s) could not be checked and will be retried` : undefined
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const db = drizzle(neon(url), { schema })
  const from = process.argv.find(a => a.startsWith('--from='))?.slice('--from='.length)
  await syncDivisionPetitions(db, process.argv.includes('--all'), process.argv.includes('--dry-run'), from)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Division petitions sync failed:', err)
    process.exit(1)
  })
}
