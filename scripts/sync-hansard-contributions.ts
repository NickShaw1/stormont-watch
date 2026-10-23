import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE_URL = 'http://data.niassembly.gov.uk'
import { mandateIdForDate, EARLIEST_MANDATE_START } from '../lib/constants/mandates'
import { fetchWithRetry } from './syncShared'

const MANDATE_CUTOFF = EARLIEST_MANDATE_START

type Db = ReturnType<typeof drizzle<typeof schema>>

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_CONSECUTIVE_FAILURES = 5
const PRESIDING_ROLES = new Set(['Speaker', 'Principal Deputy Speaker', 'Deputy Speaker'])

function wasPresidingOn(m: { assemblyRole: string | null; assemblyRoleStart: unknown; assemblyRoleEnd: unknown }, date: string): boolean {
  if (!m.assemblyRole || !PRESIDING_ROLES.has(m.assemblyRole)) return false
  const start = m.assemblyRoleStart ? new Date(m.assemblyRoleStart as string).toISOString().slice(0, 10) : null
  const end = m.assemblyRoleEnd ? new Date(m.assemblyRoleEnd as string).toISOString().slice(0, 10) : null
  if (start && start > date) return false
  if (end && end < date) return false
  return true
}

// catchUpPersonIds re-checks already-processed reports for just those members (used once
// to recover contributions skipped while a finished presiding role was still treated as active).
export async function syncHansardContributions(db: Db, options: { catchUpPersonIds?: string[] } = {}) {
  const catchUp = options.catchUpPersonIds?.length ? new Set(options.catchUpPersonIds) : null
  console.log('[syncHansardContributions] Starting sync...')

  try {
    // Step 1 — Fetch all Hansard reports
    console.log('[syncHansardContributions] Fetching all Hansard reports...')
    const reportsRes = await fetchWithRetry(`${BASE_URL}/hansard.asmx/GetAllHansardReports_JSON`)
    if (!reportsRes) {
      throw new Error('[syncHansardContributions] API request for reports failed after retries')
    }
    const reportsData = await reportsRes.json()
    const allReports: any[] = reportsData?.AllHansardComponentsList?.HansardComponent ?? []

    if (allReports.length === 0) {
      throw new Error('[syncHansardContributions] API returned zero reports')
    }
    if (allReports.length < 500) {
      throw new Error(`[syncHansardContributions] Only ${allReports.length} reports returned (expected 500+) — partial response`)
    }
    console.log(`[syncHansardContributions] Fetched ${allReports.length} total reports`)

    // Step 2 — Load fully processed report IDs
    const processedReportRows = await db
      .select({ reportDocId: schema.hansardReports.reportDocId })
      .from(schema.hansardReports)
      .where(eq(schema.hansardReports.fullyProcessed, true))

    const processedReports = new Set(processedReportRows.map(r => r.reportDocId))

    // Filter to mandate cutoff and sort ascending
    const reportsToConsider = allReports
      .filter((r: any) => {
        const date = String(r?.PlenaryDate ?? '').slice(0, 10)
        return date >= MANDATE_CUTOFF
      })
      .sort((a: any, b: any) => {
        const dateA = String(a?.PlenaryDate ?? '').slice(0, 10)
        const dateB = String(b?.PlenaryDate ?? '').slice(0, 10)
        return dateA.localeCompare(dateB)
      })

    console.log(`[syncHansardContributions] ${reportsToConsider.length} reports within mandate cutoff to evaluate`)

    // Step 3 — Fetch all members
    const allMembers = (await db
      .select({
        personId: schema.members.personId,
        mandateStart: schema.members.mandateStart,
        mandateEnd: schema.members.mandateEnd,
        assemblyRole: schema.members.assemblyRole,
        assemblyRoleStart: schema.members.assemblyRoleStart,
        assemblyRoleEnd: schema.members.assemblyRoleEnd,
        confirmedSilent: schema.members.confirmedSilent,
      })
      .from(schema.members))
      .filter(m =>
        !m.confirmedSilent &&
        (!catchUp || catchUp.has(m.personId)) &&
        !(m.mandateEnd && String(m.mandateEnd).slice(0, 10) < MANDATE_CUTOFF)
      )

    console.log(`[syncHansardContributions] Loaded ${allMembers.length} members from database`)

    // Step 4 — Process each report
    let rowsWritten = 0
    let membersSkipped = 0
    let reportsSkipped = 0
    let reportsProcessed = 0
    let consecutiveFailures = 0

    for (const report of reportsToConsider) {
      const reportDocId = String(report?.ReportDocId ?? '')
      const plenaryDate = String(report?.PlenaryDate ?? '').slice(0, 10)

      if (!reportDocId || !plenaryDate) {
        reportsSkipped++
        continue
      }

      if (processedReports.has(reportDocId) && !catchUp) {
        reportsSkipped++
        continue
      }

      // Determine eligible members for this plenary date
      const eligibleMembers = allMembers.filter(m => {
        if (!m.mandateStart) return false
        const start = String(m.mandateStart).slice(0, 10)
        const end = m.mandateEnd ? String(m.mandateEnd).slice(0, 10) : null
        if (start > plenaryDate) return false
        if (end && end < plenaryDate) return false
        if (wasPresidingOn(m, plenaryDate)) return false
        return true
      })

      let reportErrors = 0

      for (const member of eligibleMembers) {
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`[syncHansardContributions] Stopped after ${consecutiveFailures} consecutive API failures — API appears down; will retry next run`)
        }

        try {
          const res = await fetchWithRetry(
            `${BASE_URL}/hansard.asmx/GetHansardComponentsByReportIdAndPersonId_JSON?reportId=${reportDocId}&personId=${member.personId}`
          )
          await new Promise(resolve => setTimeout(resolve, 100))

          if (!res) {
            console.warn(`[syncHansardContributions] API request failed for member ${member.personId}, report ${reportDocId} — will retry next run`)
            membersSkipped++
            reportErrors++
            consecutiveFailures++
            continue
          }
          consecutiveFailures = 0

          const data = await res.json()
          const raw: any[] = data?.AllHansardComponentsList?.HansardComponent ?? []
          const components = Array.isArray(raw) ? raw : [raw]

          if (components.length === 0) continue

          // Filter to speaker contributions only
          const speakerComponents = components.filter(
            (c: any) => c?.ComponentType === 'Speaker (MlaName)'
          )
          if (speakerComponents.length === 0) continue

          // Group by debate title (ParentComponentText), deduplicating by ComponentText within each
          const debateMap = new Map<string, Set<string>>()
          for (const c of speakerComponents) {
            const debateTitle = String(c?.ParentComponentText ?? '').trim()
            const speechText = String(c?.ComponentText ?? '').trim()
            if (!debateTitle) continue
            if (!debateMap.has(debateTitle)) debateMap.set(debateTitle, new Set())
            if (speechText) debateMap.get(debateTitle)!.add(speechText)
          }

          // Upsert one row per debate title that has at least one deduplicated entry
          for (const [debateTitle, speeches] of debateMap.entries()) {
            if (speeches.size === 0) continue
            await db
              .insert(schema.hansardContributions)
              .values({
                personId: member.personId,
                reportDocId,
                plenaryDate,
                debateTitle,
                mandate: mandateIdForDate(plenaryDate),
              })
              .onConflictDoNothing()
            rowsWritten++
          }
        } catch (err) {
          console.warn(`[syncHansardContributions] Failed for member ${member.personId}, report ${reportDocId}:`, err)
          membersSkipped++
          reportErrors++
          consecutiveFailures++
        }
      }

      if (reportErrors === 0) {
        await db
          .update(schema.hansardReports)
          .set({ fullyProcessed: true })
          .where(eq(schema.hansardReports.reportDocId, reportDocId))
      }

      reportsProcessed++
      if (reportsProcessed % 10 === 0) {
        console.log(`[syncHansardContributions] Progress: ${reportsProcessed}/${reportsToConsider.length} reports processed`)
      }
    }

    console.log(`[syncHansardContributions] Complete — ${rowsWritten} rows written, ${membersSkipped} members skipped, ${reportsProcessed} reports processed, ${reportsSkipped} reports skipped`)
  } catch (err) {
    console.error('[syncHansardContributions] Sync error:', err)
    throw err // surface to runSync so the summary shows ✗, not a false ✓
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  const db = drizzle(sql, { schema })

  const catchUpArg = process.argv.find(a => a.startsWith('--catch-up='))
  syncHansardContributions(db, { catchUpPersonIds: catchUpArg ? catchUpArg.split('=')[1].split(',').filter(Boolean) : undefined })
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1) })
}
