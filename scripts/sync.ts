// ROUTINE SYNC — run nightly via cron (npm run sync). Runs daily-cadence steps every
// time, plus weekly-cadence steps (member roster, roles, interests, question stats,
// Hansard contributions) only on Mondays, or any day with --force-monday.
// Most step functions are imported from ./syncShared, the canonical implementations
// also used by sync-full.ts, sync-members.ts, sync-structure.ts, and sync-hansard.ts —
// do not fork a local copy of one of those functions here; edit syncShared.ts instead.
// syncNewDivisions and syncCurrentMemberRoles below are local to this file only.
import './load-env'
import { syncBills } from './sync-bills'
import { syncPlenaryDiary } from './sync-plenary-diary'
import { syncContactDetails } from './sync-contact-details'
import { syncQuestionStats } from './sync-question-stats'
import { syncHansardContributions } from './sync-hansard-contributions'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { apiRoleToSalaryRole } from '../lib/salaries'
import { updateMemberTermRoles } from '../lib/db/memberWrites'
import {
  BASE,
  type Db,
  apiFetch,
  str,
  isoDate,
  syncMembers,
  syncHansardReports,
  syncMinisters,
  syncCommitteeChairs,
  syncRegisteredInterests,
  syncPlenaryItems,
} from './syncShared'

const CUTOFF = '2022-05-01'
import { mandateIdForDate, mandateForToday } from '../lib/constants/mandates'

/* eslint-disable @typescript-eslint/no-explicit-any */

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
    console.log(`[syncNewDivisions] Database is up to date. No new divisions to sync. [${startDate} → ${endDate}]`)
    return
  }

  const data = await apiFetch<any>(
    `/plenary.asmx/GetVotesOnDivision_JSON?startdate=${startDate}&enddate=${endDate}`
  )

  const raw = data?.DivisionList?.Division ?? []
  const newDivisions: any[] = Array.isArray(raw) ? raw : [raw]

  if (newDivisions.length === 0) {
    console.log(`[syncNewDivisions] No new divisions found. [${startDate} → ${endDate}]`)
    return
  }

  console.log(`[syncNewDivisions] Found ${newDivisions.length} new divisions [${startDate} → ${endDate}]`)

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
        console.warn(`[syncNewDivisions] Could not find parent motion for amendment division ${documentId} — title: "${title}"`)
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

    processed++
    if (processed % 10 === 0) {
      console.log(`[syncNewDivisions] Progress: ${processed}/${newDivisions.length} divisions processed`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`[syncNewDivisions] Complete — ${processed} divisions written, ${skipped} skipped`)
}

async function syncCurrentMemberRoles(db: Db) {
  console.log('[syncCurrentMemberRoles] Fetching roles for current members and recently departed members with missing mandate_end...')

  // Derived from today's date, not the isCurrent flag, so this is correct on a cron run even
  // before the isCurrent-flip PR for a new mandate has been deployed.
  const todaysMandate = mandateForToday()

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
          // Members are returned at the election, which is on or before the first sitting
          // (todaysMandate.start); use electionDate so an election-day affiliation isn't missed.
          r.AffiliationStart >= todaysMandate.electionDate
        )
        .sort((a: any, b: any) =>
          new Date(b.AffiliationStart).getTime() - new Date(a.AffiliationStart).getTime()
        )[0]

      const specialRole = roles
        .filter((r: any) => r.RoleType === 'Assembly Membership Role' && r.Role !== 'MLA')
        .sort((a: any, b: any) => new Date(b.AffiliationStart).getTime() - new Date(a.AffiliationStart).getTime())[0]

      const designationRole = roles.find(
        (r: any) =>
          r.RoleType === 'Political Designation Role' &&
          !r.AffiliationEnd
      )

      const mandateStart = currentMandateMlaRole?.AffiliationStart?.slice(0, 10) ?? null
      const mandateEnd = currentMandateMlaRole?.AffiliationEnd?.slice(0, 10) ?? null
      const assemblyRole = specialRole?.Role ?? null
      const assemblyRoleStart = specialRole?.AffiliationStart?.slice(0, 10) ?? null
      const assemblyRoleEnd = specialRole?.AffiliationEnd?.slice(0, 10) ?? null
      const designation = designationRole?.Role ?? null

      await updateMemberTermRoles(db, personId, {
        mandateStart,
        mandateEnd,
        assemblyRole,
        assemblyRoleStart,
        assemblyRoleEnd,
        designation,
      })
      updated++

      const MANDATE_START = todaysMandate.start
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
          // Include roles that started before mandate but were still active at mandate start
          const stillActiveAtMandateStart = !endDate || endDate >= MANDATE_START
          if (!stillActiveAtMandateStart) continue
          // Role will use MANDATE_START as effective start date
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

  async function runSync(name: string, fn: () => Promise<string | void>) {
    try {
      const summary = await fn()
      syncResults.push({ script: name, status: 'success', note: summary ?? undefined })
    } catch (err) {
      console.error(`[${name}] Failed:`, err)
      syncResults.push({ script: name, status: 'error', note: String(err) })
    }
  }

  const isMonday = new Date().getDay() === 1 || process.argv.includes('--force-monday')
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
    await runSync('syncQuestionStats', () => syncQuestionStats(db))
    await runSync('syncHansardContributions', () => syncHansardContributions(db))
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
  await runSync('syncPlenaryItems', () => syncPlenaryItems(db))
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
  const fromFlag = process.argv.find(a => a.startsWith('--from='))?.split('=')[1]
  const toFlag = process.argv.find(a => a.startsWith('--to='))?.split('=')[1]
  if (fromFlag) {
    await runSync('syncNewDivisions:range', () => syncNewDivisions(db, knownMemberIds, currentMemberIds, fromFlag, toFlag))
  }
  await runSync('syncBills', () => syncBills(db, false, isBackfill2022 ? '2022-05-01' : undefined))
  await runSync('syncPlenaryDiary', () => syncPlenaryDiary(db))

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
