export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getAssemblyStats,
  getDivisionsPerMonth,
  getPassRateByYear,
  getOverallAgreementRate,
  getAllMembers,
  getExpensesLeagueTable,
  getLatestExpensesYear,
} from '@/lib/db/queries'
import StatsHeaderChart from './StatsHeaderChart'
import styles from './stats.module.css'

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Voting, attendance, spending and participation across the 2022–2027 Northern Ireland Assembly mandate.',
  openGraph: {
    title: 'Stats — Stormont Watch',
    description: 'Voting, attendance, spending and participation across the 2022–2027 Northern Ireland Assembly mandate.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats' },
}

export default async function StatsPage() {
  const [assemblyStats, divisionsPerMonth, passRateByYear, overallAgreementRate, allCurrentMembers, expensesLeague, latestExpensesYear] = await Promise.all([
    getAssemblyStats(),
    getDivisionsPerMonth(),
    getPassRateByYear(),
    getOverallAgreementRate(),
    getAllMembers(),
    getExpensesLeagueTable(),
    getLatestExpensesYear(),
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

  return (
    <div className="container">

      {/* Header */}
      <header className={styles.statsLandingHeader}>
        <div className={styles.statsLandingLeft}>
          <span className="eyebrow">Statistics</span>
          <h1 className={styles.statsLandingTitle}>Statistics</h1>
          <p className={styles.statsLandingLede}>Voting, attendance, spending and participation across the 2022–2027 mandate.</p>
        </div>
        <hr className={styles.statsLandingMobileRule} />
        <div className={styles.statsHeaderChart}>
          <StatsHeaderChart data={divisionsPerMonth} />
        </div>
      </header>

      <div className="notice-card">Some statistics reflect current MLAs only. Others include former MLAs where data is available. Every effort has been made to clarify which applies throughout.</div>

      <p className={styles.assemblyStatement}>
        Since May 2022, the Assembly has held{' '}
        <strong>{totalDivisions}</strong> divisions.{' '}
        <strong>{overallPassRate}%</strong> of divisions passed.
        A majority of unionist-designated and nationalist-designated MLAs voted the same way on{' '}
        <strong>{overallAgreementRate}%</strong> of divisions.
      </p>

      <div className={styles.glanceBar}>
        <div className={styles.glanceCell}>
          <span className={styles.glanceCellLabel}>Total divisions</span>
          <span className={styles.glanceCellValue}>{totalDivisions}</span>
          <span className={styles.glanceCellMeta}>since May 2022</span>
        </div>
        <div className={styles.glanceCell}>
          <span className={styles.glanceCellLabel}>Current MLAs</span>
          <span className={styles.glanceCellValue}>{currentMlaCount}</span>
          <span className={styles.glanceCellMeta}>across 7 parties</span>
        </div>
        <div className={styles.glanceCell}>
          <span className={styles.glanceCellLabel}>Cross-community</span>
          <span className={styles.glanceCellValue}>{crossCommunityCount}</span>
          <span className={styles.glanceCellMeta}>consent votes</span>
        </div>
        <div className={styles.glanceCell}>
          <span className={styles.glanceCellLabel}>Expenses claimed</span>
          <span className={styles.glanceCellValue}>£{(totalExpenses / 1000000).toFixed(1)}m</span>
          <span className={styles.glanceCellMeta}>{latestExpensesYear}</span>
        </div>
        <div className={styles.glanceCell}>
          <span className={styles.glanceCellLabel}>Busiest year</span>
          <span className={styles.glanceCellValue}>{busiestYear?.year ?? '—'}</span>
          <span className={styles.glanceCellMeta}>{busiestYear?.total ?? 0} divisions</span>
        </div>
      </div>

      <hr className="section-rule" />

      {/* Hub cards */}
      <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--s-3)' }}>Explore Statistics</h2>
      <p className={styles.sectionDesc} style={{ marginBottom: 'var(--s-4)' }}>Dive deeper into spending, activity and voting across the 2022–2027 mandate.</p>
      <div className={styles.hubGrid}>
        <Link href="/assembly/stats/spending" className={styles.hubCard}>
          <div className={styles.hubCardInner}>
            <span className={styles.hubCardEyebrow}>Public spending</span>
            <span className={styles.hubCardTitle}>Spending</span>
            <span className={styles.hubCardDesc}>Salaries, office expenses and overall public cost of the Assembly since May 2022.</span>
          </div>
          <span className={styles.hubCardArrow}>View spending ↗</span>
        </Link>
        <Link href="/assembly/stats/activity" className={styles.hubCard}>
          <div className={styles.hubCardInner}>
            <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
            <span className={styles.hubCardTitle}>Activity</span>
            <span className={styles.hubCardDesc}>Questions to ministers and chamber participation across the 2022–2027 mandate.</span>
          </div>
          <span className={styles.hubCardArrow}>View activity ↗</span>
        </Link>
        <Link href="/assembly/stats/voting" className={styles.hubCard}>
          <div className={styles.hubCardInner}>
            <span className={styles.hubCardEyebrow}>Voting and attendance</span>
            <span className={styles.hubCardTitle}>Voting</span>
            <span className={styles.hubCardDesc}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since May 2022.</span>
          </div>
          <span className={styles.hubCardArrow}>View voting ↗</span>
        </Link>
      </div>

      <hr className="section-rule" />

      {/* Full rankings */}
      <section aria-labelledby="full-rankings-heading" className={styles.section} style={{ marginTop: 0 }}>
        <h2 id="full-rankings-heading" className={styles.sectionTitle} style={{ marginBottom: 'var(--s-3)' }}>Full Rankings</h2>
        <p className={styles.sectionDesc} style={{ marginBottom: 'var(--s-6)' }}>Complete MLA rankings across salary, expenses, overall cost and parliamentary questions.</p>
        <div className={styles.hubGrid}>
          <Link href="/assembly/salaries" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Salaries</span>
              <span className={styles.hubCardDesc}>All current MLAs ranked by current annual salary and total mandate earnings.</span>
            </div>
            <span className={styles.hubCardArrow}>View salaries ↗</span>
          </Link>
          <Link href="/assembly/expenses" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Expenses</span>
              <span className={styles.hubCardDesc}>All current MLAs ranked by total office expenses claimed.</span>
            </div>
            <span className={styles.hubCardArrow}>View expenses ↗</span>
          </Link>
          <Link href="/assembly/overall-cost" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Public spending</span>
              <span className={styles.hubCardTitle}>Overall cost</span>
              <span className={styles.hubCardDesc}>All current MLAs ranked by total public cost — mandate salary plus all published expenses.</span>
            </div>
            <span className={styles.hubCardArrow}>View overall cost ↗</span>
          </Link>
          <Link href="/assembly/questions" className={styles.hubCard}>
            <div className={styles.hubCardInner}>
              <span className={styles.hubCardEyebrow}>Parliamentary activity</span>
              <span className={styles.hubCardTitle}>Questions</span>
              <span className={styles.hubCardDesc}>All current MLAs ranked by total questions tabled since the 2022 mandate.</span>
            </div>
            <span className={styles.hubCardArrow}>View questions ↗</span>
          </Link>
        </div>
      </section>

    </div>
  )
}
