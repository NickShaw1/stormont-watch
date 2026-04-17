import './load-env'
import { syncBills } from './sync-bills'
import { syncContactDetails } from './sync-contact-details'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, desc, eq, isNull, notInArray, or, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
const CUTOFF = '2022-05-01'
const CURRENT_MANDATE = '2022-2027'

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

function isoDate(val: unknown): string {
  const s = str(val)
  if (!s) return ''
  const msMatch = s.match(/\/Date\((-?\d+)\)\//)
  if (msMatch) return new Date(parseInt(msMatch[1], 10)).toISOString()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return s
}

async function syncMembers(db: Db): Promise<{ knownMemberIds: Set<string>; currentMemberIds: string[] }> {
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
  // CRITICAL: Partial response guard. Assembly has 90 members; fewer than 80 is a partial API failure.
  if (currentRaw.length < 80) {
    throw new Error(`[syncMembers] GetAllCurrentMembers_JSON returned only ${currentRaw.length} current members (expected ≥80) — aborting entire sync`)
  }

  console.log(`[syncMembers] Fetched ${currentRaw.length} current members, ${allRaw.length} all-time members`)

  const currentIds = new Set(
    currentRaw.map((m: any) => str(m?.PersonID ?? m?.PersonId)).filter(Boolean)
  )

  // Fix 1: Load existing DB members so we don't re-import historical MLAs from past mandates
  const existingMembers = await db
    .select({ personId: schema.members.personId })
    .from(schema.members)
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
    await db
      .insert(schema.members)
      .values({
        personId,
        fullName,
        party,
        constituency,
        imgUrl,
        isCurrent,
        mandate: CURRENT_MANDATE,
      })
      .onConflictDoUpdate({
        target: schema.members.personId,
        set: {
          // Fix 2: Only update fields when values have actually changed
          fullName: sql`CASE WHEN ${schema.members.fullName} = ${fullName} THEN ${schema.members.fullName} ELSE ${fullName} END`,
          party: sql`CASE WHEN ${schema.members.party} IS NOT DISTINCT FROM ${party} THEN ${schema.members.party} ELSE ${party} END`,
          constituency: sql`CASE WHEN ${schema.members.constituency} IS NOT DISTINCT FROM ${constituency} THEN ${schema.members.constituency} ELSE ${constituency} END`,
          imgUrl: sql`CASE WHEN ${schema.members.imgUrl} LIKE '/mla-images/%' THEN ${schema.members.imgUrl} ELSE ${imgUrl} END`,
          isCurrent,
          updatedAt: sql`CASE WHEN ${schema.members.fullName} = ${fullName} AND ${schema.members.party} IS NOT DISTINCT FROM ${party} AND ${schema.members.constituency} IS NOT DISTINCT FROM ${constituency} AND ${schema.members.isCurrent} = ${isCurrent} THEN ${schema.members.updatedAt} ELSE NOW() END`,
        },
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

async function syncHansardReports(db: Db) {
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
      await db
        .insert(schema.hansardReports)
        .values({
          reportDocId,
          plenaryDate: dateOnly,
          sessionName: sessionName ?? null,
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoNothing()
      count++
    }
    if (count < 500) {
      console.warn(`[syncHansardReports] Only ${count} reports written — expected 500+. This may indicate a partial API response.`)
    }
    console.log(`[syncHansardReports] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncHansardReports] Sync error:', err)
  }
}

async function syncMinisters(db: Db) {
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
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoUpdate({
          target: schema.ministers.personId,
          set: {
            department,
            roleTitle: roleName ?? null,
            updatedAt: new Date(),
          },
        })
      insertedIds.push(personId)
      count++
    }
    // Remove any ministers no longer in the API response
    if (insertedIds.length > 0) {
      await db.delete(schema.ministers).where(notInArray(schema.ministers.personId, insertedIds))
    }
    console.log(`[syncMinisters] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncMinisters] Sync error:', err)
  }
}

async function syncCommitteeChairs(db: Db) {
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
      .select({ personId: schema.members.personId })
      .from(schema.members)
    const knownMemberIds = new Set(knownMembers.map((m) => m.personId))

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
        console.warn(`[syncCommitteeChairs] Skipping non-MLA committee chair ${personId}`)
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
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoUpdate({
          target: schema.committeeChairs.personId,
          set: {
            committeeName: committee,
            updatedAt: new Date(),
          },
        })
      insertedIds.push(personId)
      count++
    }
    // Remove any chairs no longer in the API response
    if (insertedIds.length > 0) {
      await db.delete(schema.committeeChairs).where(notInArray(schema.committeeChairs.personId, insertedIds))
    }
    console.log(`[syncCommitteeChairs] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncCommitteeChairs] Sync error:', err)
  }
}

async function syncNewDivisions(db: Db, knownMemberIds: Set<string>, currentMemberIds: string[], startDateOverride?: string, endDateOverride?: string) {
  if (startDateOverride) {
    console.log(`[syncNewDivisions] Running with forced start date: ${startDateOverride}${endDateOverride ? ` to ${endDateOverride}` : ''}`)
  } else {
    console.log('[syncNewDivisions] Finding most recent division in database...')
  }

  let startDate: string
  if (startDateOverride) {
    startDate = startDateOverride
  } else {
    // Find the most recent division date in the database
    const latest = await db
      .select({ divisionDate: schema.divisions.divisionDate })
      .from(schema.divisions)
      .orderBy(desc(schema.divisions.divisionDate))
      .limit(1)

    const since = latest[0]?.divisionDate
      ? new Date(latest[0].divisionDate).toISOString().slice(0, 10)
      : CUTOFF

    console.log(`[syncNewDivisions] Fetching divisions since ${since}...`)

    // Fetch from the day after the latest division to today
    const sinceDate = new Date(since)
    sinceDate.setDate(sinceDate.getDate() + 1)
    startDate = sinceDate.toISOString().slice(0, 10)
  }

  const endDate = endDateOverride ?? new Date().toISOString().slice(0, 10)

  if (startDate > endDate) {
    console.log('[syncNewDivisions] Database is up to date. No new divisions to sync.')
    return
  }

  const data = await apiFetch<any>(
    `/plenary.asmx/GetVotesOnDivision_JSON?startdate=${startDate}&enddate=${endDate}`
  )

  const raw = data?.DivisionList?.Division ?? []
  const newDivisions: any[] = Array.isArray(raw) ? raw : [raw]

  if (newDivisions.length === 0) {
    console.log('[syncNewDivisions] No new divisions found.')
    return
  }

  console.log(`[syncNewDivisions] Found ${newDivisions.length} new divisions`)

  console.log(`[syncNewDivisions] Known members: ${knownMemberIds.size}, current members: ${currentMemberIds.length}`)

  // Fetch all members once to avoid N+1 queries in the no-show loop
  const allMembersForNoShow = await db
    .select({
      personId: schema.members.personId,
      mandateStart: schema.members.mandateStart,
      mandateEnd: schema.members.mandateEnd,
    })
    .from(schema.members)

  let processed = 0
  let skipped = 0

  for (const div of newDivisions) {
    const documentId = str(div?.DocumentID)
    const divisionDate = isoDate(div?.DivisionDate)

    if (!documentId || divisionDate < CUTOFF) continue

    const [resultData, votingData, plenaryData, tablersData] = await Promise.all([
      apiFetch<any>(`/plenary.asmx/GetDivisionResult_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetDivisionMemberVoting_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetPlenaryDetails_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetPlenaryTablers_JSON?documentId=${documentId}`),
    ])

    const memberVotes: any[] = votingData?.MemberVoting?.Member ?? []
    if (memberVotes.length === 0) {
      console.warn(`[syncNewDivisions] Division ${documentId} returned zero voting members — skipping`)
      skipped++
      await new Promise((resolve) => setTimeout(resolve, 100))
      continue
    }

    const result = resultData?.DivisionDetails?.Division
    const motionText = plenaryData?.PlenaryList?.Plenary?.Text ?? null
    const title = str(plenaryData?.PlenaryList?.Plenary?.Title) || null

    const tablers: any[] = tablersData?.TablerList?.Tabler ?? []
    const tablerArray = Array.isArray(tablers) ? tablers : [tablers]
    const tabledBy = tablerArray.map((t: any) => str(t?.TablerName)).filter(Boolean).join(', ') || null

    if (!motionText) {
      console.warn(`[syncNewDivisions] Division ${documentId} has no motion text — writing division without it`)
    }

    await db
      .insert(schema.divisions)
      .values({
        documentId,
        eventId: str(div?.EventID) || null,
        subject: str(div?.DivisionSubject),
        divisionDate: new Date(divisionDate),
        divisionType: str(div?.DivisonType) || null,
        outcome: str(result?.Outcome) || null,
        totalAyes: parseInt(str(result?.TotalAyes)) || 0,
        totalNoes: parseInt(str(result?.TotalNoes)) || 0,
        totalAbstains: parseInt(str(result?.TotalAbstentions)) || 0,
        nationalistAyes: parseInt(str(result?.NationalistAyes)) || 0,
        unionistAyes: parseInt(str(result?.UnionistAyes)) || 0,
        otherAyes: parseInt(str(result?.OtherAyes)) || 0,
        nationalistNoes: parseInt(str(result?.NationalistNoes)) || 0,
        unionistNoes: parseInt(str(result?.UnionistNoes)) || 0,
        otherNoes: parseInt(str(result?.OtherNoes)) || 0,
        motionText: motionText || null,
        title,
        tabledBy,
        mandate: CURRENT_MANDATE,
      })
      // Update result fields on conflict. divisionType is included defensively —
      // it rarely changes, but the cross-community count in getAssemblyStats() depends on it being correct.
      .onConflictDoUpdate({
        target: schema.divisions.documentId,
        set: {
          divisionType: str(div?.DivisonType) || null,
          outcome: str(result?.Outcome) || null,
          totalAyes: parseInt(str(result?.TotalAyes)) || 0,
          totalNoes: parseInt(str(result?.TotalNoes)) || 0,
          totalAbstains: parseInt(str(result?.TotalAbstentions)) || 0,
          motionText: motionText || null,
          title,
          tabledBy,
          updatedAt: new Date(),
        },
      })

    const votedIds = new Set<string>()

    for (const v of memberVotes) {
      const personId = str(v?.PersonID)
      if (!personId) continue
      if (!knownMemberIds.has(personId)) {
        console.warn(`[syncNewDivisions] Skipping vote for unknown member ${personId} in division ${documentId}`)
        continue
      }
      votedIds.add(personId)

      const voteValue = ['AYE', 'NO', 'ABSTAINED'].includes(str(v?.Vote))
        ? str(v?.Vote)
        : 'ABSTAINED'

      await db
        .insert(schema.votes)
        .values({
          documentId,
          personId,
          vote: voteValue,
          designation: str(v?.Designation) || null,
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoNothing()
    }

    // No shows for all members who were serving at the time of this division
    const divisionDateStr = new Date(divisionDate).toISOString().slice(0, 10)

    for (const member of allMembersForNoShow) {
      if (votedIds.has(member.personId)) continue
      if (!member.mandateStart) continue

      const memberStart = member.mandateStart.toString().slice(0, 10)
      const memberEnd = member.mandateEnd ? member.mandateEnd.toString().slice(0, 10) : null

      if (memberStart > divisionDateStr) continue
      if (memberEnd && memberEnd < divisionDateStr) continue

      await db
        .insert(schema.votes)
        .values({
          documentId,
          personId: member.personId,
          vote: 'NO_SHOW',
          designation: null,
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoNothing()
    }

    processed++
    if (processed % 10 === 0) {
      console.log(`[syncNewDivisions] Progress: ${processed}/${newDivisions.length} divisions processed`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`[syncNewDivisions] Complete — ${processed} divisions written, ${skipped} skipped`)
}

async function syncRegisteredInterests(db: Db) {
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
          mandate: CURRENT_MANDATE,
        })
        .onConflictDoUpdate({
          target: [
            schema.registeredInterests.personId,
            schema.registeredInterests.registerCategoryId,
            schema.registeredInterests.registerEntry,
          ],
          set: { updatedAt: new Date() },
        })
        .returning({ id: schema.registeredInterests.id })

      if (result[0]?.id) insertedIds.push(result[0].id)
      count++
    }

    // Remove any interests no longer in the API response
    if (insertedIds.length > 0) {
      await db
        .delete(schema.registeredInterests)
        .where(notInArray(schema.registeredInterests.id, insertedIds))
    }

    console.log(`[syncRegisteredInterests] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncRegisteredInterests] Sync error:', err)
  }
}

async function syncCurrentMemberRoles(db: Db) {
  console.log('[syncCurrentMemberRoles] Fetching roles for current members and recently departed members with missing mandate_end...')

  const membersToSync = await db
    .select({ personId: schema.members.personId })
    .from(schema.members)
    .where(
      or(
        eq(schema.members.isCurrent, true),
        and(
          eq(schema.members.isCurrent, false),
          isNull(schema.members.mandateEnd)
        )
      )
    )

  console.log(`[syncCurrentMemberRoles] Fetching roles for ${membersToSync.length} members (current + recently departed with missing mandate_end)...`)

  let updated = 0
  let skipped = 0
  let processed = 0

  for (const { personId } of membersToSync) {
    try {
      const res = await fetch(
        `${BASE}/members.asmx/GetMemberRolesByPersonId_JSON?PersonId=${personId}`
      )
      if (!res.ok) {
        console.warn(`[syncCurrentMemberRoles] API error ${res.status} for member ${personId} — skipping`)
        skipped++
        continue
      }
      const data = await res.json()
      const roles: any[] = data?.AllMembersRoles?.Role ?? []

      if (roles.length === 0) {
        skipped++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      const currentMandateMlaRole = roles
        .filter((r: any) =>
          r.RoleType === 'Assembly Membership Role' &&
          r.Role === 'MLA' &&
          r.AffiliationStart >= '2022-01-01'
        )
        .sort((a: any, b: any) =>
          new Date(b.AffiliationStart).getTime() - new Date(a.AffiliationStart).getTime()
        )[0]

      const specialRole = roles.find(
        (r: any) =>
          r.RoleType === 'Assembly Membership Role' &&
          r.Role !== 'MLA' &&
          !r.AffiliationEnd
      )

      const mandateStart = currentMandateMlaRole?.AffiliationStart?.slice(0, 10) ?? null
      const mandateEnd = currentMandateMlaRole?.AffiliationEnd?.slice(0, 10) ?? null
      const assemblyRole = specialRole?.Role ?? null
      const assemblyRoleStart = specialRole?.AffiliationStart?.slice(0, 10) ?? null
      const assemblyRoleEnd = specialRole?.AffiliationEnd?.slice(0, 10) ?? null

      await db
        .update(schema.members)
        .set({
          ...(mandateStart && { mandateStart }),
          mandateEnd: mandateEnd ?? null,
          assemblyRole,
          assemblyRoleStart: assemblyRoleStart ?? null,
          assemblyRoleEnd: assemblyRoleEnd ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.members.personId, personId))
      updated++

      processed++
      if (processed % 10 === 0) {
        console.log(`[syncCurrentMemberRoles] Progress: ${processed}/${membersToSync.length}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (err) {
      console.error(`[syncCurrentMemberRoles] Failed for member ${personId}:`, err)
      skipped++
    }
  }

  console.log(`[syncCurrentMemberRoles] Complete — ${updated} updated, ${skipped} skipped`)
}

async function main() {
  const startedAt = new Date()
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Sync started at ${startedAt.toISOString()}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  const syncResults: { script: string; status: 'success' | 'skipped' | 'error'; note?: string }[] = []

  async function runSync(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      syncResults.push({ script: name, status: 'success' })
    } catch (err) {
      console.error(`[${name}] Failed:`, err)
      syncResults.push({ script: name, status: 'error', note: String(err) })
    }
  }

  const isMonday = new Date().getDay() === 1
  const isBackfill2022 = process.argv.includes('--backfill-2022')

  // Weekly scripts — Mondays only
  let knownMemberIds = new Set<string>()
  let currentMemberIds: string[] = []
  let hasNewMembers = false

  if (isMonday) {
    console.log('Monday — running weekly sync scripts...')

    // Snapshot existing member IDs before sync so we can detect newly co-opted members
    const preSyncMembers = await db
      .select({ personId: schema.members.personId })
      .from(schema.members)
    const preSyncMemberIds = new Set(preSyncMembers.map(m => m.personId))

    // syncMembers throws on critical failure — keep outside runSync to abort entire sync
    const memberResult = await syncMembers(db)
    knownMemberIds = memberResult.knownMemberIds
    currentMemberIds = memberResult.currentMemberIds
    syncResults.push({ script: 'syncMembers', status: 'success' })

    const newMemberIds = currentMemberIds.filter(id => !preSyncMemberIds.has(id))
    if (newMemberIds.length > 0) {
      console.log(`[main] ${newMemberIds.length} new member(s) detected: ${newMemberIds.join(', ')} — will backfill past 7 days of divisions`)
      hasNewMembers = true
    }

    await runSync('syncCurrentMemberRoles', () => syncCurrentMemberRoles(db))
    await runSync('syncContactDetails', () => syncContactDetails(db))
    await runSync('syncRegisteredInterests', () => syncRegisteredInterests(db))
  } else {
    // On non-Monday days, load member IDs from DB directly for syncNewDivisions
    console.log('Daily sync — loading member IDs from database...')
    const allMembers = await db
      .select({ personId: schema.members.personId, isCurrent: schema.members.isCurrent })
      .from(schema.members)
    knownMemberIds = new Set(allMembers.map(m => m.personId))
    currentMemberIds = allMembers
      .filter(m => m.isCurrent)
      .map(m => m.personId)
  }

  // Daily scripts — run every time
  await runSync('syncHansardReports', () => syncHansardReports(db))
  await runSync('syncMinisters', () => syncMinisters(db))
  await runSync('syncCommitteeChairs', () => syncCommitteeChairs(db))
  await runSync('syncNewDivisions', () => syncNewDivisions(db, knownMemberIds, currentMemberIds))
  if (hasNewMembers) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const backfillStart = sevenDaysAgo.toISOString().slice(0, 10)
    await runSync('syncNewDivisions:backfill', () => syncNewDivisions(db, knownMemberIds, currentMemberIds, backfillStart))
  }
  if (isBackfill2022) {
    console.log('[main] --backfill-2022 flag detected — syncing suspension-era divisions (2022-05-01 to 2024-02-01)')
    await runSync('syncNewDivisions:backfill-2022', () => syncNewDivisions(db, knownMemberIds, currentMemberIds, '2022-05-01', '2024-02-01'))
  }
  await runSync('syncBills', () => syncBills(db, false, isBackfill2022 ? '2022-05-01' : undefined))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Sync summary:')
  for (const r of syncResults) {
    const icon = r.status === 'success' ? '✓' : r.status === 'skipped' ? '–' : '✗'
    console.log(`  ${icon} ${r.script}${r.note ? ` — ${r.note}` : ''}`)
  }
  const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000)
  console.log(`Total runtime: ${durationSec}s`)
  const errors = syncResults.filter(r => r.status === 'error')
  if (errors.length > 0) {
    console.error(`\n${errors.length} script(s) failed. See above for details.`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    process.exit(1)
  } else {
    console.log('\nAll done.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Incremental sync failed:', err)
  process.exit(1)
})
