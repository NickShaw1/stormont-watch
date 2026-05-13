import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const CURRENT_MANDATE = '2022-2027'

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, desc, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { bills, billStages } from '../lib/db/schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPlenaryItems(startDate: string, endDate: string) {
  const url = `${BASE}/GetPlenaryItemsPlenaryDate_JSON?startDate=${startDate}&endDate=${endDate}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`[syncBills] Plenary API returned ${res.status} for ${startDate}–${endDate}`)
  const data = await res.json()
  const items = data?.PlenaryList?.Plenary ?? []
  if (!Array.isArray(items)) {
    console.warn(`[syncBills] Unexpected plenary response shape for ${startDate}–${endDate}: expected Array, got ${typeof items === 'object' ? JSON.stringify(Object.keys(items as object)) : typeof items}`)
    return []
  }
  return items
}

async function fetchMotionBill(documentId: string) {
  const url = `${BASE}/GetMotionBill_JSON?documentId=${documentId}`
  const res = await fetch(url)
  const data = await res.json()
  return data?.MotionBill?.Bill ?? null
}

function extractStage(title: string): string | null {
  const match = title.match(/^([^:(\[]+)/i)
  if (!match) return null
  let stage = match[1].trim()
  // Strip clause, schedule, amendment and long title prefixes
  stage = stage.replace(/^(Clauses?\s+[\d\s,toand]+|Schedules?\s+[\d\s,toand]+|Schedule|Amendment\s+\d+|Long Title)\s*-?\s*/i, '')
  return stage.trim() || null
}



function extractItemTitle(title: string): string | null {
  // Strip from the first ' - <stage keyword>' or ':' onwards
  const stripped = title
    .replace(/\s*-\s*(?:consideration|further|final|second|committee)\b.*$/i, '')
    .replace(/:.*$/, '')
    .trim()
  // Only return if what remains is a recognised sub-item prefix
  if (/^(?:Clauses?\s+[\d\s,toand]+|Schedules?\s+[\d\s,toand]+|Schedule|Amendment\s+\d+|Long Title)$/i.test(stripped)) {
    return stripped
  }
  return null
}

function extractBillId(title: string): string | null {
  const match = title.match(/NIA\s+Bill\s+(\d+\/\d{2}-\d{2,4})/i)
  return match ? `NIA Bill ${match[1]}` : null
}

export async function syncBills(db: Db, forceTitles = false, forceStartDate?: string) {
  console.log('[syncBills] Starting...')

  // 1. Incremental sync — only fetch months we haven't seen yet
  const latestStage = await db.select({ plenaryDate: billStages.plenaryDate })
    .from(billStages)
    .orderBy(desc(billStages.plenaryDate))
    .limit(1)

  const syncFrom = forceStartDate
    ? new Date(forceStartDate)
    : latestStage.length > 0
      ? new Date(latestStage[0].plenaryDate)
      : new Date('2022-05-01')

  // Start from the beginning of the month containing syncFrom
  syncFrom.setDate(1)

  const end = new Date()
  end.setMonth(end.getMonth() + 2)
  end.setDate(0) // last day of next month
  console.log(`[syncBills] Syncing from ${syncFrom.toISOString().slice(0, 10)}${forceStartDate ? ' (forced)' : ''}`)

  const allItems: any[] = []
  let current = new Date(syncFrom.getFullYear(), syncFrom.getMonth(), 1)

  while (current <= end) {
    const monthStart = current.toISOString().slice(0, 10)
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10)
    console.log(`[syncBills] Fetching plenary items ${monthStart} to ${monthEnd}`)
    const items = await fetchPlenaryItems(monthStart, monthEnd)
    allItems.push(...items)
    await sleep(300)
    current = nextMonth
  }

  console.log(`[syncBills] Total plenary items fetched: ${allItems.length}`)

  // 2. Minimum record guard
  if (allItems.length === 0) {
    console.warn(`[syncBills] API returned zero plenary items — aborting to avoid data loss`)
    return
  }

  const billItems = allItems.filter((item: any) =>
    item.Title && /NIA\s+Bill/i.test(item.Title)
  )

  console.log(`[syncBills] Bill-related items found: ${billItems.length}`)

  if (billItems.length === 0) {
    console.log('[syncBills] No new bill-related plenary items found')
    return
  }

  let processed = 0
  let skipped = 0
  let errors = 0
  const skipReasons: Record<string, number> = {}

  function countSkip(reason: string) {
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1
    skipped++
  }

  for (const item of billItems) {
    try {
      const billId = extractBillId(item.Title)
      if (!billId) {
        countSkip('no bill id')
        continue
      }

      const existing = await db.select()
        .from(billStages)
        .where(eq(billStages.documentId, item.DocumentID))
        .limit(1)

      if (existing.length > 0) {
        countSkip('already exists')
        continue
      }

      await sleep(200)
      const billData = await fetchMotionBill(item.DocumentID)

      if (!billData) {
        console.warn(`[syncBills] No bill data for documentId ${item.DocumentID}`)
        countSkip('no bill data')
        continue
      }

      const stage = extractStage(item.Title) ?? billData.Stage ?? 'Unknown'
      const dateStr = item.PlenaryDate.slice(0, 10)
      const plenaryDate = new Date(`${dateStr}T12:00:00.000Z`)

      // 7. --force-titles: overwrite title fields when explicitly requested
      const isAccelerated = billData.IsAcceleratedPassage === 'true'
      const titleSet = forceTitles ? {
        shortTitle: billData.ShortTitle?.trim() ?? billId,
        longTitle: billData.LongTitle?.trim() ?? null,
        billType: billData.BillType?.trim() ?? null,
        isAccelerated,
        currentStage: stage,
        latestDate: plenaryDate,
        updatedAt: new Date(),
      } : {
        // Title fields written on INSERT only — never clobbered by a later lower-priority item
        isAccelerated,
        currentStage: stage,
        latestDate: plenaryDate,
        updatedAt: new Date(),
      }

      await db.insert(bills).values({
        billId,
        shortTitle: billData.ShortTitle?.trim() ?? billId,
        longTitle: billData.LongTitle?.trim() ?? null,
        billType: billData.BillType?.trim() ?? null,
        isAccelerated,
        currentStage: stage,
        latestDate: plenaryDate,
        mandate: CURRENT_MANDATE,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: bills.billId,
        set: titleSet,
      })

      await db.insert(billStages).values({
        documentId: item.DocumentID,
        billId,
        stage,
        plenaryDate,
        hasDivision: false,
        divisionId: null,
        mandate: CURRENT_MANDATE,
        itemTitle: extractItemTitle(item.Title),
        updatedAt: new Date(),
      }).onConflictDoNothing()

      processed++
      console.log(`[syncBills] Processed: ${billId} — ${stage}`)
    } catch (err) {
      console.error(`[syncBills] Error processing ${item.DocumentID}:`, err)
      errors++
    }
  }

  // 4. Single SQL query to find highest-priority stage per bill
  const stageUpdates = await db.execute(sql`
    SELECT DISTINCT ON (bill_id)
      bill_id,
      stage,
      plenary_date
    FROM bill_stages
    ORDER BY bill_id,
      CASE
        WHEN LOWER(stage) = 'final stage'                      THEN 10
        WHEN LOWER(stage) LIKE '%final stage%'                 THEN 9
        WHEN LOWER(stage) = 'further consideration stage'      THEN 8
        WHEN LOWER(stage) LIKE '%further consideration stage%' THEN 7
        WHEN LOWER(stage) = 'consideration stage'              THEN 6
        WHEN LOWER(stage) LIKE '%consideration stage%'         THEN 5
        WHEN LOWER(stage) = 'committee stage'                  THEN 4
        WHEN LOWER(stage) LIKE '%committee stage%'             THEN 3
        WHEN LOWER(stage) = 'second stage'                     THEN 2
        WHEN LOWER(stage) LIKE '%second stage%'                THEN 1
        ELSE 0
      END DESC,
      plenary_date DESC
  `)

  const existingStages = await db.select({ billId: bills.billId, currentStage: bills.currentStage }).from(bills)
  const existingStageMap = new Map(existingStages.map(b => [b.billId, b.currentStage]))

  for (const row of stageUpdates.rows as { bill_id: string; stage: string; plenary_date: string }[]) {
    if (existingStageMap.get(row.bill_id) !== row.stage) {
      console.log(`[syncBills] Stage updated: ${row.bill_id} → ${row.stage}`)
    }
    await db.update(bills)
      .set({
        currentStage: row.stage,
        latestDate: new Date(row.plenary_date),
        updatedAt: new Date(),
      })
      .where(eq(bills.billId, row.bill_id))
  }

  const backfillResult = await db.execute(sql`
    UPDATE bill_stages
    SET has_division = true,
        division_id = document_id,
        updated_at = NOW()
    WHERE has_division = false
      AND document_id IN (
        SELECT document_id FROM divisions
      )
  `)
  console.log(`[syncBills] Backfill complete — ${backfillResult.rowCount ?? 0} bill stage(s) linked to divisions`)

  // 6. Improved summary logging
  const skipBreakdown = Object.entries(skipReasons).map(([r, n]) => `${r}: ${n}`).join(', ')
  console.log(`[syncBills] Done. New stages: ${processed}, Skipped: ${skipped}${skipBreakdown ? ` (${skipBreakdown})` : ''}, Errors: ${errors}, Bills stage-resolved: ${stageUpdates.rows.length}`)
}

// Standalone entrypoint
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const forceTitles = process.argv.includes('--force-titles')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  await syncBills(db, forceTitles)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bills sync failed:', err)
    process.exit(1)
  })
}
