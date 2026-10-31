import { sql } from 'drizzle-orm'
import { db } from '../client'
import { CURRENT_MANDATE, mandateStartOf, mlaImg, notServingAsSpeaker } from './helpers'
import { MIN_SITTING_QUESTIONS, questionExposure, type ConstituencyMla, type DateSpan, type ExpenseYearRow, type MonthlyAttendanceRow, type MonthlyQuestionRow } from '@/lib/constituencies'

// Every member of the mandate, current and former, with figures limited to their own tenure.
export async function getConstituencyMlaRows(
  mandate: string = CURRENT_MANDATE,
  window: { start: string; end: string } = { start: mandateStartOf(mandate), end: new Date().toISOString().slice(0, 10) },
): Promise<ConstituencyMla[]> {
  const [spanRows, monthRows] = await Promise.all([
    db.execute(sql`
      SELECT person_id, start_date::text AS start_date, end_date::text AS end_date
      FROM member_role_history
      WHERE mandate = ${mandate} AND (role_type = 'Ministerial Role' OR role = 'Speaker')
    `),
    db.execute(sql`
      SELECT person_id, year, month, written_count + oral_count AS count
      FROM question_stats
      WHERE mandate = ${mandate}
    `),
  ])
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.constituency,
      m.is_current,
      m.mandate_start::text AS mandate_start,
      m.mandate_end::text AS mandate_end,
      m.assembly_role,
      m.assembly_role_end::text AS assembly_role_end,
      COALESCE(vt.present, 0) AS present,
      COALESCE(vt.total, 0) AS total,
      COALESCE(q.written, 0) AS written,
      COALESCE(q.oral, 0) AS oral,
      ex.total AS expenses
    FROM members m
    LEFT JOIN (
      SELECT
        v.person_id,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') AS present,
        COUNT(*) AS total
      FROM votes v
      JOIN divisions d ON d.document_id = v.document_id AND d.mandate = ${mandate}
      JOIN members mm ON mm.person_id = v.person_id AND mm.mandate = ${mandate}
      WHERE v.mandate = ${mandate}
        AND (mm.mandate_start IS NULL OR d.division_date >= mm.mandate_start::date)
        AND (mm.mandate_end IS NULL OR d.division_date::date <= mm.mandate_end::date)
        AND ${notServingAsSpeaker(sql`v.person_id`, sql`d.division_date`)}
      GROUP BY v.person_id
    ) vt ON vt.person_id = m.person_id
    LEFT JOIN (
      SELECT person_id, SUM(written_count) AS written, SUM(oral_count) AS oral
      FROM question_stats
      WHERE mandate = ${mandate}
      GROUP BY person_id
    ) q ON q.person_id = m.person_id
    LEFT JOIN (
      SELECT person_id, SUM(total) AS total
      FROM expenses
      WHERE mandate = ${mandate} AND total IS NOT NULL
      GROUP BY person_id
    ) ex ON ex.person_id = m.person_id
    WHERE m.mandate = ${mandate}
      AND m.constituency IS NOT NULL
    ORDER BY m.constituency, m.full_name
  `)

  type Row = {
    person_id: string
    full_name: string
    party: string | null
    constituency: string
    is_current: boolean
    mandate_start: string | null
    mandate_end: string | null
    assembly_role: string | null
    assembly_role_end: string | null
    present: string
    total: string
    written: string
    oral: string
    expenses: string | null
  }

  const spansByPerson = new Map<string, DateSpan[]>()
  for (const r of spanRows.rows as unknown as { person_id: string; start_date: string; end_date: string | null }[]) {
    const list = spansByPerson.get(r.person_id) ?? []
    list.push({ start: r.start_date, end: r.end_date })
    spansByPerson.set(r.person_id, list)
  }

  const countsByPerson = new Map<string, Map<string, number>>()
  const assemblyByMonth = new Map<string, number>()
  for (const r of monthRows.rows as unknown as { person_id: string; year: number; month: number; count: string }[]) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`
    const byMonth = countsByPerson.get(r.person_id) ?? new Map<string, number>()
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(r.count))
    countsByPerson.set(r.person_id, byMonth)
    assemblyByMonth.set(key, (assemblyByMonth.get(key) ?? 0) + Number(r.count))
  }
  const sittingMonths = new Set([...assemblyByMonth].filter(([, n]) => n >= MIN_SITTING_QUESTIONS).map(([key]) => key))

  return (result.rows as unknown as Row[]).map((r) => {
    const excludedSpans = spansByPerson.get(r.person_id) ?? []
    const exposure = questionExposure(
      { mandateStart: r.mandate_start, mandateEnd: r.mandate_end },
      excludedSpans,
      countsByPerson.get(r.person_id) ?? new Map<string, number>(),
      sittingMonths,
      window.start,
      window.end,
    )
    return {
      personId: r.person_id,
      fullName: r.full_name,
      party: r.party,
      constituency: r.constituency,
      imgUrl: mlaImg(r.person_id),
      isCurrent: r.is_current,
      mandateStart: r.mandate_start,
      mandateEnd: r.mandate_end,
      assemblyRole: r.assembly_role,
      assemblyRoleEnd: r.assembly_role_end,
      present: Number(r.present),
      total: Number(r.total),
      written: Number(r.written),
      oral: Number(r.oral),
      expenses: r.expenses === null ? null : Number(r.expenses),
      questionCount: exposure.count,
      questionMonths: exposure.months,
      excludedSpans,
    }
  })
}

