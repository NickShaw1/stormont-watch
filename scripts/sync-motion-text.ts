import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { isNull, eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'

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

type Db = ReturnType<typeof drizzle<typeof schema>>

async function syncMotionText(db: Db) {
  console.log('[syncMotionText] Fetching divisions without motion text...')

  const divisionsToUpdate = await db
    .select({ documentId: schema.divisions.documentId })
    .from(schema.divisions)
    .where(isNull(schema.divisions.motionText))

  console.log(`[syncMotionText] Found ${divisionsToUpdate.length} divisions needing motion text`)

  let updated = 0
  let skipped = 0

  for (const { documentId } of divisionsToUpdate) {
    const data = await apiFetch<any>(
      `/plenary.asmx/GetPlenaryDetails_JSON?documentId=${documentId}`
    )
    const motionText = data?.PlenaryList?.Plenary?.Text ?? null

    if (motionText) {
      await db
        .update(schema.divisions)
        .set({ motionText, updatedAt: new Date() })
        .where(eq(schema.divisions.documentId, documentId))
      updated++
    } else {
      console.warn(`[syncMotionText] No motion text returned for division ${documentId} — skipping`)
      skipped++
    }

    if ((updated + skipped) % 10 === 0) {
      console.log(`[syncMotionText] Progress: ${updated + skipped}/${divisionsToUpdate.length} — updated: ${updated}, skipped: ${skipped}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`[syncMotionText] Complete — updated: ${updated}, skipped: ${skipped}`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  console.log('Connected.')

  await syncMotionText(db)

  console.log('All done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync motion text failed:', err)
  process.exit(1)
})
