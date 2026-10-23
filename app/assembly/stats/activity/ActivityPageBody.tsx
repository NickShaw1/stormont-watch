import Link from 'next/link'
import { Info, MessageCircleQuestion, Users, ArrowUpWideNarrow, ArrowDownWideNarrow, CalendarDays, CalendarClock, CalendarCheck, Trophy, MessageSquare, TrendingUp, Flame, Percent, Gauge, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  getAllMembers,
  getAllMinisters,
  getQuestionTotalsAllMembers,
  getDivisionsPerMonth,
  getPassRateByYear,
  getSittingDays,
  getHansardTopByMLA,
  getHansardBottomByMLA,
  getHansardPartyAverages,
  getHansardThisMonth,
  getHansardSiteStats,
  getAllPartyAttendanceTrends,
} from '@/lib/db/queries'
import { formatMemberName } from '@/lib/format'
import PartyBars from '../PartyBars'
import MoneyList, { type MoneyRow } from '../MoneyList'
import PartyShare, { type ShareRow } from '../PartyShare'
import TabbedTile from '../TabbedTile'
import PhoneSections from '../PhoneSections'
import PartyAttendanceTrends from '../PartyAttendanceTrends'
import DivisionHeatmap from '../DivisionHeatmap'
import styles from '../statsKit.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function ActivityPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allCurrentMembers, ministerRows, questionTotalsRaw, divisionsPerMonth, passRateByYear, sittingDays, hansardTopBySittings, hansardBottomBySittings, hansardTopByTopics, hansardBottomByTopics, hansardPartyAverages, hansardThisMonth, hansardSiteStats, partyAttendanceTrends] = await Promise.all([
    getAllMembers(mandate.id),
    getAllMinisters(mandate.id),
    getQuestionTotalsAllMembers(mandate.id),
    getDivisionsPerMonth(mandate.id),
    getPassRateByYear(mandate.id),
    getSittingDays(mandate.id),
    getHansardTopByMLA(5, 'sittings', mandate.id),
    getHansardBottomByMLA(5, 'sittings', mandate.id),
    getHansardTopByMLA(5, 'debates', mandate.id),
    getHansardBottomByMLA(5, 'debates', mandate.id),
    getHansardPartyAverages(mandate.id),
    getHansardThisMonth(mandate.id),
    getHansardSiteStats(mandate.id),
    getAllPartyAttendanceTrends(mandate.id),
  ])

  // Question rankings
  const ministerIds = new Set(ministerRows.map(m => m.personId))
  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const questionRanking = questionTotalsRaw
    .map(r => ({
      personId: r.personId,
      total: Number(r.total),
      written: Number(r.written),
      oral: Number(r.oral),
      member: memberMap.get(r.personId),
    }))
    .filter(r => r.member && r.member.assemblyRole !== 'Speaker' && !ministerIds.has(r.personId))
    .sort((a, b) => b.total - a.total)

  const questionTop5 = questionRanking.slice(0, 5).map(r => ({
    personId: r.personId,
    fullName: r.member!.fullName,
    party: r.member!.party,
    imgUrl: r.member!.imgUrl,
    total: r.total,
  }))
  const questionBottom5 = [...questionRanking].reverse().slice(0, 5).map(r => ({
    personId: r.personId,
    fullName: r.member!.fullName,
    party: r.member!.party,
    imgUrl: r.member!.imgUrl,
    total: r.total,
  }))

  // Scoped to current MLAs only, matching the "no longer sitting" copy.
  // A departed MLA's questions are deliberately dropped, not merged in.
  const partyTotals: Record<string, number> = {}
  const partyMemberCounts: Record<string, number> = {}
  for (const m of allCurrentMembers) {
    if (m.party) partyMemberCounts[m.party] = (partyMemberCounts[m.party] ?? 0) + 1
  }
  for (const r of questionTotalsRaw) {
    const m = memberMap.get(r.personId)
    if (!m?.party || !m.isCurrent) continue
    partyTotals[m.party] = (partyTotals[m.party] ?? 0) + Number(r.total)
  }
  const questionByParty = Object.entries(partyTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([party, total]) => ({ party, total, memberCount: partyMemberCounts[party] ?? 1 }))

  const num = (v: number | string) => Number(v).toLocaleString('en-GB')
  const toRows = (rows: { personId: string; fullName: string; party: string | null; imgUrl: string | null; constituency?: string | null }[], value: (i: number) => string): MoneyRow[] =>
    rows.map((r, i) => ({ personId: r.personId, fullName: r.fullName, party: r.party, imgUrl: r.imgUrl, constituency: r.constituency ?? null, value: value(i) }))
  const hansard = (rows: typeof hansardTopBySittings, key: 'sittings' | 'debates') => toRows(rows, i => num(rows[i][key]))

  const totalQuestions = questionTotalsRaw.reduce((s, r) => (memberMap.has(r.personId) ? s + Number(r.total) : s), 0)
  const topSitter = hansardTopBySittings[0]
  const monthRows = divisionsPerMonth.map(r => ({ month: r.month, total_divisions: Number(r.total_divisions) }))
  const busiest = monthRows.length ? monthRows.reduce((b, r) => (r.total_divisions > b.total_divisions ? r : b), monthRows[0]) : null
  const busiestLabel = busiest ? new Date(busiest.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '-'
  const sittingMonths = monthRows.filter(r => r.total_divisions > 0)
  const avgPerMonth = sittingMonths.length ? Math.round((sittingMonths.reduce((s, r) => s + r.total_divisions, 0) / sittingMonths.length) * 10) / 10 : 0
  const avgSittingsBars = [...hansardPartyAverages].map(r => ({ party: r.party, value: Number(r.avgSittings) })).sort((a, b) => b.value - a.value)
  const avgTopicsBars = [...hansardPartyAverages].map(r => ({ party: r.party, value: Number(r.avgDebates) })).sort((a, b) => b.value - a.value)
  const oneDp = (v: number) => v.toFixed(1)
  const questionShare: ShareRow[] = [...questionByParty].map(r => ({ party: r.party, value: r.total, display: num(r.total), sub: `${num(Math.round(r.total / r.memberCount))} per MLA, ${r.memberCount} MLA${Number(r.memberCount) === 1 ? '' : 's'}` }))

  const rankPair = (id: string, tone: string, a: { title: string; Icon: LucideIcon; rows: MoneyRow[] }, b: { title: string; Icon: LucideIcon; rows: MoneyRow[] }, sub?: React.ReactNode) => (
    <div className={styles.bento}>
      {[a, b].map((x, i) => (
        <section key={i} className={`${styles.span6} ${styles.tile}`} aria-labelledby={`${id}-${i}`}>
          <div className={styles.tileHead}>
            <span className={`${styles.iconTile} ${tone}`}><x.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
            <div className={styles.tileTitles}>
              <h3 className={styles.tileTitle} id={`${id}-${i}`}>{x.title}</h3>
              {sub && <p className={styles.tileSub}>{sub}</p>}
            </div>
          </div>
          <MoneyList basePath={basePath} rows={x.rows} />
        </section>
      ))}
    </div>
  )
  const stat = (tone: string, Icon: LucideIcon, label: string, figure: React.ReactNode, sub: React.ReactNode) => (
    <li className={styles.hItem} key={label}>
      <div className={styles.hHead}><span className={`${styles.iconTile} ${tone}`}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>{label}</span></div>
      <span className={styles.hFigure}>{figure}</span>
      <span className={styles.hSub}>{sub}</span>
    </li>
  )
  const viewAll = (href: string, label = 'View full rankings') => (
    <Link href={`${basePath}${href}`} className={styles.linkPill}>{label}<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
  )

  const questions = questionTop5.length > 0 ? (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="questions-heading">
      <div className="container">
        <div className={`${styles.sectionHead} ${styles.sectionHeadAction}`}>
          <div>
            <span className={styles.eyebrow}>MLA questions</span>
            <h2 className={styles.h2} id="questions-heading">Questions</h2>
            <p className={styles.sectionSub}>Who asks the most questions. Excludes current ministers, the Speaker and MLAs no longer sitting.</p>
          </div>
          {viewAll('/assembly/questions')}
        </div>
        <div className={styles.stack}>
          {rankPair('q', styles.tnBlue, { title: 'Most questions asked', Icon: ArrowUpWideNarrow, rows: toRows(questionTop5, i => num(questionTop5[i].total)) }, { title: 'Fewest questions asked', Icon: ArrowDownWideNarrow, rows: toRows(questionBottom5, i => num(questionBottom5[i].total)) })}
          <section className={styles.tile} aria-labelledby="q-party">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnIndigo}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div className={styles.tileTitles}>
                <h3 className={styles.tileTitle} id="q-party">Questions by party</h3>
                <p className={styles.tileSub}>Each party&apos;s share of the questions asked by current MLAs.</p>
              </div>
            </div>
            <PartyShare label="Share of questions by party" rows={questionShare} />
          </section>
        </div>
      </div>
    </section>
  ) : null

  const chamber = (
    <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="chamber-heading">
      <div className="container">
        <div className={`${styles.sectionHead} ${styles.sectionHeadAction}`}>
          <div>
            <span className={styles.eyebrow}>Plenary chamber</span>
            <h2 className={styles.h2} id="chamber-heading">Chamber activity</h2>
            <p className={styles.sectionSub}>Plenary sittings spoken in and debate topics contributed to since {mandate.startLabel}. Excludes presiding officers.</p>
          </div>
          <div className={styles.sectionActions}>
            {viewAll('/assembly/sittings', 'Sittings rankings')}
            {viewAll('/assembly/topics', 'Topics rankings')}
          </div>
        </div>
        <div className={styles.stack}>
          <ul className={`${styles.headline} ${styles.headline4}`} aria-label="Chamber figures">
            {stat(styles.tnBlue, CalendarDays, 'Sittings', num(hansardSiteStats.totalSittings), `since ${mandate.startLabel}`)}
            {stat(styles.tnGreen, CalendarClock, 'This month', num(hansardThisMonth), Number(hansardThisMonth) === 1 ? 'sitting' : 'sittings')}
            {stat(styles.tnAmber, Trophy, 'Most active MLA', topSitter ? <span className={styles.hFigureText}>{formatMemberName(topSitter.fullName)}</span> : '-', topSitter ? `${num(topSitter.sittings)} sittings` : '')}
            {stat(styles.tnPurple, MessageSquare, 'Topics debated', num(hansardSiteStats.totalDebates), `${num(hansardSiteStats.totalParticipations)} contributions`)}
          </ul>
            {rankPair('cs', styles.tnBlue, { title: 'Most sittings spoken in', Icon: ArrowUpWideNarrow, rows: hansard(hansardTopBySittings, 'sittings') }, { title: 'Fewest sittings spoken in', Icon: ArrowDownWideNarrow, rows: hansard(hansardBottomBySittings, 'sittings') })}
          {rankPair('ct', styles.tnPurple, { title: 'Most topics spoken on', Icon: ArrowUpWideNarrow, rows: hansard(hansardTopByTopics, 'debates') }, { title: 'Fewest topics spoken on', Icon: ArrowDownWideNarrow, rows: hansard(hansardBottomByTopics, 'debates') })}
          <section className={styles.tile} aria-labelledby="c-party">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnIndigo}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div className={styles.tileTitles}>
                <h3 className={styles.tileTitle} id="c-party">Average per {sittingAdjective(mandate)} MLA, by party</h3>
              </div>
            </div>
            <TabbedTile label="Party averages" tabs={[
              { key: 'sit', label: 'Sittings', node: <PartyBars label="Average sittings per MLA by party" suffix="" rows={avgSittingsBars} format={oneDp} /> },
              { key: 'top', label: 'Topics', node: <PartyBars label="Average topics per MLA by party" suffix="" rows={avgTopicsBars} format={oneDp} /> },
            ]} />
          </section>
        </div>
      </div>
    </section>
  )

  const activity = (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="productivity-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Sitting and voting patterns</span>
          <h2 className={styles.h2} id="productivity-heading">Assembly activity</h2>
          <p className={styles.sectionSub}>How active the Assembly has been since {mandate.startLabel}.</p>
        </div>
        <div className={styles.stack}>
          {partyAttendanceTrends.length > 0 && (
            <section className={styles.tile} aria-labelledby="a-att">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnGreen}`}><TrendingUp size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="a-att">Party division attendance</h3>
                  <p className={styles.tileSub}>How each party&apos;s attendance at divisions has tracked month by month. Only parties with more than 3 MLAs are shown.</p>
                </div>
              </div>
              <PartyAttendanceTrends data={partyAttendanceTrends} />
              <div className={styles.note}>
                <Info size={18} strokeWidth={2} aria-hidden="true" />
                <p>Only months with recorded divisions are included. Excludes the Speaker and divisions before each MLA&apos;s mandate start date.</p>
              </div>
            </section>
          )}
          <div className={styles.bento}>
            <section className={`${styles.span7} ${styles.tile}`} aria-labelledby="a-heat">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnAmber}`}><Flame size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="a-heat">Divisions per month</h3>
                  <p className={styles.tileSub}>Votes held each month. Months with no colour had no divisions; the current month is outlined.</p>
                </div>
              </div>
              <DivisionHeatmap rows={monthRows} />
            </section>
            <section className={`${styles.span5} ${styles.tile}`} aria-labelledby="a-pass">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnTeal}`}><Percent size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="a-pass">Pass rate by year</h3>
                  <p className={styles.tileSub}>Share of divisions that passed in each calendar year.</p>
                </div>
              </div>
              <ul className={styles.pBars} aria-label="Pass rate by year">
                {passRateByYear.map(r => (
                  <li key={r.year} className={styles.pBar} style={{ ['--pc' as string]: 'var(--sw-success-solid)' }}>
                    <span className={`${styles.pBarName} ${styles.pBarNameFlat}`}>{r.year}{mandate.isCurrent && r.year === new Date().getFullYear() ? ' (YTD)' : ''}<span className={styles.pBarMeta}>{num(r.passed)} of {num(r.total)} passed</span></span>
                    <span className={styles.pBarTrack} aria-hidden="true"><span className={styles.pBarFill} style={{ width: `${Number(r.pass_rate)}%` }} /></span>
                    <span className={styles.pBarValue}>{Number(r.pass_rate)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  )

  const sections = [
    questions && { key: 'questions', label: 'Questions', icon: 'messages' as const, meta: 'Who asks the most', node: questions },
    { key: 'chamber', label: 'Chamber', icon: 'mic' as const, meta: 'Sittings and topics', node: chamber },
    { key: 'activity', label: 'Assembly activity', icon: 'activity' as const, meta: 'Attendance and divisions', node: activity },
  ].filter((s): s is NonNullable<typeof s> => Boolean(s))

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="activity-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>Statistics</span>
            <h1 className={styles.h1} id="activity-title">Parliamentary activity</h1>
            <p className={styles.headSub}>Questions to ministers, chamber participation and sitting patterns across the {mandate.label} mandate.</p>
          </header>
          <ul className={`${styles.headline} ${styles.headline4}`} aria-label="Headline figures">
            {stat(styles.tnBlue, CalendarCheck, 'Sitting days', num(sittingDays), `since ${mandate.startLabel}`)}
            {stat(styles.tnPink, MessageCircleQuestion, 'Questions asked', num(totalQuestions), 'by current MLAs, written and oral')}
            {stat(styles.tnAmber, Flame, 'Busiest month', busiest?.total_divisions ?? 0, `divisions, ${busiestLabel}`)}
            {stat(styles.tnGreen, Gauge, 'Average month', avgPerMonth, 'divisions, excluding months with none')}
          </ul>
        </div>
      </section>
      <PhoneSections sections={sections} />
    </div>
  )
}
