import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
const CURRENT_MANDATE = '2022-2027'

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Db = ReturnType<typeof drizzle<typeof schema>>

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) {
      console.error(`[syncQuestions] API error ${res.status} for ${path}`)
      return null
    }
    return res.json()
  } catch (err) {
    console.error(`[syncQuestions] Fetch error for ${path}:`, err)
    return null
  }
}

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

interface QuestionDetail {
  answerByDate: string | null
  answeredOnDate: string | null
  answerText: string | null
  answerTruncated: boolean
  hansardLink: string | null
}

async function fetchQuestionDetail(documentId: string): Promise<QuestionDetail | null> {
  try {
    const res = await fetch(`${BASE}/questions.asmx/GetQuestionDetails?documentId=${documentId}`)
    if (!res.ok) {
      console.error(`[syncQuestions] API error ${res.status} for question detail ${documentId}`)
      return null
    }
    const xml = await res.text()

    const answerByDateRaw = xml.match(/<AnswerByDate>(.*?)<\/AnswerByDate>/)?.[1] ?? null
    const answerByDate = answerByDateRaw ? answerByDateRaw.slice(0, 10) : null

    const answeredOnDateRaw = xml.match(/<AnsweredOnDate>(.*?)<\/AnsweredOnDate>/)?.[1] ?? null
    const answeredOnDate = answeredOnDateRaw ? answeredOnDateRaw.slice(0, 10) : null

    const answerRaw = xml.match(/<AnswerPlainText>([\s\S]*?)<\/AnswerPlainText>/)?.[1]?.trim() ?? null
    let answerText: string | null = null
    let answerTruncated = false
    if (answerRaw) {
      if (answerRaw.length > 3000) {
        answerText = answerRaw.slice(0, 3000)
        answerTruncated = true
      } else {
        answerText = answerRaw
      }
    }

    const hansardLink = xml.match(/<AnswerHansardLink>(.*?)<\/AnswerHansardLink>/)?.[1]?.trim() ?? null

    return { answerByDate, answeredOnDate, answerText, answerTruncated, hansardLink }
  } catch (err) {
    console.error(`[syncQuestions] Fetch error for question detail ${documentId}:`, err)
    return null
  }
}

