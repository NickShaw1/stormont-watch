import Link from 'next/link'
import Image from 'next/image'
import { PoundSterling, Wallet, Receipt, Landmark, TrendingUp, TrendingDown, Banknote, PiggyBank, ArrowUpWideNarrow, ArrowDownWideNarrow, ScrollText, Users, UserCheck, Coins, Crown, Sigma } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  getExpensesLeagueTable,
  getExpensesByParty,
  getAllMembers,
  getAllMemberRoleHistories,
  getTotalExpensesPerMember,
  getAllMandateMembers,
  getAllMlaExpensesForLatestYear,
  getInstitutionalExpensesForLatestYear,
} from '@/lib/db/queries'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, salaryRatesPublished, hasServedOneYear, type RoleInterval } from '@/lib/salaries'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import StatsBreadcrumb from '../StatsBreadcrumb'
import styles from '../stats.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function SpendingPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [expensesLeague, expensesByParty, allCurrentMembers, allRoleHistories, totalExpensesData, allMandateMembers, allMlaExpenses, institutionalExpenses] = await Promise.all([
    getExpensesLeagueTable(mandate.id),
    getExpensesByParty(mandate.id),
    getAllMembers(mandate.id),
    getAllMemberRoleHistories(mandate.id),
    getTotalExpensesPerMember(mandate.id),
    getAllMandateMembers(mandate.id),
    getAllMlaExpensesForLatestYear(mandate.id),
    getInstitutionalExpensesForLatestYear(mandate.id),
  ])

  // Salary computation
  const rolesByPerson = new Map<string, typeof allRoleHistories>()
  for (const r of allRoleHistories) {
    if (!rolesByPerson.has(r.personId)) rolesByPerson.set(r.personId, [])
    rolesByPerson.get(r.personId)!.push(r)
  }
  const today = new Date().toISOString().slice(0, 10)
  const ratesPublished = salaryRatesPublished(mandate.id)
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
      currentSalary: getCurrentAnnualSalary(roleIntervals, today, mandate.id) ?? 0,
      mandateEarnings: calculateMandateEarnings(roleIntervals, today, mandate.id) ?? 0,
    }
  })
  const salaryTop5 = [...salaryRows].sort((a, b) => b.currentSalary - a.currentSalary).slice(0, 5)
  const earningsTop5 = [...salaryRows].sort((a, b) => b.mandateEarnings - a.mandateEarnings).slice(0, 5)

  // Overall cost computation
  const expenseTotalsMap = new Map(totalExpensesData.map(r => [r.personId, parseFloat(r.totalExpenses)]))

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
      const earnings = calculateMandateEarnings(roleIntervals, today, mandate.id) ?? 0
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
    return m?.isCurrent && m.mandateStart && hasServedOneYear(m.mandateStart, today)
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

  const SalaryCard = ({ title, icon: Icon, rows, getValue }: { title: string; icon: LucideIcon; rows: typeof salaryTop5; getValue: (r: typeof salaryTop5[0]) => number }) => (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {title}
        <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </h3>
      <ol className={styles.list}>
        {rows.map((row, i) => (
          <li key={row.personId} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            <span className={styles.rowPhoto}>
              {row.imgUrl && <Image src={row.imgUrl} alt="" fill sizes="52px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
            </span>
            <div className={styles.info}>
              <Link href={`${basePath}/assembly/mlas/${row.personId}`} className={styles.name}>
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
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="Public Spending" basePath={basePath} />
        <h1 className={styles.pageHeaderTitle}>
          <PoundSterling className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Public Spending
        </h1>
        <p className={styles.lede}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</p>
      </header>

      {/* Salaries — replaced by a notice when the mandate's pay rates aren't published */}
      {ratesPublished ? (
      <section aria-labelledby="salaries-heading" className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionHeadRow}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Public spending</span>
            <h2 id="salaries-heading" className={styles.sectionTitle}>
              <Wallet className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Salaries
            </h2>
          </div>
          <Link href={`${basePath}/assembly/salaries`} className={styles.viewAllBtn}>View full rankings</Link>
        </div>
        <div className={styles.cardGrid}>
          <SalaryCard title="Highest current salaries" icon={Banknote} rows={salaryTop5} getValue={r => r.currentSalary} />
          <SalaryCard title="Highest mandate earnings" icon={PiggyBank} rows={earningsTop5} getValue={r => r.mandateEarnings} />
        </div>
      </section>
      ) : (
        <div className="notice-card">Salary and overall-cost figures for the {mandate.label} mandate are not yet available: the Assembly&apos;s published pay rates for this mandate have not been released.</div>
      )}

      {/* Member expenses */}
      {expensesLeague.length > 0 && (() => {
        const assemblyTotal = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)
        const assemblyAvg = assemblyTotal / expensesLeague.length
        const top5 = expensesLeague.slice(0, 5)
        const bottom5 = [...expensesLeague].slice(-5).reverse()
        const latestPeriod = expensesLeague.reduce((latest, row) => row.financialYear > latest ? row.financialYear : latest, '')
        const periodLabel = expensesLeague.find(r => r.financialYear === latestPeriod)?.period ?? ''

        const ExpensesCard = ({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: typeof top5 }) => (
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>
              {title}
              <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </p>
            {periodLabel && <p className={styles.partyRankingSubtitle}>{periodLabel}</p>}
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.rowPhoto}>
                    {row.imgUrl && <Image src={row.imgUrl} alt="" fill sizes="52px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
                  </span>
                  <div className={styles.info}>
                    <Link href={`${basePath}/assembly/mlas/${row.personId}`} className={styles.name}>
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
            <div className={styles.sectionHeadRow} style={{ marginBottom: 0 }}>
              <div>
                <span className={styles.sectionEyebrow}>Public spending</span>
                <h2 id="expenses-heading" className={styles.sectionTitle}>
                  <Receipt className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Latest published expenses
                </h2>
              </div>
              <Link href={`${basePath}/assembly/expenses`} className={styles.viewAllBtn}>View full rankings</Link>
            </div>
            {expensesByParty.length >= 2 && (
              <div className={styles.sectionHead}>
                <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Expenses claimed by {sittingAdjective(mandate)} MLAs in the most recently published financial year.</p>
              </div>
            )}

            {expensesByParty.length >= 2 && (() => {
              const fmt2 = (n: number) => Math.round(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
              const byTotal = [...expensesByParty].sort((a, b) => b.party_total - a.party_total)
              const byAvg = [...expensesByParty].sort((a, b) => b.per_mla_avg - a.per_mla_avg)
              const maxTotal = byTotal[0]?.party_total ?? 1
              const maxAvg = byAvg[0]?.per_mla_avg ?? 1

              type ExpenseRow = { party: string; party_total: number; mla_count: number; per_mla_avg: number }
              const PartyRankingCard = ({ title, icon: Icon, subtitleList, rows, getValue, getMax }: { title: string; icon: LucideIcon; subtitleList: string[]; rows: ExpenseRow[]; getValue: (r: ExpenseRow) => number; getMax: number }) => (
                <div className={styles.partyRankingCard}>
                  <p className={styles.partyRankingTitle}>
                    {title}
                    <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                  </p>
                  <ul className={styles.partyRankingSubtitleList}>
                    {subtitleList.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  <table className={styles.partyRankingTable}>
                    <colgroup>
                      <col className={styles.colRank} />
                      <col className={styles.colParty} />
                      <col className={styles.colMbrs} />
                      <col className={styles.colBar} />
                      <col className={styles.colTotal} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col" className={styles.thRank} aria-label="Rank"></th>
                        <th scope="col">Party</th>
                        <th scope="col" className={styles.thMbrs}><abbr title="Members">Mbrs</abbr></th>
                        <th scope="col" aria-label="Proportion"></th>
                        <th scope="col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.party}>
                          <td className={styles.partyRankingRank}>{i + 1}</td>
                          <td>
                            <span className={styles.partyRankingParty}>
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
                  <div className={`${styles.glanceStripSmall} ${institutionalExpenses.length > 0 ? styles.glanceStripSmallFour : styles.glanceStripSmallThree}`} style={{ marginTop: 'var(--s-4)' }}>
                    <div className={styles.glanceCellSmall}>
                      <span className={styles.glanceCellSmallLabel}>Total claimed</span>
                      <div className={styles.glanceCellSmallValue}>{gbp(String(assemblyTotal))}</div>
                      <span className={styles.glanceCellSmallMeta}>Current MLAs &middot; {periodLabel}</span>
                    </div>
                    <div className={styles.glanceCellSmall}>
                      <span className={styles.glanceCellSmallLabel}>Avg per MLA</span>
                      <div className={styles.glanceCellSmallValue}>{gbp(String(assemblyAvg))}</div>
                      <span className={styles.glanceCellSmallMeta}>Current MLAs &middot; {periodLabel}</span>
                    </div>
                    <div className={styles.glanceCellSmall}>
                      <span className={styles.glanceCellSmallLabel}>Current &amp; former total</span>
                      <div className={styles.glanceCellSmallValue}>{gbpFull(allMlaExpenses.total)}</div>
                      <span className={styles.glanceCellSmallMeta}>
                        All {allMlaExpenses.count} MLAs who claimed &middot; {periodLabel}
                      </span>
                    </div>
                    {institutionalExpenses.length > 0 && (
                      <div className={styles.glanceCellSmall}>
                        <span className={styles.glanceCellSmallLabel}>Other Assembly costs</span>
                        <div className={styles.glanceCellSmallValue}>
                          {gbpFull(institutionalExpenses.reduce((sum, r) => sum + r.amount, 0))}
                        </div>
                        <span className={styles.glanceCellSmallMeta}>
                          Not attributed to an MLA &middot; {institutionalExpenses.map(r => r.category).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={styles.cardGrid}>
                    <ExpensesCard title="Most expenses claimed" icon={ArrowUpWideNarrow} rows={top5} />
                    <ExpensesCard title="Least expenses claimed" icon={ArrowDownWideNarrow} rows={bottom5} />
                  </div>
                  <div className={styles.partyRankingGrid} style={{ marginTop: 'var(--s-5)' }}>
                    <PartyRankingCard title="Total claimed by party" icon={Users} subtitleList={[`All ${sittingAdjective(mandate)} MLAs`, periodLabel]} rows={byTotal} getValue={r => r.party_total} getMax={maxTotal} />
                    <PartyRankingCard title="Cost per MLA by party" icon={UserCheck} subtitleList={['Average claim per MLA within each party', periodLabel]} rows={byAvg} getValue={r => r.per_mla_avg} getMax={maxAvg} />
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
                      .filter(m => m.isCurrent && m.mandateStart && hasServedOneYear(m.mandateStart, today))
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

                    const MandateCard = ({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: typeof mandateTop5 }) => (
                      <div className={styles.partyRankingCard}>
                        <p className={styles.partyRankingTitle}>
                          {title}
                          <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                        </p>
                        <ul className={styles.partyRankingSubtitleList}>
                          <li>{mandate.isCurrent ? 'Current' : 'Sitting'} MLAs only (former MLAs excluded)</li>
                          <li>Expenses across all published years</li>
                          <li>Excludes MLAs who joined within the last year</li>
                        </ul>
                        <ol className={styles.list} style={{ marginTop: 'var(--s-2)' }}>
                          {rows.map((row, i) => (
                            <li key={row.personId} className={styles.row}>
                              <span className={styles.rank}>{i + 1}</span>
                              <span className={styles.rowPhoto}>
                                {row.imgUrl && <Image src={row.imgUrl} alt="" fill sizes="52px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
                              </span>
                              <div className={styles.info}>
                                <Link href={`${basePath}/assembly/mlas/${row.personId}`} className={styles.name}>
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

                    const ExpPartyCard = ({ title, icon: Icon, subtitleList, rows, getValue, getMax, wideTotal }: { title: string; icon: LucideIcon; subtitleList: string[]; rows: ExpPartyRow[]; getValue: (r: ExpPartyRow) => number; getMax: number; wideTotal?: boolean }) => (
                      <div className={styles.partyRankingCard}>
                        <p className={styles.partyRankingTitle}>
                          {title}
                          <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                        </p>
                        <ul className={styles.partyRankingSubtitleList}>
                          {subtitleList.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                        <table className={`${styles.partyRankingTable} ${wideTotal ? styles.partyRankingTableWideTotal : ''}`}>
                          <colgroup>
                            <col className={styles.colRank} />
                            <col className={styles.colParty} />
                            <col className={styles.colMbrs} />
                            <col className={styles.colBar} />
                            <col className={styles.colTotal} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th scope="col" className={styles.thRank} aria-label="Rank"></th>
                              <th scope="col">Party</th>
                              <th scope="col" className={styles.thMbrs}><abbr title="Members">Mbrs</abbr></th>
                              <th scope="col" aria-label="Proportion"></th>
                              <th scope="col">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={row.party}>
                                <td className={styles.partyRankingRank}>{i + 1}</td>
                                <td>
                                  <span className={styles.partyRankingParty}>
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
                        <h3 className={styles.chartTitle}>
                          <ScrollText className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                          Total mandate expenses
                        </h3>
                        <p className={styles.trendNote} style={{ marginBottom: 'var(--s-4)' }}>Total expenses claimed by all current and former MLAs with published expense data across all published financial years of the {mandate.label} mandate.</p>
                        <div className={`${styles.glanceStripSmall} ${styles.glanceStripSmallThree}`} style={{ marginBottom: 'var(--s-5)' }}>
                          <div className={styles.glanceCellSmall}>
                            <div className={styles.glanceCellSmallLabelRow}>
                              <span className={styles.glanceCellSmallLabel}>Total claimed</span>
                              <Coins className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                            </div>
                            <div className={styles.glanceCellSmallValue}>{gbpShort(grandTotal)}</div>
                            <span className={styles.glanceCellSmallMeta}>all published years</span>
                          </div>
                          {highestParty && (
                            <div className={styles.glanceCellSmall}>
                              <div className={styles.glanceCellSmallLabelRow}>
                                <span className={styles.glanceCellSmallLabel}>Highest spending party</span>
                                <Crown className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                              </div>
                              <div className={styles.glanceCellSmallValue}><PartyName party={highestParty[0]} /></div>
                              <span className={styles.glanceCellSmallMeta}>{gbpShort(highestParty[1])} total</span>
                            </div>
                          )}
                          {lowestParty && (
                            <div className={styles.glanceCellSmall}>
                              <div className={styles.glanceCellSmallLabelRow}>
                                <span className={styles.glanceCellSmallLabel}>Lowest spending party</span>
                                <TrendingDown className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                              </div>
                              <div className={styles.glanceCellSmallValue}><PartyName party={lowestParty[0]} /></div>
                              <span className={styles.glanceCellSmallMeta}>{gbpShort(lowestParty[1])} total</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.partyRankingGrid} style={{ marginBottom: 'var(--s-5)' }}>
                          <ExpPartyCard title="Total expenses by party" icon={Users} subtitleList={['All current and former MLAs with published expense data', 'Expenses across all published years']} rows={byTotalMandate} getValue={r => r.party_total} getMax={maxTotalMandate} wideTotal />
                          <ExpPartyCard title="Expenses per MLA by party" icon={UserCheck} subtitleList={['All current and former MLAs with published expense data', 'All published years']} rows={byAvgMandate} getValue={r => r.per_mla_avg} getMax={maxAvgMandate} />
                        </div>
                        <div className={styles.cardGrid}>
                          <MandateCard title="Highest mandate expenses" icon={ScrollText} rows={mandateTop5} />
                          <MandateCard title="Lowest mandate expenses" icon={ScrollText} rows={mandateBottom5} />
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

      {/* Overall cost */}
      {ratesPublished && overallCostRows.length > 0 && (() => {
        const CostCard = ({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: typeof mostCostly5 }) => (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              {title}
              <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </h3>
            <ul className={styles.partyRankingSubtitleList}>
              <li>{mandate.isCurrent ? 'Current' : 'Sitting'} MLAs only (former MLAs excluded)</li>
              <li>Excludes MLAs who joined within the last year</li>
            </ul>
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.rowPhoto}>
                    {row.imgUrl && <Image src={row.imgUrl} alt="" fill sizes="52px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />}
                  </span>
                  <div className={styles.info}>
                    <Link href={`${basePath}/assembly/mlas/${row.personId}`} className={styles.name}>
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
        type CostPartyRow = { party: string; mla_count: number; seats: number; party_total: number; per_mla_avg: number }
        const partyMap: Record<string, { total: number; count: number }> = {}
        for (const r of overallCostRows) {
          if (!r.party) continue
          if (!partyMap[r.party]) partyMap[r.party] = { total: 0, count: 0 }
          partyMap[r.party].total += r.totalCost
          partyMap[r.party].count += 1
        }
        // Denominator for the average: a seat counts once, not once per holder.
        const currentSeatsByParty: Record<string, number> = {}
        for (const m of allMandateMembers) {
          if (!m.party || !m.isCurrent) continue
          currentSeatsByParty[m.party] = (currentSeatsByParty[m.party] ?? 0) + 1
        }
        const costPartyRows: CostPartyRow[] = Object.entries(partyMap).map(([party, { total, count }]) => {
          const seats = currentSeatsByParty[party] ?? 0
          return { party, mla_count: count, seats, party_total: total, per_mla_avg: seats > 0 ? total / seats : 0 }
        })
        const byTotal = [...costPartyRows].sort((a, b) => b.party_total - a.party_total)
        const byAvg = [...costPartyRows].sort((a, b) => b.per_mla_avg - a.per_mla_avg)

        const avgEntries = Object.entries(partyMap)
          .filter(([party]) => (currentSeatsByParty[party] ?? 0) > 0)
          .map(([party, { total }]) => [party, total / currentSeatsByParty[party]] as [string, number])
          .sort((a, b) => b[1] - a[1])
        const highestAvgParty = avgEntries[0]
        const lowestAvgParty = avgEntries[avgEntries.length - 1]
        const grandTotal = overallCostRows.reduce((s, r) => s + r.totalCost, 0)

        const CostPartyCard = ({ title, icon: Icon, subtitleList, rows, getValue }: { title: string; icon: LucideIcon; subtitleList: string[]; rows: CostPartyRow[]; getValue: (r: CostPartyRow) => number }) => (
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>
              {title}
              <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </p>
            <ul className={styles.partyRankingSubtitleList}>
              {subtitleList.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
            <table className={`${styles.partyRankingTable} ${styles.partyRankingTableSeats}`}>
              <colgroup>
                <col className={styles.colRank} />
                <col className={styles.colParty} />
                <col className={styles.colMbrs} />
                <col className={styles.colSeats} />
                <col className={styles.colTotal} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={styles.thRank} aria-label="Rank"></th>
                  <th scope="col">Party</th>
                  <th scope="col" className={styles.thMbrs}><abbr title="Members">Mbrs</abbr></th>
                  <th scope="col" className={`${styles.thMbrs} ${styles.thSeats}`}><abbr title="Seats">Seats</abbr></th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.party}>
                    <td className={styles.partyRankingRank}>{i + 1}</td>
                    <td>
                      <span className={styles.partyRankingParty}>
                        <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                        <PartyName party={row.party} />
                      </span>
                    </td>
                    <td className={styles.cohesionMembers}>{row.mla_count}</td>
                    <td className={`${styles.cohesionMembers} ${styles.seatsCell}`}>{row.seats}</td>
                    <td className={styles.partyRankingValue}>{fmt2(getValue(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

        return (
          <section aria-labelledby="overall-cost-heading" className={`${styles.section} ${styles.sectionLast}`}>
            <div className={styles.sectionHeadRow} style={{ marginBottom: 0 }}>
              <div>
                <span className={styles.sectionEyebrow}>Public spending</span>
                <h2 id="overall-cost-heading" className={styles.sectionTitle}>
                  <Landmark className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Overall cost
                </h2>
              </div>
              <Link href={`${basePath}/assembly/overall-cost`} className={styles.viewAllBtn}>View full rankings</Link>
            </div>
            <div className={styles.sectionHead}>
              <p className={styles.sectionDesc}>Estimated mandate salary plus all published expenses for all current and former MLAs in the {mandate.label} mandate. Salary is estimated from each MLA&apos;s role history: the published salary rate for their highest-paid role at any given time (minister, committee chair, or base MLA rate), pro-rated across the mandate. Expenses are summed across all published financial years.</p>
            </div>
            <div className={`${styles.glanceStripSmall} ${styles.glanceStripSmallThree}`} style={{ marginBottom: 'var(--s-5)' }}>
              <div className={styles.glanceCellSmall}>
                <div className={styles.glanceCellSmallLabelRow}>
                  <span className={styles.glanceCellSmallLabel}>Total mandate cost</span>
                  <Sigma className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className={styles.glanceCellSmallValue}>{gbpShort(grandTotal)}</div>
                <span className={styles.glanceCellSmallMeta}>salary + expenses</span>
              </div>
              {highestAvgParty && (
                <div className={styles.glanceCellSmall}>
                  <div className={styles.glanceCellSmallLabelRow}>
                    <span className={styles.glanceCellSmallLabel}>Highest cost per seat</span>
                    <Crown className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className={styles.glanceCellSmallValue}><PartyName party={highestAvgParty[0]} /></div>
                  <span className={styles.glanceCellSmallMeta}>{fmt2(highestAvgParty[1])} per seat</span>
                </div>
              )}
              {lowestAvgParty && (
                <div className={styles.glanceCellSmall}>
                  <div className={styles.glanceCellSmallLabelRow}>
                    <span className={styles.glanceCellSmallLabel}>Lowest cost per seat</span>
                    <TrendingDown className={styles.glanceCellSmallIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className={styles.glanceCellSmallValue}><PartyName party={lowestAvgParty[0]} /></div>
                  <span className={styles.glanceCellSmallMeta}>{fmt2(lowestAvgParty[1])} per seat</span>
                </div>
              )}
            </div>
            <div className={styles.partyRankingGrid} style={{ marginBottom: 'var(--s-5)' }}>
              <CostPartyCard title="Total cost by party" icon={Users} subtitleList={['All current and former MLAs', `Salary and expenses across the ${mandate.label} mandate`, 'Some MLAs have no published expense data and contribute salary estimates only']} rows={byTotal} getValue={r => r.party_total} />
              <CostPartyCard title="Cost per seat by party" icon={UserCheck} subtitleList={[`Salary and expenses across the ${mandate.label} mandate`, 'Some MLAs have no published expense data and contribute salary estimates only', 'Divided by seats each party currently holds, not by every MLA who has held one']} rows={byAvg} getValue={r => r.per_mla_avg} />
            </div>
            <div className={styles.cardGrid}>
              <CostCard title="Highest public cost" icon={TrendingUp} rows={mostCostly5} />
              <CostCard title="Lowest public cost" icon={TrendingDown} rows={leastCostly5} />
            </div>
          </section>
        )
      })()}
    </div>
  )
}