// Register category 53: family members who benefit from Office Cost Expenditure.
export async function getFamilyEmployedIds(mandate: string): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT DISTINCT person_id
    FROM registered_interests
    WHERE mandate = ${mandate} AND register_category_id = '53'
  `)
  return new Set((result.rows as unknown as { person_id: string }[]).map((r) => r.person_id))
}

export async function getMonthlyAttendanceRows(mandate: string, since: string): Promise<MonthlyAttendanceRow[]> {
  const result = await db.execute(sql`
    SELECT
      v.person_id,
      to_char(d.division_date::date, 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') AS present,
      COUNT(*) AS total
    FROM votes v
    JOIN divisions d ON d.document_id = v.document_id AND d.mandate = ${mandate}
    JOIN members mm ON mm.person_id = v.person_id AND mm.mandate = ${mandate}
    WHERE v.mandate = ${mandate}
      AND d.division_date::date >= ${since}::date
      AND (mm.mandate_start IS NULL OR d.division_date >= mm.mandate_start::date)
      AND (mm.mandate_end IS NULL OR d.division_date::date <= mm.mandate_end::date)
      AND ${notServingAsSpeaker(sql`v.person_id`, sql`d.division_date`)}
    GROUP BY v.person_id, to_char(d.division_date::date, 'YYYY-MM')
  `)
  return (result.rows as unknown as { person_id: string; month: string; present: string; total: string }[]).map((r) => ({
    personId: r.person_id,
    month: r.month,
    present: Number(r.present),
    total: Number(r.total),
  }))
}

export async function getMonthlyQuestionRows(mandate: string, since: string): Promise<MonthlyQuestionRow[]> {
  const result = await db.execute(sql`
    SELECT person_id, year, month, written_count + oral_count AS count
    FROM question_stats
    WHERE mandate = ${mandate}
      AND year * 100 + month >= ${Number(since.slice(0, 4)) * 100 + Number(since.slice(5, 7))}
  `)
  return (result.rows as unknown as { person_id: string; year: number; month: number; count: number }[]).map((r) => ({
    personId: r.person_id,
    month: `${r.year}-${String(r.month).padStart(2, '0')}`,
    count: Number(r.count),
  }))
}

export async function getExpenseYearRows(mandate: string, years: string[]): Promise<ExpenseYearRow[]> {
  const result = await db.execute(sql`
    SELECT person_id, financial_year, total
    FROM expenses
    WHERE mandate = ${mandate} AND total IS NOT NULL AND financial_year IN (${sql.join(years.map((y) => sql`${y}`), sql`, `)})
  `)
  return (result.rows as unknown as { person_id: string; financial_year: string; total: string }[]).map((r) => ({
    personId: r.person_id,
    financialYear: r.financial_year,
    total: Number(r.total),
  }))
}
