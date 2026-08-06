// Canonical sync-step implementations, shared by sync.ts, sync-full.ts, sync-members.ts,
// sync-structure.ts, and sync-hansard.ts. This is the single source of truth for these
// functions — do not fork a local copy in a consuming script; edit here instead.
// Several functions throw on a critical guard failure (e.g. a near-empty API response)
// rather than swallowing the error, so a caller not wrapping the call in its own
// try/catch (or in sync.ts's runSync helper) will crash on that failure. This is
// intentional: a silent partial sync is worse than a loud, visible one.
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { upsertMemberSnapshot } from '../lib/db/memberWrites'
import { mandateIdForDate, dateToMandate, mandateForToday } from '../lib/constants/mandates'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const BASE = 'http://data.niassembly.gov.uk'

export type Db = ReturnType<typeof drizzle<typeof schema>>

export async function apiFetch<T>(path: string): Promise<T | null> {
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

export function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

export function isoDate(val: unknown): string {
  const s = str(val)
  if (!s) return ''
  const msMatch = s.match(/\/Date\((-?\d+)\)\//)
  if (msMatch) return new Date(parseInt(msMatch[1], 10)).toISOString()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return s
}

export async function syncMembers(db: Db): Promise<{ knownMemberIds: Set<string>; currentMemberIds: string[] }> {
  console.log('[syncMembers] Fetching current and all members from API...')
  const [currentData, allData] = await Promise.all([
    apiFetch<any>('/members.asmx/GetAllCurrentMembers_JSON'),
    apiFetch<any>('/members.asmx/GetAllMembers_JSON'),
  ])

  const currentRaw = currentData?.AllMembersList?.Member ?? []
  const allRaw = allData?.AllMembersList?.Member ?? []

  // CRITICAL: Zero current members means the API failed entirely. Continuing would set
  // isCurrent = false on every MLA in the database, corrupting the entire current member list.
  if (currentRaw.length === 0) {
    throw new Error('[syncMembers] GetAllCurrentMembers_JSON returned zero members — aborting entire sync to prevent corrupting isCurrent flags')
  }
  // CRITICAL: Partial response guard; fewer than 80 of 90 members means partial failure.
  if (currentRaw.length < 80) {
    throw new Error(`[syncMembers] GetAllCurrentMembers_JSON returned only ${currentRaw.length} current members (expected ≥80) — aborting entire sync`)
  }

  console.log(`[syncMembers] Fetched ${currentRaw.length} current members, ${allRaw.length} all-time members`)

  const currentIds = new Set(
    currentRaw.map((m: any) => str(m?.PersonID ?? m?.PersonId)).filter(Boolean)
  )

  // Fix 1: Load members already tracked in today's mandate so we don't re-import historical
  // MLAs from past mandates. Scoped via mandateForToday().id (not CURRENT_MANDATE.id) so that
  // at a mandate boundary this is correct from the actual calendar date, even
  // on a cron run before the isCurrent-flip PR deploys; past-mandate members are NOT
  // treated as existing and re-imported; the members view spans every mandate.
  const existingMembers = await db
    .select({ personId: schema.members.personId })
    .from(schema.members)
    .where(eq(schema.members.mandate, mandateForToday().id))
  const existingIds = new Set(existingMembers.map(m => m.personId))

  const seen = new Set<string>()
  const raw = [...currentRaw, ...allRaw].filter((m: any) => {
    const id = str(m?.PersonID ?? m?.PersonId)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  if (raw.length === 0) {
    console.error('[syncMembers] No members found in either API response — aborting member sync')
    return { knownMemberIds: new Set(), currentMemberIds: [] }
  }

  const filteredRaw = raw.filter((m: any) => {
    const id = str(m?.PersonID ?? m?.PersonId)
    return currentIds.has(id) || existingIds.has(id)
  })
  console.log(`[syncMembers] Filtered out ${raw.length - filteredRaw.length} historical members not in current mandate`)

  let written = 0
  const skippedHistorical = raw.length - filteredRaw.length
  let skippedInvalid = 0
  for (const m of filteredRaw) {
    const personId = str(m?.PersonID ?? m?.PersonId)
    if (!personId) {
      console.warn('[syncMembers] Skipping member record with missing PersonID')
      skippedInvalid++
      continue
    }
    const fullName = str(m?.MemberFullDisplayName)
    if (!fullName) {
      console.warn(`[syncMembers] Member ${personId} has no MemberFullDisplayName — writing with empty name`)
    }
    const party = str(m?.PartyName) || null
    const constituency = str(m?.ConstituencyName) || null
    const imgUrl = str(m?.MemberImgUrl) || null
    const isCurrent = currentIds.has(personId)
    await upsertMemberSnapshot(db, {
      personId,
      fullName,
      imgUrl,
      party,
      constituency,
      isCurrent,
    })
    written++
  }
  console.log(`[syncMembers] Complete — ${written} written, ${skippedHistorical} skipped as historical, ${skippedInvalid} skipped as invalid, ${currentIds.size} marked current`)

  // Fix 3: Build knownMemberIds from filteredRaw plus all existing DB members
  const knownMemberIds = new Set<string>(
    filteredRaw.map((m: any) => str(m?.PersonID ?? m?.PersonId)).filter(Boolean)
  )
  existingIds.forEach(id => knownMemberIds.add(id))

  const currentMemberIds: string[] = currentRaw
    .map((m: any) => str(m?.PersonID ?? m?.PersonId))
    .filter(Boolean)

  return { knownMemberIds, currentMemberIds }
}

export async function syncHansardReports(db: Db) {
  console.log('[syncHansardReports] Fetching all Hansard reports...')
  try {
    const res = await fetch(`${BASE}/hansard.asmx/GetAllHansardReports`)
    if (!res.ok) {
      console.error(`[syncHansardReports] API error ${res.status}`)
      return
    }
    const text = await res.text()
    const matches = text.matchAll(/<HansardComponent>([\s\S]*?)<\/HansardComponent>/g)
    let count = 0
    let skipped = 0
    for (const match of matches) {
      const block = match[1]
      const reportDocId = block.match(/<ReportDocId>(.*?)<\/ReportDocId>/)?.[1]
      const plenaryDate = block.match(/<PlenaryDate>(.*?)<\/PlenaryDate>/)?.[1]
      const sessionName = block.match(/<PlenarySessionName>(.*?)<\/PlenarySessionName>/)?.[1]
      if (!reportDocId || !plenaryDate) {
        console.warn(`[syncHansardReports] Skipping record with missing ${!reportDocId ? 'ReportDocId' : 'PlenaryDate'}`)
        skipped++
        continue
      }
      const dateOnly = plenaryDate.slice(0, 10)
      // GetAllHansardReports returns reports from before this mandate (e.g. the 2016-2022
      // Assembly). Those fall outside every tracked mandate, so skip them rather than let
      // mandateIdForDate throw (which would abort the whole Hansard-report sync).
      const reportMandate = dateToMandate(dateOnly)?.id
      if (!reportMandate) {
        skipped++
        continue
      }
      await db
        .insert(schema.hansardReports)
        .values({
          reportDocId,
          plenaryDate: dateOnly,
          sessionName: sessionName ?? null,
          mandate: reportMandate,
        })
        .onConflictDoNothing()
      count++
    }
    // Partial-response guard: check what the API returned (written + skipped), not just the
    // in-mandate reports written — otherwise skipping pre-mandate reports trips a false alarm.
    if (count + skipped < 500) {
      console.warn(`[syncHansardReports] Only ${count + skipped} reports returned by the API — expected 500+. This may indicate a partial API response.`)
    }
    console.log(`[syncHansardReports] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncHansardReports] Sync error:', err)
    throw err // surface to runSync so the summary shows ✗, not a false ✓
  }
}

export async function syncMinisters(db: Db) {
  console.log('[syncMinisters] Fetching current ministers from API...')
  try {
    const res = await fetch(`${BASE}/members.asmx/GetAllCurrentMinisters`)
    if (!res.ok) {
      console.error(`[syncMinisters] API error ${res.status}`)
      return
    }
    const text = await res.text()
    const rawMatches = [...text.matchAll(/<Minister>([\s\S]*?)<\/Minister>/g)]

    // Zero records may indicate an Executive collapse or reshuffle — preserve existing data
    if (rawMatches.length === 0) {
      console.warn('[syncMinisters] API returned zero ministers — preserving existing ministers table and skipping update')
      return
    }
    if (rawMatches.length < 8) {
      console.warn(`[syncMinisters] API returned only ${rawMatches.length} ministers (expected ≥8) — preserving existing data and skipping update`)
      return
    }

    console.log(`[syncMinisters] Found ${rawMatches.length} minister records in API response`)

    const knownMembers = await db
      .select({ personId: schema.members.personId })
      .from(schema.members)
    const knownMemberIds = new Set(knownMembers.map((m) => m.personId))

    let count = 0
    let skipped = 0
    const insertedIds: string[] = []
    for (const match of rawMatches) {
      const block = match[1]
      const personId = block.match(/<PersonId>(.*?)<\/PersonId>/)?.[1]
      const department = block.match(/<Department>(.*?)<\/Department>/)?.[1]
      const roleName = block.match(/<RoleName>(.*?)<\/RoleName>/)?.[1]
      if (!personId) {
        console.warn('[syncMinisters] Skipping minister record with missing PersonId')
        skipped++
        continue
      }
      if (!department) {
        console.warn(`[syncMinisters] Skipping minister ${personId} with missing Department`)
        skipped++
        continue
      }
      if (!knownMemberIds.has(personId)) {
        console.warn(`[syncMinisters] Skipping non-MLA minister ${personId}`)
        skipped++
        continue
      }
      await db
        .insert(schema.ministers)
        .values({
          personId,
          department,
          roleTitle: roleName ?? null,
          mandate: mandateForToday().id,
        })
        .onConflictDoUpdate({
          target: [schema.ministers.personId, schema.ministers.mandate],
          set: {
            department,
            roleTitle: roleName ?? null,
            updatedAt: new Date(),
          },
        })
      insertedIds.push(personId)
      count++
    }
    // Remove any current-mandate ministers no longer in the API response. Scoped via
    // mandateForToday().id (the calendar date, not the isCurrent flag) so past-mandate
    // ministers remain as an archive even if this runs before the isCurrent-flip deploy.
    if (insertedIds.length > 0) {
      await db.delete(schema.ministers).where(
        and(notInArray(schema.ministers.personId, insertedIds), eq(schema.ministers.mandate, mandateForToday().id))
      )
    }
    console.log(`[syncMinisters] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncMinisters] Sync error:', err)
    throw err // surface to runSync so the summary shows ✗, not a false ✓
  }
}

export async function syncCommitteeChairs(db: Db) {
  console.log('[syncCommitteeChairs] Fetching current committee chairs from API...')
  try {
    const res = await fetch(`${BASE}/members.asmx/GetAllCurrentCommitteeChairs`)
    if (!res.ok) {
      console.error(`[syncCommitteeChairs] API error ${res.status}`)
      return
    }
    const text = await res.text()
    const rawMatches = [...text.matchAll(/<CommitteeChair>([\s\S]*?)<\/CommitteeChair>/g)]

    // Zero records may indicate a committee reshuffle — preserve existing data
    if (rawMatches.length === 0) {
      console.warn('[syncCommitteeChairs] API returned zero committee chairs — preserving existing committee chairs table and skipping update')
      return
    }
    if (rawMatches.length < 10) {
      console.warn(`[syncCommitteeChairs] API returned only ${rawMatches.length} committee chairs (expected ≥10) — preserving existing data and skipping update`)
      return
    }

    console.log(`[syncCommitteeChairs] Found ${rawMatches.length} committee chair records in API response`)

    const knownMembers = await db
      .select({ personId: schema.members.personId, fullName: schema.members.fullName })
      .from(schema.members)
    const knownMemberIds = new Set(knownMembers.map((m) => m.personId))
    const memberNames = new Map(knownMembers.map((m) => [m.personId, m.fullName]))

    let count = 0
    let skipped = 0
    const insertedIds: string[] = []
    for (const match of rawMatches) {
      const block = match[1]
      const personId = block.match(/<PersonId>(.*?)<\/PersonId>/)?.[1]
      const committee = block.match(/<Committee>(.*?)<\/Committee>/)?.[1]?.trim()
      if (!personId) {
        console.warn('[syncCommitteeChairs] Skipping chair record with missing PersonId')
        skipped++
        continue
      }
      if (!committee) {
        console.warn(`[syncCommitteeChairs] Skipping chair ${personId} with missing Committee`)
        skipped++
        continue
      }
      if (!knownMemberIds.has(personId)) {
        console.warn(`[syncCommitteeChairs] Skipping non-MLA committee chair ${personId} (${memberNames.get(personId) ?? 'unknown'})`)
        skipped++
        continue
      }

      // Skip temporary/concurrent committees — only store standing committee chairs
      if (
        committee.toLowerCase().includes('concurrent') ||
        committee.toLowerCase().includes('ad hoc')
      ) {
        console.log(`[syncCommitteeChairs] Skipping temporary committee: ${committee}`)
        skipped++
        continue
      }

      await db
        .insert(schema.committeeChairs)
        .values({
          personId,
          committeeName: committee,
          mandate: mandateForToday().id,
        })
        .onConflictDoUpdate({
          target: [schema.committeeChairs.personId, schema.committeeChairs.mandate],
          set: {
            committeeName: committee,
            updatedAt: new Date(),
          },
        })
      insertedIds.push(personId)
      count++
    }
    // Remove any current-mandate chairs no longer in the API response. Scoped via
    // mandateForToday().id (the calendar date, not the isCurrent flag) so past-mandate
    // chairs remain as an archive even if this runs before the isCurrent-flip deploy.
    if (insertedIds.length > 0) {
      await db.delete(schema.committeeChairs).where(
        and(notInArray(schema.committeeChairs.personId, insertedIds), eq(schema.committeeChairs.mandate, mandateForToday().id))
      )
    }
    console.log(`[syncCommitteeChairs] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncCommitteeChairs] Sync error:', err)
    throw err // surface to runSync so the summary shows ✗, not a false ✓
  }
}

export async function syncRegisteredInterests(db: Db) {
  console.log('[syncRegisteredInterests] Fetching all registered interests from API...')
  try {
    const res = await fetch(
      'http://data.niassembly.gov.uk/register.asmx/GetAllRegisteredInterests_JSON'
    )
    if (!res.ok) {
      console.error(`[syncRegisteredInterests] API error ${res.status}`)
      return
    }
    const data = await res.json()
    const interests: any[] = data?.AllRegisteredInterests?.RegisteredInterest ?? []

    if (interests.length === 0) {
      console.warn('[syncRegisteredInterests] API returned zero interests — preserving existing data and skipping update')
      return
    }

    if (interests.length < 400) {
      console.warn(`[syncRegisteredInterests] Only ${interests.length} interests found — expected 400+, aborting to avoid data loss`)
      return
    }

    console.log(`[syncRegisteredInterests] Found ${interests.length} registered interest records`)

    const knownMembers = await db
      .select({ personId: schema.members.personId })
      .from(schema.members)
    const knownMemberIds = new Set(knownMembers.map((m) => m.personId))

    let count = 0
    let skipped = 0
    const insertedIds: number[] = []

    for (const interest of interests) {
      const personId = str(interest?.PersonId)
      const registerEntry = str(interest?.RegisterEntry)
      const registerCategory = str(interest?.RegisterCategory)
      const registerCategoryId = str(interest?.RegisterCategoryId)

      if (!personId) {
        console.warn('[syncRegisteredInterests] Skipping record with missing PersonId')
        skipped++
        continue
      }
      if (!registerEntry) {
        console.warn(`[syncRegisteredInterests] Skipping record for ${personId} with missing RegisterEntry`)
        skipped++
        continue
      }
      if (!knownMemberIds.has(personId)) {
        console.warn(`[syncRegisteredInterests] Skipping interest for unknown member ${personId}`)
        skipped++
        continue
      }

      const result = await db
        .insert(schema.registeredInterests)
        .values({
          personId,
          registerCategoryId,
          registerCategory,
          registerEntry,
          registerEntryStartDate: interest?.RegisterEntryStartDate
            ? new Date(interest.RegisterEntryStartDate)
            : null,
          mandate: mandateForToday().id,
        })
        .onConflictDoUpdate({
          target: [
            schema.registeredInterests.personId,
            schema.registeredInterests.registerCategoryId,
            schema.registeredInterests.registerEntry,
            schema.registeredInterests.mandate,
          ],
          set: { updatedAt: new Date() },
        })
        .returning({ id: schema.registeredInterests.id })

      if (result[0]?.id) insertedIds.push(result[0].id)
      count++
    }

    // Remove any current-mandate interests no longer in the API response. Scoped via
    // mandateForToday().id (the calendar date, not the isCurrent flag) so past-mandate
    // interests remain as an archive even if this runs before the isCurrent-flip deploy.
    if (insertedIds.length > 0) {
      await db
        .delete(schema.registeredInterests)
        .where(
          and(notInArray(schema.registeredInterests.id, insertedIds), eq(schema.registeredInterests.mandate, mandateForToday().id))
        )
    }

    console.log(`[syncRegisteredInterests] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncRegisteredInterests] Sync error:', err)
    throw err // surface to runSync so the summary shows ✗, not a false ✓
  }
}

export async function syncPlenaryItems(db: Db) {
  console.log('[syncPlenaryItems] Syncing plenary agenda for current week...')

  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startDate = monday.toISOString().slice(0, 10)
  const endDate = sunday.toISOString().slice(0, 10)

  const items = await apiFetch<any>(
    `/plenary.asmx/GetPlenaryItemsPlenaryDate_JSON?startDate=${startDate}&endDate=${endDate}`
  )

  if (items === null) {
    console.log('[syncPlenaryItems] API call failed — skipping')
    return
  }

  const raw: any[] = items?.PlenaryList?.Plenary ?? []
  const list = Array.isArray(raw) ? raw : [raw]

  if (list.length === 0) {
    console.log('[syncPlenaryItems] API returned zero items — skipping')
    return
  }

  const ALLOWED_TYPE_IDS = new Set(['1', '2', '5'])
  const CLAUSE_RE = /^(Clauses?\s|Schedules?\s|Schedule\s|Amendment\s\d|Long Title\s*-)/i
  const SUSPENSION_RE = /Suspension of Standing Orders/i

  let written = 0
  let skipped = 0

  for (const item of list) {
    const documentId = str(item?.DocumentID)
    const title = str(item?.Title).trim()
    const plenaryTypeId = str(item?.PlenaryTypeID)
    const plenaryType = str(item?.PlenaryType)

    if (!documentId || !title) { skipped++; continue }
    if (!ALLOWED_TYPE_IDS.has(plenaryTypeId)) { skipped++; continue }
    if (CLAUSE_RE.test(title)) { skipped++; continue }
    if (SUSPENSION_RE.test(title)) { skipped++; continue }

    const plenaryDate = str(item?.PlenaryDate).slice(0, 10)
    const tabledDate = item?.TabledDate ? str(item.TabledDate).slice(0, 10) : null

    await db.execute(sql`
      INSERT INTO plenary_items
        (document_id, title, plenary_date, plenary_type, plenary_type_id, motion_category, motion_category_id, text, tabled_date, mandate, updated_at)
      VALUES
        (${documentId}, ${title}, ${plenaryDate}, ${plenaryType}, ${plenaryTypeId},
         ${str(item?.MotionCategory) || null}, ${str(item?.MotionCategoryID) || null},
         ${str(item?.Text) || null}, ${tabledDate}, ${mandateIdForDate(plenaryDate)}, NOW())
      ON CONFLICT (document_id) DO UPDATE SET
        title = EXCLUDED.title,
        text = EXCLUDED.text,
        updated_at = NOW()
    `)
    written++
  }

  if (written === 0 && skipped > 0) {
    console.warn(`[syncPlenaryItems] All ${skipped} items were filtered out — check filter rules if this is unexpected`)
  }
  console.log(`[syncPlenaryItems] Complete — ${written} written, ${skipped} skipped`)
}
