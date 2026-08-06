import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { mandateIdForDate } from '../lib/constants/mandates'

const BASE = 'http://data.niassembly.gov.uk'

type Db = ReturnType<typeof drizzle<typeof schema>>

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function syncQuestionStats(db: Db) {
  console.log('[syncQuestionStats] Fetching current members...')

  const currentMembers = await db
    .select({ personId: schema.members.personId, mandateStart: schema.members.mandateStart })
    .from(schema.members)
    .where(eq(schema.members.isCurrent, true))

  // Former members with zero question_stats rows have never been backfilled (the sync only
  // ever covers isCurrent=true members) — give each of these a one-time full-history fetch
  // instead of the rolling 6-month window, so their real record isn't silently lost once they
  // leave. Self-healing: covers today's gap and every future departure on its first run after.
  // Bounded to each member's own mandateStart — never backfill questions from before their
  // own term began (e.g. a prior mandate, or a co-opted member's predecessor).
  const formerMembersNeedingBackfill = await db.execute(sql`
    SELECT m.person_id as "personId", m.mandate_start as "mandateStart"
    FROM members m
    WHERE m.is_current = false
    AND m.mandate_start IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM question_stats qs WHERE qs.person_id = m.person_id)
  `)
  const backfillRows = formerMembersNeedingBackfill.rows as { personId: string; mandateStart: string }[]
  const backfillIds = new Set(backfillRows.map(r => r.personId))
  const backfillStartByPersonId = new Map(backfillRows.map(r => [r.personId, r.mandateStart.slice(0, 10)]))

  const members = [...currentMembers, ...backfillRows.map(r => ({ personId: r.personId, mandateStart: r.mandateStart }))]

  console.log(`[syncQuestionStats] Processing ${currentMembers.length} current members + ${backfillIds.size} former members needing backfill...`)

  let processed = 0
  let skippedApiError = 0
  let skippedError = 0

  const cutoffPreview = (() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()
  console.log(`[syncQuestionStats] Filtering questions from ${cutoffPreview} onwards (current members); full history for backfilled former members`)

  for (const { personId } of members) {
    const isBackfill = backfillIds.has(personId)
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

      // Current members: last 6 months only — older months are already correct. Former
      // members being backfilled: their full history from their own mandateStart onward —
      // never before it, so a returning MLA's prior-mandate questions aren't misattributed.
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const rollingCutoff = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`
      const cutoff = isBackfill ? backfillStartByPersonId.get(personId)! : rollingCutoff

      const mandateQuestions = questions.filter((q: any) => {
        const date = q?.TabledDate?.slice(0, 10)
        return date && date >= cutoff
      })

      // Group by year and month. Track one real TabledDate per group (not a synthetic
      // "-01" reconstruction) so mandateIdForDate resolves correctly even for a month
      // where the mandate itself started partway through (e.g. May 2022, which starts
      // 2022-05-05 — "2022-05-01" falls before that and would fail to resolve).
      const counts: Record<string, { written: number; oral: number; sampleDate: string }> = {}
      for (const q of mandateQuestions) {
        const date = q?.TabledDate?.slice(0, 10)
        if (!date) continue
        const year = parseInt(date.slice(0, 4))
        const month = parseInt(date.slice(5, 7))
        const key = `${year}-${month}`
        if (!counts[key]) counts[key] = { written: 0, oral: 0, sampleDate: date }
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
      for (const [key, { written, oral, sampleDate }] of Object.entries(counts)) {
        const [year, month] = key.split('-').map(Number)
        const mandate = mandateIdForDate(sampleDate)
        await db
          .insert(schema.questionStats)
          .values({
            personId,
            year,
            month,
            writtenCount: written,
            oralCount: oral,
            mandate,
          })
          .onConflictDoUpdate({
            target: [schema.questionStats.personId, schema.questionStats.year, schema.questionStats.month, schema.questionStats.mandate],
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
