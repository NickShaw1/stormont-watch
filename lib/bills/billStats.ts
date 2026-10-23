import { computeBillProgress, BILL_STAGES } from './billProgress'

interface StatsBill {
  slug: string
  title: string
  billType: string | null
  stageHistory: { stage: string; plenaryDate: string }[]
  royalAssentDate: string | null
  passed: boolean | null
}

export interface BillStats {
  total: number
  becameLaw: number
  awaiting: number
  failed: number
  active: number
  scheduled: number
  inProgress: number
  daysToLaw: { median: number; quickest: number; slowest: number; count: number; acts: { slug: string; title: string; days: number }[] } | null
  pipeline: { label: string; count: number; kind: 'stage' | 'awaiting' | 'law' | 'failed'; stage?: number }[]
  types: { label: string; count: number }[]
  outcomes: { label: string; total: number; law: number; awaiting: number; active: number; failed: number }[]
}

const DAY_MS = 86_400_000

export const PIPELINE_LABELS = BILL_STAGES.slice(1, BILL_STAGES.length - 1)

export function pipelineIndex(stageIdx: number): number {
  return Math.min(Math.max(stageIdx - 1, 0), PIPELINE_LABELS.length - 1)
}

export function daysToLawOf(bills: StatsBill[]): BillStats['daysToLaw'] {
  const acts: { slug: string; title: string; days: number }[] = []
  for (const b of bills) {
    if (!b.royalAssentDate) continue
    const dates = b.stageHistory.map((h) => new Date(h.plenaryDate).getTime()).filter((t) => !isNaN(t))
    if (dates.length === 0) continue
    acts.push({ slug: b.slug, title: b.title, days: Math.round((new Date(b.royalAssentDate).getTime() - Math.min(...dates)) / DAY_MS) })
  }
  if (acts.length === 0) return null
  acts.sort((a, b) => a.days - b.days)
  const days = acts.map((a) => a.days)
  const mid = Math.floor(days.length / 2)
  const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2
  return { median: Math.round(median), quickest: days[0], slowest: days[days.length - 1], count: days.length, acts }
}

export function computeBillStats(scheduled: StatsBill[], inProgress: StatsBill[], completed: StatsBill[]): BillStats {
  const all = [...scheduled, ...inProgress, ...completed]

  const counts = new Array(PIPELINE_LABELS.length).fill(0) as number[]
  for (const b of [...scheduled, ...inProgress]) {
    const { stageIdx } = computeBillProgress(b.stageHistory, b.royalAssentDate, b.passed === true)
    counts[pipelineIndex(stageIdx)] += 1
  }
  const awaiting = completed.filter((b) => !b.royalAssentDate && b.passed !== false).length
  const becameLaw = completed.filter((b) => b.royalAssentDate).length
  const failed = completed.filter((b) => !b.royalAssentDate && b.passed === false).length
  const pipeline: BillStats['pipeline'] = [
    ...PIPELINE_LABELS.map((label, i) => ({ label: label as string, count: counts[i], kind: 'stage' as const, stage: i + 1 })),
    { label: 'Awaiting Royal Assent', count: awaiting, kind: 'awaiting' as const },
    { label: 'Became law', count: becameLaw, kind: 'law' as const },
    ...(failed > 0 ? [{ label: 'Defeated', count: failed, kind: 'failed' as const }] : []),
  ]

  const typeCounts = new Map<string, number>()
  for (const b of all) {
    const key = b.billType ?? 'Other'
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1)
  }
  const types = [...typeCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)

  const outcomes = types.map(({ label }) => {
    const inType = (b: StatsBill) => (b.billType ?? 'Other') === label
    const completedHere = completed.filter(inType)
    return {
      label,
      total: all.filter(inType).length,
      law: completedHere.filter((b) => b.royalAssentDate).length,
      awaiting: completedHere.filter((b) => !b.royalAssentDate && b.passed !== false).length,
      active: scheduled.filter(inType).length + inProgress.filter(inType).length,
      failed: completedHere.filter((b) => !b.royalAssentDate && b.passed === false).length,
    }
  })

  return {
    total: all.length,
    becameLaw,
    awaiting,
    failed,
    active: scheduled.length + inProgress.length,
    scheduled: scheduled.length,
    inProgress: inProgress.length,
    daysToLaw: daysToLawOf(completed),
    pipeline,
    types,
    outcomes,
  }
}
