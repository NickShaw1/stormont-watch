'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Search, SearchX, CalendarX, X, Users, MapPin, UserMinus, Gauge, SlidersHorizontal, ArrowDown, ChevronDown, Check, Flag, ArrowRight } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { useMandate } from '@/components/MandateContext'
import { useDropdown } from '@/lib/useDropdown'
import { formatDate, formatMemberName, abbreviateParty, partyBorderColor, formatConstituency } from '@/lib/format'
import styles from './mlas.module.css'

interface MlaRow {
  person_id: string
  full_name: string
  party: string | null
  constituency: string | null
  img_url: string | null
  assembly_role: string | null
  assembly_role_end: string | null
  attendance_pct: number | null
}

interface FormerMlaRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateEnd: string | null
}

interface Props {
  partyGroups: { party: string; mlas: MlaRow[] }[]
  roleLookup: Record<string, string>
  formerGroups: { party: string; mlas: FormerMlaRow[] }[]
  averageAttendance: number
  attendanceFloor: number
  totalMlas: number
  mandateLabel: string
}

interface Entry {
  id: string
  name: string
  constituency: string
  imgUrl: string
  party: string | null
  roles: string[]
  attendance: number | null
  attendanceNa: boolean
  left: string | null
}

interface Group {
  key: string
  title: string
  short: string
  swatch: string
  entries: Entry[]
}

type Mode = 'party' | 'constituency' | 'former'
type Grade = 'good' | 'low' | 'poor' | 'na'

const MODES: { id: Mode; long: string; short: string }[] = [
  { id: 'party', long: 'By party', short: 'Party' },
  { id: 'constituency', long: 'By constituency', short: 'Constituency' },
  { id: 'former', long: 'Former MLAs', short: 'Former' },
]

const GROUP_ICON = { party: Users, constituency: MapPin, former: UserMinus } as const
const GRADE_TEXT: Record<Grade, string> = { good: 'at or above average', low: 'below average', poor: 'far below average', na: '' }

const slug = (s: string) => s.replace(/[^a-z0-9]/gi, '-').toLowerCase()

function rolesOf(m: MlaRow, roleLookup: Record<string, string>): string[] {
  const roles: string[] = []
  if (m.assembly_role && !m.assembly_role_end) {
    roles.push(m.assembly_role.replace(/\bPrincipal Deputy\b/g, 'Pr. Dep.').replace(/\bPrincipal\b/g, 'Pr.'))
  }
  const other = roleLookup[m.person_id]
  if (other && !roles.some((r) => r.toLowerCase() === other.toLowerCase())) roles.push(other)
  return roles
}

