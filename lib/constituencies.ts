import { constituencySlug } from '@/lib/utils/constituencySlug'

export interface ConstituencyMla {
  personId: string
  fullName: string
  party: string | null
  constituency: string
  imgUrl: string | null
  isCurrent: boolean
  mandateStart: string | null
  mandateEnd: string | null
  assemblyRole: string | null
  assemblyRoleEnd: string | null
  present: number
  total: number
  written: number
  oral: number
  expenses: number | null
  questionCount: number
  questionMonths: number
  excludedSpans: DateSpan[]
}

export interface DateSpan {
  start: string
  end: string | null
}

export interface SummaryContext {
  mandateStart: string
  questionsEnd: string
  expensesEnd: string | null
}

export interface ConstituencySummary {
  mlaCount: number
  currentCount: number
  formerCount: number
  currentMeanAttendance: number | null
  pooledAttendance: number | null
  questionTotal: number
  written: number
  oral: number
  questionsPerMlaMonth: number | null
  expensesTotal: number
  expensesPerMlaMonth: number | null
  questionsCounted: number
  questionMlaCount: number
  questionMonthTotal: number
  presentVotes: number
  possibleVotes: number
}

const DAY_MS = 86_400_000
const DAYS_PER_MONTH = 30.4375

const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

type RoleFields = Pick<ConstituencyMla, 'assemblyRole' | 'assemblyRoleEnd'>

export function isServingSpeaker(m: RoleFields): boolean {
  return m.assemblyRole === 'Speaker' && !m.assemblyRoleEnd
}

export function attendancePct(m: Pick<ConstituencyMla, 'present' | 'total'> & RoleFields): number | null {
  return m.total > 0 && !isServingSpeaker(m) ? (m.present * 100) / m.total : null
}

export function roundedPct(m: Pick<ConstituencyMla, 'present' | 'total'> & RoleFields): number | null {
  const pct = attendancePct(m)
  return pct === null ? null : Math.round(pct)
}

export function isQuestionEligible(m: Pick<ConstituencyMla, 'questionMonths'>): boolean {
  return m.questionMonths > 0
}

export const MIN_SITTING_QUESTIONS = 100
export const MIN_QUESTION_MONTHS = 5
export const MIN_EXPENSE_MONTHS = 12

const inSpan = (t: number, spans: DateSpan[]) =>
  spans.some((s) => t >= toMs(s.start) && (s.end === null || t < toMs(s.end)))

const daysInMonth = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()

function tenureDays(
  m: Pick<ConstituencyMla, 'mandateStart' | 'mandateEnd'>,
  spans: DateSpan[],
  windowStart: string,
  windowEnd: string,
  from: number,
  to: number,
): { tenure: number; included: number } {
  const start = Math.max(toMs(m.mandateStart ?? windowStart), toMs(windowStart), from)
  const end = Math.min(toMs(m.mandateEnd ?? windowEnd), toMs(windowEnd), to)
  let tenure = 0
  let included = 0
  for (let t = start; t < end; t += DAY_MS) {
    tenure++
    if (!inSpan(t, spans)) included++
  }
  return { tenure, included }
}

export function questionExposure(
  m: Pick<ConstituencyMla, 'mandateStart' | 'mandateEnd'>,
  spans: DateSpan[],
  countsByMonth: Map<string, number>,
  sittingMonths: Set<string>,
  windowStart: string,
  windowEnd: string,
): { count: number; months: number } {
  let count = 0
  let months = 0
  let year = +windowStart.slice(0, 4)
  let month0 = +windowStart.slice(5, 7) - 1
  const lastKey = windowEnd.slice(0, 7)
  for (;;) {
    const key = `${year}-${String(month0 + 1).padStart(2, '0')}`
    if (key > lastKey) break
    if (sittingMonths.has(key)) {
      const { tenure, included } = tenureDays(m, spans, windowStart, windowEnd, Date.UTC(year, month0, 1), Date.UTC(year, month0 + 1, 1))
      months += included / daysInMonth(year, month0)
      if (tenure > 0) count += (countsByMonth.get(key) ?? 0) * (included / tenure)
    }
    month0++
    if (month0 === 12) {
      month0 = 0
      year++
    }
  }
  return { count, months }
}

