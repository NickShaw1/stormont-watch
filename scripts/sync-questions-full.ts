import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, gte, or } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk'
const CURRENT_MANDATE = '2022-2027'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Db = ReturnType<typeof drizzle<typeof schema>>

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
      console.error(`[syncQuestionsFull] API error ${res.status} for question detail ${documentId}`)
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
    console.error(`[syncQuestionsFull] Fetch error for question detail ${documentId}:`, err)
    return null
  }
}

async function syncQuestionsFull(db: Db, formerOnly: boolean) {
  const modeLabel = formerOnly ? 'former mandate MLAs only' : 'all mandate MLAs'
  console.log(`[syncQuestionsFull] Fetching members from database (${modeLabel})...`)

  const whereClause = formerOnly
    ? and(
        eq(schema.members.isCurrent, false),
        gte(schema.members.mandateStart, '2022-05-05')
      )
    : or(
        eq(schema.members.isCurrent, true),
        and(
          eq(schema.members.isCurrent, false),
          gte(schema.members.mandateStart, '2022-05-05')
        )
      )

  const members = await db
    .select({ personId: schema.members.personId, mandateStart: schema.members.mandateStart })
    .from(schema.members)
    .where(whereClause)

  console.log(`[syncQuestionsFull] Found ${members.length} members`)

  let totalQuestionsWritten = 0
  let totalSkipped = 0
  let membersProcessed = 0

  for (const member of members) {
    const { personId, mandateStart } = member
    const mandateStartStr = mandateStart ? mandateStart.toString().slice(0, 10) : '2022-05-01'

    try {
      const data = await apiFetch<any>(
        `/questions.asmx/GetQuestionsByMember_JSON?personId=${personId}`
      )

      const raw = data?.QuestionsList?.Question ?? null
      if (!raw) {
        console.warn(`[syncQuestionsFull] Member ${personId}: no questions returned from API — skipping`)
        membersProcessed++
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      const rawList: any[] = Array.isArray(raw) ? raw : [raw]

      // Deduplicate on DocumentId — API returns duplicate rows when multiple ministers are linked
      const seen = new Map<string, any>()
      for (const q of rawList) {
        const docId = str(q?.DocumentId)
        if (docId && !seen.has(docId)) seen.set(docId, q)
      }

      // Filter to questions tabled on or after member's mandate start
      const filtered = Array.from(seen.values()).filter((q: any) => {
        const tabledDate = str(q?.TabledDate).slice(0, 10)
        return tabledDate >= mandateStartStr
      })

      let questionsInserted = 0

      for (const q of filtered) {
        const documentId = str(q?.DocumentId)
        if (!documentId) {
          totalSkipped++
          continue
        }

        const tabledDate = str(q?.TabledDate).slice(0, 10)
        const questionRaw = str(q?.QuestionText)
        const questionText = questionRaw.length > 600 ? questionRaw.slice(0, 600) : questionRaw
        const isOral = str(q?.Reference).toUpperCase().startsWith('AQO')
        const calendarYear = parseInt(tabledDate.slice(0, 4), 10)

        if (!tabledDate || !questionText || isNaN(calendarYear)) {
          console.warn(`[syncQuestionsFull] Skipping question ${documentId} for member ${personId} — missing required fields`)
          totalSkipped++
          continue
        }

        const detail = await fetchQuestionDetail(documentId)
        if (!detail) {
          console.warn(`[syncQuestionsFull] Skipping question ${documentId} — could not fetch detail`)
          totalSkipped++
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }

        try {
          const result = await db
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
            .returning({ id: schema.questions.id })

          if (result.length > 0) {
            questionsInserted++
            totalQuestionsWritten++
          }
        } catch (err) {
          console.error(`[syncQuestionsFull] Failed to insert question ${documentId}:`, err)
          totalSkipped++
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      console.log(`[syncQuestionsFull] Member ${personId}: ${questionsInserted} new questions inserted`)
      membersProcessed++

      if (membersProcessed % 10 === 0) {
        console.log(`[syncQuestionsFull] Progress: ${membersProcessed}/${members.length} members processed, ${totalQuestionsWritten} questions written`)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (err) {
      console.error(`[syncQuestionsFull] Failed for member ${personId}:`, err)
      membersProcessed++
    }
  }

  console.log(`\n[syncQuestionsFull] Complete — ${membersProcessed} members processed, ${totalQuestionsWritten} questions written, ${totalSkipped} skipped`)
}

async function main() {
  const formerOnly = process.argv.includes('--former-only')

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  console.log('Connecting to database...')
  const sqlClient = neon(url)
  const db = drizzle(sqlClient, { schema })
  console.log('Connected.')

  await syncQuestionsFull(db, formerOnly)
  process.exit(0)
}

main().catch((err) => {
  console.error('[syncQuestionsFull] Fatal error:', err)
  process.exit(1)
})
