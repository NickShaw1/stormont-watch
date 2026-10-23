'use client'

import { useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import {
  PieChart,
  MessageCircleQuestion, FileText, CalendarCheck, MessagesSquare, TrendingUp,
  Wallet, PoundSterling, BarChart3, Newspaper, Users, MapPin, Landmark, Vote, ArrowRight, ArrowUpRight, LayoutList, ChevronDown, Info, CalendarDays,
} from 'lucide-react'
import styles from './mlaDetail.module.css'
import VotingRecordClient from './VotingRecordClient'
import SheetSelect from './SheetSelect'
import { useMandate } from '@/components/MandateContext'

type ExpenseRow = {
  financial_year: string
  period: string
  constituency_office: string | null
  other_expenses: string | null
  allowances: string | null
  staff_costs: string | null
  total: string | null
  rank: number | null
  total_members: number | null
}

type Interest = {
  id: number
  personId: string
  registerCategoryId: string
  registerCategory: string
  registerEntry: string
  registerEntryStartDate: string | null
  updatedAt: string | null
}

type QuestionStat = {
  year: number
  month: number
  writtenCount: number
  oralCount: number
}

type HansardRow = {
  reportDocId: string
  plenaryDate: string
  debateTitle: string
}

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

type SittingMonth = { year: number; month: number; totalSittings: number }

interface Props {
  votes: VoteRow[]
  avgAttendance: number
  attendanceFloor: number
  notice?: string
  allExpenses: ExpenseRow[]
  interests: Interest[]
  totalQuestions: number
  writtenCount: number
  oralCount: number
  questionStats: QuestionStat[]
  hideQuestionsTab: boolean
  isCurrent: boolean
  questionRank: { rank: number; totalEligible: number } | null
  currentSalary: number | null
  mandateEarnings: number | null
  mandateExpensesRank: number | null
  mandateExpensesTotalMembers: number | null
  hansardRows: HansardRow[]
  hansardRank: { rank: number; eligibleCount: number } | null
  hansardDebateRank: { rank: number; eligibleCount: number; debates: number } | null
  hansardSittingsByMonth: SittingMonth[]
}

type Tab = 'voting' | 'finances' | 'participation' | 'interests'

const SECTION_TILE: Record<Tab, { color: string; on?: string }> = {
  voting: { color: 'var(--sw-accent-solid)' },
  finances: { color: 'var(--sw-success-solid)' },
  participation: { color: '#8b5cf6' },
  interests: { color: '#14b8a6', on: '#1a1d21' },
}
type Icon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

const CATEGORY_TONES = ['tnIndigo', 'tnGreen', 'tnCoral', 'tnTeal', 'tnPurple', 'tnPink', 'tnOrange', 'tnBlue'] as const


const gbp = (val: string | null | undefined) => {
  const n = val ? parseFloat(val) || 0 : 0
  const whole = Math.round(n * 100) % 100 === 0
  return `£${n.toLocaleString('en-GB', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const gbpWhole = (val: number) => `£${val.toLocaleString('en-GB')}`

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LONDON_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })

function londonIsoDate(timestamp: string | null): string | null {
  if (!timestamp) return null
  return LONDON_DATE.format(new Date(timestamp))
}

function formatInterestDate(isoDate: string | null): string {
  if (!isoDate) return ''
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

type Tone = 'good' | 'warn' | 'bad'

function rankTone(rank: number, total: number, highIsBad: boolean): Tone {
  const pctile = total > 1 ? (rank - 1) / (total - 1) : 0
  const tone: Tone = pctile <= 0.33 ? 'good' : pctile <= 0.66 ? 'warn' : 'bad'
  if (!highIsBad) return tone
  return tone === 'good' ? 'bad' : tone === 'bad' ? 'good' : 'warn'
}

function lastTwelveMonths() {
  const now = new Date()
  const months: { year: number; month: number; label: string }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    })
  }
  return months
}

function Figure({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figLabel}>{label}</span>
      <span className={styles.figValue}>{value}</span>
      {children}
    </div>
  )
}

const MANDATE_KEY = 'mandate'

const EXPENSE_CATS = [
  { key: 'staff', label: 'Staff costs', field: 'staff_costs', tone: 'tnCoral', icon: Users },
  { key: 'office', label: 'Constituency office', field: 'constituency_office', tone: 'tnPink', icon: MapPin },
  { key: 'allow', label: 'Allowances', field: 'allowances', tone: 'tnOrange', icon: Wallet },
  { key: 'other', label: 'Other expenses', field: 'other_expenses', tone: 'tnPurple', icon: FileText },
] as const

const shortYear = (y: string) => y.replace(/^\d{2}(\d{2})-\d{2}(\d{2})$/, '$1-$2')

const shortGbp = (v: number) => (Math.abs(v) >= 1000 ? `£${Math.round(v / 1000)}k` : `£${Math.round(v)}`)

type KpiScale = { rank: number; total: number; highIsBad: boolean; top: string; bottom: string }

function Kpi({ icon: IconCmp, tone, label, value, sub, span, compact, scale, aside }: {
  icon: Icon
  tone: string
  label: string
  value: ReactNode
  sub?: string
  span?: string
  compact?: boolean
  scale?: KpiScale
  aside?: ReactNode
}) {
  const pos = scale && scale.total > 1 ? ((scale.total - scale.rank) / (scale.total - 1)) * 100 : 100
  const rankTn = scale ? rankTone(scale.rank, scale.total, scale.highIsBad) : null
  return (
    <div className={`${styles.tile} ${span ?? styles.tThird}`}>
      <div className={styles.tileHead}>
        <span className={`${styles.iconTile} ${styles[tone]}`}><IconCmp size={22} strokeWidth={2} aria-hidden="true" /></span>
        <span className={styles.tileLabel}>{label}</span>
      </div>
      <div className={aside ? styles.kpiSplit : styles.kpiStack}>
        <div className={styles.kpiStack}>
        <div className={styles.kpiTop}>
          <span className={`${styles.figValue}${compact ? ` ${styles.figValueSm}` : ''}`}>{value}</span>
          {scale && rankTn && (
            <span className={styles.kpiRank}>
              <span className={styles.kpiRankLabel}>Rank</span>
              <span className={`${styles.kpiRankNum} ${styles[`tone_${rankTn}`]}`}>{scale.rank}<small>/{scale.total}</small></span>
            </span>
          )}
        </div>
        {sub && <p className={styles.kpiSub}>{sub}</p>}
        {scale && rankTn && (
          <div className={styles.hScale}>
            <span className={styles.hTrack} data-scale={scale.highIsBad ? 'bad-right' : 'good-right'} aria-hidden="true">
              <span className={styles.hMark} data-tone={rankTn} style={{ left: `${pos}%` }} />
            </span>
            <span className={styles.hEnds} aria-hidden="true">
              <span>{scale.bottom}</span>
              <span>{scale.top}</span>
            </span>
            <span className="sr-only">Ranked {scale.rank} of {scale.total}, between {scale.bottom.toLowerCase()} and {scale.top.toLowerCase()}</span>
          </div>
        )}
        </div>
        {aside}
      </div>
    </div>
  )
}

function YearChart({ rows, selected, onSelect, mandate, detail }: {
  rows: ExpenseRow[]
  selected: string
  onSelect: (year: string) => void
  mandate: ExpenseRow | null
  detail?: ReactNode
}) {
  const [closed, setClosed] = useState(false)
  const chrono = [...rows].reverse()
  const num = (v: string | null | undefined) => Math.max(0, parseFloat(v ?? '0') || 0)
  const max = Math.max(1, ...chrono.map((r) => num(r.total)))
  const columns = [...(mandate ? [mandate] : []), ...chrono]

  return (
    <>
    <div className={styles.yearChart} role="group" aria-label="Expenses and rank by financial year" style={{ '--n': columns.length } as CSSProperties}>
      {columns.map((r, idx) => {
        const isMandate = r.financial_year === MANDATE_KEY
        const total = num(r.total)
        const scale = isMandate ? total : max
        const pos = r.rank !== null && r.total_members !== null && r.total_members > 1
          ? ((r.total_members - r.rank) / (r.total_members - 1)) * 100
          : r.rank !== null ? 100 : null
        const tone = r.rank !== null && r.total_members !== null ? rankTone(r.rank, r.total_members, true) : null
        return (
          <button
            key={r.financial_year}
            type="button"
            className={`${styles.yearCol}${isMandate ? ` ${styles.mandateCol}` : ''}`}
            aria-pressed={r.financial_year === selected}
            onClick={() => onSelect(r.financial_year)}
          >
            <span className={styles.yearLabel}>
              {isMandate ? 'Mandate' : (
                <>
                  <span className={styles.lblFull}>{r.financial_year}</span>
                  <span className={styles.lblShort} aria-hidden="true">{shortYear(r.financial_year)}</span>
                </>
              )}
            </span>
            <span className={styles.yearTotal}>{shortGbp(total)}</span>
            <span className={styles.yearPlot} aria-hidden="true">
              <span className={styles.yearBar}>
                {EXPENSE_CATS.map((c) => {
                  const v = num(r[c.field])
                  return v > 0 && scale > 0 ? <span key={c.key} className={styles[c.tone]} style={{ height: `${(v / scale) * 100}%` }} /> : null
                })}
              </span>
              {pos !== null && tone && (
                <span className={styles.rankTrack}>
                  <span className={styles.rankMark} data-tone={tone} style={{ bottom: `${pos}%` }} />
                  {r.rank !== null && r.total_members !== null && (
                    <span className={styles.colTip} aria-hidden="true" data-flip={idx === columns.length - 1 ? '' : undefined} style={{ bottom: `${pos}%` }}>
                      <span className={styles.tipHead}><span>{isMandate ? 'Mandate' : r.financial_year}</span></span>
                      <span className={styles.tipRow}>Ranked<b>{r.rank} of {r.total_members}</b></span>
                      <span className={styles.tipRow}>Spend<b>{shortGbp(total)}</b></span>
                      <span className={styles.tipNote}>Rank 1 is the highest spend</span>
                    </span>
                  )}
                </span>
              )}
            </span>
            {r.rank !== null && r.total_members !== null && tone && (
              <span className={styles.rankPill} data-tone={tone}>
                {r.rank}<small>/{r.total_members}</small>
                <span className="sr-only"> rank for spend, rank 1 is the highest</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
    <div className={styles.yearRows} role="group" aria-label="Expenses and rank by financial year">
      {columns.map((r) => {
        const isMandate = r.financial_year === MANDATE_KEY
        const total = num(r.total)
        const pos = r.rank !== null && r.total_members !== null && r.total_members > 1
          ? ((r.total_members - r.rank) / (r.total_members - 1)) * 100
          : r.rank !== null ? 100 : null
        const isOpen = r.financial_year === selected && !closed
        const tone = r.rank !== null && r.total_members !== null ? rankTone(r.rank, r.total_members, true) : null
        return (
          <div
            key={r.financial_year}
            className={`${styles.yItem}${isMandate ? ` ${styles.yRowMandate}` : ''}`}
            data-open={isOpen ? '' : undefined}
          >
          <button
            type="button"
            className={styles.yRow}
            aria-expanded={isOpen}
            aria-controls={`yp-${r.financial_year}`}
            onClick={() => {
              if (r.financial_year === selected) setClosed((c) => !c)
              else { onSelect(r.financial_year); setClosed(false) }
            }}
          >
            <span className={styles.yRowTop}>
              <span className={`${styles.iconTile} ${isMandate ? styles.tnBlue : styles.tnGrey}`} aria-hidden="true">
                {isMandate ? <Wallet size={22} strokeWidth={2} /> : <CalendarDays size={22} strokeWidth={2} />}
              </span>
              <span className={styles.yRowText}>
                <span className={styles.yRowLabel}>{isMandate ? 'Whole mandate' : r.financial_year}</span>
                <span className={styles.yRowTotal}>{isOpen ? gbp(r.total) : shortGbp(total)}</span>
              </span>
              <span className={styles.yChev} aria-hidden="true"><ChevronDown size={20} strokeWidth={2} /></span>
            </span>
            {pos !== null && tone && r.rank !== null && r.total_members !== null && (
              <span className={styles.yRank}>
                <span className={styles.hTrack} data-scale="bad-right" aria-hidden="true">
                  <span className={styles.hMark} data-tone={tone} style={{ left: `${pos}%` }} />
                </span>
                <span className={styles.rankPill} data-tone={tone}>
                  {r.rank}<small>/{r.total_members}</small>
                  <span className="sr-only"> rank for spend, rank 1 is the highest</span>
                </span>
              </span>
            )}
          </button>
          <div id={`yp-${r.financial_year}`} className={styles.yPanel} data-open={isOpen ? '' : undefined}>
            <div className={styles.yPanelInner}>{isOpen && detail}</div>
          </div>
          </div>
        )
      })}
    </div>
    </>
  )
}

type Segment = { key: string; label: string; amount: string; value: number; tone: string; icon: Icon }

function SplitBar({ segments, label, showBar = true }: { segments: Segment[]; label: string; showBar?: boolean }) {
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0)
  return (
    <div className={styles.split}>
      {showBar && (
        <span className={styles.splitBar} role="img" aria-label={label}>
          {segments.filter((seg) => seg.value > 0).map((seg) => (
            <span key={seg.key} className={`${styles.splitSeg} ${styles[seg.tone]}`} style={{ flex: seg.value }} />
          ))}
        </span>
      )}
      <ul className={styles.splitLegend}>
        {segments.map((seg) => (
          <li key={seg.key} className={`${styles.splitItem} ${styles[seg.tone]}`}>
            <span className={styles.splitIcon}><seg.icon size={18} strokeWidth={2} aria-hidden="true" /></span>
            <span className={styles.splitText}>
              <span className={styles.splitLabel}>{seg.label}</span>
              <span className={styles.splitAmount}>{seg.amount}</span>
            </span>
            <span className={styles.splitShare}>{total > 0 ? Math.round((Math.max(0, seg.value) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuestionSplit({ written, oral }: { written: number; oral: number }) {
  const total = written + oral
  const rows = [
    { key: 'w', label: 'Written', count: written, cls: styles.splitWritten },
    { key: 'o', label: 'Oral', count: oral, cls: styles.splitOral },
  ]
  return (
    <div className={`${styles.tile} ${styles.tHalf}`}>
      <div className={styles.tileHead}>
        <span className={`${styles.iconTile} ${styles.tnBlue}`}><PieChart size={22} strokeWidth={2} aria-hidden="true" /></span>
        <span className={styles.tileLabel}>Written vs oral</span>
      </div>
      <div className={styles.mixTop}>
        {rows.map((r) => (
          <span key={r.key} className={`${styles.mixFig} ${r.key === 'o' ? styles.mixEnd : ''}`}>
            <span className={styles.figValue}>{r.count.toLocaleString()}</span>
          </span>
        ))}
      </div>
      <div className={styles.hScale}>
      <div className={styles.mixBar} role="img" aria-label={`${written} written and ${oral} oral questions`}>
        <span className={styles.splitWritten} style={{ flexGrow: Math.max(written, 1) }} />
        <span className={styles.splitOral} style={{ flexGrow: Math.max(oral, 1) }} />
      </div>
      <div className={styles.mixEnds} aria-hidden="true">
        {rows.map((r) => (
          <span key={r.key} className={`${styles.mixKey} ${r.key === 'o' ? styles.mixEnd : ''}`}>
            <i className={`${styles.splitDot} ${r.cls}`} />
            {r.label} {Math.round((r.count / total) * 100)}%
          </span>
        ))}
      </div>
      </div>
    </div>
  )
}

type TabDef = { id: Tab; long: string; short: string; icon: Icon }

function TileHead({ icon: IconCmp, tone, title, action, panel, suffix }: { icon: Icon; tone: string; title: string; action?: ReactNode; panel?: boolean; suffix?: string }) {
  return (
    <div className={`${styles.tileHead}${panel ? ` ${styles.panelHead}` : ''}`}>
      <span className={`${styles.iconTile} ${styles[tone]}`}><IconCmp size={22} strokeWidth={2} aria-hidden="true" /></span>
      <h3 className={styles.tileTitle}>{title}{suffix && <span className={styles.titleSuffix}> {suffix}</span>}</h3>
      {action}
    </div>
  )
}

function MonthChart({ questionStats, hansardRows, hansardSittingsByMonth, showQuestions, showPlenary }: {
  questionStats: QuestionStat[]
  hansardRows: HansardRow[]
  hansardSittingsByMonth: SittingMonth[]
  showQuestions: boolean
  showPlenary: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const months = lastTwelveMonths()
  const qMap = new Map(questionStats.map((r) => [`${r.year}-${r.month}`, r.writtenCount + r.oralCount]))
  const totalMap = new Map(hansardSittingsByMonth.map((r) => [`${r.year}-${r.month}`, Number(r.totalSittings)]))
  const spokenMap = new Map<string, Set<string>>()
  for (const row of hansardRows) {
    const key = `${parseInt(row.plenaryDate.slice(0, 4))}-${parseInt(row.plenaryDate.slice(5, 7))}`
    if (!spokenMap.has(key)) spokenMap.set(key, new Set())
    spokenMap.get(key)!.add(row.reportDocId)
  }
  const data = months.map((m) => {
    const key = `${m.year}-${m.month}`
    const spoken = spokenMap.get(key)?.size ?? 0
    return { ...m, questions: qMap.get(key) ?? 0, spoken, held: Math.max(totalMap.get(key) ?? 0, spoken) }
  })
  const qMax = Math.max(1, ...data.map((d) => d.questions))
  const sMax = Math.max(1, ...data.map((d) => d.held))
  const topCount = Math.max(0, ...data.map((d) => d.spoken))
  const tied = topCount > 0 ? data.map((d, i) => (d.spoken === topCount ? i : -1)).filter((i) => i >= 0) : []
  const monthName = (d: { year: number; month: number }) => new Date(d.year, d.month - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  const tiedNames = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(tied.map((i) => monthName(data[i])))
  const totalQuestionsYear = data.reduce((sum, d) => sum + d.questions, 0)
  const qPeak = data.reduce((best, d) => (d.questions > best.questions ? d : best), data[0])
  const totalSpoken = data.reduce((sum, d) => sum + d.spoken, 0)
  const totalHeldYear = data.reduce((sum, d) => sum + d.held, 0)
  const pct = hover === null ? 0 : ((hover + 0.5) / data.length) * 100
  const pos = pct <= 50 ? { left: `calc(${pct}% + 14px)` } : { right: `calc(${100 - pct}% + 14px)` }
  const hd = hover === null ? null : data[hover]

  return (
    <div className={styles.monthChart}>
      <div className={styles.pStats}>
        {showQuestions && (
          <div className={styles.pStat}>
            <span className={styles.pStatTop}><i className={styles.pStatDot} style={{ background: 'var(--mq)' }} />Questions asked</span>
            <span className={styles.pStatFig}>{totalQuestionsYear.toLocaleString()}</span>
            <span className={styles.pStatSub}>In the last 12 months</span>
          </div>
        )}
        {showQuestions && (
          <div className={styles.pStat}>
            <span className={styles.pStatTop}><i className={styles.pStatDot} style={{ background: 'var(--mq)' }} />Most questions</span>
            <span className={styles.pStatFig}>{qMax.toLocaleString()}</span>
            <span className={styles.pStatSub}>in {monthName(qPeak)}</span>
          </div>
        )}
        {showPlenary && (
          <div className={styles.pStat}>
            <span className={styles.pStatTop}><i className={styles.pStatDot} style={{ background: 'var(--ms)' }} />Sittings spoken in</span>
            <span className={styles.pStatFig}>{totalSpoken}<small>/{totalHeldYear}</small></span>
            <span className={styles.pStatSub}>of those held (pale bars)</span>
          </div>
        )}
        {showPlenary && tied.length > 0 && (
          <div className={styles.pStat}>
            <span className={styles.pStatTop}><i className={styles.pStatDot} style={{ background: 'var(--ms)' }} />Most sittings</span>
            <span className={styles.pStatFig}>{topCount}</span>
            <span className={styles.pStatSub}>in {tiedNames}</span>
          </div>
        )}
      </div>
      <ul className={styles.mSummary}>
        {showQuestions && (
          <li>
            <i className={styles.pStatDot} style={{ background: 'var(--mq)' }} />
            <span><b>{totalQuestionsYear.toLocaleString()}</b> questions. Most in one month: {qMax.toLocaleString()} ({monthName(qPeak)})</span>
          </li>
        )}
        {showPlenary && (
          <li>
            <i className={styles.pStatDot} style={{ background: 'var(--ms)' }} />
            <span><b>{totalSpoken} of {totalHeldYear}</b> sittings spoken in. Most in one month: {topCount} ({tied.length > 0 ? tiedNames : 'none'})</span>
          </li>
        )}
      </ul>
      <div className={styles.monthPlot} onMouseLeave={() => setHover(null)} role="group" aria-label="Activity by month over the last 12 months">
        <div className={styles.monthCols}>
          {data.map((d, i) => (
            <div
              key={`${d.year}-${d.month}`}
              className={styles.monthCol}
              data-hover={hover === i ? '' : undefined}
              data-best={tied.includes(i) ? '' : undefined}
              tabIndex={0}
              aria-label={`${d.label}: ${showQuestions ? `${d.questions} questions` : ''}${showQuestions && showPlenary ? ', ' : ''}${showPlenary ? `spoke in ${d.spoken} of ${d.held} sittings` : ''}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover((h) => (h === i ? null : i))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span className={styles.monthBars}>
                {showQuestions && <span className={styles.monthQ} style={{ height: `${(d.questions / qMax) * 100}%` }} />}
                {showPlenary && (
                  <span className={styles.monthTrack} style={{ height: `${(d.held / sMax) * 100}%` }}>
                    <span className={styles.monthS} style={{ height: d.held > 0 ? `${(d.spoken / d.held) * 100}%` : 0 }} />
                  </span>
                )}
              </span>
              <span className={styles.monthLabel}>
                <span className={styles.lblFull}>{d.label.slice(0, 3)}</span>
                <span className={styles.lblShort} aria-hidden="true">{d.label.slice(0, 1)}</span>
              </span>
            </div>
          ))}
        </div>
        <p className={styles.monthCaption}>Last 12 months</p>
        {hd && (
          <span className={styles.chartTip} style={pos}>
            <span className={styles.tipHead}><span>{hd.label}</span></span>
            {showQuestions && <span className={styles.tipRow}><i style={{ background: 'var(--mq)' }} />Questions<b>{hd.questions}</b></span>}
            {showPlenary && <span className={styles.tipRow}><i style={{ background: 'var(--ms)' }} />Spoke in<b>{hd.spoken} of {hd.held}</b></span>}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ActivityTabsClient(props: Props) {
  const {
    votes, avgAttendance, attendanceFloor, notice, allExpenses: allExpensesRaw, interests, totalQuestions, writtenCount, oralCount, questionStats, hideQuestionsTab, isCurrent,
    questionRank, currentSalary, mandateEarnings, mandateExpensesRank, mandateExpensesTotalMembers,
    hansardRows, hansardRank, hansardDebateRank, hansardSittingsByMonth,
  } = props
  const { mandate, basePath } = useMandate()
  const allExpenses = allExpensesRaw.filter((e) => (parseFloat(e.total ?? '0') || 0) > 0)
  const [activeTab, setActiveTab] = useState<Tab>(votes.length > 0 ? 'voting' : 'finances')
  const [selectedYear, setSelectedYear] = useState<string>(allExpenses.length > 0 ? MANDATE_KEY : '')

  // Mandate figures use every published row, net, so a recovery (a negative year) reduces the total,
  // exactly as on the Overall cost, Spending, Expenses and party pages. The chart only draws years above £0.
  const sumField = (f: 'staff_costs' | 'constituency_office' | 'allowances' | 'other_expenses' | 'total') =>
    allExpensesRaw.reduce((acc, e) => acc + (parseFloat(e[f] ?? '0') || 0), 0).toFixed(2)
  const mandateRow: ExpenseRow | null = allExpenses.length > 0
    ? {
        financial_year: MANDATE_KEY,
        period: 'Whole mandate',
        staff_costs: sumField('staff_costs'),
        constituency_office: sumField('constituency_office'),
        allowances: sumField('allowances'),
        other_expenses: sumField('other_expenses'),
        total: sumField('total'),
        rank: mandateExpensesRank,
        total_members: mandateExpensesTotalMembers,
      }
    : null
  const selectedExpenses = selectedYear === MANDATE_KEY
    ? mandateRow
    : allExpenses.find(e => e.financial_year === selectedYear) ?? null
  const mandateTotalExpenses = allExpensesRaw.reduce((sum, e) => sum + (parseFloat(e.total ?? '0') || 0), 0)
  const recoveries = allExpensesRaw.filter((e) => (parseFloat(e.total ?? '0') || 0) < 0)
  const recoveryTotal = Math.abs(recoveries.reduce((sum, e) => sum + (parseFloat(e.total ?? '0') || 0), 0))

  const showQuestions = !hideQuestionsTab && totalQuestions > 0
  const showPlenary = hansardRows.length > 0
  const showParticipation = showQuestions || showPlenary

  const grouped = interests.reduce<Record<string, Interest[]>>((acc, item) => {
    if (!acc[item.registerCategory]) acc[item.registerCategory] = []
    acc[item.registerCategory].push(item)
    return acc
  }, {})
  const categories = Object.keys(grouped)
  const toneOf = (category: string) => CATEGORY_TONES[Math.max(0, categories.indexOf(category)) % CATEGORY_TONES.length]

  const yearDetailNode = selectedExpenses ? (
  <div className={styles.yearDetail}>
    <div className={styles.yearHead}>
      <Figure label={selectedExpenses.period ?? selectedYear} value={gbp(selectedExpenses.total)} />
      {selectedExpenses.rank !== null && selectedExpenses.total_members !== null && (
        <span className={styles.rankChip} data-tone={rankTone(selectedExpenses.rank, selectedExpenses.total_members, true)}>
          Ranked {selectedExpenses.rank} of {selectedExpenses.total_members} for spend
        </span>
      )}
    </div>
    <SplitBar
      showBar={false}
      label={`Expenses for ${selectedExpenses.period ?? selectedYear} by category`}
      segments={EXPENSE_CATS.map((c) => ({
        key: c.key,
        label: c.label,
        amount: gbp(selectedExpenses[c.field]),
        value: parseFloat(selectedExpenses[c.field] ?? '0') || 0,
        tone: c.tone,
        icon: c.icon,
      }))}
    />
  </div>
  ) : null

  const tabs: TabDef[] = [
    ...(votes.length > 0 ? [{ id: 'voting' as Tab, long: 'Voting', short: 'Voting', icon: Vote as Icon }] : []),
    { id: 'finances', long: 'Finances', short: 'Finances', icon: Wallet as Icon },
    ...(showParticipation ? [{ id: 'participation' as Tab, long: 'Participation', short: 'Activity', icon: MessagesSquare as Icon }] : []),
    { id: 'interests', long: 'Register of Interests', short: 'Interests', icon: Landmark as Icon },
  ]

  const distinctSittings = new Set(hansardRows.map((r) => r.reportDocId)).size
  const distinctDebates = new Set(hansardRows.map((r) => r.debateTitle)).size
  const totalSittings = hansardSittingsByMonth.reduce((acc, row) => acc + Number(row.totalSittings), 0)
  const monthMap = new Map<string, Set<string>>()
  for (const row of hansardRows) {
    const d = new Date(row.plenaryDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) monthMap.set(key, new Set())
    monthMap.get(key)!.add(row.reportDocId)
  }
  let bestKey = ''
  let bestCount = 0
  for (const [key, ids] of monthMap) {
    if (ids.size > bestCount || (ids.size === bestCount && key > bestKey)) {
      bestKey = key
      bestCount = ids.size
    }
  }
  const bestLabel = bestKey
    ? (() => {
        const [y, m] = bestKey.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      })()
    : null

  const partKpis: ReactNode[] = []
  if (showPlenary && bestLabel && !isCurrent) {
    partKpis.push({ key: 'm', node: () => (
      <Kpi
        key="m"
        span={styles.tFull}
        compact
        icon={TrendingUp}
        tone="tnOrange"
        label="Most active month"
        value={bestLabel}
        sub={`${bestCount} ${bestCount === 1 ? 'sitting' : 'sittings'} spoken in.`}
      />
    ) } as unknown as ReactNode)
  }
  if (showQuestions) {
    partKpis.push({ key: 'q', node: () => (
      <Kpi
        key="q"
        span={styles.tHalf}
        icon={MessageCircleQuestion}
        tone="tnPurple"
        label="Questions asked"
        value={totalQuestions.toLocaleString()}
        scale={questionRank ? { rank: questionRank.rank, total: questionRank.totalEligible, highIsBad: false, top: 'Most', bottom: 'Fewest' } : undefined}
      />
    ) } as unknown as ReactNode)
    if (totalQuestions > 0) {
      partKpis.push({ key: 'qs', node: () => <QuestionSplit key="qs" written={writtenCount} oral={oralCount} /> } as unknown as ReactNode)
    }
  }
  if (showPlenary) {
    partKpis.push({ key: 's', node: () => (
      <Kpi
        key="s"
        span={styles.tHalf}
        icon={CalendarCheck}
        tone="tnGreen"
        label="Sittings spoken in"
        value={<>{distinctSittings.toLocaleString()}<small>/{totalSittings.toLocaleString()}</small></>}
        scale={hansardRank ? { rank: hansardRank.rank, total: hansardRank.eligibleCount, highIsBad: false, top: 'Most', bottom: 'Fewest' } : undefined}
        sub={totalSittings > 0 ? `${Math.round((distinctSittings / totalSittings) * 100)}% of all plenary sittings.` : undefined}
      />
    ) } as unknown as ReactNode)
    partKpis.push({ key: 'd', node: () => (
      <Kpi
        key="d"
        span={styles.tHalf}
        icon={MessagesSquare}
        tone="tnCoral"
        label="Debates contributed to"
        value={distinctDebates.toLocaleString()}
        scale={hansardDebateRank ? { rank: hansardDebateRank.rank, total: hansardDebateRank.eligibleCount, highIsBad: false, top: 'Most', bottom: 'Fewest' } : undefined}
        sub="Debates spoken in since mandate start."
      />
    ) } as unknown as ReactNode)
  }

  const recentPanel = showPlenary && (
    <div className={`${styles.tile} ${styles.tFull}`}>
      <TileHead icon={Newspaper} tone="tnBlue" title="Recent activity" />
      <ul className={styles.activityList}>
        {hansardRows.slice(0, 5).map((row, i) => {
          const [year, , dayNum] = row.plenaryDate.slice(0, 10).split('-')
          const day = parseInt(dayNum)
          const month = new Date(`${row.plenaryDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
          return (
            <li key={`${row.reportDocId}-${i}`}>
              <a
                href={`https://aims.niassembly.gov.uk/officialreport/report.aspx?&eveDate=${row.plenaryDate}&docID=${row.reportDocId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.activityRow}
              >
                <span className={styles.dateBlock} aria-hidden="true">
                  <span className={styles.dateDay}>{day}</span>
                  <span className={styles.dateMonth}>{month}</span>
                  <span className={styles.dateYear}>{year}</span>
                </span>
                <span className="sr-only">{day} {month} {year}: </span>
                <span className={styles.activityTitle}>{row.debateTitle}</span>
                <span className={styles.activityTag}>
                  <FileText size={14} strokeWidth={2} aria-hidden="true" />
                  Hansard
                </span>
                <ArrowUpRight className={styles.activityArrow} size={18} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div>
      <SheetSelect
        options={tabs.map((t) => ({ key: t.id, label: t.long, icon: t.icon, ...SECTION_TILE[t.id] }))}
        value={activeTab}
        onPick={(k) => setActiveTab(k as Tab)}
        eyebrow="Show"
        title="Section"
        headIcon={LayoutList}
      />
      <div className={`${styles.pillRow} ${styles.tabs}`} role="group" aria-label="Activity sections" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={activeTab === t.id}
           
            className={styles.pillBtn}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={18} strokeWidth={2} aria-hidden="true" />
            <span className={styles.segLong}>{t.long}</span>
            <span className={styles.segShort} aria-hidden="true">{t.short}</span>
          </button>
        ))}
      </div>

      {activeTab === 'voting' && votes.length > 0 && (
        <div id="panel-voting">
          <VotingRecordClient votes={votes} notice={notice} avgAttendance={avgAttendance} attendanceFloor={attendanceFloor} />
        </div>
      )}

      {activeTab === 'participation' && showParticipation && (
        <div id="panel-participation" className={styles.panelFlat}>
          <TileHead
            icon={MessagesSquare}
            tone="tnPurple"
            title="Participation"
            panel
            action={
              <span className={styles.headLinks}>
                {showQuestions && <Link href={`${basePath}/assembly/questions`} className={styles.rankLink}>Questions ranking<ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" /></Link>}
                {showPlenary && <Link href={`${basePath}/assembly/sittings`} className={styles.rankLink}>Sittings ranking<ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" /></Link>}
              </span>
            }
          />
          <div className={styles.bento}>
            {partKpis.map((k) => (k as unknown as { node: () => ReactNode }).node())}
            {isCurrent && (
              <div className={`${styles.tile} ${styles.tFull}`}>
                <TileHead icon={BarChart3} tone="tnBlue" title="Activity by month" suffix="(Last 12 months)" />
                <MonthChart
                  questionStats={questionStats}
                  hansardRows={hansardRows}
                  hansardSittingsByMonth={hansardSittingsByMonth}
                  showQuestions={showQuestions}
                  showPlenary={showPlenary}
                />
              </div>
            )}
            {recentPanel}
          </div>
          <p className={styles.footnote}>Question rankings exclude current ministers and the Speaker. Plenary rankings exclude presiding officers only, so ministers are included as they take part in debates as MLAs.</p>
        </div>
      )}

      {activeTab === 'finances' && (
        <div id="panel-finances" className={styles.panelFlat}>
          <TileHead icon={Wallet} tone="tnGreen" title="Finances" panel />
          <div className={styles.bento}>
          {isCurrent && (
            <Kpi
              icon={Wallet}
              tone="tnGreen"
              label="Current annual salary"
              value={currentSalary === null ? <span className={styles.valMuted}>N/A</span> : <>{gbpWhole(currentSalary)}<small>/year</small></>}
              sub={currentSalary === null && mandateEarnings === null ? `Pay rates for the ${mandate.label} mandate have not been released yet.` : `Mandate ${mandate.label}`}
            />
          )}
          <Kpi
            span={isCurrent ? undefined : styles.tHalf}
            icon={TrendingUp}
            tone="tnTeal"
            label={isCurrent ? 'Estimated earnings so far this mandate' : 'Estimated mandate earnings'}
            value={mandateEarnings === null ? <span className={styles.valMuted}>N/A</span> : gbpWhole(mandateEarnings)}
            sub="Estimated from published Assembly rates. May not reflect personal circumstances."
          />
          <Kpi
            span={isCurrent ? undefined : styles.tHalf}
            icon={PoundSterling}
            tone="tnBlue"
            label="Total mandate expenses"
            value={allExpensesRaw.length > 0 ? gbp(mandateTotalExpenses.toFixed(2)) : <span className={styles.valMuted}>N/A</span>}
            sub={allExpensesRaw.length > 0
              ? `Across ${allExpensesRaw.length} financial ${allExpensesRaw.length === 1 ? 'year' : 'years'}, published quarterly by the Assembly.${recoveries.length > 0 ? ` Includes ${recoveries.length === 1 ? 'a recovery' : 'recoveries'} of ${gbp(String(recoveryTotal))} in ${recoveries.map((e) => e.financial_year).join(', ')}.` : ''}`
              : 'No expenses data available.'}
          />

          {allExpenses.length > 0 && selectedExpenses && (
            <div className={`${styles.tile} ${styles.tFull}`}>
              <TileHead
                icon={BarChart3}
                tone="tnPurple"
                title="Expenses by year"
                action={<Link href={`${basePath}/assembly/expenses`} className={styles.rankLink}>Rankings<ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" /></Link>}
              />
              <div className={styles.finMain}>
                <div className={styles.finCharts}>
                  <YearChart rows={allExpenses} selected={selectedYear} onSelect={setSelectedYear} mandate={mandateRow} detail={yearDetailNode} />
                </div>
                {yearDetailNode && <div className={styles.yearDetailDesktop}>{yearDetailNode}</div>}
              </div>
              <p className={`${styles.footnote} ${styles.finNote}`}>Bars show spend. The slim scale beside each bar ranks that period against every MLA with expenses recorded, from least expensive at the bottom to most expensive at the top. Rank 1 is the highest spend. Select a column for its detail.</p>
            </div>
          )}
          </div>
        </div>
      )}

      {activeTab === 'interests' && (
        <div id="panel-interests" className={styles.panelFlat}>
          <TileHead icon={Landmark} tone="tnIndigo" title="Register of interests" panel />
          {interests.length === 0 ? (
            <div className={`${styles.tile} ${styles.empty}`}>
              <span className={`${styles.iconTile} ${styles.tnGrey}`}><Landmark size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div>
                <p className={styles.emptyTitle}>No interests registered</p>
                <p className={styles.emptySub}>This MLA has no entries in the Register of Members&apos; Interests.</p>
              </div>
            </div>
          ) : (
            <div className={styles.interestGroups}>
              {categories.map((cat) => {
                const entries = [...grouped[cat]].sort((x, y) => (y.registerEntryStartDate ?? '').localeCompare(x.registerEntryStartDate ?? '') || y.id - x.id)
                return (
                  <section key={cat} className={styles.interestGroup} aria-label={toSentenceCase(cat)}>
                    <div className={styles.interestHead}>
                      <span className={`${styles.iconTile} ${styles[toneOf(cat)]}`}><FileText size={22} strokeWidth={2} aria-hidden="true" /></span>
                      <h4 className={styles.interestTitle}>{toSentenceCase(cat)}</h4>
                      <span className={styles.voteGroupCount}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    <ul className={styles.interestFeed}>
                      {entries.map((entry) => {
                        const iso = londonIsoDate(entry.registerEntryStartDate)
                        return (
                          <li key={entry.id} className={`${styles.interestRow} ${styles[toneOf(cat)]}`}>
                            <span className={styles.voteDate} aria-hidden="true">
                              {iso ? (
                                <>
                                  <span className={styles.voteMon}>{MONTH_ABBR[parseInt(iso.slice(5, 7)) - 1]}</span>
                                  <span className={styles.voteDay}>{parseInt(iso.slice(8, 10))}</span>
                                  <span className={styles.voteYear}>{iso.slice(0, 4)}</span>
                                </>
                              ) : (
                                <FileText size={22} strokeWidth={2} />
                              )}
                            </span>
                            <div className={styles.interestBody}>
                              {iso && <time className="sr-only" dateTime={iso}>{formatInterestDate(iso)}: </time>}
                              <p className={styles.interestText}>{entry.registerEntry}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
          <div className={styles.attribution}>
            <Info className={styles.attributionIcon} size={18} strokeWidth={2} aria-hidden="true" />
            <p>
              Data from the{' '}
              <a href="https://www.niassembly.gov.uk/your-mlas/register-of-interests/" target="_blank" rel="noopener noreferrer">
                NI Assembly Register of Members&apos; Interests
                <span className="sr-only"> (opens in a new tab)</span>
              </a>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
