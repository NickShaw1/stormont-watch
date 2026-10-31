import { rankTone, type RankTone } from '@/lib/constituencies'
import { gbp } from '@/lib/format'

export type MetricKey = 'attendance' | 'questions' | 'expenses' | 'perSeat' | 'former' | 'overall'

export const METRIC_KEYS: MetricKey[] = ['attendance', 'questions', 'expenses', 'perSeat', 'former', 'overall']

export interface LeagueRow {
  name: string
  slug: string
  current: number
  former: number
  leader: string | null
  leaderColour: string
  values: Record<MetricKey, number | null>
}

export interface MetricMeta {
  label: string
  highIsBad: boolean | null
  format: (v: number) => string
  unit: (v: number) => string
  blurb: string
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  attendance: {
    label: 'Attendance',
    highIsBad: false,
    format: (v) => `${v.toFixed(1)}%`,
    unit: () => 'of divisions',
    blurb: 'Share of divisions that every MLA who held a seat took part in, pooled across all of them.',
  },
  questions: {
    label: 'Questions',
    highIsBad: false,
    format: (v) => v.toFixed(1),
    unit: () => 'per MLA a month',
    blurb: 'Written and oral questions per MLA per month in office, for every MLA who held a seat.',
  },
  expenses: {
    label: 'Expenses',
    highIsBad: true,
    format: (v) => gbp(Math.round(v)),
    unit: () => 'in total',
    blurb: 'Published expenses and staff costs of every MLA who held a seat, current and former.',
  },
  perSeat: {
    label: 'Expenses per seat',
    highIsBad: true,
    format: (v) => gbp(Math.round(v)),
    unit: () => 'per seat',
    blurb: 'Total expenses divided by the number of current seats.',
  },
  overall: {
    label: 'Overall score',
    highIsBad: false,
    format: (v) => v.toFixed(1),
    unit: () => 'out of 100',
    blurb: 'Just for fun. Each of four measures gets a score from 0 to 100 across the constituencies.\nThe best constituency on a measure scores 100, the worst scores 0 and the rest fall in proportion between them. Higher attendance and more questions score well; lower total expenses and lower expenses per seat score well.\nThe four scores count 25% each and are averaged. A 0 means the lowest of the constituencies on that measure, not zero attendance or zero questions.\nTotal expenses and expenses per seat tend to move together, so cost counts for about half.',
  },
  former: {
    label: 'MLAs left',
    highIsBad: null,
    format: (v) => String(v),
    unit: (v) => (v === 1 ? 'MLA' : 'MLAs'),
    blurb: 'MLAs who held a seat this mandate and have since left the Assembly.',
  },
}

export interface Ranked {
  row: LeagueRow
  value: number | null
  rank: number | null
  of: number
  tone: RankTone | undefined
}

export function rankRows(rows: LeagueRow[], key: MetricKey): Ranked[] {
  const meta = METRIC_META[key]
  const withValue = rows.flatMap((row) => {
    const value = row.values[key]
    return value === null ? [] : [{ row, value }]
  })
  const sorted = [...withValue].sort((a, b) => b.value - a.value || a.row.name.localeCompare(b.row.name))
  const ranked: Ranked[] = sorted.map((x) => {
    const rank = sorted.filter((y) => y.value > x.value).length + 1
    return { row: x.row, value: x.value, rank, of: sorted.length, tone: meta.highIsBad === null ? undefined : rankTone(rank, sorted.length, meta.highIsBad) }
  })
  const missing: Ranked[] = rows
    .filter((r) => r.values[key] === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({ row, value: null, rank: null, of: sorted.length, tone: undefined }))
  return [...ranked, ...missing]
}

const scale = (v: number, min: number, max: number, highIsGood: boolean) => (max === min ? 50 : (((highIsGood ? v - min : max - v) / (max - min)) * 100))

// Adds the overall score: four measures at 25% each, each scaled 0 (worst) to 100 (best) across the constituencies.
export function withOverall(rows: LeagueRow[]): LeagueRow[] {
  const parts = [
    { key: 'attendance', highIsGood: true },
    { key: 'questions', highIsGood: true },
    { key: 'expenses', highIsGood: false },
    { key: 'perSeat', highIsGood: false },
  ] as const
  const range = Object.fromEntries(
    parts.map((p) => {
      const vals = rows.map((r) => r.values[p.key]).filter((v): v is number => v !== null)
      return [p.key, { min: Math.min(...vals), max: Math.max(...vals) }]
    }),
  ) as Record<(typeof parts)[number]['key'], { min: number; max: number }>
  return rows.map((row) => {
    const parts4 = parts.map((p) => {
      const v = row.values[p.key]
      return v === null ? null : scale(v, range[p.key].min, range[p.key].max, p.highIsGood)
    })
    if (parts4.some((v) => v === null)) return row
    const overall = (parts4 as number[]).reduce((a, b) => a + b, 0) / parts4.length
    return { ...row, values: { ...row.values, overall } }
  })
}