export default function MlasListClient({
  partyGroups,
  roleLookup,
  formerGroups,
  averageAttendance,
  attendanceFloor,
  totalMlas,
  mandateLabel,
}: Props) {
  const { basePath } = useMandate()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('party')
  const [partyFilter, setPartyFilter] = useState('ALL')
  const [gradeFilter, setGradeFilter] = useState<Exclude<Grade, 'na'> | null>(null)
  const q = useDeferredValue(query).toLowerCase().trim()
  const resultsRef = useRef<HTMLDivElement>(null)
  const partyDropdown = useDropdown()

  const viewResults = () => {
    const el = resultsRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  const currentGroups = useMemo<Group[]>(
    () =>
      partyGroups.map((g) => ({
        key: g.party,
        title: g.party,
        short: abbreviateParty(g.party),
        swatch: partyBorderColor(g.party),
        entries: g.mlas.map((m) => ({
          id: m.person_id,
          name: formatMemberName(m.full_name),
          constituency: m.constituency ?? '',
          imgUrl: m.img_url ?? '',
          party: m.party,
          roles: rolesOf(m, roleLookup),
          attendance: m.attendance_pct === null ? null : Number(m.attendance_pct),
          attendanceNa: m.assembly_role === 'Speaker' && !m.assembly_role_end,
          left: null,
        })),
      })),
    [partyGroups, roleLookup],
  )

  const formerList = useMemo<Group[]>(
    () =>
      formerGroups.map((g) => ({
        key: g.party,
        title: g.party,
        short: abbreviateParty(g.party),
        swatch: partyBorderColor(g.party),
        entries: g.mlas.map((m) => ({
          id: m.personId,
          name: formatMemberName(m.fullName),
          constituency: m.constituency ?? '',
          imgUrl: m.imgUrl ?? '',
          party: m.party,
          roles: [],
          attendance: null,
          attendanceNa: true,
          left: m.mandateEnd ? `Left ${formatDate(m.mandateEnd)}` : 'Left Assembly',
        })),
      })),
    [formerGroups],
  )

  const gradeOf = useCallback(
    (e: Entry): Grade =>
      e.attendanceNa || e.attendance === null
        ? 'na'
        : e.attendance >= averageAttendance
          ? 'good'
          : e.attendance >= attendanceFloor
            ? 'low'
            : 'poor',
    [averageAttendance, attendanceFloor],
  )

  const base = mode === 'former' ? formerList : currentGroups
  const chips = base.map((g) => ({ key: g.key, short: g.short, swatch: g.swatch, count: g.entries.length }))
  const total = base.reduce((s, g) => s + g.entries.length, 0)
  const activeParty = chips.some((c) => c.key === partyFilter) ? partyFilter : 'ALL'

  const activeGrade = mode === 'former' ? null : gradeFilter

  const matchesSearch = useCallback(
    (e: Entry) => !q || e.name.toLowerCase().includes(q) || e.constituency.toLowerCase().includes(q),
    [q],
  )

  const gradeCounts = useMemo(() => {
    const counts = { good: 0, low: 0, poor: 0 }
    if (mode === 'former') return counts
    for (const g of currentGroups) {
      if (activeParty !== 'ALL' && g.key !== activeParty) continue
      for (const e of g.entries) {
        if (!matchesSearch(e)) continue
        const grade = gradeOf(e)
        if (grade !== 'na') counts[grade] += 1
      }
    }
    return counts
  }, [mode, currentGroups, activeParty, matchesSearch, gradeOf])

  const visible: Group[] = useMemo(() => {
    const passes = (e: Entry) => matchesSearch(e) && (activeGrade === null || gradeOf(e) === activeGrade)
    const scoped = base.filter((g) => activeParty === 'ALL' || g.key === activeParty)
    if (mode === 'constituency') {
      const byConstituency = new Map<string, Entry[]>()
      for (const g of scoped) {
        for (const e of g.entries) {
          if (!passes(e)) continue
          const key = e.constituency || 'Unknown'
          byConstituency.set(key, [...(byConstituency.get(key) ?? []), e])
        }
      }
      return Array.from(byConstituency.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([c, entries]) => ({
          key: c,
          title: formatConstituency(c),
          short: formatConstituency(c),
          swatch: 'var(--sw-accent-solid)',
          entries: [...entries].sort((a, b) => a.name.localeCompare(b.name)),
        }))
    }
    return scoped.map((g) => ({ ...g, entries: g.entries.filter(passes) })).filter((g) => g.entries.length > 0)
  }, [base, mode, activeParty, activeGrade, matchesSearch, gradeOf])

  const shown = visible.reduce((s, g) => s + g.entries.length, 0)
  const filtering = q !== '' || activeParty !== 'ALL' || activeGrade !== null
  const dirty = filtering || mode !== 'party'
  const noun = mode === 'former' ? 'former MLAs' : 'MLAs'
  const GroupIcon = GROUP_ICON[mode]

  const sheetRef = useRef<HTMLDivElement>(null)
  const sheetOpen = partyDropdown.open

  const closeSheet = useCallback(() => {
    partyDropdown.setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sheetOpen) return
    const triggerEl = partyDropdown.triggerRef.current
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('#main-content, footer, .skip-link'))
    inertTargets.forEach((el) => el.setAttribute('inert', ''))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet() }
    const mq = window.matchMedia('(min-width: 641px)')
    const onResize = () => { if (mq.matches) closeSheet() }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    return () => {
      html.style.overflow = previousOverflow
      inertTargets.forEach((el) => el.removeAttribute('inert'))
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
      triggerEl?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, closeSheet])

  function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? [])
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const inList = document.activeElement?.getAttribute('role') === 'option'
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && (document.activeElement === last || inList)) { e.preventDefault(); first.focus() }
  }

  function pickParty(key: string) {
    setPartyFilter(key)
    partyDropdown.setOpen(false)
    window.setTimeout(viewResults, 150)
  }

  function clearAll() {
    setQuery('')
    setPartyFilter('ALL')
    setGradeFilter(null)
    setMode('party')
  }

  return (
    <>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="mlas-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>The Assembly</span>
            <h1 className={styles.h1} id="mlas-title">All {totalMlas} MLAs</h1>
            <p className={styles.headSub}>Every member of the Legislative Assembly elected to the {mandateLabel} mandate.</p>
          </header>

          <div className={styles.bento}>
            <div className={`${styles.tile} ${styles.tFind}`} role="search">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><SlidersHorizontal size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.tileLabel}>Search and filter</span>
                {dirty && (
                  <button type="button" className={styles.pillAction} onClick={clearAll}>
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                    <span className={styles.clearText}>Clear filters</span>
                  </button>
                )}
              </div>

              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} size={22} strokeWidth={2} aria-hidden="true" />
                <label htmlFor="mla-search" className="sr-only">Search MLAs by name or constituency</label>
                <input
                  id="mla-search"
                  type="search"
                  placeholder="Name or constituency"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.search}
                  autoComplete="off"
                />
                {query && (
                  <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => setQuery('')}>
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className={styles.field}>
                <span id="group-label" className={styles.fieldLabel}>Group by</span>
                <div className={styles.pillRow} role="group" aria-labelledby="group-label">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={mode === m.id}
                      className={styles.pillBtn}
                      onClick={() => setMode(m.id)}
                    >
                      <span className={styles.segLong}>{m.long}</span>
                      <span className={styles.segShort} aria-hidden="true">{m.short}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span id="party-label" className={styles.fieldLabel}>Party</span>
                <div className={styles.chips} role="group" aria-labelledby="party-label">
                  <button
                    type="button"
                    aria-pressed={activeParty === 'ALL'}
                    className={styles.pillBtn}
                    onClick={() => setPartyFilter('ALL')}
                  >
                    All
                    <span className={styles.pillCount}>{total}</span>
                  </button>
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={activeParty === c.key}
                      title={c.key}
                      className={styles.pillBtn}
                      onClick={() => setPartyFilter(c.key)}
                    >
                      <span className={styles.chipDot} style={{ background: c.swatch }} aria-hidden="true" />
                      {c.short}
                      <span className={styles.pillCount}>{c.count}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.selectWrap}>
                  <button
                    ref={partyDropdown.triggerRef}
                    type="button"
                    className={styles.select}
                    aria-haspopup="listbox"
                    aria-expanded={partyDropdown.open}
                    aria-labelledby="party-label party-value"
                    onClick={() => partyDropdown.setOpen((o) => !o)}
                  >
                    <span id="party-value" className={styles.selectValue}>
                      {activeParty === 'ALL' ? 'All parties' : chips.find((c) => c.key === activeParty)?.short}
                    </span>
                    <ChevronDown className={styles.selectChev} size={20} strokeWidth={2} aria-hidden="true" />
                  </button>

                  {partyDropdown.open && createPortal(
                    <>
                      <div className={styles.sheetBackdrop} onClick={closeSheet} aria-hidden="true" />
                      <div
                        ref={sheetRef}
                        className={styles.sheet}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="party-sheet-title"
                        onKeyDown={trapFocus}
                      >
                        <span className={styles.sheetGrip} aria-hidden="true" />
                        <div className={styles.sheetHead}>
                          <span className={styles.sheetIcon}><Flag size={22} strokeWidth={2} aria-hidden="true" /></span>
                          <div className={styles.sheetHeadText}>
                            <span className={styles.sheetEyebrow}>Filter by</span>
                            <h2 id="party-sheet-title" className={styles.sheetTitle}>Party</h2>
                          </div>
                          <button type="button" className={styles.sheetClose} aria-label="Close" onClick={closeSheet}>
                            <X size={20} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                        <ul ref={partyDropdown.listRef} className={styles.sheetList} role="listbox" aria-labelledby="party-sheet-title">
                          <li
                            role="option"
                            tabIndex={activeParty === 'ALL' ? 0 : -1}
                            aria-selected={activeParty === 'ALL'}
                            className={styles.sheetItem}
                            onClick={() => pickParty('ALL')}
                            onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => pickParty('ALL'))}
                          >
                            <span className={styles.sheetItemMain}>
                              <span className={styles.sheetTile} aria-hidden="true" />
                              <span className={styles.sheetItemText}>
                                <span className={styles.sheetItemName}>All parties</span>
                                <span className={styles.sheetItemSub}>Show every MLA</span>
                              </span>
                            </span>
                            {activeParty === 'ALL' && <span className={styles.sheetCheck}><Check size={14} strokeWidth={3} aria-hidden="true" /></span>}
                          </li>
                          {chips.map((c) => (
                            <li
                              key={c.key}
                              role="option"
                              tabIndex={activeParty === c.key ? 0 : -1}
                              aria-selected={activeParty === c.key}
                              className={styles.sheetItem}
                              onClick={() => pickParty(c.key)}
                              onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => pickParty(c.key))}
                            >
                              <span className={styles.sheetItemMain}>
                                <span className={styles.sheetTile} style={{ background: c.swatch }} aria-hidden="true" />
                                <span className={styles.sheetItemText}>
                                  <span className={styles.sheetItemName}>{c.short}</span>
                                  {c.key !== c.short && <span className={styles.sheetItemSub}>{c.key}</span>}
                                </span>
                              </span>
                              {activeParty === c.key && <span className={styles.sheetCheck}><Check size={14} strokeWidth={3} aria-hidden="true" /></span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>,
                    document.body,
                  )}
                </div>
              </div>

              <button type="button" className={styles.viewBtn} onClick={viewResults}>
                {filtering ? `View ${shown} ${shown === 1 ? 'MLA' : 'MLAs'}` : `View all ${total} ${noun}`}
                <ArrowDown size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {filtering ? `Showing ${shown} of ${total} ${noun}` : `Showing all ${total} ${noun}`}
              </p>
            </div>

            <div className={`${styles.tile} ${styles.tKey}${mode === 'former' ? ` ${styles.hideOnPhone}` : ''}`}>
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnGreen}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.tileLabel}>Division attendance</span>
              </div>

              <div className={styles.keyFigure}>
                <span className={styles.keyBig}>{averageAttendance.toFixed(1)}<small>%</small></span>
                <span className={styles.keyBigLabel}>average across all MLAs*. Attendance is the share of divisions voted in.</span>
              </div>

              <div className={styles.keyBar} role="img" aria-label={`MLAs by attendance: ${gradeCounts.good} at or above average, ${gradeCounts.low} below average, ${gradeCounts.poor} far below average`}>
                {gradeCounts.good > 0 && <span data-grade="good" style={{ flex: gradeCounts.good }} />}
                {gradeCounts.low > 0 && <span data-grade="low" style={{ flex: gradeCounts.low }} />}
                {gradeCounts.poor > 0 && <span data-grade="poor" style={{ flex: gradeCounts.poor }} />}
              </div>

              <ul className={styles.keyList} aria-label="Filter by attendance">
                <li>
                  <button
                    type="button"
                    className={styles.keyRow}
                    data-grade="good"
                    aria-pressed={activeGrade === 'good'}
                    disabled={mode === 'former'}
                    onClick={() => setGradeFilter((cur) => (cur === 'good' ? null : 'good'))}
                  >
                    <i />
                    <span className={styles.keyText}>
                      <span className={styles.keyName}>At or above average</span>
                      <span className={styles.keyRange}>{averageAttendance.toFixed(1)}% or more</span>
                    </span>
                    <span className={styles.keyCount}>{gradeCounts.good}<small> {gradeCounts.good === 1 ? 'MLA' : 'MLAs'}</small></span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.keyRow}
                    data-grade="low"
                    aria-pressed={activeGrade === 'low'}
                    disabled={mode === 'former'}
                    onClick={() => setGradeFilter((cur) => (cur === 'low' ? null : 'low'))}
                  >
                    <i />
                    <span className={styles.keyText}>
                      <span className={styles.keyName}>Below average</span>
                      <span className={styles.keyRange}>{attendanceFloor.toFixed(1)}-{averageAttendance.toFixed(1)}%</span>
                    </span>
                    <span className={styles.keyCount}>{gradeCounts.low}<small> {gradeCounts.low === 1 ? 'MLA' : 'MLAs'}</small></span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.keyRow}
                    data-grade="poor"
                    aria-pressed={activeGrade === 'poor'}
                    disabled={mode === 'former'}
                    onClick={() => setGradeFilter((cur) => (cur === 'poor' ? null : 'poor'))}
                  >
                    <i />
                    <span className={styles.keyText}>
                      <span className={styles.keyName}>Far below average</span>
                      <span className={styles.keyRange}>Under {attendanceFloor.toFixed(1)}%</span>
                    </span>
                    <span className={styles.keyCount}>{gradeCounts.poor}<small> {gradeCounts.poor === 1 ? 'MLA' : 'MLAs'}</small></span>
                  </button>
                </li>
              </ul>

              <p className={styles.keyNote}>
                {mode === 'former' ? '* Not shown for former MLAs.' : '* Excludes the Speaker.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-label="MLA results">
        <div className={`container ${styles.resultsAnchor}`} ref={resultsRef} tabIndex={-1}>
          {visible.length === 0 && (
            <div className={`${styles.tile} ${styles.empty}`}>
              <span className={`${styles.iconTile} ${styles.tnBlue}`}><SearchX size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div>
                <p className={styles.emptyTitle}>No {noun} match</p>
                <p className={styles.emptySub}>Try a different name or constituency, or clear the filters.</p>
              </div>
              <button type="button" className={styles.pillAction} onClick={clearAll}>Clear filters</button>
            </div>
          )}

          {visible.map((group) => {
            const headingId = `${mode}-${slug(group.key)}`
            return (
              <section key={`${mode}-${group.key}`} className={`${styles.tile} ${styles.group}`} aria-labelledby={headingId}>
                <div className={styles.groupHead} style={{ '--tone': group.swatch } as CSSProperties}>
                  <span className={styles.groupTile}><GroupIcon size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <h2 id={headingId} className={styles.groupTitle}>
                    <span className={styles.titleFull}>{group.title}</span>
                    <span className={styles.titleShort} aria-hidden="true">{group.short}</span>
                  </h2>
                  <span className={styles.groupCount}>{group.entries.length} {group.entries.length === 1 ? 'MLA' : 'MLAs'}</span>
                </div>

                <ul className={styles.rows} role="list">
                  {group.entries.map((e) => {
                    const grade = gradeOf(e)
                    return (
                      <li key={e.id} className={styles.row}>
                        <div className={styles.photo}>
                          <MlaPhoto name={e.name} imgUrl={e.imgUrl} size={128} decorative square personId={e.id} />
                        </div>
                        <div className={styles.main}>
                          <Link
                            href={`${basePath}/assembly/mlas/${e.id}`}
                            className={styles.name}
                            aria-label={`View profile for ${e.name}`}
                          >
                            {e.name}
                          </Link>
                          <span className={styles.constituency}>{formatConstituency(e.constituency)}</span>
                          <div className={styles.tags} title={e.roles.join(', ') || undefined}>
                            {e.party && <span className="party-pill" data-party={abbreviateParty(e.party)}>{abbreviateParty(e.party)}</span>}
                            {e.roles.map((r) => <span key={r} className={styles.rolePill}>{r}</span>)}
                          </div>
                        </div>
                        <div className={styles.att} data-grade={e.left ? 'na' : grade}>
                          {e.left ? (
                            <span className={styles.left}>
                              <CalendarX size={16} strokeWidth={2} aria-hidden="true" />
                              {e.left}
                            </span>
                          ) : (
                            <>
                              <span className={styles.attLabel} aria-hidden="true">Att:</span>
                              <span className={styles.attValue}>{grade === 'na' ? 'n/a' : `${e.attendance}%`}</span>
                              <span className={styles.attTrack} aria-hidden="true">
                                {grade !== 'na' && <span className={styles.attFill} style={{ width: `${Math.max(0, Math.min(100, e.attendance ?? 0))}%` }} />}
                              </span>
                              <span className="sr-only">Attendance{grade !== 'na' && `, ${GRADE_TEXT[grade]}`}</span>
                            </>
                          )}
                        </div>
                        <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </section>
    </>
  )
}
