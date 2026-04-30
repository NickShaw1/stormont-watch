export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getMlaLeaderboard,
  getAssemblyStats,
  getAverageAttendance,
  getPartyCohesion,
  getMostRebelliousMla,
  getMostCrossCommunityAgreement,
  getExpensesLeagueTable,
  getExpensesByParty,
  getCrossCommunityTrends,
  getDivisionsPerMonth,
  getPassRateByYear,
  getOverallAgreementRate,
  getAllMembers,
  getLatestExpensesYear,
  getSittingDays,
  getQuestionTotalsAllMembers,
  getAllMinisters,
  getAllMemberRoleHistories,
  getTotalExpensesPerMember,
} from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import StatsRankingTabs from './StatsRankingTabs'
import StatsQuestionsSection from './StatsQuestionsSection'

import CrossCommunityTrendsClient from './CrossCommunityTrendsClient'
import AssemblyProductivityClient from './AssemblyProductivityClient'
import StatsHeaderChart from './StatsHeaderChart'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from './stats.module.css'

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Assembly voting statistics since May 2022.',
  openGraph: {
    title: 'Stats — Stormont Watch',
    description: 'Assembly voting statistics since May 2022.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats' },
}

export default async function StatsPage() {
  const [leaderboard, assemblyStats, avgAttendance, partyCohesion, rebelliousMla, crossCommunity, expensesLeague, expensesByParty, crossCommunityTrends, divisionsPerMonth, passRateByYear, overallAgreementRate, allCurrentMembers, latestExpensesYear, sittingDays, questionTotalsRaw, ministerRows, allRoleHistories, totalExpensesData] = await Promise.all([
    getMlaLeaderboard(),
    getAssemblyStats(),
    getAverageAttendance(),
    getPartyCohesion(),
    getMostRebelliousMla(),
    getMostCrossCommunityAgreement(),
    getExpensesLeagueTable(),
    getExpensesByParty(),
    getCrossCommunityTrends(),
    getDivisionsPerMonth(),
    getPassRateByYear(),
    getOverallAgreementRate(),
    getAllMembers(),
    getLatestExpensesYear(),
    getSittingDays(),
    getQuestionTotalsAllMembers(),
    getAllMinisters(),
    getAllMemberRoleHistories(),
    getTotalExpensesPerMember(),
  ])

  // Compute salary rankings
  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }
  const today = new Date().toISOString().slice(0, 10)
  const salaryRows = allCurrentMembers.map(m => {
    const history = rolesByPerson.get(m.personId) ?? []
    const roleIntervals: RoleInterval[] = history
      .map(r => {
        const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
        if (!salaryRole) return null
        return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
      })
      .filter((r): r is RoleInterval => r !== null)
    return {
      personId: m.personId,
      fullName: m.fullName,
      party: m.party ?? null,
      imgUrl: `/mla-images/${m.personId}.jpg`,
      currentSalary: getCurrentAnnualSalary(roleIntervals, today),
      mandateEarnings: calculateMandateEarnings(roleIntervals, today),
    }
  })
  const salaryTop5 = [...salaryRows].sort((a, b) => b.currentSalary - a.currentSalary).slice(0, 5)
  const earningsTop5 = [...salaryRows].sort((a, b) => b.mandateEarnings - a.mandateEarnings).slice(0, 5)

  // Overall cost = all expenses + mandate earnings, excluding members who joined within the last year
  const expenseTotalsMap = new Map(totalExpensesData.map(r => [r.personId, parseFloat(r.totalExpenses)]))
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  const overallCostRows = allCurrentMembers
    .filter(m => m.mandateStart && m.mandateStart <= oneYearAgoStr)
    .map(m => {
      const history = rolesByPerson.get(m.personId) ?? []
      const roleIntervals: RoleInterval[] = history
        .map(r => {
          const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
          if (!salaryRole) return null
          return { salaryRole, startDate: r.startDate, endDate: r.endDate ?? null }
        })
        .filter((r): r is RoleInterval => r !== null)
      const earnings = calculateMandateEarnings(roleIntervals, today)
      const expenses = expenseTotalsMap.get(m.personId) ?? 0
      return {
        personId: m.personId,
        fullName: m.fullName,
        party: m.party ?? null,
        imgUrl: `/mla-images/${m.personId}.jpg`,
        mandateEarnings: earnings,
        totalExpenses: expenses,
        totalCost: earnings + expenses,
      }
    })
    .sort((a, b) => b.totalCost - a.totalCost)

  const mostCostly5 = overallCostRows.slice(0, 5)
  const leastCostly5 = [...overallCostRows].reverse().slice(0, 5)

  // Build question rankings — exclude ministers and speakers (use leaderboard as allowlist, then remove ministers)
  const eligibleIds = new Set(leaderboard.map(r => r.personId))
  ministerRows.forEach(m => eligibleIds.delete(m.personId))
  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const questionRanking = questionTotalsRaw
    .map(r => ({
      personId: r.personId,
      total: Number(r.total),
      written: Number(r.written),
      oral: Number(r.oral),
      member: memberMap.get(r.personId),
    }))
    .filter(r => r.member && eligibleIds.has(r.personId))
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

  const partyTotals: Record<string, number> = {}
  const partyMemberCounts: Record<string, number> = {}
  for (const m of allCurrentMembers) {
    if (m.party) partyMemberCounts[m.party] = (partyMemberCounts[m.party] ?? 0) + 1
  }
  for (const r of questionTotalsRaw) {
    const m = memberMap.get(r.personId)
    if (!m?.party) continue
    partyTotals[m.party] = (partyTotals[m.party] ?? 0) + Number(r.total)
  }
  const questionByParty = Object.entries(partyTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([party, total]) => ({ party, total, memberCount: partyMemberCounts[party] ?? 1 }))

  const { totalDivisions, crossCommunityCount } = assemblyStats

  const totalExpenses = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)

  const allPassRates = passRateByYear.map(r => ({ year: Number(r.year), total: Number(r.total), passed: Number(r.passed) }))
  const totalPassed = allPassRates.reduce((s, r) => s + r.passed, 0)
  const overallPassRate = totalDivisions > 0 ? Math.round(totalPassed * 100 / totalDivisions) : 0
  const busiestYear = allPassRates.length > 0
    ? allPassRates.reduce((best, r) => r.total > best.total ? r : best, allPassRates[0])
    : null

  const currentMlaCount = allCurrentMembers.length

  type RawDivisionRow = { document_id?: string; documentId?: string; subject?: string }
  const crossCommunityDivisionId = crossCommunity
    ? ((crossCommunity as unknown as RawDivisionRow).document_id ?? (crossCommunity as unknown as RawDivisionRow).documentId ?? null)
    : null
  const crossCommunitySubject = crossCommunity
    ? (crossCommunity as unknown as RawDivisionRow).subject ?? null
    : null

  return (
    <div className="container">
      {/* 1. Assembly at a glance */}
      <section aria-labelledby="assembly-stats-heading" className={styles.section}>
        <header className={`page-header ${styles.statsPageHeader}`}>
          <div>
            <span className="eyebrow">Statistics</span>
            <h1 id="assembly-stats-heading">At a glance</h1>
            <p className="lede">Voting, attendance, salaries, expenses and cross-community trends since May 2022.</p>
          </div>
          <div className={styles.statsHeaderChart}>
            <StatsHeaderChart data={divisionsPerMonth} />
          </div>
        </header>

        <p className={styles.assemblyStatement}>
          Since May 2022, the Assembly has held{' '}
          <strong>{totalDivisions}</strong> divisions.{' '}
          <strong>{overallPassRate}%</strong> of divisions passed.
          Unionist and nationalist MLAs voted the same way on{' '}
          <strong>{overallAgreementRate}%</strong> of divisions.{' '}
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

      </section>

      <hr className="section-rule" />

      {/* 2. Salaries */}
      {(() => {
        const gbpSalary = (v: number) => `£${v.toLocaleString('en-GB')}`

        const SalaryCard = ({ title, rows, getValue }: { title: string; rows: typeof salaryTop5; getValue: (r: typeof salaryTop5[0]) => number }) => (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{title}</h3>
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={52} decorative square />
                  <div className={styles.info}>
                    <Link href={`/assembly/mlas/${row.personId}`} className={styles.name}>
                      {formatMemberName(row.fullName)}
                    </Link>
                    {row.party && (
                      <span className="party-pill" data-party={abbreviateParty(row.party)}>
                        <PartyName party={row.party} />
                      </span>
                    )}
                  </div>
                  <span className={styles.value}>{gbpSalary(getValue(row))}</span>
                </li>
              ))}
            </ol>
          </div>
        )

        return (
          <section aria-labelledby="salaries-heading" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.expensesHeader}>
                <p className="eyebrow">Public spending</p>
              </div>
              <h2 id="salaries-heading" className={styles.sectionTitle}>Salaries</h2>
              <div className={styles.sectionRule}></div>
            </div>
            <Link href="/assembly/salaries" className={styles.expensesRankingsCard} style={{ marginTop: 0 }}>
              <span className={styles.expensesRankingsCardLeft}>
                <svg className={styles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
                  <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
                  <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
                </svg>
                <span className={styles.expensesRankingsCardText}>View full MLA salary rankings</span>
              </span>
              <span className={styles.expensesRankingsCardArrow}>↗</span>
            </Link>
            <div className={styles.expensesCardGrid}>
              <SalaryCard title="Highest current salaries" rows={salaryTop5} getValue={r => r.currentSalary} />
              <SalaryCard title="Highest mandate earnings" rows={earningsTop5} getValue={r => r.mandateEarnings} />
            </div>
          </section>
        )
      })()}

      <hr className="section-rule" />

      {/* 3. Member expenses */}

      {expensesLeague.length > 0 && (() => {
        const gbp = (v: string | null | undefined) =>
          `£${parseFloat(v ?? '0').toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        const assemblyTotal = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)
        const assemblyAvg = assemblyTotal / expensesLeague.length
        const top5 = expensesLeague.slice(0, 5)
        const bottom5 = [...expensesLeague].slice(-5).reverse()
        const latestPeriod = expensesLeague.reduce((latest, row) => {
          return row.financialYear > latest ? row.financialYear : latest
        }, '')
        const periodLabel = expensesLeague.find(
          (r) => r.financialYear === latestPeriod
        )?.period ?? ''

        const ExpensesCard = ({ title, rows }: { title: string; rows: typeof top5 }) => (
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>{title}</p>
            {periodLabel && <p className={styles.partyRankingSubtitle}>{periodLabel}</p>}
            <ol className={styles.list} style={{ marginTop: 'var(--s-2)' }}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <MlaPhoto
                    name={row.fullName}
                    imgUrl={row.imgUrl ?? ''}
                    size={52}
                    decorative
                    square
                  />
                  <div className={styles.info}>
                    <Link href={`/assembly/mlas/${row.personId}`} className={styles.name}>
                      {formatMemberName(row.fullName)}
                    </Link>
                    {row.party && (
                      <span
                        className="party-pill"
                        data-party={abbreviateParty(row.party)}
                      >
                        <PartyName party={row.party} />
                      </span>
                    )}
                  </div>
                  <span className={styles.value}>{gbp(row.total)}</span>
                </li>
              ))}
            </ol>
          </div>
        )

        return (
          <section aria-labelledby="expenses-heading" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.expensesHeader}>
                <p className="eyebrow">Public spending</p>
                <a href="https://www.niassembly.gov.uk/your-mlas/members-salaries-and-expenses/" target="_blank" rel="noopener noreferrer" className={`${styles.expensesSourceLink} ${styles.expensesSourceLinkDesktop}`}>
                  Official source
                </a>
              </div>
              <h2 id="expenses-heading" className={styles.sectionTitle}>Member expenses</h2>
              <div className={styles.sectionRule}></div>
            </div>
            <Link href="/assembly/expenses" className={styles.expensesRankingsCard} style={{ marginTop: 0 }}>
              <span className={styles.expensesRankingsCardLeft}>
                <svg className={styles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
                  <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
                  <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
                </svg>
                <span className={styles.expensesRankingsCardText}>View full MLA expenses rankings</span>
              </span>
              <span className={styles.expensesRankingsCardArrow}>↗</span>
            </Link>

            {expensesByParty.length >= 2 && (() => {
              const fmt2 = (n: number) => Math.round(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
              const byTotal = [...expensesByParty].sort((a, b) => b.party_total - a.party_total)
              const byAvg = [...expensesByParty].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
              const maxTotal = byTotal[0]?.party_total ?? 1
              const maxAvg = byAvg[0]?.per_mla_avg ?? 1

              type ExpenseRow = { party: string; party_total: number; mla_count: number; per_mla_avg: number }
              const PartyRankingCard = ({
                title,
                subtitle,
                rows,
                getValue,
                getMax,
              }: {
                title: string
                subtitle: string
                rows: ExpenseRow[]
                getValue: (r: ExpenseRow) => number
                getMax: number
              }) => (
                <div className={styles.partyRankingCard}>
                  <p className={styles.partyRankingTitle}>{title}</p>
                  <p className={styles.partyRankingSubtitle}>{subtitle}</p>
                  <table className={styles.partyRankingTable}>
                    <thead>
                      <tr>
                        <th scope="col">Party</th>
                        <th scope="col"><abbr title="Members">Mbrs</abbr></th>
                        <th scope="col" aria-label="Proportion"></th>
                        <th scope="col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.party}>
                          <td>
                            <span className={styles.partyRankingParty}>
                              <span className={styles.partyRankingRank}>{i + 1}</span>
                              <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                              <PartyName party={row.party} />
                            </span>
                          </td>
                          <td className={styles.cohesionMembers}>{row.mla_count}</td>
                          <td className={styles.partyRankingBarCell}>
                            <div className={styles.partyRankingBarTrack} aria-hidden="true">
                              <div
                                className={styles.partyRankingBarFill}
                                style={{ width: `${Math.round(getValue(row) / getMax * 100)}%`, background: partyBorderColor(row.party) }}
                              />
                            </div>
                          </td>
                          <td className={styles.partyRankingValue}>{fmt2(getValue(row))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )

              return (
                <>
                  <h3 className={styles.chartTitle}>Latest published expenses</h3>
                  <p className={styles.expensesMeta} style={{ marginBottom: 'var(--s-3)' }}>
                    <strong className={styles.expensesPeriod}>{periodLabel}</strong>
                    <span className={styles.expensesMetaSep} aria-hidden="true">|</span>
                    <span className={styles.expensesStat}>
                      <strong className={styles.expensesStatValue}>{gbp(String(assemblyTotal))}</strong>
                      <span className={styles.expensesStatLabel}>total</span>
                    </span>
                    <span className={styles.expensesMetaSep} aria-hidden="true">|</span>
                    <span className={styles.expensesStat}>
                      <strong className={styles.expensesStatValue}>{gbp(String(assemblyAvg))}</strong>
                      <span className={styles.expensesStatLabel}>avg per MLA</span>
                    </span>
                  </p>
                  <p className={styles.trendNote} style={{ marginBottom: 'var(--spacing-lg)' }}>Expenses claimed by <strong>current MLAs</strong> in the most recently published financial year.</p>
                  <div className={styles.expensesCardGrid}>
                    <ExpensesCard title="Most expenses claimed" rows={top5} />
                    <ExpensesCard title="Least expenses claimed" rows={bottom5} />
                  </div>
                  <div className={styles.partyRankingGrid}>
                    <PartyRankingCard
                      title="Total claimed by party"
                      subtitle={`All current MLAs · ${periodLabel}`}
                      rows={byTotal}
                      getValue={(r) => r.party_total}
                      getMax={maxTotal}
                    />
                    <PartyRankingCard
                      title="Cost per MLA by party"
                      subtitle={`Average claim per MLA within each party · ${periodLabel}`}
                      rows={byAvg}
                      getValue={(r) => r.per_mla_avg}
                      getMax={maxAvg}
                    />
                  </div>

                  {/* Total mandate expenses subsection */}
                  {(() => {
                    const gbpShort = (v: number) => {
                      if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
                      if (v >= 1_000) return `£${Math.round(v / 1_000)}k`
                      return `£${Math.round(v).toLocaleString('en-GB')}`
                    }
                    const gbpM = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`

                    // Party totals from all-years expense data
                    const partyExpTotals: Record<string, number> = {}
                    for (const m of allCurrentMembers) {
                      if (!m.party) continue
                      partyExpTotals[m.party] = (partyExpTotals[m.party] ?? 0) + (expenseTotalsMap.get(m.personId) ?? 0)
                    }
                    const partyExpEntries = Object.entries(partyExpTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
                    const highestParty = partyExpEntries[0]
                    const lowestParty = partyExpEntries[partyExpEntries.length - 1]
                    const grandTotal = partyExpEntries.reduce((s, [, v]) => s + v, 0)

                    const mandateRows = allCurrentMembers
                      .filter(m => m.mandateStart && m.mandateStart <= oneYearAgoStr)
                      .map(m => ({
                        personId: m.personId,
                        fullName: m.fullName,
                        party: m.party ?? null,
                        imgUrl: `/mla-images/${m.personId}.jpg`,
                        total: expenseTotalsMap.get(m.personId) ?? 0,
                      }))
                      .filter(r => r.total > 0)
                      .sort((a, b) => b.total - a.total)

                    const mandateTop5 = mandateRows.slice(0, 5)
                    const mandateBottom5 = [...mandateRows].reverse().slice(0, 5)

                    const MandateCard = ({ title, rows }: { title: string; rows: typeof mandateTop5 }) => (
                      <div className={styles.partyRankingCard}>
                        <p className={styles.partyRankingTitle}>{title}</p>
                        <p className={styles.partyRankingSubtitle}>Expenses across all published years</p>
                        <ol className={`${styles.list}`} style={{ marginTop: 'var(--s-2)' }}>
                          {rows.map((row, i) => (
                            <li key={row.personId} className={styles.row}>
                              <span className={styles.rank}>{i + 1}</span>
                              <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={52} decorative square />
                              <div className={styles.info}>
                                <Link href={`/assembly/mlas/${row.personId}`} className={styles.name}>
                                  {formatMemberName(row.fullName)}
                                </Link>
                                {row.party && (
                                  <span className="party-pill" data-party={abbreviateParty(row.party)}>
                                    <PartyName party={row.party} />
                                  </span>
                                )}
                              </div>
                              <span className={styles.value}>{gbpM(row.total)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )

                    return (
                      <>
                        <h3 className={styles.chartTitle}>Total mandate expenses</h3>
                        <p className={styles.trendNote} style={{ marginBottom: 'var(--spacing-lg)' }}>Total expenses claimed by <strong>current MLAs</strong> across all published financial years of the 2022–2027 mandate. Those who joined within the last year are excluded as their figures are not yet comparable.</p>
                        <div className={styles.overviewGridThree} style={{ marginBottom: 'var(--spacing-lg)' }}>
                          <div className={styles.overviewCard}>
                            <span className={styles.overviewLabel}>Total claimed</span>
                            <span className={styles.overviewValue}>{gbpShort(grandTotal)}</span>
                            <span className={styles.overviewMeta}>all published years</span>
                          </div>
                          {highestParty && (
                            <div className={styles.overviewCard}>
                              <span className={styles.overviewLabel}>Highest spending party</span>
                              <span className={styles.overviewValue}><PartyName party={highestParty[0]} /></span>
                              <span className={styles.overviewMeta}>{gbpShort(highestParty[1])} total</span>
                            </div>
                          )}
                          {lowestParty && (
                            <div className={styles.overviewCard}>
                              <span className={styles.overviewLabel}>Lowest spending party</span>
                              <span className={styles.overviewValue}><PartyName party={lowestParty[0]} /></span>
                              <span className={styles.overviewMeta}>{gbpShort(lowestParty[1])} total</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.expensesCardGrid}>
                          <MandateCard title="Highest mandate expenses" rows={mandateTop5} />
                          <MandateCard title="Lowest mandate expenses" rows={mandateBottom5} />
                        </div>

                        {(() => {
                          const fmt = (n: number) => Math.round(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
                          type ExpPartyRow = { party: string; mla_count: number; party_total: number; per_mla_avg: number }
                          const partyMap: Record<string, { total: number; count: number }> = {}
                          for (const m of allCurrentMembers) {
                            if (!m.party) continue
                            const exp = expenseTotalsMap.get(m.personId) ?? 0
                            if (!partyMap[m.party]) partyMap[m.party] = { total: 0, count: 0 }
                            partyMap[m.party].total += exp
                            partyMap[m.party].count += 1
                          }
                          const expPartyRows: ExpPartyRow[] = Object.entries(partyMap)
                            .filter(([, v]) => v.total > 0)
                            .map(([party, { total, count }]) => ({ party, mla_count: count, party_total: total, per_mla_avg: count > 0 ? total / count : 0 }))
                          const byTotal = [...expPartyRows].sort((a, b) => b.party_total - a.party_total)
                          const byAvg = [...expPartyRows].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
                          const maxTotal = byTotal[0]?.party_total ?? 1
                          const maxAvg = byAvg[0]?.per_mla_avg ?? 1

                          const ExpPartyCard = ({ title, subtitle, rows, getValue, getMax }: { title: string; subtitle: string; rows: ExpPartyRow[]; getValue: (r: ExpPartyRow) => number; getMax: number }) => (
                            <div className={styles.partyRankingCard}>
                              <p className={styles.partyRankingTitle}>{title}</p>
                              <p className={styles.partyRankingSubtitle}>{subtitle}</p>
                              <table className={styles.partyRankingTable}>
                                <thead>
                                  <tr>
                                    <th scope="col">Party</th>
                                    <th scope="col"><abbr title="Members">Mbrs</abbr></th>
                                    <th scope="col" aria-label="Proportion"></th>
                                    <th scope="col">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, i) => (
                                    <tr key={row.party}>
                                      <td>
                                        <span className={styles.partyRankingParty}>
                                          <span className={styles.partyRankingRank}>{i + 1}</span>
                                          <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                                          <PartyName party={row.party} />
                                        </span>
                                      </td>
                                      <td className={styles.cohesionMembers}>{row.mla_count}</td>
                                      <td className={styles.partyRankingBarCell}>
                                        <div className={styles.partyRankingBarTrack} aria-hidden="true">
                                          <div className={styles.partyRankingBarFill} style={{ width: `${Math.round(getValue(row) / getMax * 100)}%`, background: partyBorderColor(row.party) }} />
                                        </div>
                                      </td>
                                      <td className={styles.partyRankingValue}>{fmt(getValue(row))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )

                          return (
                            <div className={styles.partyRankingGrid} style={{ marginTop: 'var(--spacing-lg)' }}>
                              <ExpPartyCard
                                title="Total expenses by party"
                                subtitle="All MLAs · expenses across all published years"
                                rows={byTotal}
                                getValue={(r) => r.party_total}
                                getMax={maxTotal}
                              />
                              <ExpPartyCard
                                title="Expenses per MLA by party"
                                subtitle="Average expenses per MLA within each party"
                                rows={byAvg}
                                getValue={(r) => r.per_mla_avg}
                                getMax={maxAvg}
                              />
                            </div>
                          )
                        })()}
                      </>
                    )
                  })()}
                </>
              )
            })()}
          </section>
        )
      })()}

      <hr className="section-rule" />

      {/* 3. Overall cost */}
      {overallCostRows.length > 0 && (() => {
        const gbpFull = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`

        const CostCard = ({ title, rows }: { title: string; rows: typeof mostCostly5 }) => (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{title}</h3>
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={52} decorative square />
                  <div className={styles.info}>
                    <Link href={`/assembly/mlas/${row.personId}`} className={styles.name}>
                      {formatMemberName(row.fullName)}
                    </Link>
                    {row.party && (
                      <span className="party-pill" data-party={abbreviateParty(row.party)}>
                        <PartyName party={row.party} />
                      </span>
                    )}
                  </div>
                  <span className={styles.value}>{gbpFull(row.totalCost)}</span>
                </li>
              ))}
            </ol>
          </div>
        )


        return (
          <section aria-labelledby="overall-cost-heading" className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className="eyebrow">Public spending</p>
              <h2 id="overall-cost-heading" className={styles.sectionTitle}>Overall cost</h2>
              <div className={styles.sectionRule}></div>
              <p className={styles.sectionDesc}>Estimated mandate salary plus all published expenses for <strong>current MLAs</strong>. Those who joined within the last year are excluded as their figures are not yet comparable.</p>
            </div>
            <Link href="/assembly/overall-cost" className={styles.expensesRankingsCard} style={{ marginTop: 0 }}>
              <span className={styles.expensesRankingsCardLeft}>
                <svg className={styles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
                  <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
                  <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
                </svg>
                <span className={styles.expensesRankingsCardText}>
                  <span className={styles.rankingsCardTextDesktop}>View full MLA overall cost rankings</span>
                  <span className={styles.rankingsCardTextMobile}>View overall cost rankings</span>
                </span>
              </span>
              <span className={styles.expensesRankingsCardArrow}>↗</span>
            </Link>
            {(() => {
              const gbpShort = (v: number) => v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(1)}m` : v >= 1_000 ? `£${Math.round(v / 1_000)}k` : `£${Math.round(v).toLocaleString('en-GB')}`
              const partyMap2: Record<string, { total: number; count: number }> = {}
              for (const r of overallCostRows) {
                if (!r.party) continue
                if (!partyMap2[r.party]) partyMap2[r.party] = { total: 0, count: 0 }
                partyMap2[r.party].total += r.totalCost
                partyMap2[r.party].count += 1
              }
              const avgEntries = Object.entries(partyMap2)
                .filter(([, v]) => v.count > 0)
                .map(([party, { total, count }]) => [party, total / count] as [string, number])
                .sort((a, b) => b[1] - a[1])
              const highestAvgParty = avgEntries[0]
              const lowestAvgParty = avgEntries[avgEntries.length - 1]
              const grandTotal = overallCostRows.reduce((s, r) => s + r.totalCost, 0)
              return (
                <div className={styles.overviewGridThree} style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <div className={styles.overviewCard}>
                    <span className={styles.overviewLabel}>Total mandate cost</span>
                    <span className={styles.overviewValue}>{gbpShort(grandTotal)}</span>
                    <span className={styles.overviewMeta}>salary + expenses</span>
                  </div>
                  {highestAvgParty && (
                    <div className={styles.overviewCard}>
                      <span className={styles.overviewLabel}>Highest cost per MLA</span>
                      <span className={styles.overviewValue}><PartyName party={highestAvgParty[0]} /></span>
                      <span className={styles.overviewMeta}>{gbpShort(highestAvgParty[1])} avg per MLA</span>
                    </div>
                  )}
                  {lowestAvgParty && (
                    <div className={styles.overviewCard}>
                      <span className={styles.overviewLabel}>Lowest cost per MLA</span>
                      <span className={styles.overviewValue}><PartyName party={lowestAvgParty[0]} /></span>
                      <span className={styles.overviewMeta}>{gbpShort(lowestAvgParty[1])} avg per MLA</span>
                    </div>
                  )}
                </div>
              )
            })()}
            <div className={styles.expensesCardGrid}>
              <CostCard title="Highest public cost" rows={mostCostly5} />
              <CostCard title="Lowest public cost" rows={leastCostly5} />
            </div>
            {(() => {
              const fmt2 = (n: number) => Math.round(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
              type CostPartyRow = { party: string; mla_count: number; party_total: number; per_mla_avg: number }
              const partyMap: Record<string, { total: number; count: number }> = {}
              for (const r of overallCostRows) {
                if (!r.party) continue
                if (!partyMap[r.party]) partyMap[r.party] = { total: 0, count: 0 }
                partyMap[r.party].total += r.totalCost
                partyMap[r.party].count += 1
              }
              const costPartyRows: CostPartyRow[] = Object.entries(partyMap).map(([party, { total, count }]) => ({
                party,
                mla_count: count,
                party_total: total,
                per_mla_avg: count > 0 ? total / count : 0,
              }))
              const byTotal = [...costPartyRows].sort((a, b) => b.party_total - a.party_total)
              const byAvg = [...costPartyRows].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
              const maxTotal = byTotal[0]?.party_total ?? 1
              const maxAvg = byAvg[0]?.per_mla_avg ?? 1

              const CostPartyCard = ({ title, subtitle, rows, getValue, getMax }: { title: string; subtitle: string; rows: CostPartyRow[]; getValue: (r: CostPartyRow) => number; getMax: number }) => (
                <div className={styles.partyRankingCard}>
                  <p className={styles.partyRankingTitle}>{title}</p>
                  <p className={styles.partyRankingSubtitle}>{subtitle}</p>
                  <table className={styles.partyRankingTable}>
                    <thead>
                      <tr>
                        <th scope="col">Party</th>
                        <th scope="col"><abbr title="Members">Mbrs</abbr></th>
                        <th scope="col" aria-label="Proportion"></th>
                        <th scope="col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.party}>
                          <td>
                            <span className={styles.partyRankingParty}>
                              <span className={styles.partyRankingRank}>{i + 1}</span>
                              <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                              <PartyName party={row.party} />
                            </span>
                          </td>
                          <td className={styles.cohesionMembers}>{row.mla_count}</td>
                          <td className={styles.partyRankingBarCell}>
                            <div className={styles.partyRankingBarTrack} aria-hidden="true">
                              <div
                                className={styles.partyRankingBarFill}
                                style={{ width: `${Math.round(getValue(row) / getMax * 100)}%`, background: partyBorderColor(row.party) }}
                              />
                            </div>
                          </td>
                          <td className={styles.partyRankingValue}>{fmt2(getValue(row))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )

              return (
                <div className={styles.partyRankingGrid}>
                  <CostPartyCard
                    title="Total cost by party"
                    subtitle="All MLAs · salary + expenses across mandate"
                    rows={byTotal}
                    getValue={(r) => r.party_total}
                    getMax={maxTotal}
                  />
                  <CostPartyCard
                    title="Cost per MLA by party"
                    subtitle="Average cost per MLA within each party"
                    rows={byAvg}
                    getValue={(r) => r.per_mla_avg}
                    getMax={maxAvg}
                  />
                </div>
              )
            })()}
          </section>
        )
      })()}

      <hr className="section-rule" />

      {/* 4. Individual performance */}
      <section aria-labelledby="mla-stats-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Individual performance</p>
          <h2 id="mla-stats-heading" className={styles.sectionTitle}>MLA Voting</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>Who shows up, who votes Aye and who votes No. The top and bottom 5 MLAs ranked.</p>
        </div>
        <StatsRankingTabs data={leaderboard} />
      </section>

      <hr className="section-rule" />

      {/* 4. Questions */}
      {questionTop5.length > 0 && (
        <section aria-labelledby="questions-heading" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Parliamentary activity</p>
            <h2 id="questions-heading" className={styles.sectionTitle}>Questions</h2>
            <div className={styles.sectionRule}></div>
            <p className={styles.sectionDesc}>Who asks the most questions. Excludes current ministers and speakers.</p>
          </div>
          <StatsQuestionsSection top5={questionTop5} bottom5={questionBottom5} byParty={questionByParty} />
        </section>
      )}

      <hr className="section-rule" />

      {/* 5. Party behaviour */}
      <section aria-labelledby="patterns-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Party behaviour</p>
          <h2 id="patterns-heading" className={styles.sectionTitle}>How parties vote</h2>
          <div className={styles.sectionRule}></div>
        </div>
        <div className={styles.patternsGrid}>

          {/* Left: Party cohesion */}
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>Party cohesion</p>
            <p className={styles.partyRankingSubtitle}>Percentage of votes where all party members who voted, voted the same way.</p>
            <table className={styles.partyRankingTable}>
              <thead>
                <tr>
                  <th scope="col">Party</th>
                  <th scope="col"><abbr title="Members">Mbrs</abbr></th>
                  <th scope="col" aria-label="Proportion"></th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {partyCohesion.map((row, i) => (
                  <tr key={row.party}>
                    <td>
                      <span className={styles.partyRankingParty}>
                        <span className={styles.partyRankingRank}>{i + 1}</span>
                        <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                        <PartyName party={row.party} />
                      </span>
                    </td>
                    <td className={styles.cohesionMembers}>{row.memberCount}</td>
                    <td className={styles.partyRankingBarCell}>
                      <div className={styles.partyRankingBarTrack} aria-hidden="true">
                        <div className={styles.partyRankingBarFill} style={{ width: `${row.cohesionPct}%`, background: partyBorderColor(row.party) }} />
                      </div>
                    </td>
                    <td className={styles.partyRankingValue}>{row.cohesionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: stacked stats */}
          <div className={styles.patternStack}>

            {/* Average attendance */}
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Average MLA attendance</h3>
              <span className={styles.patternBigValue}>{avgAttendance}%</span>
              <span className={styles.patternNote}>of divisions attended, excluding presiding officers</span>
            </div>

            {/* Most cross-community agreement */}
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Most cross-community agreement</h3>
              {crossCommunity && crossCommunityDivisionId ? (
                <>
                  <span className={styles.patternNote}>The division with the strongest cross-community consensus by total votes cast.</span>
                  <Link
                    href={`/assembly/divisions/${crossCommunityDivisionId}`}
                    className={styles.patternDivisionLink}
                    aria-label={crossCommunitySubject ? `View division: ${crossCommunitySubject}` : 'View division'}
                  >
                    View division
                  </Link>
                </>
              ) : <span className={styles.overviewMeta}>No data</span>}
            </div>

            {/* Most rebellious MLA */}
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Most rebellious MLA</h3>
              {rebelliousMla ? (
                <div className={styles.rebelliousCard}>
                  <MlaPhoto name={rebelliousMla.fullName} imgUrl={rebelliousMla.imgUrl ?? ''} size={64} decorative square />
                  <div className={styles.rebelliousInfo}>
                    <Link href={`/assembly/mlas/${rebelliousMla.personId}`} className={styles.patternName}>
                      {formatMemberName(rebelliousMla.fullName)}
                    </Link>
                    <span
                      className="party-pill"
                      data-party={abbreviateParty(rebelliousMla.party)}
                    >
                      <PartyName party={rebelliousMla.party} />
                    </span>
                    <span className={styles.patternNote}>
                      <strong>{rebelliousMla.rebellionPct}%</strong> rebellion rate<span aria-hidden="true"> · </span>{rebelliousMla.rebellionCount} votes against party
                    </span>
                  </div>
                </div>
              ) : <span className={styles.overviewMeta}>No data</span>}
            </div>

          </div>

        </div>
      </section>

      <hr className="section-rule" />

      {/* 5. Assembly activity */}
      <section aria-labelledby="productivity-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Sitting and voting patterns</p>
          <h2 id="productivity-heading" className={styles.sectionTitle}>Assembly activity</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>How active the Assembly has been since May 2022.</p>
        </div>
        <AssemblyProductivityClient monthData={divisionsPerMonth} yearData={passRateByYear} sittingDays={sittingDays} />
      </section>

      <hr className="section-rule" />

      {/* 6. Cross-community voting */}
      <section aria-labelledby="cross-community-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Unionist and nationalist blocs</p>
          <h2 id="cross-community-heading" className={styles.sectionTitle}>Cross-community voting</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>How often unionist and nationalist MLAs voted the same way on the same division.</p>
          <div className="note-card">
            <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p>Figures cover divisions where a formal vote was called. Items passed without division are not included.</p>
          </div>
        </div>
        <CrossCommunityTrendsClient data={crossCommunityTrends} />
      </section>

    </div>
  )
}
