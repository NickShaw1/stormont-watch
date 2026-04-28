export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import ExpensesListClient from './ExpensesListClient'
import MissingMlasTable from './MissingMlasTable'
import styles from './expenses.module.css'

export const metadata: Metadata = {
  title: 'MLA Expenses',
  description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
  openGraph: {
    title: 'MLA Expenses — Stormont Watch',
    description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/expenses' },
}

export default async function ExpensesPage() {
  const [allRows, missing] = await Promise.all([
    getAllExpensesLeagueTable(),
    getMlasWithoutExpenses(),
  ])

  const years = [...new Set(allRows.map(r => r.financialYear as string))].sort((a, b) => b.localeCompare(a))
  const latestYear = years[0] ?? null

  const mappedRows = allRows.map(r => ({
    personId: r.personId as string,
    fullName: r.fullName as string,
    party: r.party as string | null,
    constituency: r.constituency as string | null,
    imgUrl: r.imgUrl as string | null,
    mandateStart: r.mandateStart as string | null,
    total: r.total as string | null,
    period: r.period as string | null,
    financialYear: r.financialYear as string,
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

      <ExpensesListClient rows={mappedRows} years={years} latestYear={latestYear} />
    </div>
  )
}
