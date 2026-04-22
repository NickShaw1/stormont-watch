import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, isNull, like, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
const CURRENT_MANDATE = '2022-2027'

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  const sqlClient = neon(url)
  const db = drizzle(sqlClient, { schema })

  console.log('[backfill] Fetching unprocessed motion amendment divisions...')

  const amendments = await db
    .select({
      documentId: schema.divisions.documentId,
      title: schema.divisions.title,
      divisionDate: schema.divisions.divisionDate,
    })
    .from(schema.divisions)
    .where(
      and(
        like(schema.divisions.subject, '-%'),
        eq(schema.divisions.mandate, CURRENT_MANDATE),
        isNull(schema.divisions.parentMotionText),
      )
    )
    .orderBy(schema.divisions.divisionDate)

  // Further filter in JS to subject LIKE '-#%' (subject starts with '-' followed by a digit)
  // The DB LIKE '-#%' pattern isn't directly expressible in Drizzle without raw SQL,
  // so filter the '-\d' pattern here
  const motionAmendments = amendments.filter(d => {
    const subjectMatch = true // already filtered to LIKE '-%' via DB; re-check subject not available here
    // We filter on title instead — strip " - Amendment N" and check it differs from title
    const title = d.title ?? ''
    return /\s*-\s*Amendment\s+\d+\s*$/i.test(title)
  })

  console.log(`[backfill] Found ${motionAmendments.length} unprocessed motion amendment divisions`)

  // Group by date
  const byDate = new Map<string, typeof motionAmendments>()
  for (const div of motionAmendments) {
    const dateStr = new Date(div.divisionDate).toISOString().slice(0, 10)
    if (!byDate.has(dateStr)) byDate.set(dateStr, [])
    byDate.get(dateStr)!.push(div)
  }

  console.log(`[backfill] ${byDate.size} unique sitting dates to fetch`)

  let totalProcessed = 0
  let totalMatched = 0
  let totalUnmatched = 0
  const unmatchedIds: string[] = []

  for (const [dateStr, divs] of byDate) {
    console.log(`[backfill] Fetching plenary items for ${dateStr} (${divs.length} amendment(s))...`)

    let itemList: any[] = []
    try {
      const res = await fetch(
        `${BASE}/plenary.asmx/GetPlenaryItemsPlenaryDate_JSON?startDate=${dateStr}&endDate=${dateStr}`
      )
      if (!res.ok) {
        console.warn(`[backfill] API error ${res.status} for ${dateStr} — skipping`)
      } else {
        const data = await res.json()
        const raw = data?.PlenaryList?.Plenary ?? []
        itemList = Array.isArray(raw) ? raw : [raw]
        // Filter to PlenaryTypeID === '1' (plain motions)
        itemList = itemList.filter((i: any) => str(i?.PlenaryTypeID) === '1')
      }
    } catch (err) {
      console.warn(`[backfill] Fetch error for ${dateStr}:`, err)
    }

    for (const div of divs) {
      const title = div.title ?? ''
      const parentTitle = title.replace(/\s*-\s*Amendment\s+\d+\s*$/i, '').trim()

      const parent = itemList.find((i: any) =>
        str(i?.Title).trim().toLowerCase() === parentTitle.toLowerCase()
      )

      if (parent) {
        const parentText: string | null = str(parent?.Text) || null
        await db
          .update(schema.divisions)
          .set({ isMotionAmendment: true, parentMotionText: parentText, updatedAt: new Date() })
          .where(eq(schema.divisions.documentId, div.documentId))
        totalMatched++
        console.log(`[backfill] ✓ ${div.documentId} — matched parent for "${parentTitle}"`)
      } else {
        await db
          .update(schema.divisions)
          .set({ isMotionAmendment: true, updatedAt: new Date() })
          .where(eq(schema.divisions.documentId, div.documentId))
        totalUnmatched++
        unmatchedIds.push(div.documentId)
        console.warn(`[backfill] ✗ ${div.documentId} — no parent found for "${parentTitle}" on ${dateStr}`)
      }
      totalProcessed++
    }

    await sleep(300)
  }

  // Second pass: ensure all subject LIKE '-#%' rows have is_motion_amendment = true,
  // including any that were matched in a previous run (parent_motion_text already set)
  console.log('[backfill] Second pass — marking all motion amendment divisions...')
  await db.execute(sql`
    UPDATE divisions
    SET is_motion_amendment = true, updated_at = NOW()
    WHERE mandate = ${CURRENT_MANDATE}
      AND title ~ E'\\\\s*-\\\\s*Amendment\\\\s+\\\\d+\\\\s*$'
      AND (is_motion_amendment IS NULL OR is_motion_amendment = false)
  `)

  console.log('\n[backfill] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`[backfill] Complete`)
  console.log(`[backfill] Total processed: ${totalProcessed}`)
  console.log(`[backfill] Matched:         ${totalMatched}`)
  console.log(`[backfill] Unmatched:       ${totalUnmatched}`)
  if (unmatchedIds.length > 0) {
    console.log(`[backfill] Unmatched IDs:   ${unmatchedIds.join(', ')}`)
  }
  console.log('[backfill] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

if (require.main === module) {
  main().catch(err => {
    console.error('[backfill] Failed:', err)
    process.exit(1)
  })
}
