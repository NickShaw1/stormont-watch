import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { fetchWithRetry, MAX_CONSECUTIVE_FAILURES } from './syncShared'
import { refreshBillStageSummary } from './sync-bills'

type Db = ReturnType<typeof drizzle<typeof schema>>

const BASE = 'http://data.niassembly.gov.uk/hansard.asmx'

export interface HansardComponent {
  ComponentType?: string
  ComponentText?: string
}

export type HansardOutcome = 'passed' | 'negatived' | 'petition_of_concern'

export interface StageReading {
  debated: boolean | null
  outcome: HansardOutcome | null
}

function text(c: HansardComponent | undefined): string {
  return (c?.ComponentText ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function flat(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function reportHasContent(components: HansardComponent[]): boolean {
  return components.some(c => c.ComponentType === 'Header')
}

export function reportIsComplete(components: HansardComponent[]): boolean {
  return reportHasContent(components) &&
    !components.some(c => c.ComponentType === 'Procedure Line' && /remainder of this day'?s sitting will be published/i.test(text(c)))
}

export function readStage(components: HansardComponent[], billTitle: string, billRef: string, stage: string, reportComplete: boolean): StageReading {
  const wanted = flat(`${billTitle}: ${stage}`)
  const refKey = flat(billRef)
  const stageKey = flat(stage)
  const all: { header: string; body: HansardComponent[] }[] = []
  for (const c of components) {
    if (c.ComponentType === 'Header') all.push({ header: flat(text(c)), body: [] })
    else if (all.length > 0) all[all.length - 1].body.push(c)
  }
  const sections = all
    .filter(s => s.header === wanted ||
      (s.header.endsWith(stageKey) && s.body.some(c => c.ComponentType === 'Plenary Item Text' && flat(text(c)).includes(refKey))))
    .map(s => s.body)

  if (sections.length === 0) {
    const titleKey = flat(billTitle)
    const mentioned = components.some(c => (c.ComponentType === 'Header' || c.ComponentType === 'Plenary Item Text') && (flat(text(c)).includes(titleKey) || flat(text(c)).includes(refKey)))
    return { debated: reportComplete && !mentioned ? false : null, outcome: null }
  }

  const moved = sections.some(sec => sec.some(c =>
    c.ComponentType === 'Plenary Item Text' ||
    (c.ComponentType === 'Procedure Line' && /^(Moved\b|Question|Resolved|The Assembly divided|Debate\b[^.]*\bresumed)/i.test(text(c)))))
  if (!moved) return { debated: reportComplete ? false : null, outcome: null }

  if (!/^final stage$/i.test(stage)) return { debated: true, outcome: null }

  for (const sec of sections) {
    for (let i = 0; i < sec.length - 1; i++) {
      if (sec[i].ComponentType === 'Procedure Line' && /^(?:.*\.\s*)?Resolved[^:]*:\s*$/i.test(text(sec[i])) &&
          sec[i + 1].ComponentType === 'Plenary Item Text' && /do now pass/i.test(text(sec[i + 1]))) {
        return { debated: true, outcome: 'passed' }
      }
    }
  }
  for (const sec of sections) {
    if (sec.some(c => c.ComponentType === 'Procedure Line' && /negatived/i.test(text(c)))) {
      return { debated: true, outcome: 'negatived' }
    }
  }
  for (const sec of sections) {
    if (sec.some(c => c.ComponentType === 'Spoken Text' && /valid petition of concern/i.test(text(c)) && /will not be taken/i.test(text(c)))) {
      return { debated: true, outcome: 'petition_of_concern' }
    }
  }
  return { debated: true, outcome: null }
}

async function fetchReport(date: string): Promise<HansardComponent[]> {
  const res = await fetchWithRetry(`${BASE}/GetHansardComponentsByPlenaryDate_JSON?plenaryDate=${date}`)
  if (!res) throw new Error(`[syncBillHansard] API request failed for ${date}`)
  const data = await res.json()
  const comps = data?.AllHansardComponentsList?.HansardComponent
  return Array.isArray(comps) ? comps : comps ? [comps] : []
}

export async function syncBillHansard(db: Db, all = false, dryRun = false) {
  console.log(`[syncBillHansard] Starting${all ? ' (all stages)' : ''}${dryRun ? ' (dry run)' : ''}...`)

  const pending = await db.execute(sql`
    SELECT bs.document_id, bs.stage, b.short_title, b.bill_id,
           to_char(bs.plenary_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS held_date
    FROM bill_stages bs
    JOIN bills b ON b.bill_id = bs.bill_id
    WHERE bs.event_type = 'stage'
      AND bs.item_title IS NULL
      AND bs.decision_outcome IS NULL
      AND bs.has_division IS NOT TRUE
      AND bs.plenary_date < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM bill_stages o
        WHERE o.bill_id = bs.bill_id AND o.stage = bs.stage
          AND o.plenary_date::date = bs.plenary_date::date
          AND o.document_id <> bs.document_id
          AND (o.decision_outcome IS NOT NULL OR o.division_id IS NOT NULL)
      )
      AND ${all ? sql`TRUE` : sql`bs.hansard_report_complete IS NOT TRUE`}
    ORDER BY bs.plenary_date
  `)
  const rows = pending.rows as { document_id: string; stage: string; short_title: string; bill_id: string; held_date: string }[]
  console.log(`[syncBillHansard] Stages to check: ${rows.length}`)
  if (rows.length === 0) return

  const byDate = new Map<string, typeof rows>()
  for (const r of rows) byDate.set(r.held_date, [...(byDate.get(r.held_date) ?? []), r])

  let written = 0
  let errors = 0
  let consecutiveFailures = 0
  const tally = { held: 0, notHeld: 0, unknown: 0, passed: 0, negatived: 0, petition: 0, incomplete: 0 }

  for (const [date, stageRows] of byDate) {
    let components: HansardComponent[]
    try {
      components = await fetchReport(date)
      consecutiveFailures = 0
    } catch (err) {
      console.error(`[syncBillHansard] Error fetching ${date}:`, err)
      errors++
      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`[syncBillHansard] Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row, the API looks unavailable (${written} written first)`)
      }
      continue
    }

    const complete = reportIsComplete(components)
    if (!complete) tally.incomplete += stageRows.length
    for (const r of stageRows) {
      const reading = readStage(components, r.short_title, r.bill_id, r.stage, complete)
      if (reading.debated === true) tally.held++
      else if (reading.debated === false) tally.notHeld++
      else tally.unknown++
      if (reading.outcome === 'passed') tally.passed++
      if (reading.outcome === 'negatived') tally.negatived++
      if (reading.outcome === 'petition_of_concern') tally.petition++
      console.log(`[syncBillHansard] ${date} ${r.short_title} / ${r.stage}: debated=${reading.debated} outcome=${reading.outcome ?? 'none'} reportComplete=${complete}`)
      if (dryRun) continue
      await db.execute(sql`
        UPDATE bill_stages
        SET hansard_checked_at = NOW(),
            hansard_report_complete = ${complete},
            hansard_debated = ${reading.debated},
            hansard_outcome = ${reading.outcome},
            hansard_petition_date = COALESCE(hansard_petition_date, ${reading.outcome === 'petition_of_concern' ? r.held_date : null}::date),
            updated_at = NOW()
        WHERE document_id = ${r.document_id}
      `)
      written++
    }
  }

  console.log(`[syncBillHansard] Debated: ${tally.held}, not debated: ${tally.notHeld}, unknown: ${tally.unknown}, passed: ${tally.passed}, negatived: ${tally.negatived}, petition of concern: ${tally.petition}, awaiting full report: ${tally.incomplete}, errors: ${errors}`)
  if (dryRun) {
    console.log('[syncBillHansard] Dry run, no changes made.')
    return
  }
  if (errors > 0 && written === 0) {
    throw new Error(`[syncBillHansard] Nothing written with ${errors} error(s), possible API failure`)
  }
  const resolved = await refreshBillStageSummary(db)
  console.log(`[syncBillHansard] Done. Bill stage summaries refreshed: ${resolved}`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const db = drizzle(neon(url), { schema })
  await syncBillHansard(db, process.argv.includes('--all'), process.argv.includes('--dry-run'))
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bill Hansard sync failed:', err)
    process.exit(1)
  })
}
