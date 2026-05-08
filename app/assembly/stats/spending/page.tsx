export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getMlaLeaderboard,
  getExpensesLeagueTable,
  getExpensesByParty,
  getAllMembers,
  getLatestExpensesYear,
  getAllMinisters,
  getAllMemberRoleHistories,
  getTotalExpensesPerMember,
  getAllMandateMembers,
} from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import StatsBreadcrumb from '../StatsBreadcrumb'
import styles from '../stats.module.css'

export const metadata: Metadata = {
  title: 'Spending - Stats',
  description: 'Salaries, office expenses and overall public cost of the Northern Ireland Assembly since May 2022.',
  openGraph: {
    title: 'Spending - Stormont Watch',
    description: 'Salaries, office expenses and overall public cost of the Northern Ireland Assembly since May 2022.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats/spending' },
}

export default async function SpendingPage() {
  const [leaderboard, expensesLeague, expensesByParty, allCurrentMembers, latestExpensesYear, ministerRows, allRoleHistories, totalExpensesData, allMandateMembers] = await Promise.all([
    getMlaLeaderboard(),
    getExpensesLeagueTable(),
    getExpensesByParty(),
    getAllMembers(),
    getLatestExpensesYear(),
    getAllMinisters(),
    getAllMemberRoleHistories(),
    getTotalExpensesPerMember(),
    getAllMandateMembers(),
  ])

  void leaderboard
  void ministerRows
  void latestExpensesYear

  // Salary computation
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

  // Overall cost computation
  const expenseTotalsMap = new Map(totalExpensesData.map(r => [r.personId, parseFloat(r.totalExpenses)]))
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  const overallCostRows = allMandateMembers
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

  const costRowsForLeaderboard = overallCostRows.filter(r => {
    const m = allMandateMembers.find(m => m.personId === r.personId)
    return m?.isCurrent && m.mandateStart && m.mandateStart <= oneYearAgoStr
  })
  const mostCostly5 = costRowsForLeaderboard.slice(0, 5)
  const leastCostly5 = [...costRowsForLeaderboard].reverse().slice(0, 5)

  const gbpSalary = (v: number) => `£${v.toLocaleString('en-GB')}`
  const gbp = (v: string | null | undefined) =>
    `£${parseFloat(v ?? '0').toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const gbpFull = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`
  const gbpShort = (v: number) => {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`
    if (v >= 1_000) return `£${Math.round(v / 1_000)}k`
    return `£${Math.round(v).toLocaleString('en-GB')}`
  }
  const gbpM = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`

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
    <div className="container">
      <header className="page-header">
        <StatsBreadcrumb label="Public Spending" />
        <h1>Public Spending</h1>
        <p className="lede">Salaries, office expenses and overall public cost of the Assembly since May 2022.</p>
      </header>

      {/* Salaries */}
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

      <hr className="section-rule" />

      {/* Member expenses */}
      {expensesLeague.length > 0 && (() => {
        const assemblyTotal = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)
        const assemblyAvg = assemblyTotal / expensesLeague.length
        const top5 = expensesLeague.slice(0, 5)
        const bottom5 = [...expensesLeague].slice(-5).reverse()
        const latestPeriod = expensesLeague.reduce((latest, row) => row.financialYear > latest ? row.financialYear : latest, '')
        const periodLabel = expensesLeague.find(r => r.financialYear === latestPeriod)?.period ?? ''

        const ExpensesCard = ({ title, rows }: { title: string; rows: typeof top5 }) => (
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>{title}</p>
            {periodLabel && <p className={styles.partyRankingSubtitle}>{periodLabel}</p>}
            <ol className={styles.list} style={{ marginTop: 'var(--s-2)' }}>
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
              const PartyRankingCard = ({ title, subtitle, rows, getValue, getMax }: { title: string; subtitle: string; rows: ExpenseRow[]; getValue: (r: ExpenseRow) => number; getMax: number }) => (
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
                  <p className={styles.expensesMeta} style={{ marginTop: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
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
                    <PartyRankingCard title="Total claimed by party" subtitle={`All current MLAs · ${periodLabel}`} rows={byTotal} getValue={r => r.party_total} getMax={maxTotal} />
                    <PartyRankingCard title="Cost per MLA by party" subtitle={`Average claim per MLA within each party · ${periodLabel}`} rows={byAvg} getValue={r => r.per_mla_avg} getMax={maxAvg} />
                  </div>

                  {/* Total mandate expenses subsection */}
                  {(() => {
                    const partyExpTotals: Record<string, number> = {}
                    for (const m of allMandateMembers) {
                      if (!m.party) continue
                      partyExpTotals[m.party] = (partyExpTotals[m.party] ?? 0) + (expenseTotalsMap.get(m.personId) ?? 0)
                    }
                    const partyExpEntries = Object.entries(partyExpTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
                    const highestParty = partyExpEntries[0]
                    const lowestParty = partyExpEntries[partyExpEntries.length - 1]
                    const grandTotal = partyExpEntries.reduce((s, [, v]) => s + v, 0)

                    const mandateRows = allMandateMembers
                      .filter(m => m.isCurrent && m.mandateStart && m.mandateStart <= oneYearAgoStr)
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
                        <ul className={styles.partyRankingSubtitleList}>
                          <li>Current MLAs only (former MLAs excluded)</li>
                          <li>Expenses across all published years</li>
                          <li>Excludes MLAs who joined within the last year</li>
                        </ul>
                        <ol className={styles.list} style={{ marginTop: 'var(--s-2)' }}>
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

                    const fmt = (n: number) => Math.round(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
                    type ExpPartyRow = { party: string; mla_count: number; party_total: number; per_mla_avg: number }
                    const partyMap: Record<string, { total: number; count: number }> = {}
                    for (const m of allMandateMembers) {
                      if (!m.party) continue
                      const exp = expenseTotalsMap.get(m.personId) ?? 0
                      if (!partyMap[m.party]) partyMap[m.party] = { total: 0, count: 0 }
                      partyMap[m.party].total += exp
                      if (expenseTotalsMap.has(m.personId)) partyMap[m.party].count += 1
                    }
                    const expPartyRows: ExpPartyRow[] = Object.entries(partyMap)
                      .filter(([, v]) => v.total > 0)
                      .map(([party, { total, count }]) => ({ party, mla_count: count, party_total: total, per_mla_avg: count > 0 ? total / count : 0 }))
                    const byTotalMandate = [...expPartyRows].sort((a, b) => b.party_total - a.party_total)
                    const byAvgMandate = [...expPartyRows].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
                    const maxTotalMandate = byTotalMandate[0]?.party_total ?? 1
                    const maxAvgMandate = byAvgMandate[0]?.per_mla_avg ?? 1

                    const ExpPartyCard = ({ title, subtitleList, rows, getValue, getMax }: { title: string; subtitleList: string[]; rows: ExpPartyRow[]; getValue: (r: ExpPartyRow) => number; getMax: number }) => (
                      <div className={styles.partyRankingCard}>
                        <p className={styles.partyRankingTitle}>{title}</p>
                        <ul className={styles.partyRankingSubtitleList}>
                          {subtitleList.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
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
                      <>
                        <h3 className={styles.chartTitle}>Total mandate expenses</h3>
                        <p className={styles.trendNote} style={{ marginBottom: 'var(--spacing-lg)' }}>Total expenses claimed by <strong>all current and former MLAs with published expense data</strong> across all published financial years of the 2022–2027 mandate.</p>
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
                        <div className={styles.partyRankingGrid} style={{ marginBottom: 'var(--spacing-lg)' }}>
                          <ExpPartyCard title="Total expenses by party" subtitleList={['All current and former MLAs with published expense data', 'Expenses across all published years']} rows={byTotalMandate} getValue={r => r.party_total} getMax={maxTotalMandate} />
                          <ExpPartyCard title="Expenses per MLA by party" subtitleList={['All current and former MLAs with published expense data', 'All published years']} rows={byAvgMandate} getValue={r => r.per_mla_avg} getMax={maxAvgMandate} />
                        </div>
                        <div className={styles.expensesCardGrid}>
                          <MandateCard title="Highest mandate expenses" rows={mandateTop5} />
                          <MandateCard title="Lowest mandate expenses" rows={mandateBottom5} />
                        </div>
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

      {/* Overall cost */}
      {overallCostRows.length > 0 && (() => {
        const CostCard = ({ title, rows }: { title: string; rows: typeof mostCostly5 }) => (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{title}</h3>
            <ul className={styles.partyRankingSubtitleList} style={{ marginBottom: 'var(--s-3)' }}>
              <li>Current MLAs only (former MLAs excluded)</li>
              <li>Excludes MLAs who joined within the last year</li>
            </ul>
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
          party, mla_count: count, party_total: total, per_mla_avg: count > 0 ? total / count : 0,
        }))
        const byTotal = [...costPartyRows].sort((a, b) => b.party_total - a.party_total)
        const byAvg = [...costPartyRows].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
        const maxTotal = byTotal[0]?.party_total ?? 1
        const maxAvg = byAvg[0]?.per_mla_avg ?? 1

        const avgEntries = Object.entries(partyMap)
          .filter(([, v]) => v.count > 0)
          .map(([party, { total, count }]) => [party, total / count] as [string, number])
          .sort((a, b) => b[1] - a[1])
        const highestAvgParty = avgEntries[0]
        const lowestAvgParty = avgEntries[avgEntries.length - 1]
        const grandTotal = overallCostRows.reduce((s, r) => s + r.totalCost, 0)

        const CostPartyCard = ({ title, subtitleList, rows, getValue, getMax }: { title: string; subtitleList: string[]; rows: CostPartyRow[]; getValue: (r: CostPartyRow) => number; getMax: number }) => (
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>{title}</p>
            <ul className={styles.partyRankingSubtitleList}>
              {subtitleList.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
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
                    <td className={styles.partyRankingValue}>{fmt2(getValue(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

        return (
          <section aria-labelledby="overall-cost-heading" className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className="eyebrow">Public spending</p>
              <h2 id="overall-cost-heading" className={styles.sectionTitle}>Overall cost</h2>
              <div className={styles.sectionRule}></div>
              <p className={styles.sectionDesc}>Estimated mandate salary plus all published expenses for <strong>all current and former MLAs</strong> in the 2022–2027 mandate. Salary is estimated from each MLA&apos;s role history: the published salary rate for their highest-paid role at any given time (minister, committee chair, or base MLA rate), pro-rated across the mandate. Expenses are summed across all published financial years.</p>
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
            <div className={styles.partyRankingGrid} style={{ marginBottom: 'var(--spacing-lg)' }}>
              <CostPartyCard title="Total cost by party" subtitleList={['All current and former MLAs', 'Salary and expenses across the 2022-2027 mandate', 'Some MLAs have no published expense data and contribute salary estimates only']} rows={byTotal} getValue={r => r.party_total} getMax={maxTotal} />
              <CostPartyCard title="Cost per MLA by party" subtitleList={['All current and former MLAs', 'Salary and expenses across the 2022-2027 mandate', 'Some MLAs have no published expense data and contribute salary estimates only']} rows={byAvg} getValue={r => r.per_mla_avg} getMax={maxAvg} />
            </div>
            <div className={styles.expensesCardGrid}>
              <CostCard title="Highest public cost" rows={mostCostly5} />
              <CostCard title="Lowest public cost" rows={leastCostly5} />
            </div>
          </section>
        )
      })()}
    </div>
  )
}
