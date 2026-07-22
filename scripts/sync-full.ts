/**
 * FULL HISTORICAL SYNC — MANUAL USE ONLY
 *
 * Re-syncs all data from scratch since February 2024.
 * This script is for recovery and backfill purposes only.
 * Do NOT add this to any cron job or automated workflow.
 * For routine daily/weekly syncs use: npm run sync
 *
 * After a full recovery, the following require manual attention:
 *   - royal_assent_date and act_title on the bills table (not populated by any sync script)
 *   - plenary_items data (syncPlenaryItems only fetches the current week — historical agenda data is not recoverable)
 */

import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { upsertMemberSnapshot, updateMemberTermRoles } from '../lib/db/memberWrites'
import { syncContactDetails } from './sync-contact-details'
import { syncBills } from './sync-bills'
import { syncHansardContributions } from './sync-hansard-contributions'
import { syncQuestionStats } from './sync-question-stats'
import { apiRoleToSalaryRole } from '../lib/salaries'

const BASE = 'http://data.niassembly.gov.uk'
const CUTOFF = '2022-05-01'
import { CURRENT_MANDATE, mandateIdForDate, dateToMandate } from '../lib/constants/mandates'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

type Db = ReturnType<typeof drizzle<typeof schema>>

async function syncMembers(db: Db) {
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
  const seen = new Set<string>()
  const raw = [...currentRaw, ...allRaw].filter((m: any) => {
    const id = str(m?.PersonID ?? m?.PersonId)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  if (raw.length === 0) {
    console.error('[syncMembers] No members found in either API response — aborting member sync')
    return
  }

  let written = 0
  let skipped = 0
  for (const m of raw) {
    const personId = str(m?.PersonID ?? m?.PersonId)
    if (!personId) {
      console.warn('[syncMembers] Skipping member record with missing PersonID')
      skipped++
      continue
    }
    const fullName = str(m?.MemberFullDisplayName)
    if (!fullName) {
      console.warn(`[syncMembers] Member ${personId} has no MemberFullDisplayName — writing with empty name`)
    }
    await upsertMemberSnapshot(db, {
      personId,
      fullName,
      imgUrl: str(m?.MemberImgUrl) || null,
      party: str(m?.PartyName) || null,
      constituency: str(m?.ConstituencyName) || null,
      isCurrent: currentIds.has(personId),
    })
    written++
  }
  console.log(`[syncMembers] Complete — ${written} written, ${skipped} skipped, ${currentIds.size} marked current`)
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
      // Skip reports that predate every tracked mandate (e.g. the 2016-2022 Assembly)
      // rather than letting mandateIdForDate throw and abort the whole sync.
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
  }
}

async function syncMandateAndRoles(db: Db) {
  console.log('[syncMandateAndRoles] Fetching all members from database...')

  const allMembers = await db
    .select({ personId: schema.members.personId })
    .from(schema.members)

  console.log(`[syncMandateAndRoles] Fetching roles for ${allMembers.length} members (current and former)...`)

  let updated = 0
  let skipped = 0
  let processed = 0

  for (const { personId } of allMembers) {
    try {
      const res = await fetch(
        `${BASE}/members.asmx/GetMemberRolesByPersonId_JSON?PersonId=${personId}`
      )
      if (!res.ok) {
        console.warn(`[syncMandateAndRoles] API error ${res.status} for member ${personId} — skipping`)
        skipped++
        continue
      }
      const data = await res.json()
      const roles: any[] = data?.AllMembersRoles?.Role ?? []

      if (roles.length === 0) {
        console.warn(`[syncMandateAndRoles] No roles returned for member ${personId} — skipping`)
        skipped++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      const currentMandateMlaRole = roles
        .filter((r: any) =>
          r.RoleType === 'Assembly Membership Role' &&
          r.Role === 'MLA' &&
          // Members are returned at the election, which is on or before the first sitting
          // (CURRENT_MANDATE.start); use electionDate so an election-day affiliation isn't missed.
          r.AffiliationStart >= CURRENT_MANDATE.electionDate
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

      if (mandateStart || assemblyRole) {
        await updateMemberTermRoles(db, personId, {
          mandateStart,
          mandateEnd,
          assemblyRole,
          assemblyRoleStart,
          assemblyRoleEnd,
        })
        updated++
      }

      const MANDATE_START = CURRENT_MANDATE.start
      const AD_HOC_RE = /concurrent|ad hoc/i

      for (const r of roles) {
        const affiliationId = String(r?.AffiliationId ?? '')
        const roleType = String(r?.RoleType ?? '')
        const role = String(r?.Role ?? '')
        const organisation = String(r?.Organisation ?? '')
        const organisationId = String(r?.OrganisationId ?? '')
        const startRaw = String(r?.AffiliationStart ?? '')
        const endRaw = r?.AffiliationEnd ? String(r.AffiliationEnd) : null

        if (!affiliationId || !startRaw) continue
        const startDate = startRaw.slice(0, 10)
        const endDate = endRaw ? endRaw.slice(0, 10) : null

        if (startDate < MANDATE_START) {
          const stillActiveAtMandateStart = !endDate || endDate >= MANDATE_START
          if (!stillActiveAtMandateStart) continue
        }

        const effectiveStartDate = startDate < MANDATE_START ? MANDATE_START : startDate

        if (roleType === 'Committee Role (incl Assembly Commission)' && AD_HOC_RE.test(organisation)) continue

        const salaryRole = apiRoleToSalaryRole(roleType, role, organisation)
        if (!salaryRole) continue

        await db
          .insert(schema.memberRoleHistory)
          .values({
            personId,
            affiliationId,
            roleType,
            role,
            organisation: organisation || null,
            organisationId: organisationId || null,
            startDate: effectiveStartDate,
            endDate,
            mandate: mandateIdForDate(effectiveStartDate),
          })
          .onConflictDoUpdate({
            target: schema.memberRoleHistory.affiliationId,
            set: {
              endDate,
              updatedAt: new Date(),
            },
          })
      }

      processed++
      if (processed % 10 === 0) {
        console.log(`[syncMandateAndRoles] Progress: ${processed}/${allMembers.length} members processed`)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (err) {
      console.error(`[syncMandateAndRoles] Failed to fetch roles for member ${personId}:`, err)
      skipped++
    }
  }

  console.log(`[syncMandateAndRoles] Complete — ${updated} updated, ${skipped} skipped`)
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
          mandate: CURRENT_MANDATE.id,
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
    // Remove any current-mandate ministers no longer in the API response. Scoped so
    // past-mandate ministers remain as an archive.
    if (insertedIds.length > 0) {
      await db.delete(schema.ministers).where(
        and(notInArray(schema.ministers.personId, insertedIds), eq(schema.ministers.mandate, CURRENT_MANDATE.id))
      )
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
          mandate: CURRENT_MANDATE.id,
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
    // Remove any current-mandate chairs no longer in the API response. Scoped so
    // past-mandate chairs remain as an archive.
    if (insertedIds.length > 0) {
      await db.delete(schema.committeeChairs).where(
        and(notInArray(schema.committeeChairs.personId, insertedIds), eq(schema.committeeChairs.mandate, CURRENT_MANDATE.id))
      )
    }
    console.log(`[syncCommitteeChairs] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncCommitteeChairs] Sync error:', err)
  }
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
          mandate: CURRENT_MANDATE.id,
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

    // Remove any current-mandate interests no longer in the API response. Scoped so
    // past-mandate interests remain as an archive.
    if (insertedIds.length > 0) {
      await db
        .delete(schema.registeredInterests)
        .where(
          and(notInArray(schema.registeredInterests.id, insertedIds), eq(schema.registeredInterests.mandate, CURRENT_MANDATE.id))
        )
    }

    console.log(`[syncRegisteredInterests] Complete — ${count} written, ${skipped} skipped`)
  } catch (err) {
    console.error('[syncRegisteredInterests] Sync error:', err)
  }
}

async function syncDivisionsAndVotes(db: Db) {
  console.log('[syncDivisionsAndVotes] Fetching divisions by year...')
  const currentYear = new Date().getFullYear()
  const allDivisions: any[] = []

  for (let year = 2024; year <= currentYear; year++) {
    const start = year === 2024 ? CUTOFF : `${year}-01-01`
    const end = `${year}-12-31`
    const data = await apiFetch<any>(
      `/plenary.asmx/GetVotesOnDivision_JSON?startdate=${start}&enddate=${end}`,
    )
    const divs = data?.DivisionList?.Division
    if (Array.isArray(divs)) {
      allDivisions.push(...divs)
      console.log(`[syncDivisionsAndVotes]   ${year}: ${divs.length} divisions`)
    } else {
      console.warn(`[syncDivisionsAndVotes]   ${year}: no divisions returned from API`)
    }
  }

  console.log(`[syncDivisionsAndVotes] Found ${allDivisions.length} total divisions`)

  // All members (current + historical) — used to validate votes before insert
  const membersData = await apiFetch<any>('/members.asmx/GetAllMembers_JSON')
  const allMemberIds: string[] = (membersData?.AllMembersList?.Member ?? [])
    .map((m: any) => str(m?.PersonID ?? m?.PersonId))
    .filter(Boolean)
  const knownMemberIds = new Set(allMemberIds)

  if (allMemberIds.length < 80) {
    throw new Error(`[syncDivisionsAndVotes] GetAllMembers_JSON returned only ${allMemberIds.length} members — aborting to prevent corrupting vote records`)
  }

  // Fetch all members with mandate dates once — used for mandate-aware no-show logic
  const allMembersForNoShow = await db
    .select({
      personId: schema.members.personId,
      mandateStart: schema.members.mandateStart,
      mandateEnd: schema.members.mandateEnd,
    })
    .from(schema.members)

  console.log(`[syncDivisionsAndVotes] Known members: ${allMemberIds.length}, members for no-show: ${allMembersForNoShow.length}`)

  async function processDivision(div: any) {
    const documentId = str(div?.DocumentID)
    const divisionDate = isoDate(div?.DivisionDate)

    // Fix BST midnight: if API returns midnight BST (stored as 23:00 UTC),
    // extract date portion directly and store as noon UTC
    const divisionDateFixed = (() => {
      const raw = str(div?.DivisionDate)
      if (raw && divisionDate.endsWith('T23:00:00.000Z')) {
        const dateStr = raw.slice(0, 10)
        return new Date(`${dateStr}T12:00:00.000Z`)
      }
      return new Date(divisionDate)
    })()

    if (!documentId || divisionDate < CUTOFF) return

    const [resultData, votingData, plenaryData, tablersData] = await Promise.all([
      apiFetch<any>(`/plenary.asmx/GetDivisionResult_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetDivisionMemberVoting_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetPlenaryDetails_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetPlenaryTablers_JSON?documentId=${documentId}`),
    ])

    const memberVotes: any[] = votingData?.MemberVoting?.Member ?? []
    if (memberVotes.length === 0) {
      console.warn(`[syncDivisionsAndVotes] Division ${documentId} returned zero voting members — skipping`)
      return
    }

    const result = resultData?.DivisionDetails?.Division
    const motionText = plenaryData?.PlenaryList?.Plenary?.Text ?? null
    const title = str(plenaryData?.PlenaryList?.Plenary?.Title) || null

    const tablers: any[] = tablersData?.TablerList?.Tabler ?? []
    const tablerArray = Array.isArray(tablers) ? tablers : [tablers]
    const tabledBy = tablerArray.map((t: any) => str(t?.TablerName)).filter(Boolean).join(', ') || null

    if (!motionText) {
      console.warn(`[syncDivisionsAndVotes] Division ${documentId} has no motion text — writing division without it`)
    }

    const documentType = str(plenaryData?.PlenaryList?.Plenary?.DocumentType)
    const isMotionAmendment = documentType === 'Motion Amendment'
    let parentMotionText: string | null = null

    if (isMotionAmendment) {
      const dateStr = divisionDateFixed.toISOString().slice(0, 10)
      const dayItems = await apiFetch<any>(
        `/plenary.asmx/GetPlenaryItemsPlenaryDate_JSON?startDate=${dateStr}&endDate=${dateStr}`
      )
      const items = dayItems?.PlenaryList?.Plenary ?? []
      const itemList = Array.isArray(items) ? items : [items]
      const parentTitle = (title ?? '').replace(/\s*-\s*Amendment\s+\d+\s*$/i, '').trim()
      const parent = itemList.find((i: any) =>
        str(i?.PlenaryTypeID) === '1' &&
        str(i?.Title).trim().toLowerCase() === parentTitle.toLowerCase()
      )
      parentMotionText = parent?.Text ?? null
      if (!parentMotionText) {
        console.warn(`[syncDivisionsAndVotes] Could not find parent motion for amendment division ${documentId} — title: "${title}"`)
      }
    }

    await db
      .insert(schema.divisions)
      .values({
        documentId,
        eventId: str(div?.EventID) || null,
        subject: str(div?.DivisionSubject),
        divisionDate: divisionDateFixed,
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
        isMotionAmendment,
        parentMotionText,
        mandate: mandateIdForDate(divisionDate),
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
          isMotionAmendment,
          parentMotionText,
          updatedAt: new Date(),
        },
      })

    const votedIds = new Set<string>()

    for (const v of memberVotes) {
      const personId = str(v?.PersonID)
      if (!personId) continue
      if (!knownMemberIds.has(personId)) {
        console.warn(`[syncDivisionsAndVotes] Skipping vote for unknown member ${personId} in division ${documentId}`)
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
          mandate: mandateIdForDate(divisionDate),
        })
        .onConflictDoNothing()
    }

    // No shows for all members who were serving at the time of this division
    const divisionDateStr = divisionDateFixed.toISOString().slice(0, 10)

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
          mandate: mandateIdForDate(divisionDate),
        })
        .onConflictDoNothing()
    }
  }

  let processed = 0
  for (const div of allDivisions) {
    await processDivision(div)
    processed++
    if (processed % 10 === 0) {
      console.log(`[syncDivisionsAndVotes] Progress: ${processed}/${allDivisions.length} divisions processed`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`[syncDivisionsAndVotes] Complete — processed ${allDivisions.length} divisions`)
}

async function syncPlenaryItems(db: Db) {
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

async function main() {
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

  // syncMembers throws on critical failure — keep outside runSync to abort entire sync
  await syncMembers(db)
  syncResults.push({ script: 'syncMembers', status: 'success' })

  await runSync('syncHansardReports', () => syncHansardReports(db))
  await runSync('syncMandateAndRoles', () => syncMandateAndRoles(db))
  await runSync('syncMinisters', () => syncMinisters(db))
  await runSync('syncCommitteeChairs', () => syncCommitteeChairs(db))
  await runSync('syncRegisteredInterests', () => syncRegisteredInterests(db))
  await runSync('syncDivisionsAndVotes', () => syncDivisionsAndVotes(db))
  await runSync('syncBills', () => syncBills(db, false, CUTOFF))
  await runSync('syncPlenaryItems', () => syncPlenaryItems(db))
  await runSync('syncContactDetails', () => syncContactDetails(db))
  await runSync('syncHansardContributions', () => syncHansardContributions(db))
  await runSync('syncQuestionStats', () => syncQuestionStats(db))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Sync summary:')
  for (const r of syncResults) {
    const icon = r.status === 'success' ? '✓' : r.status === 'skipped' ? '–' : '✗'
    console.log(`  ${icon} ${r.script}${r.note ? ` — ${r.note}` : ''}`)
  }
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
  console.error('Sync failed:', err)
  process.exit(1)
})
