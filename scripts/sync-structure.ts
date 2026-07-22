import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, notInArray } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
import { CURRENT_MANDATE } from '../lib/constants/mandates'

/* eslint-disable @typescript-eslint/no-explicit-any */

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

type Db = ReturnType<typeof drizzle<typeof schema>>

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

    if (rawMatches.length === 0) {
      console.warn('[syncCommitteeChairs] API returned zero committee chairs — preserving existing data and skipping update')
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

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  await syncMinisters(db)
  await syncCommitteeChairs(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync structure failed:', err)
  process.exit(1)
})
