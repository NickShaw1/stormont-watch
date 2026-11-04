import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { bills, billCommitteeItems } from '../lib/db/schema'
import { mandateIdForDate, EARLIEST_MANDATE_START } from '../lib/constants/mandates'
import { fetchWithRetry, MAX_CONSECUTIVE_FAILURES } from './syncShared'

type Db = ReturnType<typeof drizzle<typeof schema>>

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'
const DAY_MS = 86_400_000
const WINDOW_BEHIND_DAYS = 14
const WINDOW_AHEAD_DAYS = 14
const CHUNK = 200
const STALE_LIMIT_SHARE = 0.3
const WINDOW_PAD_MS = 90 * DAY_MS

interface CommitteeItem {
  eventId: string
  itemId: string
  itemOrder: number
  committeeName: string
  meetingDate: string
  itemType: string
  itemTitle: string
  session: string | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

function field(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? decodeXml(m[1]).trim() : null
}

const TITLE_ALIASES: [alias: string, canonical: string][] = [
  [
    'Inquiry (Mother and Baby Institutions, Magdalane Laundries and Workhouses) and Redress Scheme Bill',
    'Inquiry (Mother and Baby Institutions, Magdalene Laundries and Workhouses) and Redress Scheme Bill',
  ],
  ['RHI (Closure of Domestic Scheme) Bill', 'RHI (Closure of Non-Domestic Scheme) Bill'],
  ['School Inspections Bill', 'Education Inspections Bill'],
  ['Committee Bill to allow all pupils the choice to wear trousers', 'School Uniforms (Trousers) Bill'],
  ['School Uniform Bill', 'School Uniforms (Trousers) Bill'],
  ['Water, Flooding and Drainage Bill', 'Water, Sustainable Drainage and Flood Management Bill'],
]

function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/bill(20\d{2})?$/, '')
}

const ALIAS_TARGET = new Map(TITLE_ALIASES.map(([alias, canonical]) => [normaliseTitle(alias), normaliseTitle(canonical)]))

function billTitleFromItem(itemTitle: string): string {
  return itemTitle
    .split(/\s+[-–—]\s*|:\s+/)[0]
    .replace(/\s*\([^()]*session\)\s*$/i, '')
    .replace(/^the\s+/i, '')
    .trim()
}

async function fetchDay(date: string): Promise<CommitteeItem[]> {
  const res = await fetchWithRetry(`${BASE}/GetCommitteeAgendaItemsMeetingDate?meetingDate=${date}`)
  if (!res) throw new Error(`[syncBillCommitteeItems] API request failed for ${date}`)
  const xml = await res.text()
  const items: CommitteeItem[] = []
  for (const m of xml.matchAll(/<Committee>([\s\S]*?)<\/Committee>/g)) {
    const block = m[1]
    const itemType = field(block, 'ItemType')
    const itemTitle = field(block, 'ItemOfBusiness')
    const eventId = field(block, 'EventId')
    const itemId = field(block, 'ItemId')
    const meetingDate = field(block, 'MeetingDate')?.slice(0, 10)
    if (!itemType || !itemTitle || !eventId || !itemId || !meetingDate) continue
    if (!/^Primary Legislation/i.test(itemType)) continue
    items.push({
      eventId,
      itemId,
      itemOrder: Number(field(block, 'ItemOrder') ?? 0),
      committeeName: field(block, 'CommitteeName') ?? '',
      meetingDate,
      itemType,
      itemTitle,
      session: field(block, 'Session'),
    })
  }
  return items
}

