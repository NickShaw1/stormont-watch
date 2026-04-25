import type { Metadata } from 'next'
import Link from 'next/link'
import { getExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import ExpensesListClient from './ExpensesListClient'
import MissingMlasTable from './MissingMlasTable'
import styles from './expenses.module.css'


export const metadata: Metadata = {
  title: 'MLA Expenses',
  description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
  openGraph: {
    title: 'MLA Expenses — Stormont Watch',
    description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/expenses' },
}

export default async function ExpensesPage() {
  const [rows, missing] = await Promise.all([
    getExpensesLeagueTable(),
    getMlasWithoutExpenses(),
  ])

  const financialYear = rows[0]?.financialYear ?? null
  const period = rows[0]?.period ?? null

  const mappedRows = rows.map(r => ({
    personId: r.personId,
    fullName: r.fullName,
    party: r.party,
    constituency: r.constituency,
    imgUrl: r.imgUrl,
    mandateStart: r.mandateStart,
    total: r.total,
    period: r.period,
  }))

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">MLA expenses</li>
          </ol>
        </nav>
        <h1>MLA expenses</h1>
        <p className="lede">Expenses claimed by every MLA: office costs, travel, constituency support and staff salaries. Published by the Assembly Commission and made searchable here.</p>
      </header>

      {missing.length > 0 && (
        <div className={styles.missingSection} role="note" aria-label="MLAs with no expenses on record">
          <h2 className={styles.missingHeading}>
            {missing.length} MLA{missing.length !== 1 ? 's' : ''} {missing.length !== 1 ? 'have' : 'has'} no expenses on record for this period
          </h2>
          <div className={styles.tableWrap}>
            <MissingMlasTable missing={missing} />
          </div>
          <hr className="section-rule" />
        </div>
      )}

      {financialYear && period && (
        <p className={styles.coverageNote}>Figures shown cover <strong>{period}</strong> ({financialYear})</p>
      )}

      <ExpensesListClient rows={mappedRows} totalMlaCount={mappedRows.length} />
    </div>
  )
}