export function monthsInOffice(
  m: Pick<ConstituencyMla, 'mandateStart' | 'mandateEnd'>,
  windowStart: string,
  windowEnd: string,
): number {
  const start = Math.max(toMs(m.mandateStart ?? windowStart), toMs(windowStart))
  const end = Math.min(toMs(m.mandateEnd ?? windowEnd), toMs(windowEnd))
  return end > start ? (end - start) / DAY_MS / DAYS_PER_MONTH : 0
}

// "2025-2026" -> "2026-03-31", the last day of that financial year.
export function financialYearEnd(financialYear: string): string | null {
  const match = financialYear.match(/^(\d{4})-(\d{4})$/)
  return match ? `${match[2]}-03-31` : null
}

export interface MlaFigures {
  attendance: number | null
  questions: number | null
  expenses: number | null
}

export function mlaFigures(m: ConstituencyMla, mandateStart: string, expensesEnd: string | null): MlaFigures {
  const months = expensesEnd ? monthsInOffice(m, mandateStart, expensesEnd) : 0
  return {
    attendance: attendancePct(m),
    questions: m.questionMonths >= MIN_QUESTION_MONTHS ? m.questionCount / m.questionMonths : null,
    expenses: m.expenses !== null && months >= MIN_EXPENSE_MONTHS ? m.expenses / months : null,
  }
}

export interface Rank {
  rank: number
  of: number
  tied: boolean
}

export function rankIn(values: number[], v: number): Rank {
  return { rank: values.filter((x) => x > v).length + 1, of: values.length, tied: values.filter((x) => x === v).length > 1 }
}

export type RankTone = 'good' | 'warn' | 'bad'

export function rankTone(rank: number, of: number, highIsBad: boolean): RankTone {
  const pctile = of > 1 ? (rank - 1) / (of - 1) : 0
  const tone: RankTone = pctile <= 0.33 ? 'good' : pctile <= 0.66 ? 'warn' : 'bad'
  if (!highIsBad) return tone
  return tone === 'good' ? 'bad' : tone === 'bad' ? 'good' : 'warn'
}

