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
} from '@/lib/db/queries'
import StatsRankingTabs from './StatsRankingTabs'

export const revalidate = 86400
import CrossCommunityTrendsClient from './CrossCommunityTrendsClient'
import AssemblyProductivityClient from './AssemblyProductivityClient'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from './stats.module.css'

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Assembly voting statistics since February 2024.',
  openGraph: {
    title: 'Stats — Stormont Watch',
    description: 'Assembly voting statistics since February 2024.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats' },
}

export default async function StatsPage() {
  const [leaderboard, assemblyStats, avgAttendance, partyCohesion, rebelliousMla, crossCommunity, expensesLeague, expensesByParty, crossCommunityTrends, divisionsPerMonth, passRateByYear, overallAgreementRate, allCurrentMembers] = await Promise.all([
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
  ])

  const { totalDivisions, crossCommunityCount } = assemblyStats

  const totalExpenses = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)

  const allPassRates = passRateByYear.map(r => ({ year: Number(r.year), total: Number(r.total), passed: Number(r.passed) }))
  const totalPassed = allPassRates.reduce((s, r) => s + r.passed, 0)
  const overallPassRate = totalDivisions > 0 ? Math.round(totalPassed * 100 / totalDivisions) : 0
  const busiestYear = allPassRates.reduce((best, r) => r.total > best.total ? r : best, allPassRates[0])

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
        <header className={`page-header ${styles.pageHeader}`} style={{ paddingBottom: 0 }}>
          <h1 id="assembly-stats-heading">The Assembly at a glance</h1>
          <div className="page-header-rule"></div>
        </header>

        <p className={styles.assemblyStatement}>
          Since returning in February 2024, the Assembly has held{' '}
          <strong>{totalDivisions}</strong> votes.{' '}
          <strong>{overallPassRate}%</strong> of divisions passed.
          Unionist and nationalist MLAs voted Aye together on{' '}
          <strong>{overallAgreementRate}%</strong> of divisions.
        </p>

        <div className={styles.glanceBar}>
          <div className={styles.glanceCell}>
            <span className={styles.glanceCellLabel}>Total divisions</span>
            <span className={styles.glanceCellValue}>{totalDivisions}</span>
            <span className={styles.glanceCellMeta}>since Feb 2024</span>
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
            <span className={styles.glanceCellMeta}>2025–2026</span>
          </div>
          <div className={styles.glanceCell}>
            <span className={styles.glanceCellLabel}>Busiest year</span>
            <span className={styles.glanceCellValue}>{busiestYear?.year ?? '—'}</span>
            <span className={styles.glanceCellMeta}>{busiestYear?.total ?? 0} divisions</span>
          </div>
        </div>

      </section>

      <hr className="section-rule" />

      {/* 2. Member expenses */}
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
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{title}</h3>
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={row.personId} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <MlaPhoto
                    name={row.fullName}
                    imgUrl={row.imgUrl ?? ''}
                    size={52}
                    decorative
                  />
                  <div className={styles.info}>
                    <Link href={`/assembly/mlas/${row.personId}`} className={styles.name}>
                      {formatMemberName(row.fullName)}
                    </Link>
                    {row.party && (
                      <span
                        className={styles.partyPill}
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
                <p className={styles.sectionEyebrow}>Public spending</p>
                <a href="https://www.niassembly.gov.uk/your-mlas/members-salaries-and-expenses/" target="_blank" rel="noopener noreferrer" className={styles.expensesSourceLink}>
                  Official source
                </a>
              </div>
              <h2 id="expenses-heading" className={styles.sectionTitle}>Member expenses</h2>
              <div className={styles.sectionRule}></div>
            </div>
            <p className={styles.expensesMeta}>
              {periodLabel}
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
            <Link href="/assembly/expenses" className={styles.expensesRankingsCard}>
              <span className={styles.expensesRankingsCardText}>View full MLA expenses rankings</span>
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
                        <th scope="col"></th>
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
              )
            })()}

            <div className={styles.expensesCardGrid}>
              <ExpensesCard title="Most expenses claimed" rows={top5} />
              <ExpensesCard title="Least expenses claimed" rows={bottom5} />
            </div>
          </section>
        )
      })()}

      <hr className="section-rule" />

      {/* 3. Individual performance */}
      <section aria-labelledby="mla-stats-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Individual performance</p>
          <h2 id="mla-stats-heading" className={styles.sectionTitle}>MLA Voting</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>Who shows up, who votes Aye and who votes No. The top and bottom 5 MLAs ranked.</p>
        </div>
        <StatsRankingTabs data={leaderboard} />
      </section>

      <hr className="section-rule" />

      {/* 4. Party behaviour */}
      <section aria-labelledby="patterns-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Party behaviour</p>
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
                  <th scope="col"></th>
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
                  <span className={styles.patternNote}>The division where unionist and nationalist MLAs voted Aye together most unanimously.</span>
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
                  <MlaPhoto name={rebelliousMla.fullName} imgUrl={rebelliousMla.imgUrl ?? ''} size={64} decorative />
                  <div className={styles.rebelliousInfo}>
                    <Link href={`/assembly/mlas/${rebelliousMla.personId}`} className={styles.patternName}>
                      {formatMemberName(rebelliousMla.fullName)}
                    </Link>
                    <span
                      className={styles.partyPill}
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
          <p className={styles.sectionEyebrow}>Sitting and voting patterns</p>
          <h2 id="productivity-heading" className={styles.sectionTitle}>Assembly activity</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>How active the Assembly has been since returning in February 2024.</p>
        </div>
        <AssemblyProductivityClient monthData={divisionsPerMonth} yearData={passRateByYear} />
      </section>

      <hr className="section-rule" />

      {/* 6. Cross-community voting */}
      <section aria-labelledby="cross-community-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Unionist and nationalist blocs</p>
          <h2 id="cross-community-heading" className={styles.sectionTitle}>Cross-community voting</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>How often unionist and nationalist MLAs both voted Aye on the same division.</p>
          <p className={styles.sectionCaveat}>* Figures cover divisions where a formal vote was called. Items passed without division are not included.</p>
        </div>
        <CrossCommunityTrendsClient data={crossCommunityTrends} />
      </section>

    </div>
  )
}
