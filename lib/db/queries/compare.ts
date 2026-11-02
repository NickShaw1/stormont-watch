import { sql } from 'drizzle-orm'
import { db } from '../client'
import { CURRENT_MANDATE, mandateStartOf, mlaImg, notServingAsSpeaker } from './helpers'
import { getMembersGroupedByParty, getAllMinisters } from './members'
import { getQuestionTotalsAllMembers } from './questions'
import { getTotalExpensesPerMember, getMandateExpenseServiceRows } from './expenses'
import { financialYearEnd, monthsInOffice } from '@/lib/constituencies'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { getSurname } from '@/lib/format'

export type CompareRank = { rank: number; of: number }

export type CompareRanks = {
  attendance: CompareRank | null
  questions: CompareRank | null
  sittings: CompareRank | null
  debates: CompareRank | null
  expenses: CompareRank | null
  expensesPerMonth: CompareRank | null
}

export type CompareMla = {
  id: string
  name: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  attendance: number | null
  questions: number | null
  sittings: number | null
  debates: number | null
  expenses: number
  expensesPerMonth: number | null
  since: string | null
  servedDays: number | null
  ranks: CompareRanks
  votes: string
}

export type CompareDivision = {
  id: string
  title: string
  sub: string | null
  date: string
}

export type ComparePools = {
  attendance: number[]
  questions: number[]
  sittings: number[]
  debates: number[]
  expenses: number[]
  expensesPerMonth: number[]
}

export type ExtremePerson = {
  id: string
  name: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  current: boolean
}

export type Extreme = {
  value: number
  count: number
  person: ExtremePerson | null
}

export type ExtremeKey = 'served' | 'attendance' | 'questions' | 'sittings' | 'debates' | 'expenses' | 'expensesPerMonth'

export type CompareExtremes = Record<ExtremeKey, { high: Extreme; low: Extreme } | null>

export type CompareData = {
  mlas: CompareMla[]
  divisions: CompareDivision[]
  pools: ComparePools
  extremes: CompareExtremes
}

const VOTE_CODE: Record<string, string> = { AYE: 'A', NO: 'N', ABSTAINED: 'B', NO_SHOW: 'X' }
const MIN_MONTHS_RANKED = 12

