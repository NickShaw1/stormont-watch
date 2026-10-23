'use client'

import Link from 'next/link'
import { Gauge, ArrowRight, CalendarCheck, TrendingDown, ListChecks, Vote, TrendingUp, Check, X, Minus, EyeOff, CheckCircle2, XCircle, ThumbsUp, ThumbsDown, Split } from 'lucide-react'
import type { CSSProperties } from 'react'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import type { PartyVoteStats, PartyTrendRanks } from '@/lib/db/queries'
import { useMandate } from '@/components/MandateContext'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import LineChart, { type LineItem } from './LineChart'
import { Kpi, StatRow, TileHead } from './PartyUi'
import styles from './partyDetail.module.css'

interface PartyStatsProps {
  stats: PartyVoteStats
  trendRanks: PartyTrendRanks | null
  partyColor: string
  mlaCount: number
  current: { pct: number; count: number; grade: 'good' | 'low' | 'poor'; average: number } | null
}

const attendanceScale = (rank: number, total: number) => ({ rank, total, highIsBad: false, top: 'Highest', bottom: 'Lowest' })

const GRADE_PHRASE = { good: 'At or above the Assembly average', low: 'Below the Assembly average', poor: 'Far below the Assembly average' } as const

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const VOTE_LABEL = { AYE: 'Aye', NO: 'No', ABSTAINED: 'Abstain', SPLIT: 'Split', NO_SHOW: 'Did not vote' } as const
type VoteKey = keyof typeof VOTE_LABEL

const VOTE_ICON = { AYE: ThumbsUp, NO: ThumbsDown, ABSTAINED: Minus, SPLIT: Split, NO_SHOW: EyeOff } as const

const isPassed = (outcome: string | null) => (/carried|agreed/i.test(outcome ?? '') ? true : /negatived|fell/i.test(outcome ?? '') ? false : null)

