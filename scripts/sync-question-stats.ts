import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { eq } from 'drizzle-orm'

const BASE = 'http://data.niassembly.gov.uk'

type Db = ReturnType<typeof drizzle<typeof schema>>

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function syncQuestionStats(db: Db) {
  console.log('[syncQuestionStats] Fetching current members...')

  const members = await db
    .select({ personId: schema.members.personId })
    .from(schema.members)
    .where(eq(schema.members.isCurrent, true))

  console.log(`[syncQuestionStats] Processing ${members.length} members...`)

  let processed = 0
  let skippedApiError = 0
  let skippedError = 0

  const cutoffPreview = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()
  console.log(`[syncQuestionStats] Filtering questions from ${cutoffPreview} onwards`)

  for (const { personId } of members) {
    try {
      const res = await fetch(`${BASE}/questions.asmx/GetQuestionsByMember_JSON?PersonId=${personId}`)
      if (!res.ok) {
        console.warn(`[syncQuestionStats] API error ${res.status} for member ${personId}`)
        skippedApiError++
        continue
      }
      const data = await res.json()
      const raw = data?.QuestionsList?.Question ?? []
      const questions = Array.isArray(raw) ? raw : [raw]

      if (questions.length === 0) {
        console.warn(`[syncQuestionStats] Member ${personId} — API returned no questions`)
      }

      // Filter to last 6 months only — older months are already correct
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const cutoff = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

      const mandateQuestions = questions.filter((q: any) => {
        const date = q?.TabledDate?.slice(0, 10)
        return date && date >= cutoff
      })

      // Group by year and month
      const counts: Record<string, { written: number; oral: number }> = {}
      for (const q of mandateQuestions) {
        const date = q?.TabledDate?.slice(0, 10)
        if (!date) continue
        const year = parseInt(date.slice(0, 4))
        const month = parseInt(date.slice(5, 7))
        const key = `${year}-${month}`
        if (!counts[key]) counts[key] = { written: 0, oral: 0 }
        const ref = q?.Reference ?? ''
        if (ref.startsWith('AQO')) {
          counts[key].oral++
        } else {
          counts[key].written++
        }
      }

      if (mandateQuestions.length > 0) {
        const totalWritten = Object.values(counts).reduce((s, c) => s + c.written, 0)
        const totalOral = Object.values(counts).reduce((s, c) => s + c.oral, 0)
        console.log(`[syncQuestionStats] Member ${personId} — ${mandateQuestions.length} questions in window (${totalWritten} written, ${totalOral} oral)`)
      }

      // Upsert into question_stats
      for (const [key, { written, oral }] of Object.entries(counts)) {
        const [year, month] = key.split('-').map(Number)
        await db
          .insert(schema.questionStats)
          .values({
            personId,
            year,
            month,
            writtenCount: written,
            oralCount: oral,
          })
          .onConflictDoUpdate({
            target: [schema.questionStats.personId, schema.questionStats.year, schema.questionStats.month],
            set: {
              writtenCount: written,
              oralCount: oral,
              updatedAt: new Date(),
            },
          })
      }

      processed++
      if (processed % 10 === 0) {
        console.log(`[syncQuestionStats] Progress: ${processed}/${members.length}`)
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (err) {
      console.error(`[syncQuestionStats] Failed for member ${personId}:`, err)
      skippedError++
    }
  }

  if (processed === 0 && (skippedApiError > 0 || skippedError > 0)) {
    throw new Error(`[syncQuestionStats] Zero members processed — possible API outage (${skippedApiError} API errors, ${skippedError} exceptions)`)
  }

  console.log(`[syncQuestionStats] Complete — ${processed} processed, ${skippedApiError} API errors, ${skippedError} exceptions`)
}

if (require.main === module) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  const db = drizzle(sql, { schema })
  syncQuestionStats(db)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1) })
}
