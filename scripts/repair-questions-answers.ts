import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Db = ReturnType<typeof drizzle<typeof schema>>

async function fetchAnswerText(questionId: string): Promise<{ answerText: string | null; answerTruncated: boolean } | null> {
  try {
    const res = await fetch(`${BASE}/questions.asmx/GetQuestionDetails?documentId=${questionId}`)
    if (!res.ok) {
      console.warn(`[repairAnswers] API error ${res.status} for question ${questionId} — skipping`)
      return null
    }
    const xml = await res.text()

    const answerRaw = xml.match(/<AnswerPlainText>([\s\S]*?)<\/AnswerPlainText>/)?.[1]?.trim() ?? null
    if (!answerRaw) return { answerText: null, answerTruncated: false }

    if (answerRaw.length > 3000) {
      return { answerText: answerRaw.slice(0, 3000), answerTruncated: true }
    }
    return { answerText: answerRaw, answerTruncated: false }
  } catch (err) {
    console.warn(`[repairAnswers] Fetch error for question ${questionId}:`, err)
    return null
  }
}

async function repairAnswers(db: Db, unansweredMode: boolean) {
  if (unansweredMode) {
    console.log('[repairAnswers] Mode: re-fetching unanswered written questions')
  } else {
    console.log('[repairAnswers] Mode: re-fetching truncated answers')
  }

  const whereClause = unansweredMode
    ? and(eq(schema.questions.isOral, false), isNull(schema.questions.answerText))
    : eq(schema.questions.answerTruncated, true)

  const truncated = await db
    .select({ questionId: schema.questions.questionId, answerText: schema.questions.answerText })
    .from(schema.questions)
    .where(whereClause)

  console.log(`[repairAnswers] Found ${truncated.length} question${truncated.length !== 1 ? 's' : ''} to process`)

  if (truncated.length === 0) {
    console.log('[repairAnswers] Nothing to do')
    return
  }

  if (truncated.length > 15000) {
    console.warn(`[repairAnswers] ${truncated.length} questions found — unusually high count, but continuing`)
  }

  let updated = 0
  let skipped = 0
  let unchanged = 0

  for (let i = 0; i < truncated.length; i++) {
    const { questionId, answerText: existingAnswer } = truncated[i]

    try {
      const result = await fetchAnswerText(questionId)

      if (result === null) {
        skipped++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      if (result.answerText === null || result.answerText === '') {
        console.warn(`[repairAnswers] Question ${questionId} returned empty answer text — skipping`)
        skipped++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      const existingLen = existingAnswer?.length ?? 0
      if (result.answerText.length <= existingLen) {
        unchanged++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      await db
        .update(schema.questions)
        .set({
          answerText: result.answerText,
          answerTruncated: result.answerTruncated,
          updatedAt: new Date(),
        })
        .where(eq(schema.questions.questionId, questionId))

      updated++
    } catch (err) {
      console.error(`[repairAnswers] Failed for question ${questionId}:`, err)
      skipped++
    }

    await new Promise((resolve) => setTimeout(resolve, 100))

    const processed = updated + skipped + unchanged
    if (processed % 50 === 0) {
      console.log(`[repairAnswers] Progress: ${processed}/${truncated.length} — ${updated} updated, ${skipped} skipped, ${unchanged} unchanged`)
    }
  }

  console.log(`\n[repairAnswers] Complete — ${updated} updated, ${skipped} skipped, ${unchanged} unchanged`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sqlClient = neon(url)
  const db = drizzle(sqlClient, { schema })
  console.log('Connected.')

  const unansweredMode = process.argv.includes('--unanswered')
  await repairAnswers(db, unansweredMode)
  process.exit(0)
}

main().catch((err) => {
  console.error('[repairAnswers] Fatal error:', err)
  process.exit(1)
})
