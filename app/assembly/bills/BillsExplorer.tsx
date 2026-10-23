'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, X, SearchX, TrendingUp, Landmark, Layers, Timer, Crown, Check, CalendarClock, BarChart3, ArrowRight, ArrowDown, BookOpen, SlidersHorizontal, Gauge, User, Users, Building2, Milestone } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { computeBillProgress } from '@/lib/bills/billProgress'
import { PIPELINE_LABELS, pipelineIndex } from '@/lib/bills/billStats'
import { STAGE_INFO, stageSlug } from '@/lib/bills/stageInfo'
import { billTypeKey } from '@/lib/bills/billType'
import type { BillItem } from './BillsPageBody'
import { getPillInfo, type BillProgressedThisWeek } from '@/lib/bills/progressedThisWeekProgress'
import BillCard from '@/components/bills/BillCard'
import SheetSelect, { type SheetOption } from '@/app/assembly/mlas/[id]/SheetSelect'
import { useMandate } from '@/components/MandateContext'
import sch from '@/app/components/homepage/schedule.module.css'
import styles from './bills.module.css'

type PipelineKind = 'stage' | 'awaiting' | 'law' | 'failed'

export interface AgendaItem {
  slug: string
  billId: string
  billType: string | null
  title: string
  stage: string
  date: string
}

interface Props {
  head: React.ReactNode
  summary: React.ReactNode
  pipeline: { label: string; count: number; kind: PipelineKind; stage?: number }[]
  outcomes: { label: string; total: number; law: number; awaiting: number; active: number; failed: number }[]
  daysToLaw: { median: number; quickest: number; slowest: number; count: number; acts: { slug: string; title: string; days: number }[] } | null
  total: number
  comingUp: AgendaItem[]
  scheduled: BillItem[]
  inProgress: BillItem[]
  completed: BillItem[]
  progressedThisWeek: BillProgressedThisWeek[]
  mandateStartLabel: string
  children?: React.ReactNode
}

type TableKind = 'scheduled' | 'active' | 'law' | 'awaiting' | 'failed'

interface TableBill {
  slug: string
  billId: string
  billType: string | null
  title: string
  accelerated: boolean
  kind: TableKind
  stageLabel: string
  stageIdx: number
  scheduledIdx: number | null
  introduced: string | null
  latest: string
  latestLabel: string
}

type StatusFilter = 'all' | 'active' | 'completed'

const AWAITING = 'Awaiting Royal Assent'
const LAW = 'Became law'
const DEFEATED = 'Defeated'
const DAY_MS = 86_400_000
const WEEK_LIMIT = 5

const TYPE_ICON = { executive: Landmark, private: User, committee: Users, other: Building2 } as const
const TYPE_TONE = { executive: styles.tnGrey, private: styles.tnSky, committee: styles.tnTeal, other: styles.tnGrey } as const

const FOCUS_KIND: Record<string, TableKind> = { [AWAITING]: 'awaiting', [LAW]: 'law', [DEFEATED]: 'failed' }

function toTableBill(bill: BillItem): TableBill {
  const { stageIdx, scheduledIdx } = computeBillProgress(bill.stageHistory, bill.royalAssentDate, bill.passed === true)
  const dates = bill.stageHistory.map(h => h.plenaryDate).filter(d => !isNaN(new Date(d).getTime())).sort()
  const kind: TableKind =
    bill.category === 'scheduled' ? 'scheduled'
    : bill.category === 'in-progress' ? 'active'
    : bill.royalAssentDate ? 'law'
    : bill.passed === false ? 'failed'
    : 'awaiting'
  const latestLabel =
    kind === 'scheduled' ? 'Scheduled'
    : kind === 'active' ? 'Last activity'
    : kind === 'law' ? 'Royal Assent'
    : kind === 'awaiting' ? 'Final Stage'
    : 'Defeated'
  const stageLabel = PIPELINE_LABELS[pipelineIndex(stageIdx)] as string
  return {
    slug: bill.slug,
    billId: bill.billId,
    billType: bill.billType,
    title: bill.title,
    accelerated: bill.isAccelerated,
    kind,
    stageLabel,
    stageIdx: Math.max(stageIdx, 0),
    scheduledIdx,
    introduced: dates[0] ?? null,
    latest: kind === 'law' && bill.royalAssentDate ? bill.royalAssentDate : bill.latestDate,
    latestLabel,
  }
}

