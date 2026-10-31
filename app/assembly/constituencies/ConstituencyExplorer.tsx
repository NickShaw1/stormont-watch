'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, Check, ChevronDown, Gauge, MapPin, MessageCircleQuestion, Percent, PoundSterling, Repeat, Scale, TrendingDown, Trophy, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { gradeAttendance } from '@/lib/attendance'
import { ordinal, type TrendPoint } from '@/lib/constituencies'
import MlaPhoto from '@/components/MlaPhoto'
import { inkFor } from '@/lib/partyInk'
import { displayParty, formatConstituency, formatMemberName, gbp, partyBorderColor } from '@/lib/format'
import ConstituencyMapLink from './ConstituencyMapLink'
import SheetSelect, { type SheetOption } from '@/app/assembly/mlas/[id]/SheetSelect'
import statsStyles from '@/app/assembly/stats/statsKit.module.css'
import styles from './constituency.module.css'

export interface ExplorerMla {
  personId: string
  name: string
  party: string | null
  current: boolean
  imgUrl: string | null
  attendance: number | null
  questions: number | null
  expenses: number | null
  tenure: string
  served: string
  leftOn: string | null
  present: number
  possible: number
  expenseMonths: number
}

export interface ExplorerBasis {
  mlas: number
  expenseMlas: number
  questions: number
  questionMlas: number
  questionMonths: number
  present: number
  possible: number
}

export interface ExplorerCard {
  name: string
  slug: string
  current: number
  former: number
  parties: { party: string; seats: number }[]
  mlas: ExplorerMla[]
  attendance: number | null
  grade: 'good' | 'low' | 'poor' | null
  questions: number | null
  expenses: number | null
  basis: ExplorerBasis
  trend: { attendance: TrendPoint[]; questions: TrendPoint[] }
  expenseYears: { latest: number; prior: number } | null
}

export interface ExplorerAssembly {
  constituencies: number
  seats: number
  former: number
  attendance: number | null
  questions: number | null
  expenses: number | null
  basis: ExplorerBasis
  trend: { attendance: TrendPoint[]; questions: TrendPoint[] }
  expenseYears: { latest: number; prior: number } | null
  expenseYearLabels: { latest: string; prior: string } | null
  recentFrom: string
  priorFrom: string
}

type Metric = 'attendance' | 'questions' | 'expenses' | 'party' | 'changes'

const METRICS: { key: Metric; label: string; blurb: string; Icon: LucideIcon; tone: string }[] = [
  { key: 'party', label: 'Party', blurb: 'Who holds each seat', Icon: Users, tone: statsStyles.tnBlue },
  { key: 'attendance', label: 'Attendance', blurb: 'Turnout at divisions', Icon: Gauge, tone: statsStyles.tnTeal },
  { key: 'expenses', label: 'Expenses', blurb: 'Total expenses', Icon: PoundSterling, tone: statsStyles.tnIndigo },
  { key: 'questions', label: 'Questions', blurb: 'Asked each month', Icon: MessageCircleQuestion, tone: statsStyles.tnPurple },
  { key: 'changes', label: 'Changes', blurb: 'Seats that changed', Icon: Repeat, tone: statsStyles.tnGrey },
]

const NUMERIC: Metric[] = ['attendance', 'questions', 'expenses', 'changes']
const GRADE_TEXT = { good: 'at or above average', low: 'below average', poor: 'far below average' }
const BAND = {
  good: { fill: 'var(--sw-success-solid)', ink: 'var(--band-ink-strong)' },
  low: { fill: 'var(--amber)', ink: 'var(--band-ink-amber)' },
  poor: { fill: 'var(--sw-error-solid)', ink: 'var(--band-ink-strong)' },
} as const
const BAND_ORDER = ['good', 'low', 'poor'] as const
const SCALE_WORDS: Partial<Record<Metric, [string, string]>> = {
  expenses: ['Lower spend', 'Higher spend'],
  questions: ['Fewer questions', 'More questions'],
  changes: ['Fewer MLAs left', 'More MLAs left'],
}
const TIED_FILL = 'var(--tied-fill)'
const VIEW_COLOURS: Record<Metric, string> = {
  party: 'var(--sw-accent-solid)',
  attendance: 'var(--sw-success-solid)',
  expenses: '#6366f1',
  questions: '#8b5cf6',
  changes: '#656b72',
}

interface Insight {
  key: string
  Icon: LucideIcon
  label: string
  basis: string
  value: string
  unit?: string
  mla?: ExplorerMla
  card?: ExplorerCard
  tone?: string
}

interface Extremes<T> {
  hi: { item: T; v: number }
  lo: { item: T; v: number }
}

function extremesOf<T>(items: T[], get: (t: T) => number | null): Extremes<T> | null {
  const xs = items.flatMap((item) => {
    const v = get(item)
    return v === null ? [] : [{ item, v }]
  })
  if (!xs.length) return null
  return { hi: xs.reduce((a, b) => (b.v > a.v ? b : a)), lo: xs.reduce((a, b) => (b.v < a.v ? b : a)) }
}

const scaleColour = (t: number) => `color-mix(in srgb, var(--scale-high) ${Math.round(t * 100)}%, var(--scale-low))`
const personName = (fullName: string) => formatMemberName(fullName).replace(/(\s+(OBE|MBE|CBE|KBE|DBE|BEM|MC|KC|QC|DSO|DFC))+$/, '')
const partyShort = (party: string) => displayParty(party)
const partyTiny = (party: string) => {
  const short = partyShort(party)
  if (short === 'Sinn Féin') return 'SF'
  if (short === 'Alliance') return 'All'
  if (short === 'Independent') return 'Ind'
  return short
}

function leader(card: ExplorerCard): { party: string; seats: number } | null {
  const top = Math.max(0, ...card.parties.map((p) => p.seats))
  const leaders = card.parties.filter((p) => p.seats === top)
  return leaders.length === 1 ? leaders[0] : null
}

function valueOf(card: ExplorerCard, metric: Metric): number | null {
  if (metric === 'attendance') return card.attendance
  if (metric === 'questions') return card.questions
  if (metric === 'expenses') return card.expenses
  if (metric === 'changes') return card.former
  return null
}

