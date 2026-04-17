import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
const CURRENT_MANDATE = '2022-2027'

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
    await db
      .insert(schema.members)
      .values({
        personId,
        fullName,
        party: str(m?.PartyName) || null,
        constituency: str(m?.ConstituencyName) || null,
        imgUrl: str(m?.MemberImgUrl) || null,
        isCurrent: currentIds.has(personId),
        mandate: CURRENT_MANDATE,
      })
      .onConflictDoUpdate({
        target: schema.members.personId,
        set: {
          fullName,
          party: str(m?.PartyName) || null,
          constituency: str(m?.ConstituencyName) || null,
          imgUrl: str(m?.MemberImgUrl) || null,
          isCurrent: currentIds.has(personId),
          updatedAt: new Date(),
        },
      })
    written++
  }
  console.log(`[syncMembers] Complete — ${written} written, ${skipped} skipped, ${currentIds.size} marked current`)
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

      if (mandateStart || assemblyRole) {
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

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  await syncMembers(db)
  await syncMandateAndRoles(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync members failed:', err)
  process.exit(1)
})
