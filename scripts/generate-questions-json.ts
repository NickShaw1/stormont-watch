import './load-env'
import { neon } from '@neondatabase/serverless'
import * as fs from 'fs'
import * as path from 'path'
import { partySlug } from '../lib/format'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QuestionRow {
  question_id: string
  reference: string | null
  tabled_date: string
  answered_on_date: string | null
  question_text: string
  answer_text: string | null
  hansard_link: string | null
  department: string | null
  is_oral: boolean
  calendar_year: number
  answer_truncated: boolean
  person_id: string
  full_name: string
  constituency: string | null
  party: string | null
}

interface QuestionFile {
  question_id: string
  reference: string | null
  tabled_date: string
  answered_on_date: string | null
  question_text: string
  answer_text: string | null
  hansard_link: string | null
  department: string | null
  is_oral: boolean
  calendar_year: number
  answer_truncated: boolean
}

interface PartyQuestionFile extends QuestionFile {
  person_id: string
  full_name: string
  constituency: string | null
}

async function generateQuestionsJson() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[generateQuestionsJson] DATABASE_URL is not set — aborting')
    process.exit(1)
  }

  console.log('[generateQuestionsJson] Connecting to database...')
  const sql = neon(url)

  console.log('[generateQuestionsJson] Querying questions...')
  const rows = await sql`
    SELECT
      q.question_id, q.reference, q.tabled_date, q.answered_on_date,
      q.question_text, q.answer_text, q.hansard_link, q.department,
      q.is_oral, q.calendar_year, q.answer_truncated, q.person_id,
      m.full_name, m.constituency, m.party
    FROM questions q
    JOIN members m ON q.person_id = m.person_id
    WHERE (m.is_current = true OR (m.is_current = false AND m.mandate_start >= '2022-05-05'))
    ORDER BY q.person_id, q.tabled_date DESC
  ` as QuestionRow[]

  console.log(`[generateQuestionsJson] Fetched ${rows.length} rows from database`)

  if (rows.length === 0) {
    console.error('[generateQuestionsJson] Query returned zero rows — aborting to prevent writing empty JSON files')
    process.exit(1)
  }

  if (rows.length < 40000) {
    console.error(`[generateQuestionsJson] Query returned only ${rows.length} rows (expected ≥40,000) — aborting to prevent incomplete JSON files`)
    process.exit(1)
  }

  const mlaDir = path.join(process.cwd(), 'public', 'data', 'questions')
  const partyDir = path.join(mlaDir, 'party')
  fs.mkdirSync(mlaDir, { recursive: true })
  fs.mkdirSync(partyDir, { recursive: true })

  // Single-pass grouping
  const byMla = new Map<string, QuestionFile[]>()
  const byParty = new Map<string, PartyQuestionFile[]>()

  for (const row of rows) {
    const q: QuestionFile = {
      question_id: row.question_id,
      reference: row.reference,
      tabled_date: (() => {
        const d = row.tabled_date
        if (typeof d === 'string') return d.slice(0, 10)
        const year = (d as any).getFullYear()
        const month = String((d as any).getMonth() + 1).padStart(2, '0')
        const day = String((d as any).getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })(),
      answered_on_date: (() => {
        const d = row.answered_on_date
        if (!d) return null
        if (typeof d === 'string') return d.slice(0, 10)
        const year = (d as any).getFullYear()
        const month = String((d as any).getMonth() + 1).padStart(2, '0')
        const day = String((d as any).getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })(),
      question_text: row.question_text,
      answer_text: row.answer_text,
      hansard_link: row.hansard_link,
      department: row.department,
      is_oral: row.is_oral,
      calendar_year: row.calendar_year,
      answer_truncated: row.answer_truncated,
    }

    if (!byMla.has(row.person_id)) byMla.set(row.person_id, [])
    byMla.get(row.person_id)!.push(q)

    if (row.party) {
      const slug = partySlug(row.party)
      if (!byParty.has(slug)) byParty.set(slug, [])
      byParty.get(slug)!.push({ ...q, person_id: row.person_id, full_name: row.full_name, constituency: row.constituency })
    }
  }

  // Write per-MLA files
  let mlaFilesWritten = 0
  let mlaFilesSkipped = 0
  let mlaProgress = 0

  for (const [personId, questions] of byMla) {
    if (questions.length === 0) {
      console.warn(`[generateQuestionsJson] MLA ${personId} has zero questions — skipping`)
      mlaFilesSkipped++
      continue
    }
    try {
      fs.writeFileSync(
        path.join(mlaDir, `${personId}.json`),
        JSON.stringify(questions)
      )
      mlaFilesWritten++
      mlaProgress++
      if (mlaProgress % 20 === 0) {
        console.log(`[generateQuestionsJson] Progress: ${mlaProgress} MLA files written`)
      }
    } catch (err) {
      console.error(`[generateQuestionsJson] Failed to write MLA file for ${personId}:`, err)
    }
  }

  // Write per-party files
  let partyFilesWritten = 0
  let partyFilesSkipped = 0

  for (const [slug, questions] of byParty) {
    questions.sort((a, b) => (b.tabled_date ?? '').localeCompare(a.tabled_date ?? ''))
    if (questions.length === 0) {
      console.warn(`[generateQuestionsJson] Party ${slug} has zero questions — skipping`)
      partyFilesSkipped++
      continue
    }
    try {
      fs.writeFileSync(
        path.join(partyDir, `${slug}.json`),
        JSON.stringify(questions)
      )
      partyFilesWritten++
    } catch (err) {
      console.error(`[generateQuestionsJson] Failed to write party file for ${slug}:`, err)
    }
  }

  const skippedTotal = mlaFilesSkipped + partyFilesSkipped
  console.log(`\n[generateQuestionsJson] Complete`)
  console.log(`  MLA files written:   ${mlaFilesWritten}${mlaFilesSkipped > 0 ? ` (${mlaFilesSkipped} skipped)` : ''}`)
  console.log(`  Party files written: ${partyFilesWritten}${partyFilesSkipped > 0 ? ` (${partyFilesSkipped} skipped)` : ''}`)
  console.log(`  Total questions:     ${rows.length}`)
  if (skippedTotal > 0) console.log(`  Total files skipped: ${skippedTotal}`)
}

generateQuestionsJson().catch((err) => {
  console.error('[generateQuestionsJson] Fatal error:', err)
  process.exit(1)
})
