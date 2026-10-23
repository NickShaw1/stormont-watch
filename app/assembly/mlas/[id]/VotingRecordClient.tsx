'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { Gavel, Vote, CheckCircle2, XCircle, Check, X, Minus, EyeOff, CalendarDays, ChevronDown, ListFilter } from 'lucide-react'
import { isPassed } from '@/lib/bills'
import { gradeAttendance } from '@/lib/attendance'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { useMandate } from '@/components/MandateContext'
import SheetSelect from './SheetSelect'
import styles from './mlaDetail.module.css'

type VoteRow = {
  vote: string
  subject: string
  title: string | null
  divisionDate: Date
  outcome: string | null
  documentId: string
  divisionType: string | null
  totalAyes: number | null
  totalNoes: number | null
  totalAbstains: number | null
}

type VoteKey = 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW'
type Filter = 'ALL' | VoteKey

interface Props {
  votes: VoteRow[]
  avgAttendance: number
  attendanceFloor: number
  notice?: string
}

const KEYS: { key: VoteKey; label: string; icon: typeof Check }[] = [
  { key: 'AYE',       label: 'Aye',     icon: Check },
  { key: 'NO',        label: 'No',      icon: X },
  { key: 'ABSTAINED', label: 'Abstain', icon: Minus },
  { key: 'NO_SHOW',   label: 'No Show', icon: EyeOff },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const LABEL: Record<VoteKey, string> = { AYE: 'Aye', NO: 'No', ABSTAINED: 'Abstain', NO_SHOW: 'No Show' }
const ICON: Record<VoteKey, typeof Check> = { AYE: Check, NO: X, ABSTAINED: Minus, NO_SHOW: EyeOff }

const dayOf = (v: VoteRow) => v.divisionDate.toISOString().slice(0, 10)

const VOTE_TILE: Record<string, { bg: string; on?: string }> = {
  AYE: { bg: 'var(--sw-success-solid)' },
  NO: { bg: 'var(--sw-error-solid)' },
  ABSTAINED: { bg: 'var(--sw-accent-warm)', on: '#1a1d21' },
  NO_SHOW: { bg: '#656b72' },
}

export default function VotingRecordClient({ votes, avgAttendance, attendanceFloor, notice }: Props) {
  const { basePath } = useMandate()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [toggled, setToggled] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId()

  const chronological = useMemo(() => [...votes].reverse(), [votes])
  const minDay = chronological.length ? dayOf(chronological[0]) : ''
  const maxDay = chronological.length ? dayOf(chronological[chronological.length - 1]) : ''

  const months = useMemo(() => {
    if (!minDay) return []
    const list: { value: string; label: string }[] = []
    let y = parseInt(minDay.slice(0, 4))
    let m = parseInt(minDay.slice(5, 7))
    const endY = parseInt(maxDay.slice(0, 4))
    const endM = parseInt(maxDay.slice(5, 7))
    while (y < endY || (y === endY && m <= endM)) {
      list.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1].slice(0, 3)} ${y}` })
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    return list
  }, [minDay, maxDay])

  const inRange = (v: VoteRow) => {
    const d = dayOf(v)
    return (!from || d >= from) && (!to || d <= to)
  }
  const rangeVotes = votes.filter(inRange)
  const ranged = from !== '' || to !== ''

  const counts: Record<VoteKey, number> = {
    AYE:       rangeVotes.filter((v) => v.vote === 'AYE').length,
    NO:        rangeVotes.filter((v) => v.vote === 'NO').length,
    ABSTAINED: rangeVotes.filter((v) => v.vote === 'ABSTAINED').length,
    NO_SHOW:   rangeVotes.filter((v) => v.vote === 'NO_SHOW').length,
  }
  const visibleKeys = KEYS.filter((k) => counts[k.key] > 0)
  const activeFilter: Filter = filter === 'ALL' || counts[filter] > 0 ? filter : 'ALL'
  const filteredVotes = activeFilter === 'ALL' ? rangeVotes : rangeVotes.filter((v) => v.vote === activeFilter)

  const groups = filteredVotes.reduce<{ key: string; label: string; rows: VoteRow[] }[]>((acc, v) => {
    const iso = v.divisionDate.toISOString().slice(0, 7)
    const last = acc[acc.length - 1]
    if (last && last.key === iso) last.rows.push(v)
    else acc.push({ key: iso, label: `${MONTHS[parseInt(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`, rows: [v] })
    return acc
  }, [])

  const buckets = new Map<string, Record<VoteKey, { on: number; off: number }>>()
  for (const v of votes) {
    const month = dayOf(v).slice(0, 7)
    const key: VoteKey = (v.vote as VoteKey) in LABEL ? (v.vote as VoteKey) : 'NO_SHOW'
    const b = buckets.get(month) ?? {
      AYE: { on: 0, off: 0 }, NO: { on: 0, off: 0 }, ABSTAINED: { on: 0, off: 0 }, NO_SHOW: { on: 0, off: 0 },
    }
    const on = inRange(v) && (activeFilter === 'ALL' || v.vote === activeFilter)
    b[key][on ? 'on' : 'off'] += 1
    buckets.set(month, b)
  }
  const monthTotal = (month: string) => {
    const b = buckets.get(month)
    return b ? KEYS.reduce((sum, k) => sum + b[k.key].on + b[k.key].off, 0) : 0
  }
  const maxMonth = Math.max(1, ...months.map((m) => monthTotal(m.value)))

  const share = (n: number) => {
    if (rangeVotes.length === 0) return '0%'
    const v = (n / rangeVotes.length) * 100
    return v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`
  }
  const yearFrom = (y: string) => (`${y}-01-01` < minDay ? minDay : `${y}-01-01`)
  const yearTo = (y: string) => (`${y}-12-31` > maxDay ? maxDay : `${y}-12-31`)
  const yearActive = (y: string) => from === yearFrom(y) && to === yearTo(y)
  const setYear = (y: string) => { setFrom(yearFrom(y)); setTo(yearTo(y)); setToggled(new Set()) }
  const monthStats = (key: string) => {
    const rows = rangeVotes.filter((v) => dayOf(v).slice(0, 7) === key)
    const total = rows.length
    const count = (k: string) => rows.filter((v) => v.vote === k).length
    const noShow = count('NO_SHOW')
    const pct = total > 0 ? Math.round(((total - noShow) / total) * 100) : 0
    return {
      total,
      aye: count('AYE'),
      no: count('NO'),
      noShow,
      pct,
      passed: rows.filter((v) => isPassed(v.outcome) === true).length,
      grade: total > 0 ? gradeAttendance(pct, avgAttendance, attendanceFloor) : null,
    }
  }
  const resetView = () => setToggled(new Set())
  const clearRange = () => { setFrom(''); setTo(''); resetView() }
  const monthCount = months.length
  const yearSpans = months.reduce<{ year: string; count: number }[]>((acc, m) => {
    const year = m.value.slice(0, 4)
    const last = acc[acc.length - 1]
    if (last && last.year === year) last.count += 1
    else acc.push({ year, count: 1 })
    return acc
  }, [])
  const isOpen = (key: string) => toggled.has(key)
  const toggleMonth = (key: string) => setToggled((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <div className={`${styles.tile} ${styles.voteTile}`}>
      <div className={`${styles.tileHead} ${styles.panelHead}`}>
        <span className={`${styles.iconTile} ${styles.tnTeal}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
        <h3 className={styles.tileTitle}>Voting record</h3>
        {ranged && <button type="button" className={styles.pillBtn} onClick={clearRange}>Reset</button>}
      </div>

      {notice && (
        <div className={styles.notice}>
          <span className={`${styles.iconTile} ${styles.noticeIcon}`}><Gavel size={22} strokeWidth={2} aria-hidden="true" /></span>
          <div className={styles.noticeBody}>
            <p className={styles.noticeTitle}>Presiding officer</p>
            <p className={styles.noticeText}>{notice}</p>
          </div>
        </div>
      )}

      <div className={styles.voteKey}>
        <div className={styles.ribbonWrap}>
          <div className={styles.rangeBar}>
            <span className={styles.rangeLabel}>Votes by month</span>
          </div>

          <span className={styles.ribbon}>
            <span className="sr-only">
              {`Votes by month from ${months[0]?.label ?? ''} to ${months[months.length - 1]?.label ?? ''}. In view: ${rangeVotes.length} of ${votes.length}. Use the year buttons below the chart to filter by year.`}
            </span>
            <span className={styles.cols} onPointerLeave={() => setHover(null)} aria-hidden="true">
              {months.map((m, hi) => {
                const b = buckets.get(m.value)
                return (
                  <span key={m.value} className={styles.col} data-hover={hover === hi ? '' : undefined} onPointerEnter={() => setHover(hi)}>
                    {b && KEYS.flatMap((k) =>
                      (['on', 'off'] as const).map((side) =>
                        b[k.key][side] > 0 ? (
                          <span
                            key={`${k.key}-${side}`}
                            data-vote={k.key}
                            data-dim={side === 'off' ? '' : undefined}
                            style={{ height: `${(b[k.key][side] / maxMonth) * 100}%` }}
                          />
                        ) : null,
                      ),
                    )}
                  </span>
                )
              })}
              {hover !== null && months[hover] && (() => {
                const m = months[hover]
                const rows = votes.filter((v) => dayOf(v).slice(0, 7) === m.value)
                const count = (k: string) => rows.filter((v) => v.vote === k).length
                const pct = ((hover + 0.5) / monthCount) * 100
                const pos = pct <= 50 ? { left: `calc(${pct}% + 14px)` } : { right: `calc(${100 - pct}% + 14px)` }
                return (
                  <span className={styles.chartTip} style={pos}>
                    <span className={styles.tipHead}>
                      <span>{m.label}</span>
                      <span>{rows.length} {rows.length === 1 ? 'vote' : 'votes'}</span>
                    </span>
                    <span className={styles.tipRow}><i style={{ background: 'var(--sw-success-solid)' }} />Aye<b>{count('AYE')}</b></span>
                    <span className={styles.tipRow}><i style={{ background: 'var(--sw-error-solid)' }} />No<b>{count('NO')}</b></span>
                    {count('ABSTAINED') > 0 && <span className={styles.tipRow}><i style={{ background: 'var(--sw-accent-warm)' }} />Abstain<b>{count('ABSTAINED')}</b></span>}
                    <span className={styles.tipRow}><i style={{ background: '#8a9099' }} />No Show<b>{count('NO_SHOW')}</b></span>
                  </span>
                )
              })()}
            </span>
          </span>

          <span className={styles.ribbonAxis}>
            <span className={styles.axisYears} style={{ gridTemplateColumns: `repeat(${monthCount}, minmax(0, 1fr))` }}>
              {yearSpans.map((y) => (
                <button
                  key={y.year}
                  type="button"
                  className={styles.axisYear}
                  aria-pressed={yearActive(y.year)}
                  style={{ gridColumn: `span ${y.count}` }}
                  onClick={() => (yearActive(y.year) ? clearRange() : setYear(y.year))}
                >
                  {y.year}
                </button>
              ))}
            </span>
          </span>
        </div>
        <SheetSelect
          className={styles.voteSelect}
          options={[
            { key: 'ALL', label: 'All votes', icon: Vote, meta: `${rangeVotes.length}`, color: 'var(--sw-accent-strong-solid)' },
            ...visibleKeys.map((k) => ({ key: k.key, label: k.label, icon: k.icon, meta: `${counts[k.key]} (${share(counts[k.key])})`, color: VOTE_TILE[k.key]?.bg, on: VOTE_TILE[k.key]?.on })),
          ]}
          value={activeFilter}
          onPick={(k) => { setFilter(k as typeof activeFilter); setToggled(new Set()) }}
          eyebrow="Filter by"
          title="Vote"
          headIcon={ListFilter}
        />
        <div className={styles.voteKeyGrid} role="group" aria-label="Filter voting record">
          <button
            type="button"
            className={styles.voteKeyBtn}
            data-vote="ALL"
            aria-pressed={activeFilter === 'ALL'}
            onClick={() => { setFilter('ALL'); setToggled(new Set()) }}
          >
            <span className={styles.voteKeyTop}>
              <span className={styles.voteKeyIcon}><Vote size={18} strokeWidth={2.25} aria-hidden="true" /></span>
              <span className={styles.voteKeyLabel}>All votes</span>
            </span>
            <span className={styles.voteKeyCount}>{rangeVotes.length}</span>
            <span className={styles.voteKeyShare}>
              <span className={styles.voteKeyTrack} aria-hidden="true"><span style={{ width: '100%' }} /></span>
              <span className={styles.voteKeyPct}>100%</span>
            </span>
          </button>
          {visibleKeys.map((k) => (
            <button
              key={k.key}
              type="button"
              className={styles.voteKeyBtn}
              data-vote={k.key}
              aria-pressed={activeFilter === k.key}
              onClick={() => { setFilter(k.key); setToggled(new Set()) }}
            >
              <span className={styles.voteKeyTop}>
                <span className={styles.voteKeyIcon}><k.icon size={18} strokeWidth={2.5} aria-hidden="true" /></span>
                <span className={styles.voteKeyLabel}>{k.label}</span>
              </span>
              <span className={styles.voteKeyCount}>{counts[k.key]}</span>
              <span className={styles.voteKeyShare}>
                <span className={styles.voteKeyTrack} aria-hidden="true"><span style={{ width: `${(counts[k.key] / rangeVotes.length) * 100}%` }} /></span>
                <span className={styles.voteKeyPct}>{share(counts[k.key])}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <span className={styles.voteCountSr} role="status" aria-live="polite" aria-atomic="true">
        {filteredVotes.length} vote{filteredVotes.length !== 1 ? 's' : ''}
      </span>

      <ul className={styles.voteGroups}>
        {groups.map((g) => (
          <li key={`${activeFilter}-${g.key}`} className={styles.voteGroup}>
            <h4 className={styles.voteGroupHead}>
              <button
                type="button"
                id={`${uid}-btn-${g.key}`}
                className={styles.monthBtn}
                aria-expanded={isOpen(g.key)}
                aria-controls={`${uid}-panel-${g.key}`}
                onClick={() => toggleMonth(g.key)}
              >
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><CalendarDays size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.voteMonth}>{g.label}</span>
                {(() => {
                  const st = monthStats(g.key)
                  const gradeCls = st.grade === 'good' ? styles.valGood : st.grade === 'low' ? styles.valWarn : st.grade === 'poor' ? styles.valBad : ''
                  return (
                    <span className={styles.monthStats}>
                      <span className={styles.mStat}>
                        <span className={`${styles.mVal} ${gradeCls}`}>{st.pct}%</span>
                        <span className={styles.mLab}>Attendance</span>
                      </span>
                      <span className={styles.mStat}>
                        <span className={styles.mVal}>{st.aye}</span>
                        <span className={styles.mLab}><i style={{ background: 'var(--sw-success-solid)' }} />Aye</span>
                      </span>
                      <span className={styles.mStat}>
                        <span className={styles.mVal}>{st.no}</span>
                        <span className={styles.mLab}><i style={{ background: 'var(--sw-error-solid)' }} />No</span>
                      </span>
                    </span>
                  )
                })()}
                <span className={styles.voteGroupCount}>{g.rows.length} {g.rows.length === 1 ? 'vote' : 'votes'}</span>
                <span className={styles.monthChev}><ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" /></span>
              </button>
            </h4>
            <div
              id={`${uid}-panel-${g.key}`}
              role="region"
              aria-labelledby={`${uid}-btn-${g.key}`}
              className={styles.monthPanel}
              data-open={isOpen(g.key) ? '' : undefined}
            >
              <div className={styles.monthPanelInner}>
            <ul className={styles.voteList}>
              {g.rows.map((h) => {
                const key = h.vote as VoteKey
                const known = key in LABEL
                const VoteIcon = known ? ICON[key] : EyeOff
                const voteName = known ? LABEL[key] : h.vote
                const passed = isPassed(h.outcome)
                const { title, subtitle, stage } = formatDivisionSubject(h.title ?? h.subject)
                const amendmentMatch = subtitle?.match(/^Amendment (\d+)$/)

                const t = h.title ?? ''
                const s = h.subject ?? ''
                const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
                const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
                const category = isStatutory ? 'Regulations' : isBill ? 'Bill' : 'Motion'
                const categoryCls = isStatutory ? styles.metaRegs : isBill ? styles.metaBill : styles.metaMotion
                const iso = h.divisionDate.toISOString().slice(0, 10)

                return (
                  <li key={h.documentId}>
                    <Link href={`${basePath}/assembly/divisions/${h.documentId}`} className={styles.voteCard} data-vote={known ? key : 'NO_SHOW'}>
                      <span className={styles.voteDate} aria-hidden="true">
                        <span className={styles.voteDay}>{parseInt(iso.slice(8, 10))}</span>
                        <span className={styles.voteMon}>{MONTHS[parseInt(iso.slice(5, 7)) - 1].slice(0, 3)}</span>
                      </span>
                      <time className="sr-only" dateTime={iso}>{formatDate(iso)}: </time>
                      <span className={styles.vMain}>
                        <span className={styles.voteTitle}>{title}</span>
                        <span className={styles.vMeta}>
                          <span className={categoryCls}>{category}</span>
                          {stage && <span className={styles.vStage}>{stage}</span>}
                          {amendmentMatch && <span>Amendment {amendmentMatch[1]}</span>}
                        </span>
                      </span>
                      <span className={styles.vTags}>
                        <span className={styles.vChip}>
                          <VoteIcon size={14} strokeWidth={2.5} aria-hidden="true" />
                          {key === 'NO_SHOW' ? 'No Show' : `Voted ${voteName}`}
                        </span>
                        {passed !== null && (
                          <span className={`${styles.badge} ${passed ? styles.badgePass : styles.badgeFail}`}>
                            {passed ? <CheckCircle2 size={14} strokeWidth={2.25} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2.25} aria-hidden="true" />}
                            {passed ? 'Passed' : 'Failed'}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {groups.length === 0 && (
        <div className={styles.rangeEmpty}>
          <p className={styles.tileText}>No votes match this date range and filter.</p>
          <button type="button" className={styles.pillBtn} onClick={() => { clearRange(); setFilter('ALL') }}>Clear filters</button>
        </div>
      )}
    </div>
  )
}
