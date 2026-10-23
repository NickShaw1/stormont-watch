import Link from 'next/link'
import { Wallet, Landmark, Banknote, PiggyBank, Users, Coins, Sigma, ScrollText, TrendingUp, TrendingDown, ArrowUpWideNarrow, ArrowDownWideNarrow, Building2, Calculator, ArrowRight } from 'lucide-react'
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
import PartyShare, { type ShareRow } from '../PartyShare'
import MoneyList, { type MoneyRow } from '../MoneyList'
import PhoneSections from '../PhoneSections'
import styles from '../statsKit.module.css'
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

  const toRows = <T extends { personId: string; fullName: string; party: string | null; imgUrl?: string | null; constituency?: string | null }>(rows: T[], value: (r: T) => string): MoneyRow[] =>
    rows.map(r => ({ personId: r.personId, fullName: r.fullName, party: r.party, imgUrl: r.imgUrl ?? null, constituency: r.constituency ?? null, value: value(r) }))
  const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  const partyTotals = (rows: { party: string | null; total: number; count: number }[]) => {
    const map: Record<string, { total: number; count: number }> = {}
    for (const r of rows) {
      if (!r.party) continue
      if (!map[r.party]) map[r.party] = { total: 0, count: 0 }
      map[r.party].total += r.total
      map[r.party].count += r.count
    }
    return map
  }

  const expenseGrand = [...expenseTotalsMap.values()].reduce((s, v) => s + v, 0)
  const salaryGrand = overallCostRows.reduce((s, r) => s + r.mandateEarnings, 0)
  const costGrand = overallCostRows.reduce((s, r) => s + r.totalCost, 0)
  const hasExpenses = expensesLeague.length > 0

  const assemblyTotal = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)
  const assemblyAvg = hasExpenses ? assemblyTotal / expensesLeague.length : 0
  const latestPeriod = expensesLeague.reduce((latest, row) => (row.financialYear > latest ? row.financialYear : latest), '')
  const periodLabel = expensesLeague.find(r => r.financialYear === latestPeriod)?.period ?? ''
  const yearTop5 = expensesLeague.slice(0, 5)
  const yearBottom5 = [...expensesLeague].slice(-5).reverse()
  const institutionalTotal = institutionalExpenses.reduce((sum, r) => sum + r.amount, 0)

  const byTotalYear = [...expensesByParty].sort((a, b) => b.party_total - a.party_total)

  const mandateExpMap = partyTotals(allMandateMembers.map(m => ({ party: m.party ?? null, total: expenseTotalsMap.get(m.personId) ?? 0, count: expenseTotalsMap.has(m.personId) ? 1 : 0 })))
  const mandateExpParties = Object.entries(mandateExpMap).filter(([, v]) => v.total > 0)
  const mandateExpByTotal = [...mandateExpParties].sort((a, b) => b[1].total - a[1].total)
  const mandateExpRows = allMandateMembers
    .filter(m => m.isCurrent && m.mandateStart && hasServedOneYear(m.mandateStart, today))
    .map(m => ({ personId: m.personId, fullName: m.fullName, party: m.party ?? null, imgUrl: `/mla-images/${m.personId}.jpg`, total: expenseTotalsMap.get(m.personId) ?? 0 }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  const costMap = partyTotals(overallCostRows.map(r => ({ party: r.party, total: r.totalCost, count: 1 })))
  const currentSeatsByParty: Record<string, number> = {}
  for (const m of allMandateMembers) {
    if (!m.party || !m.isCurrent) continue
    currentSeatsByParty[m.party] = (currentSeatsByParty[m.party] ?? 0) + 1
  }
  const costByTotal = Object.entries(costMap).sort((a, b) => b[1].total - a[1].total)

  const viewAll = (href: string, hideOnPhone = false) => (
    <Link href={`${basePath}${href}`} className={hideOnPhone ? `${styles.linkPill} ${styles.hideOnPhone}` : styles.linkPill}>View full rankings<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
  )
  const stat = (tone: string, Icon: typeof Coins, label: string, figure: React.ReactNode, sub: React.ReactNode) => (
    <li className={styles.hItem} key={label}>
      <div className={styles.hHead}><span className={`${styles.iconTile} ${tone}`}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>{label}</span></div>
      <span className={styles.hFigure}>{figure}</span>
      <span className={styles.hSub}>{sub}</span>
    </li>
  )

  const headlineItems = [
    ratesPublished && stat(styles.tnPurple, Sigma, 'Total mandate cost', money(costGrand), 'estimated salary plus expenses'),
    ratesPublished && stat(styles.tnBlue, Wallet, 'Estimated salaries', money(salaryGrand), `across the ${mandate.label} mandate`),
    hasExpenses && stat(styles.tnAmber, Coins, 'Expenses claimed', money(expenseGrand), 'all published years'),
  ].filter(Boolean)

  const rankPair = (id: string, tone: string, a: { title: string; Icon: typeof Coins; rows: MoneyRow[] }, b: { title: string; Icon: typeof Coins; rows: MoneyRow[] }, sub?: React.ReactNode) => (
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
  const tile = (id: string, Icon: typeof Coins, tone: string, title: string, sub: React.ReactNode, body: React.ReactNode) => (
    <section className={styles.tile} aria-labelledby={id}>
      <div className={styles.tileHead}>
        <span className={`${styles.iconTile} ${tone}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
        <div className={styles.tileTitles}>
          <h3 className={styles.tileTitle} id={id}>{title}</h3>
          {sub && <p className={styles.tileSub}>{sub}</p>}
        </div>
      </div>
      {body}
    </section>
  )

  const salaries = ratesPublished ? (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="salaries-heading">
      <div className="container">
        <div className={`${styles.sectionHead} ${styles.sectionHeadAction}`}>
          <div>
            <span className={styles.eyebrow}>Public spending</span>
            <h2 className={styles.h2} id="salaries-heading">Salaries</h2>
            <p className={styles.sectionSub}>Annual pay for {sittingAdjective(mandate)} MLAs, and estimated earnings across the mandate.</p>
          </div>
          {viewAll('/assembly/salaries', true)}
        </div>
        <div className={styles.stack}>
                    {rankPair('sal', styles.tnGreen, { title: 'Highest current salaries', Icon: Banknote, rows: toRows(salaryTop5, r => gbpSalary(r.currentSalary)) }, { title: 'Highest mandate earnings', Icon: PiggyBank, rows: toRows(earningsTop5, r => gbpSalary(r.mandateEarnings)) })}
        </div>
      </div>
    </section>
  ) : (
    <section className={`${styles.band} ${styles.bandTint}`}>
      <div className="container"><div className="notice-card">Salary and overall-cost figures for the {mandate.label} mandate are not yet available: the Assembly&apos;s published pay rates for this mandate have not been released.</div></div>
    </section>
  )

  const yearItems = [
    stat(styles.tnAmber, Coins, 'Total claimed', gbp(String(assemblyTotal)), `current MLAs, ${periodLabel}`),
    stat(styles.tnBlue, Calculator, 'Average per MLA', gbp(String(assemblyAvg)), `current MLAs who claimed, ${periodLabel}`),
    stat(styles.tnPurple, Users, 'Current and former', gbpFull(allMlaExpenses.total), `all ${allMlaExpenses.count} MLAs who claimed`),
    institutionalExpenses.length > 0 && stat(styles.tnTeal, Building2, 'Other Assembly costs', gbpFull(institutionalTotal), `not attributed to an MLA: ${institutionalExpenses.map(r => r.category).join(', ')}`),
  ].filter(Boolean)

  const yearShare: ShareRow[] = byTotalYear.map(r => ({ party: r.party, value: r.party_total, display: money(r.party_total), sub: `${money(r.per_mla_avg)} per MLA, ${r.mla_count} MLA${Number(r.mla_count) === 1 ? '' : 's'}` }))
  const mandateShare: ShareRow[] = mandateExpByTotal.map(([party, v]) => ({ party, value: v.total, display: money(v.total), sub: v.count > 0 ? `${money(v.total / v.count)} per MLA, ${v.count} MLA${Number(v.count) === 1 ? '' : 's'}` : 'No MLAs with data' }))
  const costShare: ShareRow[] = costByTotal.map(([party, v]) => {
    const seats = currentSeatsByParty[party] ?? 0
    return { party, value: v.total, display: money(v.total), sub: seats > 0 ? `${money(v.total / seats)} per seat, ${seats} seat${Number(seats) === 1 ? '' : 's'}` : `${v.count} MLA${Number(v.count) === 1 ? '' : 's'}` }
  })

  const expenses = hasExpenses ? (
    <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="expenses-heading">
      <div className="container">
        <div className={`${styles.sectionHead} ${styles.sectionHeadAction}`}>
          <div>
            <span className={styles.eyebrow}>Public spending</span>
            <h2 className={styles.h2} id="expenses-heading">Latest published expenses</h2>
            <p className={styles.sectionSub}>Expenses claimed in the most recently published financial year, {periodLabel}. Party figures include former MLAs; the rankings are {sittingAdjective(mandate)} MLAs only.</p>
          </div>
          {viewAll('/assembly/expenses', true)}
        </div>
        <div className={styles.stack}>
          <ul className={`${styles.headline} ${yearItems.length === 4 ? styles.headline4 : styles.headline3} ${styles.headlineMoney}`} aria-label="Latest year expenses">{yearItems}</ul>
          {byTotalYear.length >= 2 && tile('exp-party', Users, styles.tnIndigo, 'Where the claims go', `Each party's share of everything claimed in ${periodLabel}.`, <PartyShare rows={yearShare} label="Share of expenses claimed by party" />)}
                    {rankPair('exp', styles.tnCoral, { title: 'Most claimed', Icon: ArrowUpWideNarrow, rows: toRows(yearTop5, r => gbp(r.total)) }, { title: 'Least claimed', Icon: ArrowDownWideNarrow, rows: toRows(yearBottom5, r => gbp(r.total)) }, periodLabel)}
        </div>
      </div>
    </section>
  ) : null

  const mandateExpenses = hasExpenses && mandateExpParties.length > 0 ? (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="mandate-expenses-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Public spending</span>
          <h2 className={styles.h2} id="mandate-expenses-heading">Mandate expenses</h2>
          <p className={styles.sectionSub}>Everything claimed in every published financial year of the {mandate.label} mandate.</p>
        </div>
        <div className={styles.stack}>
          {tile('exp-mandate-party', ScrollText, styles.tnOrange, 'By party', "Each party's share, including former MLAs.", <PartyShare rows={mandateShare} label="Share of mandate expenses by party" />)}
                    {rankPair('expm', styles.tnCoral, { title: 'Highest mandate expenses', Icon: ArrowUpWideNarrow, rows: toRows(mandateExpRows.slice(0, 5), r => money(r.total)) }, { title: 'Lowest mandate expenses', Icon: ArrowDownWideNarrow, rows: toRows([...mandateExpRows].reverse().slice(0, 5), r => money(r.total)) }, `${sittingAdjective(mandate)} MLAs only, excluding anyone who joined within the last year.`)}
        </div>
      </div>
    </section>
  ) : null

  const cost = ratesPublished && overallCostRows.length > 0 ? (
    <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="cost-heading">
      <div className="container">
        <div className={`${styles.sectionHead} ${styles.sectionHeadAction}`}>
          <div>
            <span className={styles.eyebrow}>Public spending</span>
            <h2 className={styles.h2} id="cost-heading">Overall cost</h2>
            <p className={styles.sectionSub}>Estimated mandate salary plus all published expenses for current and former MLAs in the {mandate.label} mandate. Salary is estimated from each MLA&apos;s role history: the published annual salary for their highest-paid role on each day, paid for every day they held it.</p>
          </div>
          {viewAll('/assembly/overall-cost', true)}
        </div>
        <div className={styles.stack}>
          {tile('cost-party', Landmark, styles.tnIndigo, 'Cost by party', 'Some MLAs have no published expenses and contribute salary estimates only. Cost per seat divides by seats held now, not every MLA who has held one.', <PartyShare rows={costShare} label="Share of overall cost by party" />)}
                    {rankPair('cost', styles.tnPurple, { title: 'Highest public cost', Icon: TrendingUp, rows: toRows(mostCostly5, r => gbpFull(r.totalCost)) }, { title: 'Lowest public cost', Icon: TrendingDown, rows: toRows(leastCostly5, r => gbpFull(r.totalCost)) }, `${sittingAdjective(mandate)} MLAs only, excluding anyone who joined within the last year.`)}
        </div>
      </div>
    </section>
  ) : null

  const sections = [
    { key: 'salaries', label: 'Salaries', icon: 'wallet' as const, meta: 'Pay and earnings', node: salaries },
    expenses && { key: 'expenses', label: 'Latest expenses', icon: 'coins' as const, meta: 'Most recent financial year', node: expenses },
    mandateExpenses && { key: 'mandate', label: 'Mandate expenses', icon: 'wallet' as const, meta: 'Whole mandate', node: mandateExpenses },
    cost && { key: 'cost', label: 'Overall cost', icon: 'pound' as const, meta: 'Salary plus expenses', node: cost },
  ].filter((s): s is NonNullable<typeof s> => Boolean(s))

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="spending-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>Statistics</span>
            <h1 className={styles.h1} id="spending-title">Public spending</h1>
            <p className={styles.headSub}>Salaries, office expenses and overall public cost of the Assembly since {mandate.startLabel}.</p>
          </header>
          {headlineItems.length > 0 && <ul className={`${styles.headline} ${styles.headline3}`} aria-label="Headline figures">{headlineItems}</ul>}
        </div>
      </section>
      <PhoneSections sections={sections} />
    </div>
  )
}
