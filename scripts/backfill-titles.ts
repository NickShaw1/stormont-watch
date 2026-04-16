/**
 * BACKFILL SCRIPT — MANUAL USE ONLY
 * Populates title and tabled_by for existing divisions.
 * Run once after adding these columns to the divisions table.
 */

import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { isNull, eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = neon(url)
  const db = drizzle(sql, { schema })

  const divisions = await db
    .select({ documentId: schema.divisions.documentId })
    .from(schema.divisions)
    .where(isNull(schema.divisions.title))

  console.log(`Backfilling ${divisions.length} divisions...`)

  let updated = 0
  let skipped = 0

  for (const { documentId } of divisions) {
    const [plenaryData, tablersData] = await Promise.all([
      apiFetch<any>(`/plenary.asmx/GetPlenaryDetails_JSON?documentId=${documentId}`),
      apiFetch<any>(`/plenary.asmx/GetPlenaryTablers_JSON?documentId=${documentId}`),
    ])

    const title = str(plenaryData?.PlenaryList?.Plenary?.Title) || null

    const tablers: any[] = tablersData?.TablerList?.Tabler ?? []
    const tablerArray = Array.isArray(tablers) ? tablers : [tablers]
    const tabledBy = tablerArray
      .map((t: any) => str(t?.TablerName))
      .filter(Boolean)
      .join(', ') || null

    if (!title && !tabledBy) {
      skipped++
      await new Promise(r => setTimeout(r, 100))
      continue
    }

    await db
      .update(schema.divisions)
      .set({ title, tabledBy, updatedAt: new Date() })
      .where(eq(schema.divisions.documentId, documentId))

    updated++
    if (updated % 10 === 0) {
      console.log(`Progress: ${updated}/${divisions.length}`)
    }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`Complete — ${updated} updated, ${skipped} skipped`)
  process.exit(0)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
