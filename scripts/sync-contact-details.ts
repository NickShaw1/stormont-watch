import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

const API_URL = 'http://data.niassembly.gov.uk/members.asmx/GetAllMemberContactDetails_JSON'

interface ContactEntry {
  PersonId: string
  AddressType: string
  EmaiAddress: string
}

interface ApiResponse {
  AllMembersList: {
    Member: ContactEntry[]
  }
}

export async function syncContactDetails(db: Db) {
  console.log('[syncContactDetails] Syncing MLA contact details...')

  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`[syncContactDetails] Failed to fetch contact details: ${res.status}`)

  const data: ApiResponse = await res.json()
  const entries = data.AllMembersList.Member

  if (entries.length === 0) {
    console.warn('[syncContactDetails] No contact entries returned from API — aborting sync')
    return
  }

  // Build email map with priority: prefer @mla.niassembly.gov.uk, fall back to @co.niassembly.gov.uk
  const mlaEmails = new Map<string, string>()
  const coEmails = new Map<string, string>()

  for (const entry of entries) {
    const email = entry.EmaiAddress
    if (!email) continue
    if (email.endsWith('@mla.niassembly.gov.uk') && !mlaEmails.has(entry.PersonId)) {
      mlaEmails.set(entry.PersonId, email)
    } else if (email.endsWith('@co.niassembly.gov.uk') && !coEmails.has(entry.PersonId)) {
      coEmails.set(entry.PersonId, email)
    }
  }

  // Merge — prefer MLA email, fall back to CO email
  const emailMap = new Map<string, string>()
  for (const [id, email] of mlaEmails) emailMap.set(id, email)
  for (const [id, email] of coEmails) {
    if (!emailMap.has(id)) emailMap.set(id, email)
  }

  const fallbackCount = [...emailMap.values()].filter(e => e.endsWith('@co.niassembly.gov.uk')).length
  console.log(`[syncContactDetails] Found emails for ${emailMap.size} MLAs (${mlaEmails.size} MLA emails, ${fallbackCount} CO fallbacks)`)

  if (emailMap.size < 80) {
    console.warn(`[syncContactDetails] Only ${emailMap.size} emails found — expected 88+, aborting to avoid data loss`)
    return
  }

  let updated = 0
  for (const [personId, email] of emailMap) {
    await db
      .update(schema.members)
      .set({ email })
      .where(eq(schema.members.personId, personId))
    updated++
  }

  console.log(`[syncContactDetails] Complete — ${updated} MLA email addresses updated`)
}

// Allow running standalone: npx tsx scripts/sync-contact-details.ts
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  await syncContactDetails(db)
  process.exit(0)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Contact details sync failed:', err)
    process.exit(1)
  })
}
