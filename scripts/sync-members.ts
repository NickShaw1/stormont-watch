// Manual one-off resync of members and their mandate/role data (e.g. after a
// mid-mandate role change). syncMembers comes from ./syncShared, the same canonical
// implementation sync.ts and sync-full.ts use — do not fork a local copy here.
// syncMandateAndRoles below is this script's own, used only here and in sync-full.ts.
// --roles-only skips the member-roster resync and only re-fetches role history.
import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { apiRoleToSalaryRole } from '../lib/salaries'
import { updateMemberTermRoles } from '../lib/db/memberWrites'
import { BASE, type Db, syncMembers } from './syncShared'
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
  let skippedNoRoles = 0
  let skippedError = 0
  let noMandateRole = 0
  let processed = 0

  for (const { personId } of allMembers) {
    try {
      const res = await fetch(
        `${BASE}/members.asmx/GetMemberRolesByPersonId_JSON?PersonId=${personId}`
      )
      if (!res.ok) {
        console.warn(`[syncMandateAndRoles] API error ${res.status} for member ${personId} — skipping`)
        skippedNoRoles++
        continue
      }
      const data = await res.json()
      const roles: any[] = data?.AllMembersRoles?.Role ?? []

      if (roles.length === 0) {
        console.warn(`[syncMandateAndRoles] No roles returned for member ${personId} — skipping`)
        skippedNoRoles++
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

      if (!currentMandateMlaRole) {
        noMandateRole++
      }

      if (specialRole) {
        console.log(`[syncMandateAndRoles] Special assembly role detected — ${personId}: ${specialRole.Role}`)
      }

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
          // Include roles that started before mandate but were still active at mandate start
          const stillActiveAtMandateStart = !endDate || endDate >= MANDATE_START
          if (!stillActiveAtMandateStart) continue
          // Role will use MANDATE_START as effective start date
        }

        const effectiveStartDate = startDate < MANDATE_START ? MANDATE_START : startDate

        if (roleType === 'Committee Role (incl Assembly Commission)' && AD_HOC_RE.test(organisation)) continue

        const salaryRole = apiRoleToSalaryRole(roleType, role, organisation)
        if (!salaryRole) {
          console.warn(`[syncMandateAndRoles] Unrecognised role skipped — personId: ${personId}, roleType: "${roleType}", role: "${role}", organisation: "${organisation}"`)
          continue
        }

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
      skippedError++
    }
  }

  console.log(`[syncMandateAndRoles] Complete — ${updated} updated, ${skippedNoRoles} skipped (no roles), ${skippedError} skipped (error), ${noMandateRole} had no current mandate MLA role`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  const rolesOnly = process.argv.includes('--roles-only')

  if (!rolesOnly) {
    await syncMembers(db)
  } else {
    console.log('--roles-only flag detected — skipping syncMembers')
  }

  await syncMandateAndRoles(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync members failed:', err)
  process.exit(1)
})