export function ordinal(n: number): string {
  const mod = n % 100
  if (mod >= 11 && mod <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

export function previousFinancialYear(fy: string): string | null {
  const m = fy.match(/^(\d{4})-(\d{4})$/)
  return m ? `${+m[1] - 1}-${+m[2] - 1}` : null
}

export function shortFinancialYear(fy: string): string {
  return fy.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1-$2')
}

export function groupByConstituency(rows: ConstituencyMla[]): Map<string, ConstituencyMla[]> {
  const map = new Map<string, ConstituencyMla[]>()
  for (const r of rows) map.set(r.constituency, [...(map.get(r.constituency) ?? []), r])
  return map
}

export function findConstituency(rows: ConstituencyMla[], slug: string): string | null {
  const match = rows.find((r) => constituencySlug(r.constituency) === slug)
  return match ? match.constituency : null
}

export function summarise(mlas: ConstituencyMla[], ctx: SummaryContext): ConstituencySummary {
  const current = mlas.filter((m) => m.isCurrent)

  const currentPcts = current.map(attendancePct).filter((p): p is number => p !== null)
  const currentMeanAttendance = currentPcts.length ? currentPcts.reduce((a, b) => a + b, 0) / currentPcts.length : null

  const present = mlas.reduce((a, m) => a + m.present, 0)
  const total = mlas.reduce((a, m) => a + m.total, 0)

  const eligible = mlas.filter(isQuestionEligible)
  const questionCount = eligible.reduce((a, m) => a + m.questionCount, 0)
  const questionMonths = eligible.reduce((a, m) => a + m.questionMonths, 0)

  const expensesTotal = mlas.reduce((a, m) => a + (m.expenses ?? 0), 0)
  const expensesMonths = ctx.expensesEnd
    ? mlas.reduce((a, m) => a + monthsInOffice(m, ctx.mandateStart, ctx.expensesEnd as string), 0)
    : 0

  return {
    mlaCount: mlas.length,
    currentCount: current.length,
    formerCount: mlas.length - current.length,
    currentMeanAttendance,
    pooledAttendance: total > 0 ? (present * 100) / total : null,
    questionTotal: mlas.reduce((a, m) => a + m.written + m.oral, 0),
    written: mlas.reduce((a, m) => a + m.written, 0),
    oral: mlas.reduce((a, m) => a + m.oral, 0),
    questionsPerMlaMonth: questionMonths > 0 ? questionCount / questionMonths : null,
    expensesTotal,
    expensesPerMlaMonth: expensesMonths > 0 ? expensesTotal / expensesMonths : null,
    questionsCounted: questionCount,
    questionMlaCount: eligible.length,
    questionMonthTotal: questionMonths,
    presentVotes: present,
    possibleVotes: total,
  }
}

export interface TrendPoint {
  label: string
  short: string
  value: number | null
}

export interface TrendMonth {
  key: string
  label: string
  short: string
  start: string
  end: string
}

export interface MonthlyAttendanceRow {
  personId: string
  month: string
  present: number
  total: number
}

export interface MonthlyQuestionRow {
  personId: string
  month: string
  count: number
}

export interface ExpenseYearRow {
  personId: string
  financialYear: string
  total: number
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')

export function recentMonths(endIso: string, count = 6): TrendMonth[] {
  const endYear = +endIso.slice(0, 4)
  const endMonth = +endIso.slice(5, 7) - 1
  const out: TrendMonth[] = []
  for (let i = count - 1; i >= 0; i--) {
    const idx = endYear * 12 + endMonth - i
    const y = Math.floor(idx / 12)
    const m = idx % 12
    const next = idx + 1
    out.push({
      key: `${y}-${pad(m + 1)}`,
      label: `${MONTH_NAMES[m]} ${y}`,
      short: MONTH_NAMES[m].slice(0, 3),
      start: `${y}-${pad(m + 1)}-01`,
      end: `${Math.floor(next / 12)}-${pad((next % 12) + 1)}-01`,
    })
  }
  return out
}

export function attendanceTrend(
  months: TrendMonth[],
  rows: MonthlyAttendanceRow[],
  mlas: ConstituencyMla[],
  mode: 'pooled' | 'currentMean',
): TrendPoint[] {
  const ids = new Set((mode === 'currentMean' ? mlas.filter((m) => m.isCurrent) : mlas).map((m) => m.personId))
  return months.map((mo) => {
    const inMonth = rows.filter((r) => r.month === mo.key && ids.has(r.personId) && r.total > 0)
    let value: number | null = null
    if (inMonth.length) {
      value =
        mode === 'pooled'
          ? (inMonth.reduce((a, r) => a + r.present, 0) * 100) / inMonth.reduce((a, r) => a + r.total, 0)
          : inMonth.reduce((a, r) => a + (r.present * 100) / r.total, 0) / inMonth.length
    }
    return { label: mo.label, short: mo.short, value }
  })
}

export function questionTrend(
  months: TrendMonth[],
  rows: MonthlyQuestionRow[],
  mlas: ConstituencyMla[],
  clipEnd: string,
): TrendPoint[] {
  return months.map((mo) => {
    const anyData = rows.some((r) => r.month === mo.key)
    const end = mo.end < clipEnd ? mo.end : clipEnd
    const dim = daysInMonth(+mo.key.slice(0, 4), +mo.key.slice(5, 7) - 1)
    let weight = 0
    let count = 0
    for (const m of mlas) {
      const { tenure, included } = tenureDays(m, m.excludedSpans, mo.start, end, toMs(mo.start), toMs(end))
      if (included === 0) continue
      weight += included / dim
      const asked = rows.filter((r) => r.month === mo.key && r.personId === m.personId).reduce((a, r) => a + r.count, 0)
      count += asked * (included / tenure)
    }
    return { label: mo.label, short: mo.short, value: anyData && weight > 0 ? count / weight : null }
  })
}
