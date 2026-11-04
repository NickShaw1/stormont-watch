import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { mandateIdForDate, EARLIEST_MANDATE_START } from '../lib/constants/mandates'

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, desc, lte, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { bills, billStages } from '../lib/db/schema'
import { fetchWithRetry } from './syncShared'

type Db = ReturnType<typeof drizzle<typeof schema>>

// Only the fields this script reads from GetPlenaryItemsPlenaryDate_JSON.
interface PlenaryItem {
  Title: string
  DocumentID: string
  PlenaryDate: string
  PlenaryType?: string
  Text?: string
}

type EventType =
  | 'stage'
  | 'extension'
  | 'extension_amendment'
  | 'petition_of_concern'
  | 'accelerated_passage'
  | 'closure_of_debate'
  | 'ad_hoc_committee'
  | 'standing_order_suspension'

const PROCEDURAL_EVENTS: { re: RegExp; eventType: EventType; stage: string | null }[] = [
  { re: /^extension of committee stage\b/i, eventType: 'extension', stage: 'Extension of Committee Stage' },
  { re: /^petition of concern\b/i, eventType: 'petition_of_concern', stage: 'Petition of Concern' },
  { re: /^accelerated passage\b/i, eventType: 'accelerated_passage', stage: 'Accelerated Passage' },
  { re: /^closure of debate\b/i, eventType: 'closure_of_debate', stage: null },
  { re: /^establishment of an ad hoc committee\b/i, eventType: 'ad_hoc_committee', stage: 'Establishment of an Ad Hoc Committee' },
  { re: /^suspension of standing order\b/i, eventType: 'standing_order_suspension', stage: null },
]

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'
const LOOKBACK_DAYS = 14

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPlenaryItems(startDate: string, endDate: string): Promise<PlenaryItem[]> {
  const url = `${BASE}/GetPlenaryItemsPlenaryDate_JSON?startDate=${startDate}&endDate=${endDate}`
  const res = await fetchWithRetry(url)
  if (!res) throw new Error(`[syncBills] Plenary API request failed for ${startDate}–${endDate}`)
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
  const res = await fetchWithRetry(url)
  if (!res) throw new Error(`[syncBills] MotionBill request failed for ${documentId}`)
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

const BILL_REF_RE = /NIA\s*(?:Bill\s*)?(\d+)\s*\/\s*(\d{2})-(\d{1,4})/i
const STRICT_BILL_REF_RE = /NIA\s*Bill\s*(\d+)\s*\/\s*(\d{2})-(\d{1,4})/i

function parseBillRef(text: string, strict = false): { key: string; newId: string } | null {
  const match = text.match(strict ? STRICT_BILL_REF_RE : BILL_REF_RE)
  if (!match) return null
  const num = parseInt(match[1], 10)
  const start = match[2]
  const end = match[3].length >= 2 ? match[3] : String(parseInt(start, 10) + 5)
  return {
    key: `${num}/${start}`,
    newId: `NIA Bill ${String(num).padStart(2, '0')}/${start}-${end}`,
  }
}

function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function shortTitleFromItem(title: string): string | null {
  const cleaned = title
    .replace(/^establishment of an ad hoc committee to consider the\s+/i, '')
    .replace(/\s*\(\s*NIA[^)]*\)?/i, '')
    .replace(/\s*\(Day\s+\d+\)\s*$/i, '')
    .trim()
  const idx = cleaned.lastIndexOf(': ')
  const name = (idx === -1 ? cleaned : cleaned.slice(idx + 2)).trim()
  return name || null
}

function classifyEvent(title: string, plenaryType?: string): { eventType: EventType; stage: string | null } {
  if (plenaryType === 'Motion Amendment' && /^extension of committee stage\b/i.test(title)) {
    return { eventType: 'extension_amendment', stage: 'Extension of Committee Stage' }
  }
  for (const p of PROCEDURAL_EVENTS) {
    if (p.re.test(title)) return { eventType: p.eventType, stage: p.stage }
  }
  return { eventType: 'stage', stage: null }
}

function isBillCandidate(item: PlenaryItem): boolean {
  if (/^legislative consent motion/i.test(item.Title)) return false
  if (STRICT_BILL_REF_RE.test(item.Title)) return true
  if (PROCEDURAL_EVENTS.some(p => p.re.test(item.Title))) return /\bBill\b/i.test(item.Title)
  return item.PlenaryType === 'Motion' && /\bStage:\s.*\bBill\b/i.test(item.Title)
}

