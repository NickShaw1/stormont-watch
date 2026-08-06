import Link from 'next/link'
import { BarChart3, Landmark, ListOrdered, Vote, Users, Handshake, PoundSterling, Trophy, Lightbulb } from 'lucide-react'
import {
  getAssemblyStats,
  getDivisionsPerMonth,
  getPassRateByYear,
  getOverallAgreementRate,
  getAllMembers,
  getExpensesLeagueTable,
  getLatestExpensesYear,
  getAverageAttendance,
  getBigTwoAgreement,
  getPartyAlignmentWithBigTwo,
  getPartyCohesion,
  getHansardTopByMLA,
} from '@/lib/db/queries'
import StatsHeaderChart from './StatsHeaderChart'
import StatsHighlights from './StatsHighlights'
import styles from './stats.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'
import { formatMemberName } from '@/lib/format'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function StatsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [assemblyStats, divisionsPerMonth, passRateByYear, overallAgreementRate, allCurrentMembers, expensesLeague, latestExpensesYear,
    averageAttendance, bigTwoAgreement, partyAlignment, partyCohesion, topSittingsMla] = await Promise.all([
    getAssemblyStats(mandate.id),
    getDivisionsPerMonth(mandate.id),
    getPassRateByYear(mandate.id),
    getOverallAgreementRate(mandate.id),
    getAllMembers(mandate.id),
    getExpensesLeagueTable(mandate.id),
    getLatestExpensesYear(mandate.id),
    getAverageAttendance(mandate.id),
    getBigTwoAgreement(mandate.id),
    getPartyAlignmentWithBigTwo(mandate.id),
    getPartyCohesion(mandate.id),
    getHansardTopByMLA(1, 'sittings', mandate.id),
  ])

  const { totalDivisions, crossCommunityCount } = assemblyStats
  const allPassRates = passRateByYear.map(r => ({ year: Number(r.year), total: Number(r.total), passed: Number(r.passed) }))
  const totalPassed = allPassRates.reduce((s, r) => s + r.passed, 0)
  const overallPassRate = totalDivisions > 0 ? Math.round(totalPassed * 100 / totalDivisions) : 0
  const busiestYear = allPassRates.length > 0
    ? allPassRates.reduce((best, r) => r.total > best.total ? r : best, allPassRates[0])
    : null
  const currentMlaCount = allCurrentMembers.length
  const totalExpenses = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)

  const topSfAlignedParty = partyAlignment.rows.length > 0
    ? [...partyAlignment.rows].sort((a, b) => b.sfAgreePct - a.sfAgreePct)[0]
    : null
  const topDupAlignedParty = partyAlignment.rows.length > 0
    ? [...partyAlignment.rows].sort((a, b) => b.dupAgreePct - a.dupAgreePct)[0]
    : null
  const mostCohesiveParty = partyCohesion.length > 0
    ? [...partyCohesion].sort((a, b) => b.cohesionPct - a.cohesionPct)[0]
    : null
  const topSittings = topSittingsMla[0] ?? null
  const highestExpenseClaim = expensesLeague.length > 0 ? expensesLeague[0] : null

  return (
    <div className="container">

      {/* Header */}
      <header className={styles.statsLandingHeader}>
        <div className={styles.statsLandingLeft}>
          <span className={styles.statsLandingEyebrow}>Statistics</span>
          <h1 className={styles.statsLandingTitle}>
            <BarChart3 className={styles.statsLandingTitleIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
            Statistics
          </h1>
          <p className={styles.statsLandingLede}>Voting, attendance, spending and participation across the {mandate.label} mandate.</p>
        </div>
        <hr className={styles.statsLandingMobileRule} />
        <div className={styles.statsHeaderChart}>
          <StatsHeaderChart data={divisionsPerMonth} />
        </div>
      </header>

      <div className={styles.glanceBar}>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Total divisions</span>
            <Vote className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{totalDivisions}</span>
          <span className={styles.glanceCellMeta}>since {mandate.startLabel}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>{mandate.isCurrent ? 'Current' : 'Sitting'} MLAs</span>
            <Users className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{currentMlaCount}</span>
          <span className={styles.glanceCellMeta}>across 7 parties</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Cross-community</span>
            <Handshake className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{crossCommunityCount}</span>
          <span className={styles.glanceCellMeta}>consent votes</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Expenses claimed</span>
            <PoundSterling className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>£{(totalExpenses / 1000000).toFixed(1)}m</span>
          <span className={styles.glanceCellMeta}>{latestExpensesYear}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Busiest year</span>
            <Trophy className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{busiestYear?.year ?? '-'}</span>
          <span className={styles.glanceCellMeta}>{busiestYear?.total ?? 0} divisions</span>
        </div>
      </div>

      {/* Highlights */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Did you know</span>
          <h2 className={styles.sectionTitle}>
            <Lightbulb className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Highlights
          </h2>
        </div>
        <StatsHighlights
          overallPassRate={overallPassRate}
          overallAgreementRate={overallAgreementRate}
          averageAttendance={averageAttendance}
          sittingAdjective={sittingAdjective(mandate)}
          bigTwoAgreePct={bigTwoAgreement.agreePct}
          topSfAlignedParty={topSfAlignedParty}
          topDupAlignedParty={topDupAlignedParty}
          mostCohesiveParty={mostCohesiveParty}
          topSittings={topSittings ? { fullName: formatMemberName(topSittings.fullName), sittings: Number(topSittings.sittings) } : null}
          highestExpenseClaim={highestExpenseClaim ? { fullName: formatMemberName(highestExpenseClaim.fullName), total: parseFloat(highestExpenseClaim.total ?? '0'), period: highestExpenseClaim.period } : null}
        />
      </section>

      {/* Hub cards */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Explore</span>
          <h2 className={styles.sectionTitle}>
            <Landmark className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Explore statistics
          </h2>
          <p className={styles.sectionDesc}>Dive deeper into spending, activity and voting across the {mandate.label} mandate.</p>
        </div>
        <div className={styles.hubGrid}>
          <Link href={`${basePath}/assembly/stats/spending`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Spending</span>
              <span className={styles.hubCardDesc}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/stats/activity`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Activity</span>
              <span className={styles.hubCardDesc}>Questions to ministers and chamber participation across the {mandate.label} mandate.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/stats/voting`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Voting and attendance</span>
              <span className={styles.hubCardTitle}>Voting</span>
              <span className={styles.hubCardDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Full rankings */}
      <section aria-labelledby="full-rankings-heading" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Rankings</span>
          <h2 id="full-rankings-heading" className={styles.sectionTitle}>
            <ListOrdered className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Full rankings
          </h2>
          <p className={styles.sectionDesc}>Complete MLA rankings across salary, expenses, overall cost and parliamentary questions.</p>
        </div>
        <div className={styles.hubGrid}>
          <Link href={`${basePath}/assembly/salaries`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Salaries</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by current annual salary and total mandate earnings.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/expenses`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Expenses</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by total office expenses claimed.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/overall-cost`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Overall cost</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by total public cost: mandate salary plus all published expenses.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/questions`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Questions</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by total questions tabled since the {mandate.label} mandate began.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/sittings`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Sittings</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by plenary sittings spoken in since the {mandate.label} mandate began.</span>
            </div>
          </Link>
          <Link href={`${basePath}/assembly/topics`} className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Topics</span>
              <span className={styles.hubCardDesc}>All {sittingAdjective(mandate)} MLAs ranked by debate topics spoken on since the {mandate.label} mandate began.</span>
            </div>
          </Link>
        </div>
      </section>

      <p className={styles.pageFootnote}>Some statistics reflect {sittingAdjective(mandate)} MLAs only. Others include former MLAs where data is available. Every effort has been made to clarify which applies throughout.</p>

    </div>
  )
}