const moneyShort = (v: number) => (v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(2)}m` : gbp(v))

function format(metric: Metric, v: number, seats?: number): { value: string; unit?: string } {
  if (metric === 'attendance') return { value: `${v.toFixed(1)}%` }
  if (metric === 'questions') return { value: v.toFixed(1), unit: 'a month' }
  if (metric === 'expenses') return { value: moneyShort(v), unit: seats ? `£${Math.round(v / seats / 1000)}k per seat` : undefined }
  return { value: String(v), unit: v === 1 ? 'former MLA' : 'former MLAs' }
}

export default function ConstituencyExplorer({
  basePath,
  adjective,
  mandateLabel,
  expensesThrough,
  cards,
  assembly,
  geoSize,
  attendanceBands,
}: {
  basePath: string
  adjective: string
  mandateLabel: string
  attendanceBands: { average: number; floor: number }
  expensesThrough: string | null
  cards: ExplorerCard[]
  assembly: ExplorerAssembly
  geoSize: { width: number; height: number } | null
}) {
  const [metric, setMetric] = useState<Metric>('party')
  const [selected, setSelected] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pick = (picked: string | null) => {
    const name = picked === selected ? null : picked
    setSelected(name)
    if (name && window.matchMedia('(max-width: 640px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])
  const menuOptions = useMemo(
    () => [{ value: null as string | null, label: 'All constituencies' }, ...cards.map((c) => ({ value: c.name as string | null, label: c.name }))],
    [cards],
  )

  const sheetOptions = useMemo<SheetOption[]>(
    () => [
      { key: '', label: 'All constituencies', icon: Users, meta: `${assembly.seats} seats` },
      ...cards.map((c) => {
        const lead = leader(c)
        const colour = lead ? partyBorderColor(lead.party) : '#656b72'
        return { key: c.name, label: c.name, icon: MapPin, meta: `${c.current} MLAs`, color: colour, on: inkFor(colour) }
      }),
    ],
    [cards, assembly.seats],
  )

  const viewOptions = useMemo<SheetOption[]>(
    () => METRICS.map((m) => ({ key: m.key, label: m.label, icon: m.Icon, meta: m.blurb, color: VIEW_COLOURS[m.key] })),
    [],
  )

  useEffect(() => {
    if (!menuOpen) return
    const at = Math.max(0, menuOptions.findIndex((o) => o.value === selected))
    optionRefs.current[at]?.focus()
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [menuOpen, menuOptions, selected])

  const chooseOption = (i: number) => {
    setSelected(menuOptions[i].value)
    setMenuOpen(false)
    triggerRef.current?.focus()
  }

  const onOptionKey = (e: React.KeyboardEvent, i: number) => {
    const last = menuOptions.length - 1
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      chooseOption(i)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMenuOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setMenuOpen(false)
    } else {
      const to = e.key === 'ArrowDown' ? Math.min(i + 1, last) : e.key === 'ArrowUp' ? Math.max(i - 1, 0) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1
      if (to < 0) return
      e.preventDefault()
      optionRefs.current[to]?.focus()
    }
  }

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])
  const hasData = cards.length > 0
  const seatsEach = hasData ? assembly.seats / cards.length : 0
  const intro = hasData && Number.isInteger(seatsEach)
    ? `Northern Ireland is divided into ${cards.length} constituencies, each electing ${seatsEach} MLAs to the Assembly. Explore who represents them and how their records compare.`
    : `Every constituency and the MLAs who have held its seats in the ${mandateLabel} mandate, current and former.`
  const numeric = NUMERIC.includes(metric)
  const adjectiveTitle = `${adjective[0].toUpperCase()}${adjective.slice(1)}`

  const range = useMemo(() => {
    const values = cards.map((c) => valueOf(c, metric)).filter((v): v is number => v !== null)
    return values.length ? { min: metric === 'changes' ? 0 : Math.min(...values), max: Math.max(...values) } : null
  }, [cards, metric])

  const fills = useMemo(() => {
    const out: Record<string, string> = {}
    for (const c of cards) {
      if (metric === 'party') {
        const lead = leader(c)
        out[c.name] = lead ? partyBorderColor(lead.party) : TIED_FILL
        continue
      }
      if (metric === 'attendance') {
        out[c.name] = c.grade ? BAND[c.grade].fill : TIED_FILL
        continue
      }
      const v = valueOf(c, metric)
      if (v === null || !range) {
        out[c.name] = TIED_FILL
        continue
      }
      out[c.name] = scaleColour(range.max === range.min ? 0.5 : (v - range.min) / (range.max - range.min))
    }
    return out
  }, [cards, metric, range])

  const labelColors = useMemo(() => {
    const out: Record<string, string> = {}
    if (metric === 'attendance') {
      for (const c of cards) if (c.grade) out[c.name] = BAND[c.grade].ink
      return out
    }
    if (!range || !NUMERIC.includes(metric)) return undefined
    for (const c of cards) {
      const v = valueOf(c, metric)
      if (v !== null && range.max !== range.min && (v - range.min) / (range.max - range.min) >= 0.55) out[c.name] = 'var(--band-ink-strong)'
    }
    return out
  }, [cards, metric, range])

  const bandCounts = useMemo(() => {
    const counts = { good: 0, low: 0, poor: 0 }
    for (const c of cards) if (c.grade) counts[c.grade] += 1
    return counts
  }, [cards])

  const leadingParties = useMemo(() => {
    const seen = new Map<string, number>()
    for (const c of cards) {
      const lead = leader(c)
      if (lead) seen.set(lead.party, (seen.get(lead.party) ?? 0) + 1)
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || partyTiny(a[0]).localeCompare(partyTiny(b[0])))
  }, [cards])

  const tiedCount = cards.filter((c) => leader(c) === null).length
  const shown = cards.find((c) => c.name === selected) ?? null

  const rankOf = (card: ExplorerCard, m: Metric) => {
    const v = valueOf(card, m)
    if (v === null) return null
    const all = cards.map((c) => valueOf(c, m)).filter((x): x is number => x !== null)
    return { rank: all.filter((x) => x > v).length + 1, of: all.length }
  }

  const assemblyValue = (m: Metric): number | null =>
    m === 'attendance' ? assembly.attendance : m === 'questions' ? assembly.questions : m === 'expenses' ? assembly.expenses : m === 'changes' ? assembly.former : null

  const assemblyComparable = (m: Metric): number | null => {
    const v = assemblyValue(m)
    return m === 'expenses' && v !== null && cards.length ? v / cards.length : v
  }

  const note: Record<Metric, string> = {
    party: `Each constituency is coloured by the party with the most ${adjective} MLAs. Grey means two or more parties are tied for the most. The key counts constituencies.`,
    attendance: 'How often each constituency’s MLAs voted in Assembly divisions. Green is at or above the average MLA, amber is below it and red is far below.',
    expenses: `Published expenses and staff costs claimed by each constituency’s MLAs, current and former${expensesThrough ? `, to ${expensesThrough}` : ''}. Darker means more spent.`,
    questions: 'Written and oral questions asked per MLA each month in office. Ministerial, Speaker and non-sitting months excluded. Darker means more.',
    changes: 'How many MLAs have left each constituency’s seats this mandate, so the seat changed hands. Darker means more departures.',
  }

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? ''

  const mainValue = (() => {
    if (metric === 'party') {
      if (!shown) {
        const [topParty, topCount] = leadingParties[0] ?? ['', 0]
        return topParty ? { value: partyShort(topParty), unit: `leads ${topCount} of ${cards.length} constituencies`, block: { colour: partyBorderColor(topParty), count: topCount } } : { value: 'n/a' }
      }
      const lead = leader(shown)
      if (lead) return { value: partyShort(lead.party), unit: `${lead.seats} of ${shown.current} seats`, block: { colour: partyBorderColor(lead.party), count: lead.seats } }
      return { value: 'Tied', unit: 'for most seats', block: { colour: TIED_FILL, count: Math.max(0, ...shown.parties.map((p) => p.seats)) } }
    }
    const v = shown ? valueOf(shown, metric) : assemblyValue(metric)
    return v === null ? { value: 'n/a' } : format(metric, v, shown ? shown.current : assembly.seats)
  })()

  const position = (v: number | null) => (v === null || !range || range.max === range.min ? 0 : Math.max(0, Math.min(100, ((v - range.min) / (range.max - range.min)) * 100)))
  const meterValue = shown ? valueOf(shown, metric) : assemblyComparable(metric)
  const meterTick = shown && metric !== 'changes' ? assemblyComparable(metric) : null

  const rank = shown && numeric ? rankOf(shown, metric) : null
  const baseline = assemblyComparable(metric)
  const numericNote = shown
    ? [rank ? `${ordinal(rank.rank)} highest of ${rank.of}` : null, baseline !== null && metric !== 'changes' ? `${metric === 'expenses' ? 'Average constituency' : 'Assembly'} ${format(metric, baseline).value}` : null].filter(Boolean).join(' · ')
    : metric === 'changes'
      ? 'All constituencies'
      : 'All constituencies, current and former MLAs'

  const seatTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const c of cards) for (const p of c.parties) totals.set(p.party, (totals.get(p.party) ?? 0) + p.seats)
    return [...totals.entries()].map(([party, seats]) => ({ party, seats }))
  }, [cards])
  const partyKey = [...(shown ? shown.parties : seatTotals)]
    .sort((a, b) => b.seats - a.seats || partyTiny(a.party).localeCompare(partyTiny(b.party)))
    .map((p) => ({ key: p.party, label: partyShort(p.party), name: partyShort(p.party), n: p.seats, colour: partyBorderColor(p.party) }))
  const ledBase = [
    ...leadingParties.map(([party, n]) => ({ key: party, label: partyShort(party), n, colour: partyBorderColor(party) })),
    ...(tiedCount > 0 ? [{ key: 'tied', label: 'Tied', n: tiedCount, colour: TIED_FILL }] : []),
  ]
  const ledCells = ledBase.map((c, i) => {
    const narrow = c.n / cards.length < 0.1
    const afterNarrow = i > 0 && ledBase[i - 1].n / cards.length < 0.1
    return { ...c, narrow, edge: afterNarrow || (narrow && i === ledBase.length - 1) }
  })
  const idleLead = leadingParties[0]
  const idleTied = leadingParties.length > 1 && leadingParties[1][1] === leadingParties[0][1]
  const seatTop = partyKey[0]
  const seatTied = partyKey.length > 1 && partyKey[0].n === partyKey[1].n
  const seatLine = () => partyKey.map((k) => `${k.name} ${k.n}`).join(', ')

  const list = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' })
  const partyBlurb = (() => {
    if (!shown || !seatTop) return null
    if (seatTied) {
      const tied = partyKey.filter((k) => k.n === seatTop.n).map((k) => k.name)
      return `Grey on the map: ${list.format(tied)} hold ${seatTop.n} seat${seatTop.n === 1 ? '' : 's'} each, so none has the most.`
    }
    return `Coloured for ${seatTop.name}, which holds ${seatTop.n} of its ${shown.current} seats, more than any other party.`
  })()
  const formerLine = shown
    ? shown.former > 0
      ? `${shown.former} former MLA${shown.former === 1 ? ' has' : 's have'} also held seats here this mandate.`
      : 'No MLA has left a seat here this mandate.'
    : ''
  const partyHeadText = partyBlurb ? `${partyBlurb} ${formerLine}` : null
  const count = (n: number) => Math.round(n).toLocaleString('en-GB')
  const derivation = (m: Metric): string | null => {
    const b = shown ? shown.basis : assembly.basis
    const who = shown ? `${formatConstituency(shown.name)}: ` : ''
    if (m === 'questions') {
      const counted = b.questionMlas === b.mlas ? `${b.mlas} MLAs` : `${b.questionMlas} of ${b.mlas} MLAs`
      return `${who}${count(b.questions)} questions ÷ ${count(b.questionMonths)} MLA-months in office, across ${counted}, current and former. Ministerial, Speaker and non-sitting months are left out.`
    }
    if (m === 'expenses') {
      const total = shown ? shown.expenses : assembly.expenses
      if (total === null) return null
      return `${who}${moneyShort(total)} of published expenses and staff costs across ${b.expenseMlas} MLAs, current and former${expensesThrough ? `, to ${expensesThrough}` : ''}. Per seat is the total ÷ ${shown ? shown.current : assembly.seats} seats.`
    }
    if (m === 'attendance') {
      return shown
        ? `${who}its MLAs, current and former, voted in ${count(b.present)} of the ${count(b.possible)} divisions they could have.`
        : 'Each constituency is pooled across its current and former MLAs. The Assembly figure is pooled the same way across every constituency.'
    }
    if (m === 'party') return 'Seats are counted from current MLAs only. Former MLAs are listed under Changes.'
    if (m === 'changes') return 'Counts MLAs who have held a seat this mandate and have since left the Assembly.'
    return null
  }
  const mapTitle: Record<Metric, string> = {
    party: 'Largest party',
    attendance: 'Division attendance',
    expenses: 'Expenses claimed',
    questions: 'Questions asked',
    changes: 'MLAs who have left',
  }
  const mapTitlePhone: Record<Metric, string> = { ...mapTitle, party: 'Party with most seats' }
  const named = (c: ExplorerCard) => formatConstituency(c.name)
  const tone = METRICS.find((x) => x.key === metric)?.tone ?? ''

  const constituencyInsights = (m: Metric): Insight[] => {
    const e = extremesOf(cards, (c) => valueOf(c, m))
    if (!e) return []
    return [
      { key: 'hc', Icon: Trophy, tone: statsStyles.tnAmber, label: 'Highest constituency', basis: named(e.hi.item), card: e.hi.item, ...format(m, e.hi.v, e.hi.item.current) },
      { key: 'lc', Icon: TrendingDown, tone: statsStyles.tnGrey, label: 'Lowest constituency', basis: named(e.lo.item), card: e.lo.item, ...format(m, e.lo.v, e.lo.item.current) },
    ]
  }

  type PeopleMetric = 'attendance' | 'questions' | 'expenses'

  const mlaValueOf = (m: PeopleMetric, mla: ExplorerMla): number | null => {
    if (m === 'attendance') return mla.attendance
    if (m === 'questions') return mla.questions
    return mla.expenses !== null && mla.expenseMonths >= 12 ? mla.expenses / mla.expenseMonths : null
  }

  const mlaFigure = (m: PeopleMetric, mla: ExplorerMla, v: number): { value: string; unit?: string } => {
    if (m === 'attendance') return { value: `${v.toFixed(1)}%`, unit: `${count(mla.present)} of ${count(mla.possible)} divisions` }
    if (m === 'questions') return { value: v.toFixed(1), unit: 'a month' }
    return { value: gbp(Math.round(v)), unit: `a month, over ${mla.expenseMonths.toFixed(1)} months` }
  }

  const mlaLabels = {
    attendance: ['Highest MLA', 'Lowest MLA'],
    questions: ['Most questions', 'Fewest questions'],
    expenses: ['Highest monthly claim', 'Lowest monthly claim'],
  }

  const currentWithValue = (m: PeopleMetric) => cards.flatMap((c) => c.mlas.filter((x) => x.current).map((mla) => ({ mla, c, v: mlaValueOf(m, mla) })))

  const mlaInsights = (m: PeopleMetric): Insight[] => {
    const e = extremesOf(currentWithValue(m), (x) => x.v)
    if (!e) return []
    const row = (key: string, Icon: LucideIcon, tn: string, label: string, x: { mla: ExplorerMla; c: ExplorerCard }, v: number): Insight => ({
      key, Icon, tone: tn, label, basis: personName(x.mla.name), mla: x.mla, ...mlaFigure(m, x.mla, v),
    })
    return [
      row('hm', Trophy, statsStyles.tnAmber, mlaLabels[m][0], e.hi.item, e.hi.v),
      row('lm', TrendingDown, statsStyles.tnGrey, mlaLabels[m][1], e.lo.item, e.lo.v),
    ]
  }

  const shareInsight = (total: number | null): Insight[] =>
    total !== null && assembly.expenses
      ? [{ key: 'share', Icon: Percent, label: 'Share of all expenses', basis: `Of ${moneyShort(assembly.expenses)} in total`, value: `${((total * 100) / assembly.expenses).toFixed(1)}%` }]
      : []

  const perMlaInsight = (card: ExplorerCard): Insight[] => {
    const claimed = card.mlas.filter((x) => x.expenses !== null)
    const total = claimed.reduce((acc, x) => acc + (x.expenses ?? 0), 0)
    if (!claimed.length) return []
    return [{ key: 'permla', Icon: Users, label: 'Average per MLA', basis: `Across ${claimed.length} MLAs, current and former`, value: moneyShort(total / claimed.length) }]
  }

  const allFormer = cards.flatMap((c) => c.mlas.filter((m) => !m.current && m.leftOn).map((mla) => ({ mla, c, on: mla.leftOn as string })))

  const changesInsights = (): Insight[] => {
    const out: Insight[] = []
    const most = Math.max(0, ...cards.map((c) => c.former))
    if (most > 0) {
      const names = cards.filter((c) => c.former === most).map(named)
      out.push({ key: 'most', Icon: MapPin, label: 'Most MLAs left', basis: names.length > 2 ? `${names.length} constituencies tied` : list.format(names), value: String(most) })
    }
    out.push({ key: 'none', Icon: Check, label: 'Unchanged constituencies', basis: 'No MLA has left', value: String(cards.filter((c) => c.former === 0).length) })
    const byParty = new Map<string, number>()
    for (const f of allFormer) if (f.mla.party && f.mla.party !== 'Independent') byParty.set(f.mla.party, (byParty.get(f.mla.party) ?? 0) + 1)
    const top = Math.max(0, ...byParty.values())
    if (top > 0) {
      const parties = [...byParty.entries()].filter(([, n]) => n === top).map(([party]) => partyShort(party))
      out.push({ key: 'party', Icon: Users, label: 'Party with most departures', basis: parties.length > 1 ? list.format(parties) : 'Most MLAs to leave', value: parties.length > 1 ? 'Tied' : parties[0], unit: `${top} ${top === 1 ? 'MLA' : 'MLAs'}${parties.length > 1 ? ' each' : ''}` })
    }
    const recent = allFormer.filter((f) => f.on >= assembly.recentFrom).length
    const prior = allFormer.filter((f) => f.on >= assembly.priorFrom && f.on < assembly.recentFrom).length
    out.push({ key: 'recent', Icon: CalendarClock, label: 'Recent departures', basis: `Last six months, ${prior} in the six before`, value: String(recent) })
    return out
  }

  type RichTile = { key: string; Icon: LucideIcon; tone: string; label: string; sub: string; figure: string; unit?: string; body?: React.ReactNode }

  const richTile = (t: RichTile) => (
    <li key={t.key} className={styles.richTile}>
      <span className={styles.richHead}>
        <span className={`${statsStyles.iconTile} ${t.tone}`}><t.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
        <span className={styles.richText}>
          <span className={styles.overviewLabel}>{t.label}</span>
          <span className={styles.overviewBasis}>{t.sub}</span>
        </span>
        <span className={styles.richFigure}>
          {t.figure}
          {t.unit && <small>{t.unit}</small>}
        </span>
      </span>
      {t.body && <span className={styles.chipRow}>{t.body}</span>}
    </li>
  )

  const partyRich = () => {
    const holders = seatTotals.filter((x) => x.party !== 'Independent').sort((x, y) => y.seats - x.seats || partyTiny(x.party).localeCompare(partyTiny(y.party)))
    const independents = cards.flatMap((c) => c.mlas.filter((m) => m.current && m.party === 'Independent').map((m) => ({ m, c })))
    const holds = cards.flatMap((c) => {
      const lead = leader(c)
      return lead ? [{ c, party: lead.party, seats: lead.seats }] : []
    })
    const strongest = Math.max(0, ...holds.map((h) => h.seats))
    const strongestHolds = holds.filter((h) => h.seats === strongest)
    return [
      richTile({
        key: 'parties', Icon: Users, tone: statsStyles.tnBlue, label: 'Parties with seats', sub: 'Seats held across the Assembly', figure: String(holders.length),
      }),
      richTile({
        key: 'independents', Icon: Users, tone: statsStyles.tnPurple, label: 'Independent MLAs', sub: 'Sitting without a party', figure: String(independents.length),
      }),
      richTile({
        key: 'tied', Icon: Scale, tone: statsStyles.tnAmber, label: 'Tied constituencies', sub: 'Where no single party has the most MLAs', figure: String(tiedCount),
      }),
      richTile({
        key: 'strongest', Icon: Check, tone: statsStyles.tnTeal, label: 'Strongest hold', sub: 'Most seats held in one constituency', figure: String(strongest),
        body: strongestHolds.length ? (
          <span className={styles.miniPills}>
            {strongestHolds.map((h) => (
              <span key={h.c.slug} className={styles.miniGroup}>
                <span className={styles.miniPill}>{h.c.name}</span>
                <span className={`${styles.miniPill} ${styles.miniParty}`} style={{ '--party': partyBorderColor(h.party) } as React.CSSProperties}>
                  <i aria-hidden="true" />
                  {partyShort(h.party)}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className={styles.chipText}>None</span>
        ),
      }),
    ]
  }

  const idleInsights: Insight[] = (() => {
    if (metric === 'party') return []
    if (metric === 'changes') return changesInsights()
    return [...mlaInsights(metric), ...constituencyInsights(metric)]
  })()

  const mlaCards = (m: PeopleMetric, card: ExplorerCard): Insight[] => {
    const e = extremesOf(card.mlas.filter((x) => x.current), (x) => mlaValueOf(m, x))
    if (!e) return []
    const one = e.hi.item === e.lo.item
    const make = (key: string, label: string, mla: ExplorerMla, v: number): Insight => ({
      key,
      Icon: label === mlaLabels[m][0] ? Trophy : TrendingDown,
      tone: label === mlaLabels[m][0] ? statsStyles.tnAmber : statsStyles.tnGrey,
      label,
      basis: personName(mla.name),
      mla,
      ...mlaFigure(m, mla, v),
    })
    return one
      ? [make('hm', 'Current MLA', e.hi.item, e.hi.v)]
      : [make('hm', mlaLabels[m][0], e.hi.item, e.hi.v), make('lm', mlaLabels[m][1], e.lo.item, e.lo.v)]
  }

  const selectedInsights: Insight[] = (() => {
    if (!shown) return []
    if (metric === 'expenses') return [...mlaCards('expenses', shown), ...shareInsight(shown.expenses), ...perMlaInsight(shown)]
    if (metric === 'attendance' || metric === 'questions') return mlaCards(metric, shown)
    return []
  })()

  const otherMlas = (() => {
    if (!shown || (metric !== 'attendance' && metric !== 'questions')) return []
    const current = shown.mlas.filter((x) => x.current)
    const ranked = current
      .flatMap((x) => {
        const v = mlaValueOf(metric, x)
        return v === null ? [] : [{ x, v }]
      })
      .sort((a, b) => b.v - a.v)
    const missing = current.filter((x) => mlaValueOf(metric, x) === null)
    return [...ranked.slice(1, -1).map((r) => r.x), ...missing]
  })()

  const personCard = (r: Insight & { mla: ExplorerMla }) => {
    const { Icon, mla } = r
    return (
      <Link key={r.key} href={`${basePath}/assembly/mlas/${mla.personId}`} className={styles.personCard}>
        <span className={styles.personHead}>
          <span className={`${styles.personTag} ${r.tone ?? tone}`}>
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            {r.label}
          </span>
          <ArrowRight className={styles.personArrow} size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className={styles.personPhoto}>
          <MlaPhoto name={mla.name} imgUrl={mla.imgUrl ?? ''} size={144} decorative square personId={mla.personId} />
        </span>
        <span className={styles.personText}>
          <span className={styles.personName} title={r.basis}>{r.basis}</span>
          {partyTag(mla)}
        </span>
        <span className={styles.personFigure}>
          {r.value}
          {r.unit && <small>{r.unit}</small>}
        </span>
      </Link>
    )
  }

  const constituencyCard = (r: Insight & { card: ExplorerCard }) => {
    const { Icon, card } = r
    return (
      <Link key={r.key} href={`${basePath}/assembly/constituencies/${card.slug}`} className={styles.personCard} data-con="">
        <span className={styles.personHead}>
          <span className={`${styles.personTag} ${r.tone ?? tone}`}>
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            {r.label}
          </span>
          <ArrowRight className={styles.personArrow} size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        {geoSize ? (
          <span className={styles.conMap} aria-hidden="true">
            <svg viewBox={`0 0 ${geoSize.width} ${geoSize.height}`}>
              <use href="#nir-all" className={styles.miniBase} />
              <use href={`#nir-${card.slug}`} className={styles.miniHighlight} />
            </svg>
          </span>
        ) : (
          <span className={`${statsStyles.iconTile} ${statsStyles.tnBlue}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
        )}
        <span className={styles.personText}>
          <span className={styles.conName} title={card.name}>{named(card)}</span>
        </span>
        <span className={styles.personFigure}>
          {r.value}
          {r.unit && <small>{r.unit}</small>}
        </span>
      </Link>
    )
  }

  const insightRow = (r: Insight) => {
    const { Icon } = r
    return (
      <li key={r.key} className={`${styles.statTile} ${r.tone ?? tone}`}>
        <span className={styles.statLead}>
          <span className={`${statsStyles.iconTile} ${r.tone ?? tone}`}><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
          <span className={styles.overviewLabel}>{r.label}</span>
        </span>
        <span className={styles.overviewBasis}>{r.basis}</span>
        <span className={styles.statFigure}>
          {r.value}
          {r.unit && <small>{r.unit}</small>}
        </span>
      </li>
    )
  }

  const insightList = (rows: Insight[]) => {
    const out: React.ReactNode[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r.mla) {
        const pair = rows.slice(i, i + 2).filter((x): x is Insight & { mla: ExplorerMla } => !!x.mla)
        out.push(<li key={r.key} className={styles.personPair}>{pair.map(personCard)}</li>)
        i += pair.length - 1
      } else if (r.card) {
        const pair = rows.slice(i, i + 2).filter((x): x is Insight & { card: ExplorerCard } => !!x.card)
        out.push(<li key={r.key} className={styles.personPair}>{pair.map(constituencyCard)}</li>)
        i += pair.length - 1
      } else {
        out.push(insightRow(r))
      }
    }
    return out
  }

  const cardParties = (c: ExplorerCard) => {
    const top = Math.max(0, ...c.parties.map((p) => p.seats))
    const lead = c.parties.filter((p) => p.seats === top).sort((x, y) => partyShort(x.party).localeCompare(partyShort(y.party)))
    const rest = c.parties.filter((p) => p.seats !== top).sort((x, y) => y.seats - x.seats || partyShort(x.party).localeCompare(partyShort(y.party)))
    return [...lead, ...rest]
  }

  const cardOrder = (c: ExplorerCard) => {
    const top = Math.max(0, ...c.parties.map((p) => p.seats))
    const lead = c.parties.filter((p) => p.seats === top).map((p) => p.party).sort((x, y) => partyShort(x).localeCompare(partyShort(y)))
    const rank = (m: ExplorerMla) => {
      const i = lead.indexOf(m.party ?? '')
      return i < 0 ? lead.length : i
    }
    return c.mlas
      .filter((m) => m.current)
      .sort((a, b) => rank(a) - rank(b) || personName(a.name).localeCompare(personName(b.name)))
  }

  const partyTag = (m: ExplorerMla) =>
    m.party ? (
      <span className={styles.partyPill} style={{ '--party': partyBorderColor(m.party) } as React.CSSProperties}>
        <i aria-hidden="true" />
        {partyShort(m.party)}
      </span>
    ) : (
      'No party'
    )

  const mlaValue = (m: ExplorerMla): { main: React.ReactNode; unit?: string } => {
    if (metric === 'party' || metric === 'changes') return { main: partyTag(m) }
    const v = metric === 'attendance' ? m.attendance : metric === 'questions' ? m.questions : m.expenses
    if (v === null) return { main: 'n/a' }
    if (metric === 'attendance') {
      const grade = gradeAttendance(Math.round(v), attendanceBands.average, attendanceBands.floor)
      return {
        main: (
          <span className={styles.gradeInk} data-grade={grade}>
            {Math.round(v)}%
            <span className="sr-only"> ({GRADE_TEXT[grade]})</span>
          </span>
        ),
      }
    }
    if (metric === 'questions') return { main: v.toFixed(1), unit: 'a month' }
    return { main: gbp(v) }
  }

  const mlaSub = (m: ExplorerMla) => {
    if (metric === 'changes') return m.served
    if (metric === 'party') return m.tenure
    return partyTag(m)
  }

  const mlaRow = (m: ExplorerMla) => (
    <li key={m.personId}>
      <Link
        href={`${basePath}/assembly/mlas/${m.personId}`}
        className={styles.mlaRow}
        data-former={m.current || metric === 'changes' ? undefined : ''}
        title={`${personName(m.name)}${m.party ? `, ${partyShort(m.party)}` : ''}${m.current ? '' : ' (former)'}`}
      >
        <span className={styles.mlaPhoto}>
          <MlaPhoto name={m.name} imgUrl={m.imgUrl ?? ''} size={96} decorative square personId={m.personId} />
        </span>
        <span className={styles.mlaText}>
          <span className={styles.mlaName}>{personName(m.name)}</span>
          <span className={styles.mlaSub}>{mlaSub(m)}</span>
        </span>
        <span className={styles.mlaValue}>
          <span className={styles.mlaValueMain}>{mlaValue(m).main}</span>
          {mlaValue(m).unit && <small>{mlaValue(m).unit}</small>}
        </span>
        <ArrowRight className={styles.mlaArrow} size={18} strokeWidth={2} aria-hidden="true" />
        {!m.current && <span className="sr-only"> (former)</span>}
      </Link>
    </li>
  )

  const formerMlas = shown ? shown.mlas.filter((m) => !m.current) : []
  const partyRank = new Map(partyKey.map((k, i) => [k.key, i]))
  const partyOrder = (party: string | null) => (party ? (partyRank.get(party) ?? partyKey.length) : partyKey.length + 1)
  const currentMlas = shown
    ? shown.mlas
        .filter((m) => m.current)
        .sort((x, y) => partyOrder(x.party) - partyOrder(y.party) || personName(x.name).localeCompare(personName(y.name)))
    : []
  const listed = metric === 'changes' ? formerMlas : currentMlas


  return (
    <>
      <section className={styles.heroBand} aria-labelledby="constituencies-title">
        <div className="container">
          <header className={`${statsStyles.head} ${styles.headRow}`}>
            <div className={styles.headText}>
              <span className={statsStyles.eyebrow}>Representation</span>
              <h1 className={statsStyles.h1} id="constituencies-title">Constituencies</h1>
              <p className={statsStyles.headSub}>{intro}</p>
            </div>
            <Link href={`${basePath}/assembly/stats/constituencies`} className={styles.rankBadge}>
              <span className={`${statsStyles.iconTile} ${statsStyles.tnPink}`}><Trophy size={22} strokeWidth={2} aria-hidden="true" /></span>
              <span className={styles.rankBadgeText}>
                <span className={styles.rankBadgeTitle}>Constituency rankings</span>
                <span className={styles.rankBadgeSub}>See how all of them compare</span>
              </span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </header>

          <div className={styles.explorer} data-metric={metric}>

          {hasData && (
            <>
              <p className="sr-only" role="status">{`Showing ${metricLabel}, ${shown ? formatConstituency(shown.name) : 'all constituencies'}`}</p>
              <div className={styles.filterGrid} role="group" aria-label="Colour the map by">
                {METRICS.map(({ key, label, blurb, Icon, tone }) => (
                  <button key={key} type="button" className={`${styles.filterTile} ${tone}`} aria-pressed={metric === key} onClick={() => setMetric(key)}>
                    <span className={`${statsStyles.iconTile} ${tone} ${styles.filterIcon}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.filterLabel}>{label}</span>
                    <span className={styles.filterBlurb}>{blurb}</span>
                  </button>
                ))}
              </div>

              <div className={styles.explorerBody}>
                <div className={styles.panel} ref={panelRef} role="group" aria-label="Constituency readout">
                  <div className={styles.panelMain}>
                    <span className="sr-only">{metricLabel}{shown ? '' : ', Assembly-wide'}</span>
                    <div className={styles.panelHead}>
                      {metric === 'party' && shown && seatTop ? (
                        <span className={styles.partyBlock} style={{ background: seatTied ? TIED_FILL : seatTop.colour, color: seatTied ? 'var(--sw-text-primary)' : inkFor(seatTop.colour) }}>
                          <MapPin size={22} strokeWidth={2} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className={`${statsStyles.iconTile} ${statsStyles.tnBlue}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
                      )}
                      <span className={styles.panelHeadText}>
                        <span className={styles.panelEyebrow}>{mapTitle[metric]}</span>
                        <span className={styles.panelTitle} title={shown?.name}>{shown ? formatConstituency(shown.name) : 'Northern Ireland'}</span>
                      </span>
                      <span className={styles.seatsPill}><b>{shown ? shown.current : assembly.seats}</b> seats</span>
                    </div>
                    {metric === 'party' ? (
                      <>
                        {shown ? (
                          <>
                            <span className={`${styles.panelFigure} ${styles.panelFigureSm}`}>
                              {seatTop ? (seatTied ? 'Tied' : seatTop.name) : 'n/a'}
                              {seatTop && <small>{seatTied ? 'for most seats' : 'has the most seats'}</small>}
                            </span>
                            <span className={styles.seatSplit} role="img" aria-label={seatLine()}>
                              {partyKey.map((k) => (
                                <span key={k.key} className={styles.seatCol} style={{ flexGrow: k.n }}>
                                  <i style={{ background: k.colour }} />
                                  <span className={styles.seatLabel}>{k.label} <b>{k.n}</b></span>
                                </span>
                              ))}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`${styles.panelFigure} ${styles.panelFigureSm}`}>
                              {idleLead ? (idleTied ? 'Tied' : partyShort(idleLead[0])) : 'n/a'}
                              {idleLead && <small>{idleTied ? 'for most constituencies' : `is largest in ${idleLead[1]} constituencies`}</small>}
                            </span>
                            <span className={styles.seatSplit} role="img" aria-label={ledCells.map((c) => `${c.label} ${c.n}`).join(', ')}>
                              {ledCells.map((c) => (
                                <span key={c.key} className={styles.seatCol} data-narrow={c.narrow ? '' : undefined} data-edge={c.edge ? '' : undefined} style={{ flexGrow: c.n }}>
                                  <i style={{ background: c.colour }} />
                                  <span className={styles.seatLabel}>{c.label} <b>{c.n}</b></span>
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={styles.panelFigure}>
                          {mainValue.value}
                          {mainValue.unit && <small>{mainValue.unit}</small>}
                        </span>
                        <span className={styles.panelMeter} aria-hidden="true">
                          {range && meterValue !== null && (
                            <i style={{ width: `${position(meterValue)}%`, background: metric === 'attendance' ? (shown?.grade ? BAND[shown.grade].fill : undefined) : 'var(--scale-high)' }} />
                          )}
                          {range && meterTick !== null && <b style={{ left: `${position(meterTick)}%` }} />}
                        </span>
                        <span className={styles.panelNote}>{numericNote}</span>
                      </>
                    )}
                  </div>

                  <div className={styles.panelWho} data-idle={shown ? undefined : ''}>
                    {shown && (metric === 'party' || metric === 'changes') ? (
                      <>
                        <span className={styles.whoLabel}>
                          {metric === 'changes' ? 'Former MLAs' : `${adjectiveTitle} MLAs`} <b>{listed.length}</b>
                        </span>
                        {listed.length > 0 ? (
                          <ul className={`${styles.mlaList} ${styles.mlaRich}`}>{listed.map((m) => mlaRow(m))}</ul>
                        ) : (
                          <p className={styles.peopleNone}>No MLA has left this seat.</p>
                        )}
                      </>
                    ) : shown ? (
                      <>
                        <ul className={`${styles.statGrid} ${selectedInsights.some((r) => r.mla) ? styles.statGridPeople : ''} ${otherMlas.length ? styles.statGridFixed : ''}`} aria-label={`${metricLabel} figures`}>{insightList(selectedInsights)}</ul>
                        {otherMlas.length > 0 && (
                          <>
                            <span className={styles.whoLabel}>Other MLAs <b>{otherMlas.length}</b></span>
                            <ul className={styles.mlaList}>{otherMlas.map((m) => mlaRow(m))}</ul>
                          </>
                        )}
                      </>
                    ) : (
                      <ul className={`${styles.statGrid} ${idleInsights.some((r) => r.mla) ? styles.statGridPeople : ''}`} aria-label={`${metricLabel} figures, Assembly-wide`}>{metric === 'party' ? partyRich() : insightList(idleInsights)}</ul>
                    )}
                  </div>

                  {shown && (
                    <div className={styles.panelFoot}>
                      <Link href={`${basePath}/assembly/constituencies/${shown.slug}`} className={styles.panelLink}>
                        <span className={styles.panelLinkText}>View {formatConstituency(shown.name)}</span>
                        <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
                      </Link>
                      {selected && (
                        <button type="button" className={styles.panelClear} onClick={() => setSelected(null)}>
                          <X size={16} strokeWidth={2} aria-hidden="true" />
                          Clear selection
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.mapCol}>
                  <div className={styles.phoneControls}>
                    <SheetSelect
                      options={sheetOptions}
                      value={selected ?? ''}
                      onPick={(key) => setSelected(key === '' ? null : key)}
                      eyebrow="Choose"
                      title="Constituency"
                      headIcon={MapPin}
                   hideTriggerMeta
                    />
                    <SheetSelect
                      options={viewOptions}
                      value={metric}
                      onPick={(key) => setMetric(key as Metric)}
                      eyebrow="Show"
                      title="View"
                      headIcon={Gauge}
                   hideTriggerMeta
                    />
                    {shown && (
                      <Link href={`${basePath}/assembly/constituencies/${shown.slug}`} className={styles.goLink}>
                        <span className={styles.panelLinkText}>View {formatConstituency(shown.name)}</span>
                        <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  <div className={styles.mapHead}>
                    <div className={styles.mapHeadRow}>
                      <h2 className={styles.mapTitle}><span className={styles.titleFull}>{mapTitle[metric]}</span><span className={styles.titlePhone}>{mapTitlePhone[metric]}</span></h2>
                      <div className={styles.mapControls}>
                        {selected && (
                          <button type="button" className={styles.mapClear} onClick={() => setSelected(null)}>
                            <X size={16} strokeWidth={2} aria-hidden="true" />
                            <span className={styles.mapClearText}>Clear<span className="sr-only"> selection</span></span>
                          </button>
                        )}
                        <div className={styles.mapMenu} ref={menuRef}>
                          <button
                            ref={triggerRef}
                            type="button"
                            className={styles.mapTrigger}
                            data-empty={selected ? undefined : ''}
                            aria-haspopup="listbox"
                            aria-expanded={menuOpen}
                            aria-label={selected ? `Constituency: ${selected}` : 'Choose a constituency'}
                            onClick={() => setMenuOpen((o) => !o)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                setMenuOpen(true)
                              }
                            }}
                          >
                            <span className={styles.mapTriggerLabel}>{selected ?? 'Choose a constituency'}</span>
                            <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
                          </button>
                          {menuOpen && (
                            <ul className={styles.mapList} role="listbox" aria-label="Constituencies">
                              {menuOptions.map((o, i) => (
                                <li
                                  key={o.label}
                                  ref={(el) => { optionRefs.current[i] = el }}
                                  role="option"
                                  tabIndex={-1}
                                  aria-selected={o.value === selected}
                                  className={styles.mapOption}
                                  onClick={() => chooseOption(i)}
                                  onKeyDown={(e) => onOptionKey(e, i)}
                                >
                                  {o.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className={styles.mapSub}>{metric === 'party' && partyHeadText ? partyHeadText : note[metric]}</p>
                  </div>

                  <div className={styles.keyRow}>
                    {metric === 'party' ? (
                      <ul className={`${styles.keyPills}${shown ? ` ${styles.keyPhoneOnly}` : ''}`} aria-label="Map key">
                        {leadingParties.map(([party, n]) => (
                          <li key={party} className={styles.keyPill}>
                            <i style={{ background: partyBorderColor(party) }} aria-hidden="true" />
                            <span className={styles.keyLong}>{partyShort(party)}</span>
                            <span className={styles.keyShort} aria-hidden="true">{partyTiny(party)}</span>
                            <b>{n}</b>
                          </li>
                        ))}
                        {tiedCount > 0 && (
                          <li className={styles.keyPill}>
                            <i style={{ background: TIED_FILL }} aria-hidden="true" />
                            Tied
                            <b>{tiedCount}</b>
                          </li>
                        )}
                      </ul>
                    ) : metric === 'attendance' ? (
                      <ul className={styles.keyPills} data-kind="bands" aria-label="Map key">
                        {BAND_ORDER.map((g) => (
                          <li key={g} className={styles.keyPill}>
                            <i style={{ background: BAND[g].fill }} aria-hidden="true" />
                            <span className={styles.keyLong}>{g === 'good' ? `${attendanceBands.average.toFixed(1)}% or more` : g === 'low' ? `${attendanceBands.floor.toFixed(1)}% to ${attendanceBands.average.toFixed(1)}%` : `Under ${attendanceBands.floor.toFixed(1)}%`}</span>
                            <span className={styles.keyShort} aria-hidden="true">{g === 'good' ? `${attendanceBands.average.toFixed(1)}%+` : g === 'low' ? `${attendanceBands.floor.toFixed(1)}-${attendanceBands.average.toFixed(1)}%` : `<${attendanceBands.floor.toFixed(1)}%`}</span> <b>{bandCounts[g]}</b>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      range && (
                        <div className={styles.scale} aria-label="Map key">
                          <span>{SCALE_WORDS[metric]?.[0]}</span>
                          <span className={styles.scaleBar} aria-hidden="true" style={{ background: `linear-gradient(to right, var(--scale-low), var(--scale-high))` }} />
                          <span>{SCALE_WORDS[metric]?.[1]}</span>
                        </div>
                      )
                    )}
                  </div>

                  <div className={styles.heroMap}>
                    <ConstituencyMapLink basePath={basePath} fills={fills} labelColors={labelColors} highlighted={selected} onPick={pick} />
                  </div>

                  <div className={styles.mapFoot}>
                    {METRICS.map(({ key }) => {
                      const text = derivation(key)
                      return text ? (
                        <p key={key} className={styles.mapFootItem} data-active={key === metric ? '' : undefined}>
                          <span>How this is worked out</span> {text}
                        </p>
                      ) : null
                    })}
                  </div>
                </div>

              </div>
            </>
          )}
          </div>
        </div>
      </section>

      {hasData && (
        <section className={`${statsStyles.band} ${statsStyles.bandTint} ${styles.listBand}`} aria-labelledby="constituencies-list-heading">
          <div className="container">
            <header className={statsStyles.sectionHead}>
              <span className={statsStyles.eyebrow}>By constituency</span>
              <h2 className={statsStyles.h2} id="constituencies-list-heading">All {cards.length} constituencies</h2>
            </header>
            <ul className={styles.cList}>
              {cards.map((c) => (
                <li key={c.slug} className={styles.cRow}>
                  {geoSize ? (
                    <span className={`${styles.miniMap} ${styles.cRowMap}`} aria-hidden="true">
                      <svg viewBox={`0 0 ${geoSize.width} ${geoSize.height}`}>
                        <use href="#nir-all" className={styles.miniBase} />
                        <use href={`#nir-${c.slug}`} className={styles.miniHighlight} />
                      </svg>
                    </span>
                  ) : (
                    <span className={`${statsStyles.iconTile} ${statsStyles.tnBlue} ${styles.cRowMap}`}><MapPin size={22} strokeWidth={2} aria-hidden="true" /></span>
                  )}
                  <span className={styles.cRowTitles}>
                    <Link href={`${basePath}/assembly/constituencies/${c.slug}`} className={styles.constLink} title={c.name}>
                      {formatConstituency(c.name)}
                    </Link>
                  </span>
                  <span className={styles.countPill}><b>{c.current}</b> {c.current === 1 ? 'MLA' : 'MLAs'}</span>

                  <div className={styles.cSplit}>
                    <span className={styles.seatSplit} role="img" aria-label={c.parties.map((x) => `${partyShort(x.party)} ${x.seats}`).join(', ')}>
                      {cardParties(c).map((x) => (
                        <span key={x.party} className={styles.seatCol} style={{ flexGrow: x.seats }}>
                          <i style={{ background: partyBorderColor(x.party) }} />
                          <span className={styles.seatLabel}>{partyShort(x.party)} <b>{x.seats}</b></span>
                        </span>
                      ))}
                    </span>
                    <ul className={styles.cLegend} aria-hidden="true">
                      {cardParties(c).map((x) => (
                        <li key={x.party}><i style={{ background: partyBorderColor(x.party) }} />{partyShort(x.party)} <b>{x.seats}</b></li>
                      ))}
                    </ul>
                  </div>

                  <ArrowRight className={styles.cRowArrow} size={22} strokeWidth={2} aria-hidden="true" />

                  <ul className={styles.cMlas} aria-label="Current MLAs">
                    {cardOrder(c).map((m) => (
                      <li key={m.personId}>
                        <div className={styles.cMla}>
                          <span className={styles.cMlaPhoto}>
                            <MlaPhoto name={m.name} imgUrl={m.imgUrl ?? ''} size={96} decorative square personId={m.personId} />
                          </span>
                          <span className={styles.cMlaText}>
                            <span className={styles.cMlaName} title={personName(m.name)}>{personName(m.name)}</span>
                            {partyTag(m)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
