'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight, ArrowRight, CalendarDays, ChevronDown, Gauge, Handshake, Hourglass, LayoutGrid, MapPin, MessageCircleQuestion, MessagesSquare,
  Mic, Pencil, PoundSterling, RotateCcw, Search, Split, TrendingDown, TrendingUp, UserPlus, UserSearch, Users, Vote, X,
} from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { abbreviateParty, displayParty, formatConstituency, formatDate, formatMemberName, gbp, getSurname, partyBorderColor } from '@/lib/format'
import { heroColours } from '@/lib/partyInk'
import type { CompareData, CompareDivision, CompareMla, CompareRank, CompareRanks, ComparePools, CompareExtremes, Extreme } from '@/lib/db/queries/compare'
import MlaSheet from './MlaSheet'
import DivisionSheet from './DivisionSheet'
import CompareArt from './CompareArt'
import { SEARCH_MAX, cleanQuery, filterMlas } from './search'
import styles from './compare.module.css'

const MIN_SHARED = 25
const SPLITS_STEP = 8

const VOTE_LABEL: Record<string, string> = { A: 'Aye', N: 'No', B: 'Abstained', X: 'No show', '-': 'Not eligible' }
const VOTE_CLASS: Record<string, string> = { A: styles.vAye, N: styles.vNo, B: styles.vAbs, X: styles.vNone, '-': styles.vOut }

type Tally = { same: number; split: number; missed: number; splits: number[] }

function tally(x: string, y: string): Tally {
  const out: Tally = { same: 0, split: 0, missed: 0, splits: [] }
  for (let i = 0; i < x.length; i++) {
    const p = x[i]
    const q = y[i]
    if (p === '-' || q === '-') continue
    if (p === 'X' || q === 'X') out.missed++
    else if (p === q) out.same++
    else {
      out.split++
      out.splits.push(i)
    }
  }
  return out
}

const agreementPct = (t: Tally) => (t.same + t.split > 0 ? Math.round((t.same * 100) / (t.same + t.split)) : null)
function shortNames(a: CompareMla | null, b: CompareMla | null): [string, string] {
  const sa = a ? getSurname(a.name) : ''
  const sb = b ? getSurname(b.name) : ''
  if (a && b && sa === sb) {
    return [`${formatMemberName(a.name)[0]}. ${sa}`, `${formatMemberName(b.name)[0]}. ${sb}`]
  }
  return [sa, sb]
}
const dateLabel = formatDate

function formatServed(days: number): string {
  const months = Math.floor(days / 30.4375)
  if (months < 1) return `${days} ${days === 1 ? 'day' : 'days'}`
  const y = Math.floor(months / 12)
  const mo = months % 12
  return [y ? `${y} ${y === 1 ? 'yr' : 'yrs'}` : '', mo ? `${mo} ${mo === 1 ? 'mth' : 'mths'}` : ''].filter(Boolean).join(' ')
}

function darkenHex(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const mix = (i: number, to: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55 + to * 0.45).toString(16).padStart(2, '0')
  return `#${mix(1, 0x1a)}${mix(3, 0x1d)}${mix(5, 0x21)}`
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const last = n % 10
  if (last === 1) return `${n}st`
  if (last === 2) return `${n}nd`
  if (last === 3) return `${n}rd`
  return `${n}th`
}

type Metric = {
  key: 'served' | 'attendance' | 'questions' | 'sittings' | 'debates' | 'expenses' | 'expensesPerMonth'
  rank?: keyof CompareRanks
  caption?: (m: CompareMla) => string | null
  label: string
  icon: typeof Gauge
  value: (m: CompareMla) => number | null
  format: (v: number) => string
  scale: 'percent' | 'relative'
}

const TEASERS = [
  { icon: Handshake, tone: 'tnGreen', title: 'How often they agree', desc: 'The share of divisions where both cast the same vote.' },
  { icon: Gauge, tone: 'tnBlue', title: 'Attendance and time served', desc: 'Division attendance and how long each has been in the Assembly.' },
  { icon: PoundSterling, tone: 'tnAmber', title: 'Expenses', desc: 'Mandate totals and monthly figures, with rankings.' },
  { icon: MessageCircleQuestion, tone: 'tnPurple', title: 'Questions and topics', desc: 'Questions asked, and the sittings and topics each has spoken in.' },
  { icon: LayoutGrid, tone: 'tnTeal', title: 'Every vote side by side', desc: 'Every division as a block, showing how each of them voted.' },
  { icon: UserSearch, tone: 'tnBlue', title: 'Find a match', desc: 'The MLAs who most and least often vote the same way as each of them.' },
] as const

const METRICS: Metric[] = [
  { key: 'served', label: 'Time served', icon: CalendarDays, value: (m) => m.servedDays, format: formatServed, scale: 'relative', caption: (m) => (m.since ? `Since ${formatDate(m.since)}` : null) },
  { key: 'attendance', rank: 'attendance', label: 'Division attendance', icon: Gauge, value: (m) => m.attendance, format: (v) => `${Math.round(v)}%`, scale: 'percent' },
  { key: 'expenses', rank: 'expenses', label: 'Expenses', icon: PoundSterling, value: (m) => m.expenses, format: (v) => gbp(v), scale: 'relative' },
  { key: 'expensesPerMonth', rank: 'expensesPerMonth', label: 'Expenses per month', icon: PoundSterling, value: (m) => m.expensesPerMonth, format: (v) => gbp(v), scale: 'relative' },
  { key: 'questions', rank: 'questions', label: 'Questions', icon: MessageCircleQuestion, value: (m) => m.questions, format: (v) => v.toLocaleString('en-GB'), scale: 'relative' },
  { key: 'sittings', rank: 'sittings', label: 'Sittings spoken in', icon: Mic, value: (m) => m.sittings, format: (v) => v.toLocaleString('en-GB'), scale: 'relative' },
  { key: 'debates', rank: 'debates', label: 'Topics spoken on', icon: MessagesSquare, value: (m) => m.debates, format: (v) => v.toLocaleString('en-GB'), scale: 'relative' },
]