export async function syncBillCommitteeItems(db: Db, fromDate?: string, toDate?: string, dryRun = false): Promise<string | undefined> {
  console.log('[syncBillCommitteeItems] Starting...')

  const today = Date.now()
  const startStr = fromDate ?? new Date(today - WINDOW_BEHIND_DAYS * DAY_MS).toISOString().slice(0, 10)
  const endStr = toDate ?? new Date(today + WINDOW_AHEAD_DAYS * DAY_MS).toISOString().slice(0, 10)
  const start = new Date(`${startStr}T00:00:00Z`)
  const end = new Date(`${endStr}T00:00:00Z`)
  const floor = new Date(`${EARLIEST_MANDATE_START}T00:00:00Z`)
  if (start < floor) start.setTime(floor.getTime())
  console.log(`[syncBillCommitteeItems] Fetching ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}${dryRun ? ' (dry run)' : ''}`)

  const days: string[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10))

  const fetched: CommitteeItem[] = []
  const failedDays: string[] = []
  let consecutiveFailures = 0
  for (const day of days) {
    try {
      fetched.push(...(await fetchDay(day)))
      consecutiveFailures = 0
    } catch (err) {
      console.error(`[syncBillCommitteeItems] Error fetching ${day}:`, err)
      failedDays.push(day)
      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`[syncBillCommitteeItems] Stopped after ${consecutiveFailures} failed days in a row, the API looks unavailable`)
      }
    }
    await sleep(100)
  }

  const notes: string[] = []
  if (failedDays.length > 0) notes.push(`${failedDays.length} day(s) could not be fetched (${failedDays.join(', ')}); stale rows were not removed`)

  const unique = new Map<string, CommitteeItem>()
  for (const item of fetched) unique.set(`${item.eventId}|${item.itemId}|${item.itemOrder}`, item)
  console.log(`[syncBillCommitteeItems] Primary legislation items fetched: ${unique.size}`)

  if (unique.size === 0) {
    console.log('[syncBillCommitteeItems] Nothing to write')
    return notes.length > 0 ? notes.join('; ') : undefined
  }

  const knownBills = await db.select({ billId: bills.billId, shortTitle: bills.shortTitle, mandate: bills.mandate }).from(bills)
  const windows = await db.execute(sql`
    SELECT bill_id, MIN(plenary_date)::date::text AS first_date, MAX(plenary_date)::date::text AS last_date
    FROM bill_stages GROUP BY bill_id
  `)
  const windowByBill = new Map((windows.rows as { bill_id: string; first_date: string; last_date: string }[]).map(w => [w.bill_id, w]))
  const candidatesByTitle = new Map<string, string[]>()
  for (const b of knownBills) {
    const key = `${b.mandate}|${normaliseTitle(b.shortTitle)}`
    candidatesByTitle.set(key, [...(candidatesByTitle.get(key) ?? []), b.billId])
  }
  const resolveBill = (key: string, meetingDate: string): string | null => {
    const candidates = candidatesByTitle.get(key) ?? []
    if (candidates.length <= 1) return candidates[0] ?? null
    const near = candidates.filter(id => {
      const w = windowByBill.get(id)
      if (!w) return false
      const lo = new Date(`${w.first_date}T00:00:00Z`).getTime() - WINDOW_PAD_MS
      const hi = new Date(`${w.last_date}T00:00:00Z`).getTime() + WINDOW_PAD_MS
      const t = new Date(`${meetingDate}T00:00:00Z`).getTime()
      return t >= lo && t <= hi
    })
    return near.length === 1 ? near[0] : null
  }

  const rows: (typeof billCommitteeItems.$inferInsert)[] = []
  const unmatched = new Map<string, number>()
  for (const item of unique.values()) {
    const billTitle = billTitleFromItem(item.itemTitle)
    const mandate = mandateIdForDate(new Date(`${item.meetingDate}T12:00:00.000Z`))
    const titleKey = normaliseTitle(billTitle)
    const billId = resolveBill(`${mandate}|${ALIAS_TARGET.get(titleKey) ?? titleKey}`, item.meetingDate)
    if (!billId) unmatched.set(billTitle, (unmatched.get(billTitle) ?? 0) + 1)
    rows.push({
      eventId: item.eventId,
      itemId: item.itemId,
      itemOrder: item.itemOrder,
      billId,
      billTitle,
      committeeName: item.committeeName,
      meetingDate: item.meetingDate,
      itemType: item.itemType,
      itemTitle: item.itemTitle,
      session: item.session,
      mandate,
      updatedAt: new Date(),
    })
  }

  const matched = rows.filter(r => r.billId).length
  console.log(`[syncBillCommitteeItems] Matched to a bill: ${matched}, unmatched: ${rows.length - matched}`)
  for (const [title, n] of unmatched) console.log(`[syncBillCommitteeItems] Unmatched: "${title}" x${n}`)
  const billLike = [...unmatched].filter(([title]) => /\bbill$/i.test(title))
  if (billLike.length > 0) notes.push(`Unmatched bill-like titles (alias may be needed): ${billLike.map(([title, n]) => `${title} (${n})`).join(', ')}`)

  if (dryRun) {
    console.log('[syncBillCommitteeItems] Dry run, no changes made.')
    return notes.length > 0 ? notes.join('; ') : undefined
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(billCommitteeItems).values(rows.slice(i, i + CHUNK)).onConflictDoUpdate({
      target: [billCommitteeItems.eventId, billCommitteeItems.itemId, billCommitteeItems.itemOrder],
      set: {
        billId: sql`COALESCE(excluded.bill_id, bill_committee_items.bill_id)`,
        billTitle: sql`excluded.bill_title`,
        committeeName: sql`excluded.committee_name`,
        meetingDate: sql`excluded.meeting_date`,
        itemType: sql`excluded.item_type`,
        itemTitle: sql`excluded.item_title`,
        session: sql`excluded.session`,
        mandate: sql`excluded.mandate`,
        updatedAt: sql`now()`,
      },
    })
  }
  console.log(`[syncBillCommitteeItems] Done. Rows written: ${rows.length}`)

  if (failedDays.length === 0) {
    const startDay = start.toISOString().slice(0, 10)
    const endDay = end.toISOString().slice(0, 10)
    const existing = await db.execute(sql`
      SELECT event_id, item_id, item_order FROM bill_committee_items
      WHERE meeting_date BETWEEN ${startDay}::date AND ${endDay}::date
    `)
    const stale = (existing.rows as { event_id: string; item_id: string; item_order: number }[])
      .filter(r => !unique.has(`${r.event_id}|${r.item_id}|${r.item_order}`))
    if (stale.length > Math.max(5, Math.ceil(existing.rows.length * STALE_LIMIT_SHARE))) {
      console.warn(`[syncBillCommitteeItems] ${stale.length} of ${existing.rows.length} stored rows are missing from the API, which looks like a bad response, so none were removed`)
      notes.push(`${stale.length} rows missing from the API were kept as a safety check`)
    } else {
      for (const r of stale) {
        await db.execute(sql`DELETE FROM bill_committee_items WHERE event_id = ${r.event_id} AND item_id = ${r.item_id} AND item_order = ${r.item_order}`)
      }
      if (stale.length > 0) {
        console.log(`[syncBillCommitteeItems] Removed ${stale.length} row(s) no longer on the committee agendas`)
        notes.push(`${stale.length} cancelled or moved committee item(s) removed`)
      }
    }
  }
  return notes.length > 0 ? notes.join('; ') : undefined
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const db = drizzle(neon(url), { schema })
  await syncBillCommitteeItems(db, arg('from'), arg('to'), process.argv.includes('--dry-run'))
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Bill committee items sync failed:', err)
    process.exit(1)
  })
}
