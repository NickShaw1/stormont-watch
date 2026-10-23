'use client'

import React from 'react'
import Link from 'next/link'
import {
  Vote, Scale, Megaphone, Stamp, Calendar, CalendarRange, SearchX, SlidersHorizontal, Search, X, Check, Layers,
  Users, Info, ArrowRight, ChartColumn, CheckCircle2, XCircle,
} from 'lucide-react'
import { formatMonthGroup, monthKey, formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import SheetSelect, { type SheetOption } from '@/app/assembly/mlas/[id]/SheetSelect'
import { useVotesFilters, type TypeFilter, type ResultFilter, type CrossFilter } from './VotesFilters'
import styles from './votes.module.css'

function getBaseTitle(rawTitle: string): string {
  const stripped = rawTitle.replace(/ - Amendment \d+$/i, '').trim()
  if (stripped !== rawTitle) return stripped

  if (/^(Amendment|Clause)\s+\d+\s+-\s+/i.test(rawTitle)) {
    const { title } = formatDivisionSubject(rawTitle)
    if (title && title !== rawTitle) return title
  }

  return rawTitle
}

function getAmendmentNumber(rawTitle: string): number | null {
  const m = rawTitle.match(/ - Amendment (\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

interface DivisionGroup {
  baseTitle: string
  mainItem: VoteItem
  items: VoteItem[]
}

function buildGroups(items: VoteItem[]): DivisionGroup[] {
  const map = new Map<string, VoteItem[]>()
  for (const item of items) {
    const base = getBaseTitle(item.rawTitle ?? item.subject)
    const key = item.isStatutory === true
      ? `__statutory__${item.key}`
      : item.isBill === true
        ? `${base}|${item.latestDate.slice(0, 10)}`
        : base
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return Array.from(map.entries()).map(([, divItems]) => {
    const sorted = [...divItems].sort((a, b) => {
      const an = getAmendmentNumber(a.rawTitle ?? a.subject)
      const bn = getAmendmentNumber(b.rawTitle ?? b.subject)
      if (an === null && bn === null) return 0
      if (an === null) return -1
      if (bn === null) return 1
      return an - bn
    })
    const mainItem = sorted.find(i => getAmendmentNumber(i.rawTitle ?? i.subject) === null) ?? sorted[0]
    const baseTitle = getBaseTitle(mainItem.rawTitle ?? mainItem.subject)
    return { baseTitle, mainItem, items: sorted }
  })
}

const itemType = (i: { isBill?: boolean; isStatutory?: boolean }): 'bill' | 'motion' | 'regs' =>
  i.isBill ? 'bill' : i.isStatutory ? 'regs' : 'motion'

const TYPE_SECTIONS = [
  { type: 'bill', label: 'Bills', icon: Scale },
  { type: 'motion', label: 'Motions', icon: Megaphone },
  { type: 'regs', label: 'Regulations', icon: Stamp },
] as const

function groupByDay<T extends { latestDate: string }>(items: T[]): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.latestDate.slice(0, 10)
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return Array.from(map.entries()).map(([key, dayItems]) => ({ key, items: dayItems }))
}

export interface VoteItem {
  key: string
  href: string
  rawTitle: string | null
  subject: string
  latestDate: string
  passed: boolean | null
  outcome?: string | null
  motionText?: string | null
  isCrossCommunity?: boolean
  isBill?: boolean
  isStatutory?: boolean
  totalAyes?: number | null
  totalNoes?: number | null
  crossClass?: 'both' | 'divided' | 'against' | 'level'
}

interface Props {
  allItems: VoteItem[]
  note?: string | null
}

const CLOSE_MARGIN = 5
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function VotesListClient({ allItems, note }: Props) {
  const { query, setQuery, yearFilter, setYearFilter, resultFilter, setResultFilter, typeFilter, setTypeFilter, crossFilter, setCrossFilter, dayFilter, setDayFilter, closeOnly, setCloseOnly, clearAll } = useVotesFilters()

  const years = Array.from(new Set(allItems.map(i => i.latestDate.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
  const q = query.toLowerCase().trim()

  const matchesType = (item: VoteItem, t: TypeFilter) =>
    t === 'ALL' || (t === 'BILLS' ? item.isBill === true : t === 'MOTIONS' ? !item.isBill && !item.isStatutory : item.isStatutory === true)
  const matchesResult = (item: VoteItem, r: ResultFilter) =>
    r === 'ALL' || (r === 'PASSED' ? item.passed === true : item.passed === false)

  const isNailBiter = (i: VoteItem) => (i.totalAyes ?? 0) + (i.totalNoes ?? 0) > 0 && Math.abs((i.totalAyes ?? 0) - (i.totalNoes ?? 0)) <= CLOSE_MARGIN

  const filteredItems = allItems.filter(item =>
    (yearFilter === 'ALL' || item.latestDate.slice(0, 4) === yearFilter) &&
    matchesResult(item, resultFilter) &&
    matchesType(item, typeFilter) &&
    (crossFilter === 'ALL' || item.crossClass === crossFilter) &&
    (dayFilter === 'ALL' || item.latestDate.slice(0, 10) === dayFilter) &&
    (!closeOnly || isNailBiter(item)) &&
    (!q || formatDivisionSubject(item.rawTitle ?? item.subject).title.toLowerCase().includes(q)),
  )
  const viewing = q !== '' || yearFilter !== 'ALL' || resultFilter !== 'ALL' || typeFilter !== 'ALL' || crossFilter !== 'ALL' || dayFilter !== 'ALL' || closeOnly

  const clearFilters = clearAll

  const counted = filteredItems.filter(i => (i.totalAyes ?? 0) + (i.totalNoes ?? 0) > 0)
  const dayCounts = new Map<string, { n: number; date: string }>()
  for (const item of filteredItems) {
    const day = item.latestDate.slice(0, 10)
    const entry = dayCounts.get(day)
    dayCounts.set(day, { n: (entry?.n ?? 0) + 1, date: item.latestDate })
  }
  let busiestDay: { n: number; date: string } | null = null
  for (const entry of dayCounts.values()) if (busiestDay === null || entry.n > busiestDay.n) busiestDay = entry
  const nailBiters = counted.filter(isNailBiter).length
  const avgTurnout = counted.length > 0 ? Math.round(counted.reduce((sum, i) => sum + (i.totalAyes ?? 0) + (i.totalNoes ?? 0), 0) / counted.length) : null
  const jumpToList = () => {
    window.setTimeout(() => {
      const el = document.getElementById('votes-list')
      if (!el) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    }, 80)
  }
  const pickDay = () => {
    if (!busiestDay) return
    const day = busiestDay.date.slice(0, 10)
    if (dayFilter === day) { setDayFilter('ALL'); return }
    setDayFilter(day)
    jumpToList()
  }
  const pickClose = () => {
    if (closeOnly) { setCloseOnly(false); return }
    setCloseOnly(true)
    jumpToList()
  }
  const marginOf = (i: VoteItem) => Math.abs((i.totalAyes ?? 0) - (i.totalNoes ?? 0))
  const nailPct = counted.length > 0 ? Math.round((nailBiters / counted.length) * 100) : 0
  const peakTurnout = counted.reduce((m, i) => Math.max(m, (i.totalAyes ?? 0) + (i.totalNoes ?? 0)), 0)
  const gaugePct = peakTurnout > 0 && avgTurnout !== null ? Math.round((avgTurnout / peakTurnout) * 100) : 0
  const busiestDate = busiestDay ? new Date(busiestDay.date) : null
  const widest = counted.reduce<VoteItem | null>((best, i) => (best === null || marginOf(i) > marginOf(best) ? i : best), null)

  const byMonth = new Map<string, VoteItem[]>()
  for (const item of filteredItems) {
    const key = monthKey(item.latestDate)
    byMonth.set(key, [...(byMonth.get(key) ?? []), item])
  }
  const monthGroups = Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, label: formatMonthGroup(items[0].latestDate), items }))

  const typeCount = (t: TypeFilter) => allItems.filter(i => matchesType(i, t)).length
  const resultCount = (r: ResultFilter) => allItems.filter(i => matchesResult(i, r)).length
  const CROSS: { key: Exclude<CrossFilter, 'ALL'>; label: string; colour: string; on?: string }[] = [
    { key: 'both', label: 'Both sides in favour', colour: 'var(--sw-success-solid)' },
    { key: 'divided', label: 'Divided', colour: 'var(--sw-accent-warm)', on: '#1a1d21' },
    { key: 'against', label: 'Both sides against', colour: 'var(--sw-error-solid)' },
    { key: 'level', label: 'Level', colour: 'var(--sw-text-tertiary)' },
  ]
  const crossCount = (k: CrossFilter) => allItems.filter(i => (k === 'ALL' ? i.isCrossCommunity === true : i.crossClass === k)).length

  const yearOptions: SheetOption[] = [
    { key: 'ALL', label: 'All years', icon: CalendarRange },
    ...years.map(y => ({ key: y, label: y, icon: Calendar, color: 'var(--sw-accent-solid)', meta: `${allItems.filter(i => i.latestDate.slice(0, 4) === y).length} divisions` })),
  ]
  const typeOptions: SheetOption[] = [
    { key: 'ALL', label: 'All types', icon: Layers, meta: `${allItems.length} divisions` },
    { key: 'BILLS', label: 'Bills', icon: Scale, color: '#8b5cf6', meta: `${typeCount('BILLS')} divisions` },
    { key: 'MOTIONS', label: 'Motions', icon: Megaphone, color: 'var(--sw-accent-solid)', meta: `${typeCount('MOTIONS')} divisions` },
    { key: 'REGULATIONS', label: 'Regulations', icon: Stamp, color: 'var(--c-pink)', meta: `${typeCount('REGULATIONS')} divisions` },
  ]
  const resultOptions: SheetOption[] = [
    { key: 'ALL', label: 'All outcomes', icon: Vote, meta: `${allItems.length} divisions` },
    { key: 'PASSED', label: 'Passed', icon: Check, color: 'var(--sw-success-solid)', meta: `${resultCount('PASSED')} divisions` },
    { key: 'FAILED', label: 'Failed', icon: X, color: 'var(--sw-error-solid)', meta: `${resultCount('FAILED')} divisions` },
  ]

  const crossOptions: SheetOption[] = [
    { key: 'ALL', label: 'All votes', icon: Layers },
    ...CROSS.filter(k => crossCount(k.key) > 0).map(k => ({ key: k.key, label: k.label, icon: Users, color: k.colour, on: k.on, meta: `${crossCount(k.key)} divisions` })),
  ]

  return (
    <section className={`${styles.band} ${styles.bandTint}`} aria-label="Search and results">
      <div className="container">
        <div className={styles.results}>
          <div className={styles.filterRow}>
          <section className={`${styles.tile} ${styles.filterTile}`} aria-labelledby="filter-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnBlue}`}><SlidersHorizontal size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileLabel} id="filter-heading">Search and filter</h2>
              {viewing && (
                <button type="button" className={`${styles.pillBtn} ${styles.clearBtn}`} onClick={clearFilters}>
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>

            <div className={styles.searchWrap}>
              <label htmlFor="vote-search" className="sr-only">Search divisions</label>
              <Search className={styles.searchIcon} size={20} strokeWidth={2} aria-hidden="true" />
              <input
                id="vote-search"
                type="search"
                className={styles.search}
                placeholder="Search divisions"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query !== '' && (
                <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className={styles.fieldsDesk}>
              <div className={styles.fField}>
                <span className={styles.fLabel} id="type-label">Type</span>
                <div className={styles.fPills} role="group" aria-labelledby="type-label">
                  {([['ALL', 'All'], ['BILLS', 'Bills'], ['MOTIONS', 'Motions'], ['REGULATIONS', 'Regulations']] as const).map(([key, label]) => (
                    <button key={key} type="button" className={styles.pillBtn} aria-pressed={typeFilter === key} onClick={() => setTypeFilter(key)}>
                      {label}
                      <span className={styles.pillCount}>{typeCount(key)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.fField}>
                <span className={styles.fLabel} id="result-label">Outcome</span>
                <div className={styles.fPills} role="group" aria-labelledby="result-label">
                  {([['ALL', 'All'], ['PASSED', 'Passed'], ['FAILED', 'Failed']] as const).map(([key, label]) => (
                    <button key={key} type="button" className={styles.pillBtn} aria-pressed={resultFilter === key} onClick={() => setResultFilter(key)}>
                      {key !== 'ALL' && <i className={styles.chipDot} data-tone={key === 'PASSED' ? 'pass' : 'fail'} aria-hidden="true" />}
                      {label}
                      <span className={styles.pillCount}>{resultCount(key)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {crossCount('ALL') > 0 && (
                <div className={styles.fField}>
                  <span className={styles.fLabel} id="cross-label">Cross-community votes</span>
                  <div className={styles.fPills} role="group" aria-labelledby="cross-label">
                    <button type="button" className={styles.pillBtn} aria-pressed={crossFilter === 'ALL'} onClick={() => setCrossFilter('ALL')}>
                      All votes
                    </button>
                    {CROSS.filter(k => crossCount(k.key) > 0).map(k => (
                      <button key={k.key} type="button" className={styles.pillBtn} aria-pressed={crossFilter === k.key} onClick={() => setCrossFilter(k.key)}>
                        <i className={styles.chipDot} style={{ background: k.colour }} aria-hidden="true" />
                        {k.label}
                        <span className={styles.pillCount}>{crossCount(k.key)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.fField}>
                <span className={styles.fLabel} id="year-label">Year</span>
                <div className={styles.fPills} role="group" aria-labelledby="year-label">
                  {['ALL', ...years].map(y => (
                    <button key={y} type="button" className={styles.pillBtn} aria-pressed={yearFilter === y} onClick={() => setYearFilter(y)}>
                      {y === 'ALL' ? 'All' : y}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.fieldsPhone}>
              <SheetSelect options={yearOptions} value={yearFilter} onPick={setYearFilter} eyebrow="Filter by" title="Year" headIcon={Calendar} hideTriggerMeta className={styles.selFit} />
              <SheetSelect options={typeOptions} value={typeFilter} onPick={k => setTypeFilter(k as TypeFilter)} eyebrow="Filter by" title="Type" headIcon={Layers} hideTriggerMeta className={styles.selFit} />
              <SheetSelect options={resultOptions} value={resultFilter} onPick={k => setResultFilter(k as ResultFilter)} eyebrow="Filter by" title="Outcome" headIcon={Vote} hideTriggerMeta className={styles.selFit} />
              <SheetSelect options={crossOptions} value={crossFilter} onPick={k => setCrossFilter(k as CrossFilter)} eyebrow="Filter by" title="Cross-community" headIcon={Users} hideTriggerMeta className={styles.selFit} />
            </div>
          </section>

          <section className={`${styles.tile} ${styles.patternTile}`} aria-labelledby="pattern-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnBlue}`}><ChartColumn size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h2 className={styles.tileLabel} id="pattern-heading">Voting patterns</h2>
              <span className={styles.patternNote}>{filteredItems.length} in view</span>
            </div>
            <ul className={styles.patternRows}>
              <li className={`${styles.patternRow}`} data-action={busiestDay ? '' : undefined} data-on={busiestDay && dayFilter === busiestDay.date.slice(0, 10) ? '' : undefined}>
                {busiestDay && <button type="button" className={styles.patternHit} aria-pressed={dayFilter === busiestDay.date.slice(0, 10)} aria-label={`Show only divisions on ${formatDate(busiestDay.date)}`} onClick={pickDay} />}
                <div className={styles.patternBody}>
                  <span className={styles.patternLabel}>Busiest day</span>
                  <span className={styles.patternFigure}>{busiestDay ? formatDate(busiestDay.date) : '-'}</span>
                  <span className={styles.patternSub}>{busiestDay ? `${busiestDay.n} ${busiestDay.n === 1 ? 'division' : 'divisions'} held` : 'No divisions in view'}</span>
                </div>
                {busiestDate && (
                  <span className={styles.vizLeaf} aria-hidden="true">
                    <span className={styles.leafTop}>{WEEKDAYS[busiestDate.getUTCDay()]}</span>
                    <span className={styles.leafNum}>{busiestDate.getUTCDate()}</span>
                    <span className={styles.leafMonth}>{MONTH_SHORT[busiestDate.getUTCMonth()]}</span>
                  </span>
                )}
              </li>
              <li className={`${styles.patternRow}`} data-action={nailBiters > 0 ? '' : undefined} data-on={closeOnly ? '' : undefined}>
                {(nailBiters > 0 || closeOnly) && <button type="button" className={styles.patternHit} aria-pressed={closeOnly} aria-label={`Show only votes decided by ${CLOSE_MARGIN} or fewer`} onClick={pickClose} />}
                <div className={styles.patternBody}>
                  <span className={styles.patternLabel}>Nail-biters</span>
                  <span className={styles.patternFigure}>{counted.length > 0 ? nailBiters : '-'}</span>
                  <span className={styles.patternSub}>{counted.length > 0 ? `of ${counted.length} decided by ${CLOSE_MARGIN} or fewer` : 'No votes in view'}</span>
                </div>
                {counted.length > 0 && (
                  <span className={styles.vizRing} style={{ '--p': nailPct } as React.CSSProperties} aria-hidden="true">
                    <span className={styles.ringInner}>{nailPct}%</span>
                  </span>
                )}
              </li>
              <li className={`${styles.patternRow}`}>
                <div className={styles.patternBody}>
                  <span className={styles.patternLabel}>Average turnout</span>
                  <span className={styles.patternFigure}>{avgTurnout ?? '-'}</span>
                  <span className={styles.patternSub}>MLAs voting per division</span>
                </div>
                {peakTurnout > 0 && (
                  <span className={styles.vizGauge} aria-hidden="true">
                    <svg viewBox="0 0 88 48" width="88" height="48">
                      <path d="M9 44 A35 35 0 0 1 79 44" pathLength="100" className={styles.gaugeTrack} />
                      <path d="M9 44 A35 35 0 0 1 79 44" pathLength="100" className={styles.gaugeFill} strokeDasharray={`${gaugePct} 100`} />
                    </svg>
                    <span className={styles.gaugeCap}>Peak {peakTurnout}</span>
                  </span>
                )}
              </li>
              <li className={`${styles.patternRow}`}>
                <div className={styles.patternBody}>
                  <span className={styles.patternLabel}>Widest margin</span>
                  <span className={styles.patternFigure}>{widest ? `${Math.max(widest.totalAyes ?? 0, widest.totalNoes ?? 0)} to ${Math.min(widest.totalAyes ?? 0, widest.totalNoes ?? 0)}` : '-'}</span>
                  {widest ? (
                    <Link href={widest.href} className={styles.patternLink}>{formatDivisionSubject(widest.rawTitle ?? widest.subject).title}</Link>
                  ) : (
                    <span className={styles.patternSub}>No votes in view</span>
                  )}
                </div>
                {widest && (
                  <span className={styles.vizCols} aria-hidden="true">
                    {([['aye', widest.totalAyes ?? 0, 'Aye'], ['no', widest.totalNoes ?? 0, 'No']] as const).map(([side, n, name]) => (
                      <span key={side} className={styles.colWrap}>
                        <span className={styles.col} data-side={side} style={{ height: `${Math.max(6, Math.round((n / Math.max(1, widest.totalAyes ?? 0, widest.totalNoes ?? 0)) * 48))}px` }} />
                        <span className={styles.colKey}>{name}</span>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            </ul>
          </section>
          </div>

          <div className={`${styles.listAnchor} ${styles.resultsAnchor}`} id="votes-list" tabIndex={-1}>
            <p className="sr-only" aria-live="polite">{filteredItems.length} {filteredItems.length === 1 ? 'division' : 'divisions'} shown</p>

            {filteredItems.length === 0 && (
              <div className={styles.empty}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><SearchX size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.emptyBody}>
                  <h2 className={styles.emptyTitle}>No divisions match</h2>
                  <p className={styles.emptyText}>Try a different search, or clear the filters.</p>
                </div>
                <button type="button" className={styles.pillBtn} onClick={clearFilters}>
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                  Clear filters
                </button>
              </div>
            )}

            <div className={styles.months}>
              {monthGroups.map(group => (
                <section key={group.key} className={`${styles.tile} ${styles.monthTile}`} aria-labelledby={`month-${group.key}`}>
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnBlue}`}><Calendar size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 className={styles.tileTitle} id={`month-${group.key}`}>{group.label}</h2>
                    <span className={styles.countPill}>{group.items.length} {group.items.length === 1 ? 'division' : 'divisions'}</span>
                  </div>
                  <ul className={styles.divList}>
                    {groupByDay(group.items).map(day => {
                      const d = new Date(day.items[0].latestDate)
                      return (
                        <li key={day.key} className={styles.divRow}>
                          <span className={styles.date} aria-hidden="true">
                            <span className={styles.dateWeekday}>{WEEKDAYS[d.getUTCDay()]}</span>
                            <span className={styles.dateNum}>{d.getUTCDate()}</span>
                            <span className={styles.dateMonth}>{MONTH_SHORT[d.getUTCMonth()]}</span>
                          </span>
                          <span className={styles.dayText}>
                            <span className={styles.dayNum}>{d.getUTCDate()}</span>
                            <span className={styles.dayInfo}>
                              <span className={styles.dayName}>{d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}</span>
                              <span className={styles.dayFull}>{d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                            </span>
                            <span className={styles.dayRule} aria-hidden="true" />
                            {TYPE_SECTIONS.filter(sec => day.items.some(i => itemType(i) === sec.type)).length > 1 && (
                              <span className={styles.countPill}>{day.items.length} {day.items.length === 1 ? 'division' : 'divisions'}</span>
                            )}
                          </span>
                          <div className={styles.dayBody}>
                            {TYPE_SECTIONS.map(section => {
                              const sectionItems = day.items.filter(i => itemType(i) === section.type)
                              if (sectionItems.length === 0) return null
                              const SectionIcon = section.icon
                              return (
                                <div key={section.type} className={styles.typeSection}>
                                  <div className={styles.typeHead} data-type={section.type}>
                                    <span className={styles.typeIcon}><SectionIcon size={16} strokeWidth={2} aria-hidden="true" /></span>
                                    <h3 className={styles.typeLabel}>{section.label}</h3>
                                    <span className={styles.typeCount}>{sectionItems.length} {sectionItems.length === 1 ? 'division' : 'divisions'}</span>
                                  </div>
                                  {buildGroups(sectionItems).map(g => {
                                    const { mainItem, baseTitle, items: divItems } = g
                                    const single = divItems.length === 1
                                    const anyAmendmentPassed = divItems.some(i => getAmendmentNumber(i.rawTitle ?? i.subject) !== null && i.passed === true)
                                    const title = formatDivisionSubject(baseTitle).title
                                    const rows = divItems.map(item => {
                                      const amendNum = getAmendmentNumber(item.rawTitle ?? item.subject)
                                      const { subtitle } = formatDivisionSubject(item.rawTitle ?? item.subject)
                                      const asAmended = amendNum === null && (anyAmendmentPassed || /as amended/i.test(item.outcome ?? ''))
                                      const label = amendNum !== null ? `Amendment ${amendNum}` : asAmended ? 'Motion (as amended)' : (subtitle ?? null)
                                      const ayes = item.totalAyes ?? 0
                                      const noes = item.totalNoes ?? 0
                                      const pill = item.passed !== null && (
                                        <span className={styles.outPill} data-tone={item.passed ? 'pass' : 'fail'}>
                                          {item.passed ? <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2} aria-hidden="true" />}
                                          {item.passed ? 'Passed' : 'Failed'}
                                        </span>
                                      )
                                      const gap = Math.abs(ayes - noes)
                                                                            const foot = ayes + noes > 0 && (
                                        <span className={styles.oFoot}>
                                          {gap === 0 ? 'Tied vote' : `Decided by ${gap} ${gap === 1 ? 'vote' : 'votes'}`}
                                          <span aria-hidden="true"> · </span>
                                          {ayes + noes} voted
                                        </span>
                                      )
                                      const chips = (label || item.isCrossCommunity) && (
                                        <span className={styles.oLabel}>
                                          {label}
                                          {item.isCrossCommunity && (
                                            <span className={styles.xc}><Users size={14} strokeWidth={2} aria-hidden="true" />Cross-community</span>
                                          )}
                                        </span>
                                      )
                                      const bar = ayes + noes > 0 && (
                                        <span className={styles.oBar}>
                                          <span className={styles.oAye}><b>{ayes}</b><small>Aye</small></span>
                                          <span className={styles.oSplit} aria-hidden="true">
                                            {ayes > 0 && <span className={styles.splitAye} style={{ flexGrow: ayes }} />}
                                            {noes > 0 && <span className={styles.splitNo} style={{ flexGrow: noes }} />}
                                          </span>
                                          <span className={styles.oNo}><b>{noes}</b><small>No</small></span>
                                        </span>
                                      )
                                      return { item, pill, chips, bar, foot }
                                    })
                                    return (
                                      <div key={mainItem.key} className={styles.divGroup} data-single={single ? '' : undefined}>
                                        {single ? (
                                          <>
                                            <div className={styles.gHead}>
                                              <Link href={mainItem.href} className={styles.divTitle}>{title}<span className="sr-only"> on {formatDate(mainItem.latestDate)}</span></Link>
                                              {rows[0].pill}
                                              <ArrowRight className={styles.gArrow} size={18} strokeWidth={2} aria-hidden="true" />
                                            </div>
                                            {rows[0].chips}
                                            {rows[0].bar}
                                            {rows[0].foot}
                                          </>
                                        ) : (
                                          <>
                                            <h3 className={styles.divTitleStatic}>{title}</h3>
                                            <div className={styles.outcomes}>
                                              {rows.map(({ item, pill, chips, bar }) => (
                                                <Link key={item.key} href={item.href} className={`${styles.oRow} ${styles.oLink}`}>
                                                  <span className={styles.oTop}>
                                                    {chips || <span />}
                                                    {pill}
                                                  </span>
                                                  {bar}
                                                  <ArrowRight className={styles.oArrow} size={18} strokeWidth={2} aria-hidden="true" />
                                                </Link>
                                              ))}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          {note && (
            <div className={styles.note}>
              <span className={`${styles.iconTile} ${styles.tnBlue}`}><Info size={22} strokeWidth={2} aria-hidden="true" /></span>
              <p>{note}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