function usePhone(query = '(max-width: 640px)') {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setPhone(mq.matches)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return phone
}

const NAV_CLEARANCE = 68

const RECORD_PARTS = [
  { code: 'A', label: 'Aye', cls: 'segAye' },
  { code: 'N', label: 'No', cls: 'segNo' },
  { code: 'B', label: 'Abstained', cls: 'segAbs' },
  { code: 'X', label: 'No show', cls: 'segNone' },
] as const

function RecordZone({ votes, cta, href, name }: { votes: string | null; cta?: ReactNode; href?: string | null; name?: string }) {
  const counts = RECORD_PARTS.map((part) => ({ ...part, n: votes ? votes.split(part.code).length - 1 : 0 }))
  const total = counts.reduce((sum, c) => sum + c.n, 0)
  return (
    <div className={styles.zoneBottom}>
      <div className={styles.recordHead}>
        <span className={styles.recordLabel}>Voting record</span>
        <span className={styles.recordTotal}>{votes ? `${total} divisions` : 'Not chosen'}</span>
      </div>
      <div className={styles.recordBar} aria-hidden="true">
        {counts.filter((c) => c.n > 0).map((c) => (
          <i key={c.code} className={styles[c.cls]} style={{ flexGrow: c.n }} />
        ))}
      </div>
      <ul className={styles.recordKey}>
        {counts.map((c) => (
          <li key={c.code}>
            <i className={`${styles.keySwatch} ${styles[c.cls]}`} aria-hidden="true" />
            <span className={styles.keyName}>{c.label}</span>
            <span className={styles.keyCount}>{votes ? c.n : '-'}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <Link href={href} className={styles.profileRow}>
          <span><span className={styles.longLabel}>View full </span>profile{name ? <span className="sr-only"> for {name}</span> : null}</span>
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : (
        <span className={styles.profileRow} aria-hidden="true">
          View full profile
          <ArrowRight size={18} strokeWidth={2} />
        </span>
      )}
      {cta && <div className={styles.zoneCta}>{cta}</div>}
    </div>
  )
}

function SlotCard({
  side, label, mlas, selected, otherId, onPick,
}: {
  side: 'a' | 'b'
  label: string
  mlas: CompareMla[]
  selected: CompareMla | null
  otherId: string | null
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = `${side}-listbox`
  const searching = changing
  const ord = side === 'a' ? 'first' : 'second'
  const phone = usePhone()
  const compact = usePhone('(max-width: 1100px)')
  const [sheetOpen, setSheetOpen] = useState(false)
  const changeEls = useRef<(HTMLButtonElement | null)[]>([])
  const selectRef = useRef<HTMLButtonElement>(null)
  const wasPicking = useRef(false)
  const picking = changing || sheetOpen
  const openPicker = () => (compact ? setSheetOpen(true) : setChanging(true))
  const tint = !searching && selected?.party ? partyBorderColor(selected.party) : null
  const hero = tint ? heroColours(tint) : null

  const parties = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of mlas) if (m.party) counts.set(m.party, (counts.get(m.party) ?? 0) + 1)
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([party]) => party)
  }, [mlas])

  const results = useMemo(() => filterMlas(mlas, query, otherId), [mlas, query, otherId])

  useEffect(() => {
    const list = listRef.current
    const el = list?.children[active] as HTMLElement | undefined
    if (!list || !el) return
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight
  }, [active, open])

  useEffect(() => {
    if (!changing) return
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    const card = slotRef.current
    if (!card) return
    const top = card.getBoundingClientRect().top
    const fieldBottom = input.getBoundingClientRect().bottom
    if (top < NAV_CLEARANCE || fieldBottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollBy({ top: top - NAV_CLEARANCE - 16, behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [changing])

  useEffect(() => {
    if (wasPicking.current && !picking) {
      const visible = changeEls.current.find((el) => el && el.offsetParent !== null)
      ;(selected ? visible : selectRef.current)?.focus()
    }
    wasPicking.current = picking
  }, [picking, selected])

  const stopChanging = () => {
    setChanging(false)
    setOpen(false)
    setQuery('')
  }

  const pick = (id: string) => {
    onPick(id)
    stopChanging()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault()
        pick(results[active].id)
      }
    } else if (e.key === 'Escape') {
      if (open) setOpen(false)
      else stopChanging()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={slotRef}
      className={`${styles.slot} ${side === 'a' ? styles.sideA : styles.sideB}${hero ? ` ${styles.slotParty}` : ''}${selected && !searching ? '' : ` ${styles.slotIsEmpty}`}${!selected && !searching ? ` ${styles.slotBlank}` : ''}`}
      style={hero && tint ? ({ '--party': tint, '--hero-bg': hero.bg, '--hero-ink': hero.ink } as CSSProperties) : undefined}
    >
      <div className={styles.zoneTop}>
        <h3 className="sr-only">{label}</h3>
        {!searching && (
          <button ref={(el) => { changeEls.current[1] = el }} type="button" className={styles.tapArea} onClick={openPicker} tabIndex={selected && !phone ? -1 : 0} aria-hidden={selected && !phone ? true : undefined}>
            <span className="sr-only">{selected ? `Change ${ord} MLA` : `Select MLA for the ${ord} card`}</span>
          </button>
        )}
        {!searching && selected?.party && (
          <span className={styles.markWrap} aria-hidden="true">
            <span className={styles.mark}>{displayParty(selected.party)}</span>
          </span>
        )}
        <div className={styles.slotHead}>
          {searching ? (
            <div
              ref={wrapRef}
              className={styles.combo}
              onBlur={(e) => { if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false) }}
            >
              <label className={styles.search}>
                <Search size={20} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Search MLAs for the {label.toLowerCase()}</span>
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={open && results.length > 0}
                  aria-controls={open && results.length > 0 ? listId : undefined}
                  aria-autocomplete="list"
                  aria-activedescendant={open && results[active] ? `${side}-opt-${results[active].id}` : undefined}
                  value={query}
                  onChange={(e) => { setQuery(cleanQuery(e.target.value)); setActive(0); setOpen(true) }}
                  onFocus={() => setOpen(true)}
                  onClick={() => setOpen(true)}
                  onKeyDown={onKeyDown}
                  placeholder="Select MLA"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={SEARCH_MAX}
                />
                {query && (
                  <button type="button" className={styles.searchClear} onClick={() => { setQuery(''); setActive(0); inputRef.current?.focus() }} aria-label="Clear search">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </label>
              <button type="button" className={styles.slotBtn} onClick={stopChanging}>Cancel<span className="sr-only"> choosing the {ord} MLA</span></button>
            <span className="sr-only" role="status" aria-live="polite">{open ? `${results.length} ${results.length === 1 ? 'MLA' : 'MLAs'} found` : ''}</span>
            </div>
          ) : (
            <>
              {selected && (
                <button ref={(el) => { changeEls.current[0] = el }} type="button" className={`${styles.slotBtn} ${styles.changeBtn}`} onClick={openPicker}>
                  <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                  <span className={styles.changeLabel}>Change</span><span className="sr-only"> {ord} MLA</span>
                </button>
              )}
            </>
          )}
        </div>
        <div className={styles.heroRow}>
          {selected ? (
            <span className={styles.photoWrap}>
              <span className={styles.slotPhoto}>
                <MlaPhoto name={selected.name} imgUrl={selected.imgUrl ?? ''} size={256} decorative square personId={selected.id} />
              </span>
              <span className={styles.editBadge} aria-hidden="true"><Pencil size={14} strokeWidth={2.25} /></span>
            </span>
          ) : (
            <span className={styles.slotEmpty}><UserPlus size={44} strokeWidth={1.75} aria-hidden="true" /></span>
          )}
        <div className={styles.identity}>
          {selected ? (
            <>
              <span className={styles.slotName}><span className={styles.nameClamp}>{formatMemberName(selected.name)}</span></span>
              <span className={styles.identityMeta}>
                {selected.party && (
                  <>
                    <span className={`sr-only ${styles.partyDesktopSr}`}>{displayParty(selected.party)}</span>
                    <span className={`party-pill ${styles.partyPhone}`} data-party={abbreviateParty(selected.party)}><PartyName party={selected.party} /></span>
                  </>
                )}
                {selected.constituency && (
                  <span className={styles.slotLine}>
                    <MapPin size={16} strokeWidth={2} aria-hidden="true" />
                    <span className={styles.slotLineText}>{formatConstituency(selected.constituency)}</span>
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className={styles.slotName} aria-hidden="true">{label}</span>
          )}
        </div>
        </div>
      </div>
              {searching && open && results.length === 0 && (
                <div className={styles.popover}>
                  <p className={styles.noResults}>No MLAs match.</p>
                </div>
              )}
              {searching && open && results.length > 0 && (
                <ul ref={listRef} id={listId} role="listbox" aria-label={`${label} results`} className={styles.popover}>
                  {results.map((m, i) => (
                    <li
                      key={m.id}
                      id={`${side}-opt-${m.id}`}
                      role="option"
                      aria-selected={i === active}
                      className={`${styles.option}${i === active ? ` ${styles.optionActive}` : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(m.id)}
                    >
                      <span className={styles.optionPhoto}>
                        <MlaPhoto name={m.name} imgUrl={m.imgUrl ?? ''} size={96} decorative square personId={m.id} />
                      </span>
                      <span className={styles.optionText}>
                        <span className={styles.optionName}>{formatMemberName(m.name)}</span>
                        <span className={styles.optionMeta}>
                          {m.party && <span className="party-pill" data-party={abbreviateParty(m.party)}><PartyName party={m.party} /></span>}
                          {m.constituency && <span className={styles.optionConst}>{formatConstituency(m.constituency)}</span>}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
      <RecordZone
        votes={selected?.votes ?? null}
        href={selected && !searching ? `/assembly/mlas/${selected.id}` : null}
        name={selected ? formatMemberName(selected.name) : undefined}
        cta={!selected && !searching ? (
          <>
            <span className={styles.ctaLabel}>Browse by party</span>
            <span className={styles.ctaHint}>Tap anywhere on this card to choose.</span>
            <span className={styles.ctaChips}>
              {parties.map((party) => (
                <button
                  key={party}
                  type="button"
                  className={`party-pill ${styles.partyChipBtn}`}
                  data-party={abbreviateParty(party)}
                  onClick={() => { setQuery(displayParty(party)); setActive(0); setChanging(true) }}
                >
                  {displayParty(party)}
                </button>
              ))}
            </span>
            <button ref={selectRef} type="button" className={styles.ctaBtn} onClick={openPicker} tabIndex={compact ? -1 : 0} aria-hidden={compact ? true : undefined}>Select MLA<span className="sr-only"> for the {ord} card</span></button>
          </>
        ) : null}
      />
      <MlaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={(id) => { onPick(id); setSheetOpen(false) }}
        mlas={mlas}
        otherId={otherId}
        currentId={selected?.id ?? null}
        ord={ord}
      />
    </div>
  )
}

function RankPill({ rank, text }: { rank: CompareRank | null; text: string | null }) {
  if (text?.startsWith('Since ')) {
    return <span className={styles.rankPill}><span className={styles.longLabel}>Since{' '}</span>{text.slice(6)}</span>
  }
  return <span className={styles.rankPill}>{text ?? (rank ? `${ordinal(rank.rank)} of ${rank.of}` : 'Not ranked')}</span>
}

function Spot({
  kind, tone, figure, e,
}: {
  kind: 'high' | 'low'
  tone: 'good' | 'bad'
  figure: string
  e: Extreme | null
}) {
  const person = e?.person ?? null
  const Icon = kind === 'high' ? TrendingUp : TrendingDown
  return (
    <div className={`${styles.spot} ${tone === 'good' ? styles.spotGood : styles.spotBad}`}>
      {person ? (
        <span className={styles.spotPhoto}>
          <MlaPhoto name={person.name} imgUrl={person.imgUrl ?? ''} size={96} decorative square personId={person.id} />
        </span>
      ) : (
        <span className={styles.spotTieIcon}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
      )}
      <span className={styles.spotBody}>
        <span className={styles.spotEyebrow}>
          <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
          {kind === 'high' ? 'Highest' : 'Lowest'}
        </span>
        <span className={styles.spotName}>
          {person ? formatMemberName(person.name) : e ? `${e.count} MLAs tied` : ''}
        </span>
        {person?.party && <span className="sr-only">{displayParty(person.party)}</span>}
        {person && !person.current && <span className={styles.spotSub}>Former MLA</span>}
      </span>
      <span className={styles.spotFig}>{figure}</span>
    </div>
  )
}

function PoolChart({
  id, metric, pool, extreme, va, vb, nameA, nameB,
}: {
  id: string
  metric: Metric
  pool: number[]
  extreme: { high: Extreme; low: Extreme } | null
  va: number | null
  vb: number | null
  nameA: string
  nameB: string
}) {
  const sorted = useMemo(() => [...pool].sort((x, y) => y - x), [pool])
  const n = sorted.length
  if (n === 0) return null
  const top = metric.scale === 'percent' ? 100 : Math.max(sorted[0], 1)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const slot = (v: number | null) => (v === null ? null : Math.min(sorted.filter((x) => x > v).length, n - 1))
  const level = va !== null && vb !== null && va === vb
  const ia = slot(va)
  const rawB = slot(vb)
  const ib = level ? null : rawB
  const pct = (v: number) => `${Math.max(v > 0 ? 2 : 0, (v / top) * 100)}%`
  const edge = (i: number) => (i / n < 0.14 ? 'start' : i / n > 0.86 ? 'end' : 'mid')
  const centre = (i: number) => `${((i + 0.5) / n) * 100}%`
  return (
    <div id={id} className={styles.pc}>
      <div className={styles.pcStage}>
        {level && ia !== null && va !== null && (
          <>
            <span className={`${styles.pcLine} ${styles.pcLineLevel}`} style={{ left: centre(ia) }} aria-hidden="true" />
            <span className={`${styles.pcChip} ${styles.pcChipLevel}`} data-edge={edge(ia)} style={{ left: centre(ia) }}>
              {nameA} and {nameB} are level on {metric.format(va)}
            </span>
          </>
        )}
        {!level && ia !== null && va !== null && (
          <>
            <span className={`${styles.pcLine} ${styles.pcLineA}`} style={{ left: centre(ia) }} aria-hidden="true" />
            <span className={`${styles.pcChip} ${styles.pcChipA}`} data-edge={edge(ia)} style={{ left: centre(ia) }}>{nameA} {metric.format(va)}</span>
          </>
        )}
        {!level && ib !== null && vb !== null && (
          <>
            <span className={`${styles.pcLine} ${styles.pcLineB}`} style={{ left: centre(ib) }} aria-hidden="true" />
            <span className={`${styles.pcChip} ${styles.pcChipB}`} data-edge={edge(ib)} style={{ left: centre(ib) }}>{nameB} {metric.format(vb)}</span>
          </>
        )}
        <div className={styles.pcPlot} aria-hidden="true">
          <div className={styles.pcCols}>
            {sorted.map((v, i) => (
              <i
                key={i}
                className={i === ia ? (level ? styles.pcColLevel : styles.pcColA) : i === ib ? styles.pcColB : undefined}
                style={{ height: pct(v) }}
              />
            ))}
          </div>
          <span className={styles.pcMedian} style={{ bottom: `${(median / top) * 100}%` }}>
            <em>Median {metric.format(median)}</em>
          </span>
        </div>
        <div className={styles.pcAxis} aria-hidden="true">
          <span>1st</span>
          <span>{ordinal(n)}</span>
        </div>
      </div>
      <div className={styles.pcSummary}>
        <Spot kind="high" tone={metric.key === 'expenses' || metric.key === 'expensesPerMonth' ? 'bad' : 'good'} figure={metric.format(sorted[0])} e={extreme ? extreme.high : null} />
        <Spot kind="low" tone={metric.key === 'expenses' || metric.key === 'expensesPerMonth' ? 'good' : 'bad'} figure={metric.format(sorted[n - 1])} e={extreme ? extreme.low : null} />
        <dl className={styles.pcFacts}>
          <div><dt>Median</dt><dd>{metric.format(median)}</dd></div>
          <div><dt>MLAs ranked</dt><dd>{n}</dd></div>
        </dl>
      </div>
    </div>
  )
}

function SideBySide({
  a, b, nameA, nameB, pools, servedPool, extremes,
}: {
  a: CompareMla
  b: CompareMla
  nameA: string
  nameB: string
  pools: ComparePools
  servedPool: number[]
  extremes: CompareExtremes
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ul className={styles.cmp}>
      {METRICS.map((metric) => {
        const va = metric.value(a)
        const vb = metric.value(b)
        const top = metric.scale === 'percent' ? 100 : Math.max(va ?? 0, vb ?? 0)
        const width = (v: number | null) => (v === null || top <= 0 ? 0 : Math.max(v > 0 ? 2 : 0, (v / top) * 100))
        const Icon = metric.icon
        const isOpen = open === metric.key
        const panelId = `pc-${metric.key}`
        return (
          <li key={metric.key} className={`${styles.cmpItem}${isOpen ? ` ${styles.cmpItemOpen}` : ''}`}>
            <button
              type="button"
              className={styles.cmpRow}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : metric.key)}
            >
              <span className={`${styles.cmpSide} ${styles.cmpA}`}>
                <span className={styles.cmpFig}>{va === null ? 'n/a' : metric.format(va)}</span>
                <RankPill rank={metric.rank ? a.ranks[metric.rank] : null} text={metric.caption?.(a) ?? null} />
              </span>
              <span className={styles.cmpMid}>
                <span className={styles.tapeLabel}>
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                  {metric.label}
                  <ChevronDown size={16} strokeWidth={2.25} className={`${styles.chev}${isOpen ? ` ${styles.chevOpen}` : ''}`} aria-hidden="true" />
                </span>
                <span className={styles.tapeBars} aria-hidden="true">
                  <span className={styles.tapeHalfA}><i className={styles.barA} style={{ width: `${width(va)}%` }} /></span>
                  <span className={styles.tapeHalfB}><i className={styles.barB} style={{ width: `${width(vb)}%` }} /></span>
                </span>
              </span>
              <span className={`${styles.cmpSide} ${styles.cmpB}`}>
                <span className={styles.cmpFig}>{vb === null ? 'n/a' : metric.format(vb)}</span>
                <RankPill rank={metric.rank ? b.ranks[metric.rank] : null} text={metric.caption?.(b) ?? null} />
              </span>
            </button>
            {isOpen && (
              <PoolChart
                id={panelId}
                metric={metric}
                pool={metric.rank ? pools[metric.rank] : servedPool}
                extreme={extremes[metric.key]}
                va={va}
                vb={vb}
                nameA={nameA}
                nameB={nameB}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function VotePill({ code }: { code: string }) {
  return <span className={`${styles.votePill} ${VOTE_CLASS[code]}`}>{VOTE_LABEL[code]}</span>
}

export default function CompareClient({ data, mandateLabel }: { data: CompareData; mandateLabel: string }) {
  const { mlas, divisions } = data
  const byId = useMemo(() => new Map(mlas.map((m) => [m.id, m])), [mlas])

  const [aId, setAId] = useState<string | null>(null)
  const [bId, setBId] = useState<string | null>(null)
  const [matchSide, setMatchSide] = useState<'a' | 'b'>('a')
  const slotsRef = useRef<HTMLDivElement>(null)
  const [mosaicFilter, setMosaicFilter] = useState<'all' | 'splits'>('all')
  const [active, setActive] = useState<number | null>(null)
  const [splitsShown, setSplitsShown] = useState(SPLITS_STEP)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qa = params.get('a')
    const qb = params.get('b')
    if (qa && byId.has(qa)) setAId(qa)
    if (qb && byId.has(qb)) setBId(qb)
    setReady(true)
  }, [byId])

  useEffect(() => {
    if (!ready) return
    const params = new URLSearchParams()
    if (aId) params.set('a', aId)
    if (bId) params.set('b', bId)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [aId, bId, ready])

  useEffect(() => {
    setActive(null)
    setSplitsShown(SPLITS_STEP)
  }, [aId, bId])

  const a = aId ? byId.get(aId) ?? null : null
  const b = bId ? byId.get(bId) ?? null : null
  const both = a && b ? { a, b } : null

  const result = useMemo(() => (a && b ? tally(a.votes, b.votes) : null), [a, b])
  const pct = result ? agreementPct(result) : null

  const matches = useMemo(() => {
    const focus = matchSide === 'a' ? a : b
    if (!focus) return null
    const rows = mlas
      .filter((m) => m.id !== focus.id)
      .map((m) => {
        const t = tally(focus.votes, m.votes)
        return { m, pct: agreementPct(t), shared: t.same + t.split }
      })
      .filter((r): r is { m: CompareMla; pct: number; shared: number } => r.pct !== null && r.shared >= MIN_SHARED)
      .sort((x, y) => y.pct - x.pct || y.shared - x.shared)
    const voted = focus.votes.split('').filter((c) => 'ANB'.includes(c)).length
    return { focus, voted, closest: rows.slice(0, 3), furthest: rows.slice(-3).reverse() }
  }, [mlas, a, b, matchSide])

  const years = useMemo(() => {
    const map = new Map<string, number[]>()
    divisions.forEach((d, i) => {
      const y = d.date.slice(0, 4)
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push(i)
    })
    return [...map.entries()]
  }, [divisions])

  const reset = () => {
    setAId(null)
    setBId(null)
    setMatchSide('a')
    setMosaicFilter('all')
    setActive(null)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById('compare-title')?.focus({ preventScroll: true })
      const slots = slotsRef.current
      if (!slots) return
      const top = slots.getBoundingClientRect().top
      if (top < NAV_CLEARANCE || top > window.innerHeight - NAV_CLEARANCE) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollBy({ top: top - NAV_CLEARANCE - 16, behavior: reduce ? 'auto' : 'smooth' })
      }
    }))
  }

  const swap = () => {
    setAId(bId)
    setBId(aId)
  }

  const phone = usePhone()
  const [divSheetOpen, setDivSheetOpen] = useState(false)
  const closeDivSheet = useCallback(() => setDivSheetOpen(false), [])
  const activeDivision: CompareDivision | null = active !== null ? divisions[active] : null
  const nameA = a ? formatMemberName(a.name) : ''
  const nameB = b ? formatMemberName(b.name) : ''
  const [shortA, shortB] = shortNames(a, b)
  const servedPool = useMemo(() => mlas.flatMap((m) => (m.servedDays === null ? [] : [m.servedDays])), [mlas])
  const sideStyle = useMemo(() => {
    if (!a || !b) return undefined
    const colA = partyBorderColor(a.party)
    const rawB = partyBorderColor(b.party)
    const colB = colA === rawB ? darkenHex(rawB) : rawB
    const heroA = heroColours(colA)
    const heroB = heroColours(colB)
    return { '--pa': colA, '--pb': colB, '--ca': heroA.bg, '--cb': heroB.bg, '--ia': heroA.ink, '--ib': heroB.ink } as CSSProperties
  }, [a, b])
  const shown = result ? result.splits.slice().reverse().slice(0, splitsShown) : []

  return (
    <>
      <section className={`${styles.band} ${styles.bandPage} ${styles.partySides}${both ? '' : ` ${styles.bandOpen}`}`} style={sideStyle} aria-labelledby="compare-title">
        <div className="container">
          <header className={`${styles.head} ${styles.headRow}`}>
            <div className={styles.headCopy}>
              <span className={styles.eyebrow}>Compare</span>
              <h1 id="compare-title" tabIndex={-1} className={styles.h1}>Head to head</h1>
              <p className={styles.headSub}>
                Pick any two MLAs to see how often they vote the same way and how they compare on attendance, questions, speeches and expenses in the {mandateLabel} mandate.
              </p>
            </div>
            {!a && !b && <CompareArt className={styles.headArt} />}
            {(a || b) && (
              <button type="button" className={`${styles.slotBtn} ${styles.slotBtnAuto} ${styles.clearHead}`} onClick={reset}>
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                Clear selection
              </button>
            )}
          </header>
          <div className={styles.heroStack}>
            <h2 className="sr-only">Choose two MLAs</h2>
            <div ref={slotsRef} className={styles.slots}>
              <SlotCard side="a" label="First MLA" mlas={mlas} selected={a} otherId={bId} onPick={setAId} />
              <div className={styles.versus}>
                <span className={styles.vsMark} aria-hidden="true">vs</span>
                <button type="button" className={styles.swap} onClick={swap} disabled={!a && !b}>
                  <ArrowLeftRight size={20} strokeWidth={2} aria-hidden="true" />
                  <span className="sr-only">Swap the two MLAs</span>
                </button>
              </div>
              <SlotCard side="b" label="Second MLA" mlas={mlas} selected={b} otherId={aId} onPick={setBId} />
              {(a || b) && (
                <button type="button" className={`${styles.slotBtn} ${styles.slotBtnAuto} ${styles.clearBelow}`} onClick={reset}>
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                  Clear selection
                </button>
              )}
            </div>
            {both && result && (
              <>
                <div className={styles.tile} role="region" aria-labelledby="agree-title">
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnGreen}`}><Handshake size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 id="agree-title" className={styles.tileLabel}>How often they agree</h2>
                  </div>
                  <div className={styles.agree}>
                    <div className={styles.agreeFig}>
                      <span className={styles.agreeNum}>{pct === null ? 'n/a' : <>{pct}<span>%</span></>}</span>
                      <span className={styles.agreeCap}>
                        {pct === null ? 'No shared votes' : `of the ${result.same + result.split} divisions where both voted, they voted the same way`}
                      </span>
                    </div>
                    <div className={styles.agreeBody}>
                      <div className={styles.agreeBar} aria-hidden="true">
                        {[['agreeSame', result.same], ['agreeSplit', result.split], ['agreeMissed', result.missed]].map(([cls, n]) => (
                          Number(n) > 0 ? <i key={cls} className={styles[cls as string]} style={{ flexGrow: Number(n) }} /> : null
                        ))}
                      </div>
                      <dl className={styles.agreeKey}>
                        <div><dt><i className={`${styles.keySwatch} ${styles.agreeSame}`} aria-hidden="true" />Voted the same way</dt><dd>{result.same}</dd></div>
                        <div><dt><i className={`${styles.keySwatch} ${styles.agreeSplit}`} aria-hidden="true" />Voted differently</dt><dd>{result.split}</dd></div>
                        <div><dt><i className={`${styles.keySwatch} ${styles.agreeMissed}`} aria-hidden="true" />At least one absent</dt><dd>{result.missed}</dd></div>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className={styles.tile} role="region" aria-labelledby="sbs-title">
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnPurple}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 id="sbs-title" className={styles.tileLabel}>Side by side</h2>
                    <span className={`${styles.tileMeta} ${styles.sbsHint}`}>Select a measure to see all MLAs.</span>
                  </div>
                  <SideBySide a={both.a} b={both.b} nameA={shortA} nameB={shortB} pools={data.pools} servedPool={servedPool} extremes={data.extremes} />
                  <ul className={styles.footnoteList}>
                    <li>Attendance: current MLAs only.</li>
                    <li>Questions: leaves out the Speaker and ministers.</li>
                    <li>Sittings and topics: leave out the Speaker and deputies.</li>
                    <li>Expenses: every MLA with published expenses, current and former, on mandate totals to date.</li>
                    <li>Time served: counted from the day each MLA took their seat this mandate.</li>
                    <li>Expenses per month: the mandate total divided by months in office, up to the end of the latest published financial year. Only MLAs with at least 12 months are ranked.</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {both && result ? (
        <>
          <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="mosaic-title">
            <div className="container">
              <header className={styles.sectionHead}>
                <span className={styles.eyebrow}>Division by division</span>
                <h2 id="mosaic-title" className={styles.h2}>Every vote, side by side</h2>
                <p className={styles.sectionSub}>
                  Each block is one division. The top half is how {nameA} voted and the bottom half is how {nameB} voted.
                </p>
              </header>
              <div className={styles.bento}>
                <div className={`${styles.tile} ${styles.span12}`}>
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnTeal}`}><LayoutGrid size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h3 className={styles.tileLabel}>{divisions.length} divisions</h3>
                    <div className={styles.chips} role="group" aria-label="Show divisions">
                      <button type="button" className={styles.chip} aria-pressed={mosaicFilter === 'all'} onClick={() => setMosaicFilter('all')}>
                        All <span className={styles.chipCount}>{divisions.length}</span>
                      </button>
                      <button type="button" className={styles.chip} aria-pressed={mosaicFilter === 'splits'} onClick={() => setMosaicFilter('splits')}>
                        Splits <span className={styles.chipCount}>{result.split}</span>
                      </button>
                    </div>
                  </div>

                  <p className="sr-only">
                    {nameA} and {nameB} voted the same way in {result.same} divisions and differently in {result.split}. In {result.missed} divisions at least one of them was absent. Each block below is one division, and the ones where they split are listed underneath.
                  </p>
                  <div className={styles.legendCard}>
                    <p id="mosaic-key" className={styles.legendTitle}>Key:</p>
                    <ul className={styles.legend} aria-labelledby="mosaic-key">
                      {(['A', 'N', 'B', 'X', '-'] as const).map((code) => (
                        <li key={code}><i className={`${styles.legendDot} ${VOTE_CLASS[code]}`} aria-hidden="true" />{VOTE_LABEL[code]}</li>
                      ))}
                      <li><i className={styles.legendRing} aria-hidden="true" />Voted differently</li>
                    </ul>
                  </div>

                  <div className={styles.mosaic} aria-hidden="true">
                    {years.map(([year, idxs]) => (
                      <div key={year} className={styles.mosaicYear}>
                        <span className={styles.yearLabel}>{year}</span>
                        <div className={styles.cells}>
                          {idxs.map((i) => {
                            const p = both.a.votes[i]
                            const q = both.b.votes[i]
                            const isSplit = p !== '-' && q !== '-' && p !== 'X' && q !== 'X' && p !== q
                            const dim = mosaicFilter === 'splits' && !isSplit
                            return (
                              <span
                                key={i}
                                className={`${styles.cell}${isSplit ? ` ${styles.cellSplit}` : ''}${dim ? ` ${styles.cellDim}` : ''}${active === i ? ` ${styles.cellActive}` : ''}`}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => { setActive(i); if (phone) setDivSheetOpen(true) }}
                              >
                                <i className={VOTE_CLASS[p]} />
                                <i className={VOTE_CLASS[q]} />
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.readout} aria-hidden="true">
                    {activeDivision && active !== null ? (
                      <>
                        <span className={styles.readoutDate}>{dateLabel(activeDivision.date)}</span>
                        <span className={styles.readoutTitle}>{activeDivision.title}{activeDivision.sub ? `: ${activeDivision.sub}` : ''}</span>
                        <span className={styles.readoutVotes}>
                          <span>{shortA} <VotePill code={both.a.votes[active]} /></span>
                          <span>{shortB} <VotePill code={both.b.votes[active]} /></span>
                        </span>
                      </>
                    ) : (
                      <span className={styles.readoutHint}>Hover over or tap a block to see the division.</span>
                    )}
                  </div>
                  {activeDivision && active !== null && (
                    <DivisionSheet
                      open={divSheetOpen}
                      onClose={closeDivSheet}
                      eyebrow={dateLabel(activeDivision.date)}
                      title={`${activeDivision.title}${activeDivision.sub ? `: ${activeDivision.sub}` : ''}`}
                    >
                      <ul className={styles.sheetVotes}>
                        <li><span>{nameA}</span><VotePill code={both.a.votes[active]} /></li>
                        <li><span>{nameB}</span><VotePill code={both.b.votes[active]} /></li>
                      </ul>
                    </DivisionSheet>
                  )}
                </div>

                <div className={`${styles.tile} ${styles.span12}`}>
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnAmber}`}><Split size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h3 className={styles.tileLabel}>Where they split</h3>
                    <span className={styles.tileMeta}>{result.split} {result.split === 1 ? 'division' : 'divisions'}</span>
                  </div>
                  {shown.length === 0 ? (
                    <p className={styles.empty}>
                      <Vote size={20} strokeWidth={2} aria-hidden="true" />
                      {nameA} and {nameB} have never voted opposite ways in the same division.
                    </p>
                  ) : (
                    <>
                      <ul className={styles.splitList}>
                        {shown.map((i) => {
                          const d = divisions[i]
                          return (
                            <li key={d.id} className={styles.splitRow}>
                              <span className={styles.splitDate}>{dateLabel(d.date)}</span>
                              <Link href={`/assembly/divisions/${d.id}`} className={styles.splitTitle}>
                                {d.title}{d.sub ? `: ${d.sub}` : ''}
                              </Link>
                              <span className={styles.splitVotes}>
                                <span>{shortA} <VotePill code={both.a.votes[i]} /></span>
                                <span>{shortB} <VotePill code={both.b.votes[i]} /></span>
                              </span>
                              <ArrowRight size={18} strokeWidth={2} className={styles.splitArrow} aria-hidden="true" />
                            </li>
                          )
                        })}
                      </ul>
                      {result.split > shown.length && (
                        <button type="button" className={styles.moreBtn} onClick={() => setSplitsShown((n) => n + SPLITS_STEP)}>
                          Show {Math.min(SPLITS_STEP, result.split - shown.length)} more
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
          <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="match-title">
            <div className="container">
              <header className={styles.sectionHead}>
                <span className={styles.eyebrow}>Voting matches</span>
                <h2 id="match-title" className={styles.h2}>Who votes like them?</h2>
                <p className={styles.sectionSub}>
                  The MLAs whose votes line up most and least with {nameA} or {nameB}, across divisions where both cast a vote.
                </p>
              </header>
                <div className={styles.tile}>
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnBlue}`}><UserSearch size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h3 className={styles.tileLabel}>Showing matches for</h3>
                    <div className={styles.segment} role="group" aria-label="Compare other MLAs against">
                      <button type="button" aria-pressed={matchSide === 'a'} onClick={() => setMatchSide('a')}>{shortA}</button>
                      <button type="button" aria-pressed={matchSide === 'b'} onClick={() => setMatchSide('b')}>{shortB}</button>
                    </div>
                  </div>
                  {matches && matches.closest.length === 0 && (
                    <div className={styles.matchEmpty}>
                      <span className={`${styles.iconTile} ${styles.tnAmber}`}><Hourglass size={22} strokeWidth={2} aria-hidden="true" /></span>
                      <div className={styles.matchEmptyBody}>
                        <p className={styles.matchEmptyTitle}>
                          {matches.voted < MIN_SHARED ? 'Not enough votes yet' : 'No close comparisons'}
                        </p>
                        <p className={styles.matchEmptyText}>
                          {matches.voted < MIN_SHARED
                            ? `${formatMemberName(matches.focus.name)} has voted in ${matches.voted} ${matches.voted === 1 ? 'division' : 'divisions'} so far. A match needs at least ${MIN_SHARED} divisions where both cast a vote.`
                            : `No other MLA shares at least ${MIN_SHARED} divisions with ${formatMemberName(matches.focus.name)} where both cast a vote.`}
                        </p>
                        {matches.voted < MIN_SHARED && (
                          <div className={styles.matchMeter}>
                            <span className={styles.matchMeterTrack} aria-hidden="true">
                              <i style={{ width: `${Math.max(3, (matches.voted / MIN_SHARED) * 100)}%` }} />
                            </span>
                            <span className={styles.matchMeterLabel}><strong>{matches.voted}</strong> of {MIN_SHARED} divisions voted in</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {matches && matches.closest.length > 0 && (
                    <div className={styles.matchLists}>
                      {([['Votes most like', matches.closest], ['Votes least like', matches.furthest]] as const).map(([title, rows]) => (
                        <div key={title}>
                          <h4 className={styles.matchTitle}>{title} {formatMemberName(matches.focus.name)}</h4>
                          <ul className={styles.matchList}>
                            {rows.map((r) => (
                              <li key={r.m.id}>
                                <div className={styles.matchRow}>
                                  <span className={styles.matchPhoto}>
                                    <MlaPhoto name={r.m.name} imgUrl={r.m.imgUrl ?? ''} size={96} decorative square personId={r.m.id} />
                                  </span>
                                  <span className={styles.matchText}>
                                    <span className={styles.matchName}>{formatMemberName(r.m.name)}</span>
                                    {r.m.party && <span className="party-pill" data-party={abbreviateParty(r.m.party)}><PartyName party={r.m.party} /></span>}
                                  </span>
                                  <span className={styles.matchPct}>{r.pct}%</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {matches && matches.closest.length > 0 && (
                    <p className={styles.footnote}>Needs at least {MIN_SHARED} divisions where both cast a vote.</p>
                  )}
                </div>
            </div>
          </section>

        </>
      ) : (
        <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="teaser-title">
          <div className="container">
            <header className={styles.sectionHead}>
              <span className={styles.eyebrow}>Head to head</span>
              <h2 id="teaser-title" className={styles.h2}>{a || b ? 'Pick one more MLA' : 'Pick two MLAs to compare'}</h2>
              <p className={styles.sectionSub}>
                Use the Select MLA buttons above. Once both are chosen, the comparison appears here.
              </p>
            </header>
            <ul className={styles.teaserGrid}>
              {TEASERS.map((t) => {
                const Icon = t.icon
                return (
                  <li key={t.title} className={styles.teaserItem}>
                    <span className={`${styles.iconTile} ${styles[t.tone]}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.teaserText}>
                      <span className={styles.teaserTitle}>{t.title}</span>
                      <span className={styles.teaserDesc}>{t.desc}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