export async function syncBills(db: Db, forceTitles = false, forceStartDate?: string, dryRun = false) {
  console.log('[syncBills] Starting...')

  // 1. Incremental sync. Anchored on the latest stage already held, not a scheduled future one,
  // with a lookback so late-published or re-dated items are picked up on a later night.
  const latestStage = await db.select({ plenaryDate: billStages.plenaryDate })
    .from(billStages)
    .where(lte(billStages.plenaryDate, new Date()))
    .orderBy(desc(billStages.plenaryDate))
    .limit(1)

  const syncFrom = forceStartDate
    ? new Date(forceStartDate)
    : latestStage.length > 0
      ? new Date(latestStage[0].plenaryDate.getTime() - LOOKBACK_DAYS * 86_400_000)
      : new Date(EARLIEST_MANDATE_START)

  // Start from the beginning of the month containing syncFrom
  syncFrom.setUTCDate(1)

  const end = new Date()
  end.setUTCMonth(end.getUTCMonth() + 2)
  end.setUTCDate(0) // last day of next month
  console.log(`[syncBills] Syncing from ${syncFrom.toISOString().slice(0, 10)}${forceStartDate ? ' (forced)' : ''}`)

  const allItems: PlenaryItem[] = []
  let current = new Date(Date.UTC(syncFrom.getUTCFullYear(), syncFrom.getUTCMonth(), 1))

  while (current <= end) {
    const monthStart = current.toISOString().slice(0, 10)
    const nextMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))
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

  const billItems = allItems.filter((item) => item.Title && isBillCandidate(item))

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

  const knownBills = await db.select({ billId: bills.billId, shortTitle: bills.shortTitle }).from(bills)
  const idByRef = new Map<string, string>()
  const idByTitle = new Map<string, string | null>()
  const rememberBill = (billId: string, shortTitle: string) => {
    const ref = parseBillRef(billId)
    if (ref) idByRef.set(ref.key, billId)
    const titleKey = normaliseTitle(shortTitle)
    const known = idByTitle.get(titleKey)
    idByTitle.set(titleKey, known !== undefined && known !== billId ? null : billId)
  }
  for (const b of knownBills) rememberBill(b.billId, b.shortTitle)

  for (const item of billItems) {
    try {
      const ref = parseBillRef(item.Title)
      const itemTitleName = shortTitleFromItem(item.Title)
      const { eventType, stage: eventStage } = classifyEvent(item.Title, item.PlenaryType)
      let billId =
        (ref && idByRef.get(ref.key)) ||
        (itemTitleName && idByTitle.get(normaliseTitle(itemTitleName))) ||
        null

      const existing = await db.select()
        .from(billStages)
        .where(eq(billStages.documentId, item.DocumentID))
        .limit(1)

      const dateStr = item.PlenaryDate.slice(0, 10)
      const plenaryDate = new Date(`${dateStr}T12:00:00.000Z`)

      // The Assembly diary sometimes re-dates an item after it's first synced (e.g. moves
      // from a scheduled date to the date it was actually heard). Re-fetch and update in that
      // case instead of leaving the row stuck on its original (now stale) date.
      if (existing.length > 0) {
        const existingDate = existing[0].plenaryDate.toISOString().slice(0, 10)
        if (existingDate === dateStr) {
          const itemTitle = extractItemTitle(item.Title)
          if (existing[0].rawTitle == null || existing[0].eventType !== eventType || (existing[0].itemTitle ?? null) !== itemTitle) {
            if (!dryRun) {
              await db.update(billStages)
                .set({
                  rawTitle: item.Title,
                  itemTitle,
                  ...(eventStage ? { stage: eventStage } : {}),
                  eventType,
                  itemText: eventType === 'stage' ? null : (item.Text?.trim() || null),
                  updatedAt: new Date(),
                })
                .where(eq(billStages.documentId, item.DocumentID))
            }
            countSkip('raw title backfilled')
          } else {
            countSkip('already exists')
          }
          continue
        }
        console.log(`[syncBills] Date changed for documentId ${item.DocumentID}: ${existingDate} → ${dateStr} — updating`)
      }

      let billData: Awaited<ReturnType<typeof fetchMotionBill>> = null
      if (eventType === 'stage' || !billId) {
        await sleep(200)
        billData = await fetchMotionBill(item.DocumentID)
      }

      let createdBill = false
      if (!billId && billData?.ReferenceNumber) {
        const dataRef = parseBillRef(billData.ReferenceNumber)
        if (dataRef) billId = idByRef.get(dataRef.key) ?? null
      }

      if (!billId) {
        const newRef = parseBillRef(item.Title, true) ?? (billData?.ReferenceNumber ? parseBillRef(billData.ReferenceNumber, true) : null)
        const newTitle = billData?.ShortTitle?.trim() ?? itemTitleName
        if (!newRef || !newTitle || eventType !== 'stage') {
          console.warn(`[syncBills] Unresolved bill for documentId ${item.DocumentID}: ${item.Title}`)
          countSkip(eventType === 'stage' ? 'no bill id' : 'unresolved procedural')
          continue
        }
        billId = newRef.newId
        createdBill = true
      }

      const stage = eventStage ?? extractStage(item.Title) ?? billData?.Stage ?? 'Unknown'

      if (dryRun) {
        console.log(`[syncBills][dry-run] ${item.DocumentID} ${dateStr} ${billId} [${eventType}] ${stage}${createdBill ? ' (new bill)' : ''}`)
        processed++
        continue
      }

      if (eventType === 'stage') {
        const isAccelerated = billData?.IsAcceleratedPassage === 'true'
        const shortTitle = billData?.ShortTitle?.trim() ?? itemTitleName ?? billId
        const titleSet = forceTitles ? {
          shortTitle,
          longTitle: billData?.LongTitle?.trim() ?? null,
          billType: billData?.BillType?.trim() ?? null,
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
          shortTitle,
          longTitle: billData?.LongTitle?.trim() ?? null,
          billType: billData?.BillType?.trim() ?? null,
          isAccelerated,
          currentStage: stage,
          latestDate: plenaryDate,
          mandate: mandateIdForDate(plenaryDate),
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: bills.billId,
          set: titleSet,
        })
        rememberBill(billId, shortTitle)
      }

      const rowFields = {
        stage,
        plenaryDate,
        mandate: mandateIdForDate(plenaryDate),
        itemTitle: extractItemTitle(item.Title),
        eventType,
        rawTitle: item.Title,
        itemText: eventType === 'stage' ? null : (item.Text?.trim() || null),
        updatedAt: new Date(),
      }

      await db.insert(billStages).values({
        documentId: item.DocumentID,
        billId,
        hasDivision: false,
        divisionId: null,
        ...rowFields,
      }).onConflictDoUpdate({
        target: billStages.documentId,
        // hasDivision/divisionId are left alone — the backfill step below re-derives them
        // from the divisions table regardless, so don't risk clobbering an existing link.
        set: rowFields,
      })

      processed++
      console.log(`[syncBills] Processed: ${billId} — ${stage}`)
    } catch (err) {
      console.error(`[syncBills] Error processing ${item.DocumentID}:`, err)
      errors++
    }
  }

  if (dryRun) {
    const skipBreakdown = Object.entries(skipReasons).map(([r, n]) => `${r}: ${n}`).join(', ')
    console.log(`[syncBills][dry-run] Would write: ${processed}, Skipped: ${skipped}${skipBreakdown ? ` (${skipBreakdown})` : ''}, Errors: ${errors}. No changes made.`)
    return
  }

  // 4. Single SQL query to find highest-priority stage per bill
  const stageUpdates = await db.execute(sql`
    SELECT DISTINCT ON (bill_id)
      bill_id,
      stage,
      plenary_date
    FROM bill_stages
    WHERE event_type = 'stage'
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

  const latestRows = await db.execute(sql`
    SELECT bill_id, MAX(plenary_date) AS latest_date FROM bill_stages GROUP BY bill_id
  `)
  const latestByBill = new Map(
    (latestRows.rows as { bill_id: string; latest_date: string }[]).map(r => [r.bill_id, new Date(r.latest_date)])
  )

  const existingStages = await db.select({ billId: bills.billId, currentStage: bills.currentStage }).from(bills)
  const existingStageMap = new Map(existingStages.map(b => [b.billId, b.currentStage]))

  for (const row of stageUpdates.rows as { bill_id: string; stage: string; plenary_date: string }[]) {
    if (existingStageMap.get(row.bill_id) !== row.stage) {
      console.log(`[syncBills] Stage updated: ${row.bill_id} → ${row.stage}`)
    }
    await db.update(bills)
      .set({
        currentStage: row.stage,
        latestDate: latestByBill.get(row.bill_id) ?? new Date(row.plenary_date),
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

  // Surface a total failure: errors occurred and nothing was written. (processed === 0 with
  // zero errors is normal — every stage already existed — so don't throw in that case.)
  if (processed === 0 && errors > 0) {
    throw new Error(`[syncBills] Zero stages written with ${errors} error(s) — possible API/data failure`)
  }
}

// Standalone entrypoint
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const forceTitles = process.argv.includes('--force-titles')
  const dryRun = process.argv.includes('--dry-run')
  const fromArg = process.argv.find(a => a.startsWith('--from='))?.slice('--from='.length)
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  await syncBills(db, forceTitles, fromArg, dryRun)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bills sync failed:', err)
    process.exit(1)
  })
}