export async function getCompareData(mandate: string = CURRENT_MANDATE): Promise<CompareData> {
  const [groups, ministers, questionTotals, expenseTotals, divisionRows, voteRows, hansardRows] = await Promise.all([
    getMembersGroupedByParty(mandate),
    getAllMinisters(mandate),
    getQuestionTotalsAllMembers(mandate),
    getTotalExpensesPerMember(mandate),
    db.execute(sql`
      SELECT document_id, subject, title, division_date
      FROM divisions
      WHERE mandate = ${mandate}
      ORDER BY division_date ASC, document_id ASC
    `),
    db.execute(sql`
      SELECT v.person_id, v.document_id, v.vote
      FROM votes v
      JOIN divisions d ON d.document_id = v.document_id AND d.mandate = ${mandate}
      JOIN members m ON m.person_id = v.person_id AND m.mandate = ${mandate}
      WHERE v.mandate = ${mandate}
      AND m.is_current = true
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz)
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
    `),
    db.execute(sql`
      SELECT person_id,
        COUNT(DISTINCT report_doc_id)::int AS sittings,
        COUNT(DISTINCT debate_title)::int AS debates
      FROM hansard_contributions
      WHERE mandate = ${mandate}
      GROUP BY person_id
    `),
  ])

  const divisions: CompareDivision[] = (divisionRows.rows as { document_id: string; subject: string; title: string | null; division_date: string | Date }[]).map((d) => {
    const parts = formatDivisionSubject(d.title ?? d.subject)
    return {
      id: d.document_id,
      title: parts.title,
      sub: parts.subtitle,
      date: new Date(d.division_date).toISOString().slice(0, 10),
    }
  })
  const divisionIndex = new Map(divisions.map((d, i) => [d.id, i]))

  const voteStrings = new Map<string, string[]>()
  for (const row of voteRows.rows as { person_id: string; document_id: string; vote: string }[]) {
    const idx = divisionIndex.get(row.document_id)
    const code = VOTE_CODE[row.vote]
    if (idx === undefined || !code) continue
    let arr = voteStrings.get(row.person_id)
    if (!arr) {
      arr = new Array(divisions.length).fill('-')
      voteStrings.set(row.person_id, arr)
    }
    arr[idx] = code
  }

  const ministerIds = new Set(ministers.map((m) => m.personId))

  const serviceRows = await getMandateExpenseServiceRows(mandate)
  const windowEnd = serviceRows[0]?.latestYear ? financialYearEnd(serviceRows[0].latestYear) : null
  const windowStart = mandateStartOf(mandate)
  const dateOf = (d: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null)
  const monthsOf = (r: (typeof serviceRows)[number]) =>
    windowEnd
      ? Math.round(monthsInOffice({ mandateStart: dateOf(r.mandateStart), mandateEnd: r.isCurrent ? null : dateOf(r.mandateEnd) }, windowStart, windowEnd) * 10) / 10
      : 0
  const perMonthAll = serviceRows.map((r) => {
    const months = monthsOf(r)
    return { id: r.personId, months, perMonth: (parseFloat(r.total ?? '0') || 0) / (months || 1) }
  })
  const perMonthById = new Map(perMonthAll.map((r) => [r.id, r]))
  const perMonthPool = perMonthAll.filter((r) => r.months >= MIN_MONTHS_RANKED)

  const questionsById = new Map(questionTotals.map((q) => [q.personId, Number(q.total ?? 0)]))
  const expensesById = new Map(expenseTotals.map((e) => [e.personId, Number(e.totalExpenses ?? 0)]))
  const hansardById = new Map(
    (hansardRows.rows as { person_id: string; sittings: number; debates: number }[]).map((h) => [h.person_id, h]),
  )

  const base = groups
    .flatMap((g) => g.mlas)
    .map((m) => {
      const id = String(m.person_id)
      const isSpeaker = m.assembly_role === 'Speaker' && !m.assembly_role_end
      const hasPresidingRole = !!m.assembly_role && !m.assembly_role_end
      const hansard = hansardById.get(id)
      const since = m.mandate_start ? String(m.mandate_start).slice(0, 10) : null
      return {
        id,
        name: m.full_name,
        party: m.party,
        constituency: m.constituency,
        imgUrl: m.img_url ?? mlaImg(id),
        attendance: m.attendance_pct === null ? null : Number(m.attendance_pct),
        questions: isSpeaker || ministerIds.has(id) ? null : (questionsById.get(id) ?? 0),
        sittings: hasPresidingRole ? null : (hansard?.sittings ?? 0),
        debates: hasPresidingRole ? null : (hansard?.debates ?? 0),
        expenses: expensesById.get(id) ?? 0,
        expensesPerMonth: (perMonthById.get(id)?.months ?? 0) > 0 ? (perMonthById.get(id)?.perMonth ?? null) : null,
        since,
        servedDays: since ? Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 86400000)) : null,
        votes: (voteStrings.get(id) ?? new Array(divisions.length).fill('-')).join(''),
      }
    })
    .sort((a, b) => getSurname(a.name).localeCompare(getSurname(b.name)) || a.name.localeCompare(b.name))

  const rankIn = (value: number | null, pool: number[], positiveOnly = true): CompareRank | null => {
    if (value === null || (positiveOnly && value <= 0)) return null
    return { rank: pool.filter((v) => v > value).length + 1, of: pool.length }
  }
  const attendancePool = base.flatMap((m) => (m.attendance === null ? [] : [m.attendance]))
  const questionPool = base.flatMap((m) => (m.questions === null || !questionsById.has(m.id) ? [] : [m.questions]))
  const sittingsPool = base.flatMap((m) => (m.sittings === null || !hansardById.has(m.id) ? [] : [m.sittings]))
  const debatesPool = base.flatMap((m) => (m.debates === null || !hansardById.has(m.id) ? [] : [m.debates]))
  const expensePool = expenseTotals.map((e) => Number(e.totalExpenses ?? 0))

  const mlas: CompareMla[] = base.map((m) => ({
    ...m,
    ranks: {
      attendance: rankIn(m.attendance, attendancePool),
      questions: rankIn(m.questions, questionPool),
      sittings: rankIn(m.sittings, sittingsPool),
      debates: rankIn(m.debates, debatesPool),
      expenses: expensesById.has(m.id) ? rankIn(m.expenses, expensePool, false) : null,
      expensesPerMonth: (perMonthById.get(m.id)?.months ?? 0) >= MIN_MONTHS_RANKED && m.expensesPerMonth !== null
        ? rankIn(m.expensesPerMonth, perMonthPool.map((r) => r.perMonth), false)
        : null,
    },
  }))

  type Entry = { id: string; v: number }
  const mlaById = new Map(mlas.map((m) => [m.id, m]))
  const entriesByKey: Record<ExtremeKey, Entry[]> = {
    served: base.flatMap((m) => (m.servedDays === null ? [] : [{ id: m.id, v: m.servedDays }])),
    attendance: base.flatMap((m) => (m.attendance === null ? [] : [{ id: m.id, v: m.attendance }])),
    questions: base.flatMap((m) => (m.questions === null || !questionsById.has(m.id) ? [] : [{ id: m.id, v: m.questions }])),
    sittings: base.flatMap((m) => (m.sittings === null || !hansardById.has(m.id) ? [] : [{ id: m.id, v: m.sittings }])),
    debates: base.flatMap((m) => (m.debates === null || !hansardById.has(m.id) ? [] : [{ id: m.id, v: m.debates }])),
    expenses: expenseTotals.map((e) => ({ id: e.personId, v: Number(e.totalExpenses ?? 0) })),
    expensesPerMonth: perMonthPool.map((r) => ({ id: r.id, v: r.perMonth })),
  }
  const extremeIds = (entries: Entry[], dir: 'max' | 'min') => {
    if (entries.length === 0) return null
    const values = entries.map((e) => e.v)
    const target = dir === 'max' ? Math.max(...values) : Math.min(...values)
    return { value: target, ids: entries.filter((e) => e.v === target).map((e) => e.id) }
  }
  const raw = (Object.keys(entriesByKey) as ExtremeKey[]).map((key) => ({
    key,
    high: extremeIds(entriesByKey[key], 'max'),
    low: extremeIds(entriesByKey[key], 'min'),
  }))
  const needed = new Set<string>()
  for (const r of raw) {
    for (const side of [r.high, r.low]) {
      if (side && side.ids.length === 1 && !mlaById.has(side.ids[0])) needed.add(side.ids[0])
    }
  }
  const formerById = new Map<string, ExtremePerson>()
  if (needed.size > 0) {
    const rows = await db.execute(sql`
      SELECT person_id, full_name, party, constituency
      FROM members
      WHERE mandate = ${mandate}
      AND person_id IN (${sql.join([...needed].map((id) => sql`${id}`), sql`, `)})
    `)
    for (const row of rows.rows as { person_id: string; full_name: string; party: string | null; constituency: string | null }[]) {
      formerById.set(row.person_id, { id: row.person_id, name: row.full_name, party: row.party, constituency: row.constituency, imgUrl: mlaImg(row.person_id), current: false })
    }
  }
  const personFor = (id: string): ExtremePerson | null => {
    const m = mlaById.get(id)
    if (m) return { id: m.id, name: m.name, party: m.party, constituency: m.constituency, imgUrl: m.imgUrl, current: true }
    return formerById.get(id) ?? null
  }
  const toExtreme = (side: { value: number; ids: string[] }): Extreme => ({
    value: side.value,
    count: side.ids.length,
    person: side.ids.length === 1 ? personFor(side.ids[0]) : null,
  })
  const extremes = Object.fromEntries(
    raw.map((r) => [r.key, r.high && r.low ? { high: toExtreme(r.high), low: toExtreme(r.low) } : null]),
  ) as CompareExtremes

  return {
    mlas,
    divisions,
    extremes,
    pools: {
      attendance: attendancePool,
      questions: questionPool,
      sittings: sittingsPool,
      debates: debatesPool,
      expenses: expensePool,
      expensesPerMonth: perMonthPool.map((r) => r.perMonth),
    },
  }
}
