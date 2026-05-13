import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, notInArray, gt, lte } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Db = ReturnType<typeof drizzle<typeof schema>>

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) {
      console.error(`API error ${res.status} for ${path}`)
      return null
    }
    return res.json()
  } catch (err) {
    console.error(`Fetch error for ${path}:`, err)
    return null
  }
}

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

export async function syncPlenaryDiary(db: Db): Promise<void> {
  console.log('[syncPlenaryDiary] Calculating date range...')

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const day = now.getDay()
  // On Sat/Sun fetch next week; Mon–Fri fetch current week
  const daysToMonday = day === 6 ? 2 : day === 0 ? 1 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysToMonday)
  const startDate = monday.toISOString().slice(0, 10)

  // Always fetch current display week + the week after (Mon → Sun+7)
  const endOfNextWeekSunday = new Date(monday)
  endOfNextWeekSunday.setDate(monday.getDate() + 13) // Mon + 13 = following Sunday
  const endDate = endOfNextWeekSunday.toISOString().slice(0, 10)

  console.log(`[syncPlenaryDiary] Fetching diary from ${startDate} to ${endDate}...`)

  const data = await apiFetch<any>(
    `/plenary.asmx/GetBusinessDiary_JSON?startDate=${startDate}&endDate=${endDate}`
  )

  if (data === null) {
    console.warn('[syncPlenaryDiary] API call failed — skipping')
    return
  }

  const raw: any[] = data?.BusinessDiary?.DiaryItem ?? []
  const items = Array.isArray(raw) ? raw : [raw]

  if (items.length === 0) {
    console.warn('[syncPlenaryDiary] API returned zero items — skipping without touching DB')
    return
  }

  console.log(`[syncPlenaryDiary] Found ${items.length} diary items`)

  // Load existing event IDs in the date range to distinguish inserts vs updates
  const existingRows = await db
    .select({ eventId: schema.plenaryDiary.eventId })
    .from(schema.plenaryDiary)
    .where(gt(schema.plenaryDiary.eventDate, todayStr))
  const existingIds = new Set(existingRows.map(r => r.eventId))

  let written = 0
  let updated = 0
  const seenEventIds: string[] = []

  for (const item of items) {
    const eventId = str(item?.EventId)
    if (!eventId) {
      console.warn('[syncPlenaryDiary] Skipping item with missing EventId')
      continue
    }

    const eventDate = str(item?.EventDate).slice(0, 10)
    if (!eventDate) {
      console.warn(`[syncPlenaryDiary] Skipping event ${eventId} with missing EventDate`)
      continue
    }

    const eventTypeId = str(item?.EventTypeId)
    const eventType = eventTypeId === '2' ? 'plenary' : eventTypeId === '1' ? 'committee' : 'other'

    const organisationName =
      eventType === 'committee'
        ? (str(item?.OrganisationName).trim() || null)
        : null

    const startTimeRaw = str(item?.StartTime)
    const endTimeRaw = str(item?.EndTime)
    const startTime = startTimeRaw ? new Date(startTimeRaw) : null
    const endTime = endTimeRaw ? new Date(endTimeRaw) : null

    await db
      .insert(schema.plenaryDiary)
      .values({
        eventId,
        eventDate,
        eventType,
        organisationName,
        startTime,
        endTime,
      })
      .onConflictDoUpdate({
        target: schema.plenaryDiary.eventId,
        set: {
          eventDate,
          eventType,
          startTime,
          endTime,
          organisationName,
          updatedAt: new Date(),
        },
      })

    seenEventIds.push(eventId)
    if (existingIds.has(eventId)) {
      updated++
    } else {
      written++
    }
  }

  let deleted = 0
  if (seenEventIds.length > 0) {
    const deleteResult = await db
      .delete(schema.plenaryDiary)
      .where(
        and(
          gt(schema.plenaryDiary.eventDate, startDate),
          lte(schema.plenaryDiary.eventDate, endDate),
          notInArray(schema.plenaryDiary.eventId, seenEventIds)
        )
      )
    deleted = (deleteResult as any).rowCount ?? 0
  }

  console.log(`[syncPlenaryDiary] Complete — ${written} written, ${updated} updated, ${deleted} deleted`)
}

if (require.main === module) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  syncPlenaryDiary(db)
    .then(() => process.exit(0))
    .catch((err: unknown) => { console.error(err); process.exit(1) })
}