export async function syncQuestions(db: Db): Promise<void> {
  const members = await db
    .select({ personId: schema.members.personId, mandateStart: schema.members.mandateStart })
    .from(schema.members)
    .where(eq(schema.members.isCurrent, true))

  // ── Phase 1 — New questions only ────────────────────────────────────────────

  console.log('[syncQuestions] Phase 1 — checking for new questions...')
  console.log(`[syncQuestions] Processing ${members.length} current members`)

  let totalNewInserted = 0
  let totalSkipped = 0
  let membersProcessed = 0

  for (const member of members) {
    const { personId, mandateStart } = member
    const mandateStartStr = mandateStart ? mandateStart.toString().slice(0, 10) : '2022-05-05'

    try {
      const data = await apiFetch<any>(
        `/questions.asmx/GetQuestionsByMember_JSON?personId=${personId}`
      )

      const raw = data?.QuestionsList?.Question ?? null
      if (!raw) {
        console.warn(`[syncQuestions] Member ${personId}: no questions returned — skipping`)
        membersProcessed++
        continue
      }

      const rawList: any[] = Array.isArray(raw) ? raw : [raw]

      const seen = new Map<string, any>()
      for (const q of rawList) {
        const docId = str(q?.DocumentId)
        if (docId && !seen.has(docId)) seen.set(docId, q)
      }

      const filtered = Array.from(seen.values()).filter((q: any) =>
        str(q?.TabledDate).slice(0, 10) >= mandateStartStr
      )

      const existingRows = await db
        .select({ questionId: schema.questions.questionId })
        .from(schema.questions)
        .where(eq(schema.questions.personId, personId))

      const existingIds = new Set(existingRows.map(r => r.questionId))

      const newQuestions = filtered.filter((q: any) => {
        const documentId = str(q?.DocumentId)
        return documentId && !existingIds.has(documentId)
      })

      if (newQuestions.length > 100) {
        console.warn(`[syncQuestions] Member ${personId}: ${newQuestions.length} new questions — unusually high for weekly sync`)
      }

      let memberNewCount = 0

      for (const q of newQuestions) {
        const documentId = str(q?.DocumentId)
        if (!documentId) { totalSkipped++; continue }

        const tabledDate = str(q?.TabledDate).slice(0, 10)
        const questionRaw = str(q?.QuestionText)
        const questionText = questionRaw.length > 600 ? questionRaw.slice(0, 600) : questionRaw
        const isOral = str(q?.Reference).toUpperCase().startsWith('AQO')
        const calendarYear = parseInt(tabledDate.slice(0, 4), 10)

        if (!tabledDate || !questionText || isNaN(calendarYear)) {
          console.warn(`[syncQuestions] Skipping question ${documentId} — missing required fields`)
          totalSkipped++
          continue
        }

        const detail = await fetchQuestionDetail(documentId)
        if (!detail) {
          console.warn(`[syncQuestions] Skipping question ${documentId} — could not fetch detail`)
          totalSkipped++
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        try {
          await db
            .insert(schema.questions)
            .values({
              questionId: documentId,
              personId,
              reference: str(q?.Reference) || null,
              tabledDate,
              answerByDate: detail.answerByDate,
              answeredOnDate: detail.answeredOnDate,
              questionText,
              answerText: detail.answerText,
              hansardLink: detail.hansardLink,
              departmentId: str(q?.DepartmentId) || null,
              department: str(q?.DepartmentName) || null,
              isOral,
              answerTruncated: detail.answerTruncated,
              calendarYear,
              mandate: CURRENT_MANDATE,
            })
            .onConflictDoNothing()

          memberNewCount++
          totalNewInserted++
        } catch (err) {
          console.error(`[syncQuestions] Failed to insert question ${documentId}:`, err)
          totalSkipped++
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (memberNewCount > 0) {
        console.log(`[syncQuestions] Member ${personId}: ${memberNewCount} new questions inserted`)
      }

      membersProcessed++

      if (membersProcessed % 10 === 0) {
        console.log(`[syncQuestions] Phase 1 progress: ${membersProcessed}/${members.length} members, ${totalNewInserted} new questions`)
      }

    } catch (err) {
      console.error(`[syncQuestions] Failed for member ${personId}:`, err)
      membersProcessed++
    }
  }

  console.log(`[syncQuestions] Phase 1 complete — ${totalNewInserted} new questions inserted, ${totalSkipped} skipped`)

  // ── Phase 2 — Unanswered questions ──────────────────────────────────────────

  console.log('[syncQuestions] Phase 2 — checking unanswered questions...')

  const unanswered = await db
    .select({ questionId: schema.questions.questionId })
    .from(schema.questions)
    .where(
      and(
        isNull(schema.questions.answerText),
        isNull(schema.questions.hansardLink)
      )
    )

  console.log(`[syncQuestions] Found ${unanswered.length} unanswered questions`)

  let totalAnswersPopulated = 0
  let totalStillUnanswered = 0
  let unansweredProcessed = 0
  const totalUnanswered = unanswered.length

  for (const { questionId } of unanswered) {
    try {
      const detail = await fetchQuestionDetail(questionId)
      if (detail?.answerText || detail?.hansardLink) {
        await db
          .update(schema.questions)
          .set({
            answerByDate: detail.answerByDate,
            answerText: detail.answerText,
            hansardLink: detail.hansardLink,
            answeredOnDate: detail.answeredOnDate,
            answerTruncated: detail.answerTruncated,
            updatedAt: new Date(),
          })
          .where(eq(schema.questions.questionId, questionId))
        totalAnswersPopulated++
      } else if (detail?.answerByDate) {
        await db
          .update(schema.questions)
          .set({
            answerByDate: detail.answerByDate,
            updatedAt: new Date(),
          })
          .where(eq(schema.questions.questionId, questionId))
        totalStillUnanswered++
      } else {
        totalStillUnanswered++
      }
    } catch (err) {
      console.error(`[syncQuestions] Failed to update answer for ${questionId}:`, err)
    }

    await new Promise(resolve => setTimeout(resolve, 100))
    unansweredProcessed++

    if (unansweredProcessed % 100 === 0) {
      console.log(`[syncQuestions] Phase 2 progress: ${unansweredProcessed}/${totalUnanswered} processed, ${totalAnswersPopulated} answers found`)
    }
  }

  console.log(`[syncQuestions] Phase 2 complete — ${totalAnswersPopulated} answers populated, ${totalStillUnanswered} still unanswered`)
  console.log(`[syncQuestions] Weekly sync complete — ${totalNewInserted} new questions, ${totalAnswersPopulated} answers populated`)
}

// Standalone entrypoint for manual runs
if (require.main === module) {
  void (async () => {
    await import('./load-env')
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set in .env.local')
    console.log('Connecting to database...')
    const sqlClient = neon(url)
    const db = drizzle(sqlClient, { schema })
    console.log('Connected.')
    await syncQuestions(db)
    process.exit(0)
  })().catch((err) => {
    console.error('[syncQuestions] Fatal error:', err)
    process.exit(1)
  })
}