function EmptyState({ icon: Icon, children }: { icon: typeof SearchX; children: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={`${styles.iconTile} ${styles.tnBlue}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
      <p className={styles.emptyText}>{children}</p>
    </div>
  )
}

function dateParts(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(d),
    day: d.getUTCDate(),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d),
  }
}

interface DayItem {
  key: string
  stage: string
  href: string
  title: string
  type: string | null
  note?: string
}

function DayRail({ groups }: { groups: [string, DayItem[]][] }) {
  return (
    <div className={sch.rail} style={{ '--head-h': '88px' } as React.CSSProperties}>
      {groups.map(([day, items]) => {
        const d = dateParts(day)
        const stages = [...new Set(items.map(item => item.stage))]
        return (
          <div key={day} className={sch.item}>
            <span className={sch.track} aria-hidden="true"><span className={sch.node} /></span>
            <div className={`${sch.card} ${styles.dayCard}`}>
              <span className={sch.date} aria-hidden="true">
                <span className={sch.dateWeekday}>{d.weekday}</span>
                <span className={sch.dateNum}>{d.day}</span>
                <span className={sch.dateMonth}>{d.month}</span>
              </span>
              <div className={styles.dayMain}>
                <h3 className={styles.dayTitle}>
                  <span className="sr-only">{formatDate(day)}: </span>
                  {stages.map(stage => (
                    <span key={stage} className={`${sch.pill} ${styles.dayPill}`}>
                      <span className={sch.pillIcon}><Landmark size={14} strokeWidth={2.25} aria-hidden="true" /></span>
                      <span className={`${sch.pillLabel} ${styles.dayPillLabel}`}>{stage}</span>
                      <span className={sch.pillCount}>{items.filter(item => item.stage === stage).length}</span>
                    </span>
                  ))}
                </h3>
                <div className={styles.dayList}>
                  {items.map(item => (
                    <Link key={item.key} href={item.href} title={item.title} className={`${sch.entry} ${sch.entryLink} ${styles.dayEntry}`}>
                      <span className={`${sch.entryTitle} ${styles.dayEntryTitle}`}>{item.title}</span>
                      {item.note && <span className={styles.entryNote}>{item.note}</span>}
                      {item.type && <span className={styles.typeTag} data-type={billTypeKey(item.type)}>{item.type}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export default function BillsExplorer({ head, summary, pipeline, outcomes, daysToLaw, total, comingUp, scheduled, inProgress, completed, progressedThisWeek, mandateStartLabel, children }: Props) {
  const { basePath } = useMandate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [focus, setFocus] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const q = searchQuery.trim().toLowerCase()
  const isSearching = q.length > 0

  const scrollToList = () => {
    setTimeout(() => {
      const el = listRef.current
      if (!el) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    }, 0)
  }

  const applyFocus = (label: string | null, scroll: boolean) => {
    setFocus(label)
    if (label !== null) {
      setSearchQuery('')
      setStatusFilter('all')
    }
    const hash = label === null ? '' : `#stage-${stageSlug(label)}`
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    if (scroll && label !== null) scrollToList()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    if (focus !== null) applyFocus(null, false)
  }

  const chooseStatus = (s: StatusFilter) => {
    setStatusFilter(s)
    if (focus !== null) applyFocus(null, false)
  }

  useEffect(() => {
    const m = window.location.hash.match(/^#stage-(.+)$/)
    if (!m) return
    const row = pipeline.find(p => stageSlug(p.label) === m[1])
    if (!row) return
    setFocus(row.label)
    setStatusFilter('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allRows: TableBill[] = [...scheduled, ...inProgress, ...completed].map(toTableBill)
  const isActive = (b: TableBill) => b.kind === 'scheduled' || b.kind === 'active'
  const statusCount = (s: StatusFilter) => allRows.filter(b => s === 'all' || (s === 'active' ? isActive(b) : !isActive(b))).length

  const focusKind = focus ? FOCUS_KIND[focus] : null
  const rows = allRows.filter(b => {
    if (isSearching && !b.title.toLowerCase().includes(q)) return false
    if (isSearching) return true
    if (focus !== null) return focusKind ? b.kind === focusKind : isActive(b) && b.stageLabel === focus
    return statusFilter === 'all' || (statusFilter === 'active' ? isActive(b) : !isActive(b))
  })

  const kindRank: Record<TableKind, number> = { scheduled: 0, active: 1, awaiting: 2, law: 3, failed: 4 }
  const sortedRows = [...rows].sort((a, b) => {
    let cmp = kindRank[a.kind] - kindRank[b.kind]
    if (cmp === 0) cmp = a.kind === 'scheduled' ? a.latest.localeCompare(b.latest) : b.latest.localeCompare(a.latest)
    return cmp !== 0 ? cmp : a.title.localeCompare(b.title)
  })

  const monday = (() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d
  })()
  const mondayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(monday)

  const viewing = focus !== null || isSearching || statusFilter !== 'all'
  const pipelineMax = Math.max(1, ...pipeline.filter(p => p.kind === 'stage').map(p => p.count))
  const rowColour = (kind: string) => (kind === 'law' ? 'var(--sw-success-solid)' : kind === 'awaiting' ? 'var(--sw-accent-warm)' : kind === 'failed' ? 'var(--sw-error-solid)' : 'var(--sw-accent-solid)')
  const stageRows = pipeline.filter(r => r.count > 0).map(r => ({ row: r, pct: total > 0 ? Math.round((r.count / total) * 100) : 0, colour: rowColour(r.kind) }))
  const topStage = stageRows
    .filter(r => r.row.kind === 'stage')
    .reduce<(typeof stageRows)[number] | null>((best, r) => (best === null || r.row.count > best.row.count ? r : best), null)
  const stageOptions: SheetOption[] = [
    { key: 'all', label: 'All stages', icon: Layers, meta: `${total} bills` },
    ...pipeline.filter(r => r.count > 0).map(r => ({
      key: r.label,
      label: r.label.replace(/ Stage$/, ''),
      icon: r.kind === 'awaiting' ? Crown : r.kind === 'law' ? Check : r.kind === 'failed' ? X : Milestone,
      meta: `${r.count} ${r.count === 1 ? 'bill' : 'bills'}`,
      color: rowColour(r.kind),
      on: r.kind === 'awaiting' ? '#1a1d21' : '#ffffff',
    })),
  ]
  const countOf = (kind: string) => pipeline.filter(r => r.kind === kind).reduce((s, r) => s + r.count, 0)
  const legend = [
    { key: 'law', label: 'Became law', count: countOf('law'), sub: total > 0 ? `${Math.round((countOf('law') / total) * 100)}% of all bills` : '', colour: 'var(--sw-success-solid)' },
    { key: 'active', label: 'Before the Assembly', count: countOf('stage'), sub: `${scheduled.length} scheduled, ${inProgress.length} in progress`, colour: 'var(--sw-accent-solid)' },
    { key: 'awaiting', label: 'Awaiting Royal Assent', count: countOf('awaiting'), sub: '', colour: 'var(--sw-accent-warm)' },
    { key: 'failed', label: 'Defeated', count: countOf('failed'), sub: '', colour: 'var(--sw-error-solid)' },
  ].filter(l => l.count > 0)
  const hasAgenda = comingUp.length > 0
  const agendaDays = (() => {
    const days = new Map<string, AgendaItem[]>()
    for (const item of comingUp) {
      const key = item.date.slice(0, 10)
      days.set(key, [...(days.get(key) ?? []), item])
    }
    return [...days.entries()]
  })()
  const hasWeek = progressedThisWeek.length > 0
  const agendaGroups: [string, DayItem[]][] = agendaDays.map(([day, items]) => [
    day,
    items.map(item => ({ key: item.slug, stage: item.stage, href: `${basePath}/assembly/bills/${item.slug}`, title: item.title, type: item.billType })),
  ])
  const weekGroups = (() => {
    const days = new Map<string, DayItem[]>()
    for (const bill of progressedThisWeek.slice(0, WEEK_LIMIT)) {
      const day = bill.headlineEvent.plenaryDate.slice(0, 10)
      days.set(day, [...(days.get(day) ?? []), {
        key: bill.billId,
        stage: bill.headlineEvent.stage,
        href: `${basePath}/assembly/bills/${billSlug(bill.billId)}`,
        title: bill.shortTitle,
        type: bill.billType,
        note: getPillInfo(bill).label,
      }])
    }
    return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })()

  const showAllScheduled = () => {
    setStatusFilter('active')
    applyFocus(null, false)
    scrollToList()
  }

  const focusInfo = focus ? STAGE_INFO[focus] : null
  const focusRow = focus ? pipeline.find(p => p.label === focus) : undefined
  const focusTypeSummary = (() => {
    if (rows.length === 0 || focus === null) return null
    const counts = new Map<string, number>()
    for (const b of rows) counts.set(b.billType ?? 'Other', (counts.get(b.billType ?? 'Other') ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${n} ${n === 1 ? name : `${name}s`}`).join(', ')
  })()
  const focusQuiet = (() => {
    if (focus === null) return null
    const idle = rows.filter(b => b.kind === 'active').map(b => (Date.now() - new Date(b.latest).getTime()) / DAY_MS).filter(n => n >= 0).sort((a, b) => a - b)
    if (idle.length === 0) return null
    const mid = Math.floor(idle.length / 2)
    return Math.round(idle.length % 2 ? idle[mid] : (idle[mid - 1] + idle[mid]) / 2)
  })()

  return (
    <>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="bills-title">
        <div className="container">
          {head}
          {summary}
          <div className={styles.shareBar} aria-hidden="true">
            {pipeline.filter(row => row.count > 0).map(row => (
              <span key={row.label} className={styles.shareSeg} style={{ flex: row.count, background: row.kind === 'law' ? 'var(--sw-success-solid)' : row.kind === 'awaiting' ? 'var(--sw-accent-warm)' : row.kind === 'failed' ? 'var(--sw-error-solid)' : 'var(--sw-accent-solid)', opacity: row.kind === 'stage' ? 0.4 + (((row.stage ?? 1) - 1) / 5) * 0.6 : 1 }} />
            ))}
          </div>
          <ul className={`${styles.compactOnly} ${styles.legend}`}>
            {legend.map(l => (
              <li key={l.key} className={styles.legendRow}>
                <i className={styles.legendDot} style={{ background: l.colour }} aria-hidden="true" />
                <span className={styles.legendText}>
                  <span className={styles.legendName}>{l.label}</span>
                  {l.sub && <span className={styles.legendSub}>{l.sub}</span>}
                </span>
                <b className={styles.legendCount}>{l.count}</b>
              </li>
            ))}
          </ul>
          <button type="button" className={`${styles.compactOnly} ${styles.heroView}`} onClick={scrollToList}>
            View all {total} bills
            <ArrowDown size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <section className={`${styles.pipelineBlock} ${styles.deskOnly}`} aria-labelledby="pipeline-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnTeal}`}><Layers size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileTitle} id="pipeline-heading">Where bills are now</h2>
            </div>
            <p className={styles.tileDesc}>All {total} bills, grouped by the furthest stage each has reached. Select a group to see its bills and what that stage means. The numbers match the stages in the legislation guide.</p>
            <ul className={styles.stages}>
              {pipeline.map(row => {
                const selected = focus === row.label
                return (
                  <li key={row.label}>
                    <button
                      type="button"
                      className={styles.stage}
                      data-kind={row.kind}
                      data-empty={row.count === 0 ? '' : undefined}
                      aria-pressed={selected}
                      disabled={row.count === 0}
                      style={{ '--v': row.kind === 'stage' ? row.count / pipelineMax : 0.4 } as React.CSSProperties}
                      onClick={() => applyFocus(selected ? null : row.label, !selected)}
                    >
                      <span className={styles.stageNode}>
                        {row.kind === 'stage' ? row.stage : row.kind === 'awaiting' ? <Crown size={14} strokeWidth={2.25} aria-hidden="true" /> : row.kind === 'law' ? <Check size={14} strokeWidth={2.75} aria-hidden="true" /> : <X size={14} strokeWidth={2.75} aria-hidden="true" />}
                      </span>
                      <span className={styles.stageCount}>{row.count}</span>
                      <span className={styles.stageLabel}>{row.label.replace(/ Stage$/, '')}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-label="Statistics and activity">
        <div className="container">
          <div className={styles.bento}>
          <section className={`${styles.tile} ${styles.tSeven} ${styles.statCard}`} aria-labelledby="outcomes-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnGreen}`}><BarChart3 size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileTitle} id="outcomes-heading">How each kind of bill fares</h2>
            </div>
            <p className={styles.tileDesc}>What has happened to the bills from each sponsor.</p>
            <ul className={styles.outGrid}>
              {outcomes.map(o => {
                const Icon = TYPE_ICON[billTypeKey(o.label)]
                const pct = o.total > 0 ? Math.round((o.law / o.total) * 100) : 0
                return (
                  <li key={o.label} className={styles.outCard}>
                    <span className={`${styles.iconTile} ${styles.outIcon} ${TYPE_TONE[billTypeKey(o.label)]}`}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                    <div className={styles.outBody}>
                      <span className={styles.outName}>{o.label}</span>
                      <span className={styles.outLine}>
                        <span><b>{o.law}</b> of {o.total} became law</span>
                        <span className={styles.outPct}>{pct}%</span>
                      </span>
                      <span className={styles.outMeter} role="img" aria-label={`${pct}% of ${o.label.toLowerCase()}s became law`}>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={`${styles.tile} ${styles.tFive} ${styles.statCard}`} aria-labelledby="time-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnPurple}`}><Timer size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileTitle} id="time-heading">How long Acts took</h2>
            </div>
            {daysToLaw ? (
              <div className={styles.timeBody}>
                <div className={styles.timeTop}>
                  <span className={styles.figure}>{daysToLaw.median}<small>days</small></span>
                  <p className={styles.kpiSub}>Median time from an Act&apos;s first recorded stage to Royal Assent, across {daysToLaw.count} {daysToLaw.count === 1 ? 'Act' : 'Acts'}.</p>
                </div>
                <ul className={styles.extremes}>
                  {[['Quickest', daysToLaw.acts[0]], ['Slowest', daysToLaw.acts[daysToLaw.acts.length - 1]]].map(([label, act]) => {
                    const a = act as { slug: string; title: string; days: number }
                    return (
                      <li key={label as string} className={styles.extreme}>
                        <span className={styles.extremeLabel}>{label as string}</span>
                        <span className={styles.extremeDays}>{a.days} days</span>
                        <ArrowRight className={styles.extremeArrow} size={18} strokeWidth={2} aria-hidden="true" />
                        <Link href={`${basePath}/assembly/bills/${a.slug}`} className={styles.extremeLink}>{a.title}</Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <>
                <span className={styles.figure}>N/A</span>
                <p className={styles.kpiSub}>No bill has received Royal Assent yet.</p>
              </>
            )}
          </section>

            {hasAgenda && (
              <section className={`${styles.tile} ${styles.tFull}`} aria-labelledby="coming-heading">
                <div className={styles.tileHead}>
                  <span className={`${styles.iconTile} ${styles.tnAmber}`}><CalendarClock size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h2 className={styles.tileTitle} id="coming-heading">Scheduled for debate</h2>
                </div>
                <p className={styles.tileDesc}>The next stages the Assembly has scheduled, soonest first.</p>
                <DayRail groups={agendaGroups} />
                {scheduled.length > comingUp.length && (
                  <button type="button" className={`${styles.pillBtn} ${styles.moreBtn}`} onClick={showAllScheduled}>
                    See all {scheduled.length} scheduled bills
                  </button>
                )}
              </section>
            )}

            {hasWeek && (
              <section className={`${styles.tile} ${styles.tFull}`} aria-labelledby="week-heading">
                <div className={styles.tileHead}>
                  <span className={`${styles.iconTile} ${styles.tnGreen}`}><TrendingUp size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h2 className={styles.tileTitle} id="week-heading">Progressed this week</h2>
                </div>
                <p className={styles.tileDesc}>Stages heard in the week commencing {mondayLabel}{progressedThisWeek.length > WEEK_LIMIT ? `. Showing ${WEEK_LIMIT} of ${progressedThisWeek.length}` : ''}.</p>
                <DayRail groups={weekGroups} />
              </section>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="all-heading">
        <div className="container">
          <div className={styles.bento}>
            <section className={`${styles.tile} ${styles.tEight} ${styles.deskOnly}`} aria-labelledby="filter-heading">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><SlidersHorizontal size={22} strokeWidth={2} aria-hidden="true" /></span>
                <h2 className={styles.tileLabel} id="filter-heading">Search and filter</h2>
                {viewing && (
                  <button type="button" className={`${styles.pillBtn} ${styles.clearBtn}`} onClick={clearFilters}>
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                    <span className={styles.clearText}>Clear filters</span>
                  </button>
                )}
              </div>

              <div className={styles.searchWrap}>
                <label htmlFor="bill-search" className="sr-only">Search bills</label>
                <Search className={styles.searchIcon} size={20} strokeWidth={2} aria-hidden="true" />
                <input
                  id="bill-search"
                  type="search"
                  className={styles.search}
                  placeholder="Search by title or bill number"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery !== '' && (
                  <button type="button" className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className={`${styles.fField} ${styles.deskOnly}`}>
                <span className={styles.fLabel} id="show-label">Show</span>
                <div className={styles.fPills} role="group" aria-labelledby="show-label">
                  {([['all', 'All'], ['active', 'Before the Assembly'], ['completed', 'Completed']] as const).map(([key, label]) => (
                    <button key={key} type="button" className={styles.pillBtn} aria-pressed={focus === null && !isSearching && statusFilter === key} onClick={() => chooseStatus(key)}>
                      {label}
                      <span className={styles.pillCount}>{statusCount(key)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${styles.fField} ${styles.deskOnly}`}>
                <span className={styles.fLabel} id="stage-label">Stage</span>
                <div className={styles.fPills} role="group" aria-labelledby="stage-label">
                  {pipeline.map(row => {
                    const selected = focus === row.label
                    return (
                      <button
                        key={row.label}
                        type="button"
                        className={styles.pillBtn}
                        aria-pressed={selected}
                        disabled={row.count === 0}
                        onClick={() => applyFocus(selected ? null : row.label, false)}
                      >
                        <i className={styles.chipDot} style={{ background: row.kind === 'law' ? 'var(--sw-success-solid)' : row.kind === 'awaiting' ? 'var(--sw-accent-warm)' : row.kind === 'failed' ? 'var(--sw-error-solid)' : 'var(--sw-accent-solid)' }} />
                        {row.label.replace(/ Stage$/, '')}
                        <span className={styles.pillCount}>{row.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button type="button" className={styles.viewBtn} onClick={scrollToList}>
                {viewing ? `View ${rows.length} ${rows.length === 1 ? 'bill' : 'bills'}` : `View all ${total} bills`}
                <ArrowDown size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </section>
            <section className={`${styles.tile} ${styles.tFour} ${styles.deskOnly}`} aria-labelledby="stand-heading">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnGreen}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
                <h2 className={styles.tileLabel} id="stand-heading">Share at each stage</h2>
              </div>
              {topStage && (
                <div className={styles.keyFigure}>
                  <span className={styles.keyBig}>{topStage.pct}<small>%</small></span>
                  <p className={styles.keyText}>of bills are at {topStage.row.label}, the most common place to be.</p>
                </div>
              )}
              <ul className={styles.keyList}>
                {stageRows.map(r => (
                  <li key={r.row.label} className={styles.keyRow} style={{ '--k': r.colour } as React.CSSProperties}>
                    <span className={styles.keyRowTop}>
                      <span className={styles.keyRowTitle}>{r.row.label.replace(/ Stage$/, '')}</span>
                      <span className={styles.keyRowCount}>{r.row.count} {r.row.count === 1 ? 'bill' : 'bills'}</span>
                      <b className={styles.keyRowPct}>{r.pct}%</b>
                    </span>
                    <span className={styles.keyMeter} aria-hidden="true">
                      <span style={{ width: `${total > 0 ? (r.row.count / total) * 100 : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>

          <div className={`${styles.tile} ${styles.tFull} ${styles.sectionTile}`} ref={listRef} tabIndex={-1}>
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnBlue}`}><Landmark size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileTitle} id="all-heading">All legislation</h2>
            </div>
            <p className={styles.tileDesc}>Every bill since {mandateStartLabel}. Select a bill for its full timeline.</p>

            <div className={`${styles.phoneOnly} ${styles.phoneFilter}`}>
              <div className={styles.searchWrap}>
                <label htmlFor="bill-search-phone" className="sr-only">Search bills</label>
                <Search className={styles.searchIcon} size={20} strokeWidth={2} aria-hidden="true" />
                <input
                  id="bill-search-phone"
                  type="search"
                  className={styles.search}
                  placeholder="Title or bill number"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery !== '' && (
                  <button type="button" className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className={styles.fField}>
                <span className="sr-only">Filter by stage</span>
                <SheetSelect
                  options={stageOptions}
                  value={focus ?? 'all'}
                  onPick={key => applyFocus(key === 'all' ? null : key, false)}
                  eyebrow="Filter by"
                  title="Stage"
                  headIcon={Milestone}
                  hideTriggerMeta
                  className={styles.stageSelect}
                />
              </div>
            </div>

            {focus !== null && !isSearching && focusInfo && (
              <div className={styles.focusPanel}>
                <div className={styles.focusMain}>
                  {focusRow?.kind === 'stage' && <span className={styles.focusEyebrow}>Stage {focusRow.stage}</span>}
                  <h3 className={styles.focusTitle}>{focus}</h3>
                  <p className={styles.focusText}>{focusInfo.summary}</p>
                  {focusTypeSummary && <span className={styles.focusTypes}>{focusTypeSummary}</span>}
                </div>
                <div className={styles.focusStats}>
                  <span className={styles.focusStat}>
                    <b>{rows.length}</b>
                    <span>{rows.length === 1 ? 'bill' : 'bills'} here</span>
                  </span>
                  {focusQuiet !== null && (
                    <span className={styles.focusStat}>
                      <b>{focusQuiet}</b>
                      <span>days since last activity (median)</span>
                    </span>
                  )}
                </div>
                <div className={styles.focusFoot}>
                  {focusInfo.guideId ? (
                    <Link href={`${basePath}/assembly/legislation-guide#${focusInfo.guideId}`} className={`${styles.focusLink} ${styles.deskOnly}`}>
                      <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
                      Read how this stage works
                      <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  ) : <span />}
                  <button type="button" className={`${styles.pillBtn} ${styles.focusClear}`} onClick={() => applyFocus(null, false)}>
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            {isSearching && (
              <p className={styles.resultCount} aria-live="polite"><strong>{rows.length}</strong> bill{rows.length !== 1 ? 's' : ''} found</p>
            )}

            {rows.length === 0
              ? <EmptyState icon={SearchX}>No bills match these filters.</EmptyState>
              : (
                <ul className={styles.cardGrid}>
                  {sortedRows.map(b => (
                    <BillCard
                      key={b.slug}
                      href={`${basePath}/assembly/bills/${b.slug}`}
                      billId={b.billId}
                      billType={b.billType}
                      title={b.title}
                      kind={b.kind}
                      accelerated={b.accelerated}
                      facts={[
                        ...(b.introduced ? [{ label: 'Introduced', value: formatDate(b.introduced) }] : []),
                        { label: b.latestLabel, value: formatDate(b.latest) },
                      ]}
                      progress={{ stageIdx: b.stageIdx, scheduledIdx: b.scheduledIdx }}
                    />
                  ))}
                </ul>
              )}
          </div>
          </div>

          {children}
        </div>
      </section>
    </>
  )
}