export default function PartyStatsClient({ stats, trendRanks, partyColor, mlaCount, current }: PartyStatsProps) {
  const { mandate, basePath } = useMandate()
  const singleMla = mlaCount === 1 || stats.highestMla.personId === stats.lowestMla.personId
  const total = stats.aye + stats.no + stats.abstained + stats.noShow

  const segments = [
    { key: 'AYE', label: 'Aye', value: stats.aye, tone: 'var(--sw-success-solid)', ink: 'var(--sw-success)', icon: Check },
    { key: 'NO', label: 'No', value: stats.no, tone: 'var(--sw-error-solid)', ink: 'var(--sw-error)', icon: X },
    { key: 'ABSTAINED', label: 'Abstain', value: stats.abstained, tone: 'var(--sw-accent-warm)', ink: 'var(--sw-warning)', icon: Minus },
    { key: 'NO_SHOW', label: 'No show', value: stats.noShow, tone: '#656b72', ink: 'var(--sw-text-secondary)', icon: EyeOff },
  ]

  const band = 1
  const compared = stats.trend.filter((p) => p.assemblyPct !== null)
  const gaps = compared.map((p) => p.attendancePct - (p.assemblyPct as number))
  const aboveMonths = gaps.filter((g) => g > band).length
  const belowMonths = gaps.filter((g) => g < -band).length
  const levelMonths = gaps.length - aboveMonths - belowMonths

  const now = new Date()
  const currentMonth = `${MONTHS[now.getMonth()].slice(0, 3)} ${now.getFullYear()}`
  const completed = stats.trend.filter((p) => p.month !== currentMonth)
  const recent = completed.slice(-6)
  const before = completed.slice(-12, -6)
  const mean = (xs: { attendancePct: number }[]) => xs.reduce((a, b) => a + b.attendancePct, 0) / xs.length
  const direction = recent.length === 6 && before.length === 6 ? mean(recent) - mean(before) : null
  const directionKind = direction === null ? null : direction > band ? 'up' : direction < -band ? 'down' : 'flat'
  const DirectionIcon = directionKind === 'up' ? TrendingUp : directionKind === 'down' ? TrendingDown : Minus

  const byMonth = new Map(stats.trend.map((p) => [p.month, p]))
  const startAt = new Date(mandate.start)
  const endAt = mandate.end ? new Date(mandate.end) : now
  const trendItems: LineItem[] = []
  for (let y = startAt.getFullYear(), mo = startAt.getMonth(); y < endAt.getFullYear() || (y === endAt.getFullYear() && mo <= endAt.getMonth()); ) {
    const key = `${MONTHS[mo].slice(0, 3)} ${y}`
    const point = byMonth.get(key)
    trendItems.push({
      key,
      label: `${MONTHS[mo]} ${y}`,
      tick: mo === 0 || trendItems.length === 0 ? `'${String(y).slice(-2)}` : '',
      value: point ? point.attendancePct : null,
      benchmark: point ? point.assemblyPct : null,
    })
    mo += 1
    if (mo > 11) { mo = 0; y += 1 }
  }

  return (
    <div className={m.panelFlat}>
      <TileHead icon={Gauge} tone="tnGreen" title="Attendance" panel />
      <div className={m.bento}>
        {current && (
          <Kpi
            icon={Gauge}
            tone="tnGreen"
            span={`${m.tThird} ${styles.kpi3}`}
            label="Current MLAs only"
            value={<>{current.pct}<small>%</small></>}
            sub={`${GRADE_PHRASE[current.grade]} (${current.average.toFixed(1)}%). The average of the party's ${current.count} sitting ${current.count === 1 ? 'MLA' : 'MLAs'}, and the figure shown at the top of the page.`}
          />
        )}
        <Kpi
          icon={Gauge}
          tone="tnTeal"
          span={`${m.tThird} ${styles.kpi3}`}
          label="Current and former MLAs"
          value={<>{stats.attendancePct}<small>%</small></>}
          sub={`Every vote cast by anyone who has been a party member in the ${mandate.label} mandate, excluding the Speaker.`}
        />
        <Kpi
          icon={Vote}
          tone="tnPurple"
          span={`${m.tThird} ${styles.kpi3}`}
          label="Divisions with a party vote"
          value={<>{stats.present.toLocaleString()}<small>/{stats.total.toLocaleString()}</small></>}
          sub="Divisions where at least one MLA from the party cast a vote."
        />

        <section className={styles.group} aria-labelledby="att-range-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnBlue}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="att-range-heading">{singleMla ? 'MLA attendance' : 'Highest and lowest MLA attendance'}</h3>
          </div>
          <p className={styles.sectionDesc}>Excludes presiding officers (the Speaker, Deputy Speaker and Principal Deputy Speaker) and the First and Deputy First Minister.</p>
          <div className={singleMla ? undefined : styles.statPair}>
            <StatRow
              personId={stats.highestMla.personId}
              fullName={stats.highestMla.fullName}
              imgUrl={stats.highestMla.imgUrl}
              constituency={stats.highestMla.constituency}
              value={`${stats.highestMla.attendancePct}%`}
              sub={`${stats.highestMla.present}/${stats.highestMla.total}`}
              barPct={stats.highestMla.attendancePct}
              label={singleMla ? 'Attendance' : 'Highest'}
              tone="good"
            />
            {!singleMla && (
              <StatRow
                personId={stats.lowestMla.personId}
                fullName={stats.lowestMla.fullName}
                imgUrl={stats.lowestMla.imgUrl}
                constituency={stats.lowestMla.constituency}
                value={`${stats.lowestMla.attendancePct}%`}
                sub={`${stats.lowestMla.present}/${stats.lowestMla.total}`}
                barPct={stats.lowestMla.attendancePct}
                label="Lowest"
                tone="bad"
              />
            )}
          </div>
        </section>

        <section className={styles.group} aria-labelledby="breakdown-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnTeal}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="breakdown-heading">Voting breakdown</h3>
          </div>
          <p className={styles.sectionDesc}>All votes cast by current and former MLAs, excluding the Speaker.</p>
          <div className={m.split}>
            <div className={m.splitBar} role="img" aria-label={`Voting breakdown: ${segments.map((s) => `${s.label} ${s.value.toLocaleString()}`).join(', ')}`}>
              {segments.filter((s) => s.value > 0).map((s) => (
                <span key={s.key} className={m.splitSeg} style={{ flex: s.value, '--tone': s.tone } as CSSProperties} />
              ))}
            </div>
            <ul className={`${m.splitLegend} ${styles.splitFour}`}>
              {segments.map((s) => {
                const Icon = s.icon
                return (
                  <li key={s.key} className={m.splitItem} style={{ '--tone': s.tone, '--tone-ink': s.ink } as CSSProperties}>
                    <span className={m.splitIcon}><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
                    <span className={m.splitText}>
                      <span className={m.splitLabel}>{s.label}</span>
                      <span className={m.splitAmount}>{s.value.toLocaleString()}</span>
                    </span>
                    <span className={m.splitShare}>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className={styles.group} aria-labelledby="trend-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnBlue}`}><TrendingUp size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="trend-heading">Attendance by month (all votes cast)</h3>
          </div>
          <p className={styles.sectionDesc}>This chart is the party as a whole, month by month, not individual MLAs. Every month of the mandate is shown; a month with no divisions is a gap, not a zero. The dotted line is every MLA in the Assembly, measured the same way. Excludes the Speaker and divisions before each MLA&apos;s mandate start date.</p>
          {stats.trend.length > 0 && (
            <LineChart items={trendItems} colour={partyColor} ariaLabel="Party attendance by month, against the Assembly average" seriesLabel="This party" benchmarkLabel="Assembly average" />
          )}
          {gaps.length > 0 && (
            <div className={m.bento}>
              <Kpi
                icon={CalendarCheck}
                tone="tnGreen"
                span={`${m.tHalf} ${styles.kpi2}`}
                label="Months above the Assembly"
                value={<>{aboveMonths}<small>/{gaps.length}</small></>}
                scale={trendRanks ? attendanceScale(trendRanks.rankMonthsAbove, trendRanks.partyCount) : undefined}
                sub={`In ${aboveMonths} of the ${gaps.length} months with divisions this party's attendance was higher than the Assembly's. ${belowMonths} were lower and ${levelMonths} were level (within a percentage point).`}
              />
              {direction !== null && directionKind && recent.length === 6 && (
                <Kpi
                  icon={DirectionIcon}
                  tone="tnPurple"
                  span={`${m.tHalf} ${styles.kpi2}`}
                  label="Last six months"
                  value={`${mean(recent).toFixed(1)}%`}
                  sub={
                    <>
                      <span className={`${styles.gradeText} ${m[`tone_${directionKind === 'up' ? 'good' : directionKind === 'down' ? 'bad' : 'warn'}`]}`}>
                        {directionKind === 'up' ? 'Improving' : directionKind === 'down' ? 'Slipping' : 'Steady'}
                      </span>
                      {directionKind === 'flat'
                        ? `. About the same as the six months before (${mean(before).toFixed(1)}%).`
                        : `. ${directionKind === 'up' ? 'Up' : 'Down'} from ${mean(before).toFixed(1)}% in the six months before, ${Math.abs(direction).toFixed(1)} percentage points ${directionKind === 'up' ? 'higher' : 'lower'}.`}
                    </>
                  }
                />
              )}
            </div>
          )}
        </section>

        <section className={styles.group} aria-labelledby="recent-heading">
          <div className={m.tileHead}>
            <span className={`${m.iconTile} ${m.tnPurple}`}><ListChecks size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className={m.tileTitle} id="recent-heading">Party vote on recent divisions</h3>
            <Link href={`${basePath}/assembly/votes`} className={m.rankLink}>All divisions<ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" /></Link>
          </div>
          <p className={styles.sectionDesc}>How the party voted on its most recent divisions, and whether each one passed.</p>
          <ul className={styles.divList}>
            {stats.recentDivisions.map((d) => {
              const key = (d.partyVote ?? '') as string
              const known = key in VOTE_LABEL
              const voteKey = (known ? key : 'NO_SHOW') as VoteKey
              const VoteIcon = VOTE_ICON[voteKey]
              const passed = isPassed(d.outcome)
              const { title, subtitle, stage } = formatDivisionSubject(d.title ?? d.subject)
              const amendmentMatch = subtitle?.match(/^Amendment (\d+)$/)

              const t = d.title ?? ''
              const s = d.subject ?? ''
              const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
              const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
              const category = isStatutory ? 'Regulations' : isBill ? 'Bill' : 'Motion'
              const cat = isStatutory ? 'regs' : isBill ? 'bill' : 'motion'
              const iso = d.divisionDate.slice(0, 10)
              const dateText = `${parseInt(iso.slice(8, 10))} ${MONTHS[parseInt(iso.slice(5, 7)) - 1].slice(0, 3)}`

              return (
                <li key={d.documentId}>
                  <Link href={`${basePath}/assembly/divisions/${d.documentId}`} className={styles.divCard} data-vote={voteKey}>
                    <span className={styles.divBody}>
                      <span className={styles.divMeta}>
                        <time dateTime={iso}>{dateText}</time>
                        <span className={styles.divCat} data-cat={cat}>{category}</span>
                        {stage && <span>{stage}</span>}
                        {amendmentMatch && <span>Amendment {amendmentMatch[1]}</span>}
                      </span>
                      <span className={styles.divTitle}>{title}</span>
                    </span>
                    <span className={styles.divStance}>
                      {known && (
                        <span className={styles.stanceCell} data-kind="vote">
                          <span className={styles.stanceLabel}>Party voted</span>
                          <span className={styles.stanceValue}>
                            <VoteIcon size={18} strokeWidth={2.25} aria-hidden="true" />
                            {VOTE_LABEL[voteKey]}
                          </span>
                        </span>
                      )}
                      {passed !== null && (
                        <span className={styles.stanceCell} data-kind={passed ? 'pass' : 'fail'}>
                          <span className={styles.stanceLabel}>Result</span>
                          <span className={styles.stanceValue}>
                            {passed ? <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden="true" /> : <XCircle size={18} strokeWidth={2.25} aria-hidden="true" />}
                            {passed ? 'Passed' : 'Failed'}
                          </span>
                        </span>
                      )}
                    </span>
                    <ArrowRight className={styles.divArrow} size={18} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
