import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'

const BASE_URL = 'http://data.niassembly.gov.uk'
const CURRENT_MANDATE = '2022-2027'
const MANDATE_CUTOFF = '2022-05-01'

type Db = ReturnType<typeof drizzle<typeof schema>>

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRESIDING_ROLES = new Set(['Speaker', 'Principal Deputy Speaker', 'Deputy Speaker'])

export async function syncHansardContributions(db: Db) {
  console.log('[syncHansardContributions] Starting sync...')

  try {
    // Step 1 — Fetch all Hansard reports
    console.log('[syncHansardContributions] Fetching all Hansard reports...')
    const reportsRes = await fetch(`${BASE_URL}/hansard.asmx/GetAllHansardReports_JSON`)
    if (!reportsRes.ok) {
      console.warn(`[syncHansardContributions] API error ${reportsRes.status} fetching reports — aborting`)
      return
    }
    const reportsData = await reportsRes.json()
    const allReports: any[] = reportsData?.AllHansardComponentsList?.HansardComponent ?? []

    if (allReports.length === 0) {
      console.warn('[syncHansardContributions] API returned zero reports — aborting')
      return
    }
    if (allReports.length < 500) {
      console.warn(`[syncHansardContributions] Only ${allReports.length} reports returned (expected 500+) — partial response, aborting`)
      return
    }
    console.log(`[syncHansardContributions] Fetched ${allReports.length} total reports`)

    // Step 2 — Determine which reports to process
    // For each report, we skip it only if it already has rows for ALL eligible members on that date.
    // We do this by querying the distinct (report_doc_id, person_id) pairs already written,
    // then comparing against eligible members per report at processing time.
    const writtenRows = await db
      .select({
        reportDocId: schema.hansardContributions.reportDocId,
        personId: schema.hansardContributions.personId,
      })
      .from(schema.hansardContributions)

    // Build a map: reportDocId -> Set of personIds already written
    const writtenByReport = new Map<string, Set<string>>()
    for (const row of writtenRows) {
      if (!writtenByReport.has(row.reportDocId)) writtenByReport.set(row.reportDocId, new Set())
      writtenByReport.get(row.reportDocId)!.add(row.personId)
    }

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
    const allMembers = await db
      .select({
        personId: schema.members.personId,
        mandateStart: schema.members.mandateStart,
        mandateEnd: schema.members.mandateEnd,
        assemblyRole: schema.members.assemblyRole,
      })
      .from(schema.members)

    console.log(`[syncHansardContributions] Loaded ${allMembers.length} members from database`)

    // Step 4 — Process each report
    let rowsWritten = 0
    let membersSkipped = 0
    let reportsSkipped = 0
    let reportsProcessed = 0

    for (const report of reportsToConsider) {
      const reportDocId = String(report?.ReportDocId ?? '')
      const plenaryDate = String(report?.PlenaryDate ?? '').slice(0, 10)

      if (!reportDocId || !plenaryDate) {
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
        if (m.assemblyRole && PRESIDING_ROLES.has(m.assemblyRole)) return false
        return true
      })

      // Skip this report only if all eligible members already have rows written for it
      const alreadyWritten = writtenByReport.get(reportDocId)
      if (alreadyWritten && eligibleMembers.every(m => alreadyWritten.has(m.personId))) {
        reportsSkipped++
        continue
      }

      for (const member of eligibleMembers) {
        // Skip this member+report combo if already written
        if (alreadyWritten?.has(member.personId)) continue

        try {
          const res = await fetch(
            `${BASE_URL}/hansard.asmx/GetHansardComponentsByReportIdAndPersonId_JSON?reportId=${reportDocId}&personId=${member.personId}`
          )
          await new Promise(resolve => setTimeout(resolve, 100))

          if (!res.ok) {
            console.warn(`[syncHansardContributions] API error ${res.status} for member ${member.personId}, report ${reportDocId} — skipping`)
            membersSkipped++
            continue
          }

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
                mandate: CURRENT_MANDATE,
              })
              .onConflictDoNothing()
            rowsWritten++
          }
        } catch (err) {
          console.warn(`[syncHansardContributions] Failed for member ${member.personId}, report ${reportDocId}:`, err)
          membersSkipped++
        }
      }

      reportsProcessed++
      if (reportsProcessed % 10 === 0) {
        console.log(`[syncHansardContributions] Progress: ${reportsProcessed}/${reportsToConsider.length} reports processed`)
      }
    }

    console.log(`[syncHansardContributions] Complete — ${rowsWritten} rows written, ${membersSkipped} members skipped, ${reportsProcessed} reports processed`)
  } catch (err) {
    console.error('[syncHansardContributions] Sync error:', err)
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  const db = drizzle(sql, { schema })

  syncHansardContributions(db)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1) })
}
