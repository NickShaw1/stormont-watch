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
 *
 * syncMembers, syncHansardReports, syncMinisters, syncCommitteeChairs,
 * syncRegisteredInterests, and syncPlenaryItems come from ./syncShared, the same
 * canonical implementations sync.ts uses. Do NOT redefine local copies of these here —
 * an earlier local copy of syncMembers lacked the historical-member guard and would
 * import every all-time MLA into the live mandate on a recovery run.
 */

import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { updateMemberTermRoles } from '../lib/db/memberWrites'
import { syncContactDetails } from './sync-contact-details'
import { syncBills } from './sync-bills'
import { syncHansardContributions } from './sync-hansard-contributions'
import { syncQuestionStats } from './sync-question-stats'
import { apiRoleToSalaryRole } from '../lib/salaries'
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

async function syncMandateAndRoles(db: Db) {
  console.log('[syncMandateAndRoles] Fetching all members from database...')

  // Derived from today's date, not the isCurrent flag, so this is correct on a manual run even
  // before the isCurrent-flip PR for a new mandate has been deployed.
  const todaysMandate = mandateForToday()

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
          // (todaysMandate.start); use electionDate so an election-day affiliation isn't missed.
          r.AffiliationStart >= todaysMandate.electionDate
        )
        .sort((a: any, b: any) =>
          new Date(b.AffiliationStart).getTime() - new Date(a.AffiliationStart).getTime()
        )[0]

      const specialRole = roles
        .filter((r: any) => r.RoleType === 'Assembly Membership Role' && r.Role !== 'MLA')
        .sort((a: any, b: any) => new Date(b.AffiliationStart).getTime() - new Date(a.AffiliationStart).getTime())[0]

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
