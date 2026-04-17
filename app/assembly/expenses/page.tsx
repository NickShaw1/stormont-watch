import type { Metadata } from 'next'
import Link from 'next/link'
import { getExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import ExpensesListClient from './ExpensesListClient'
import MissingMlasTable from './MissingMlasTable'
import styles from './expenses.module.css'

export const revalidate = 86400

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
      <header className={`page-header ${styles.pageHeader}`}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">MLA expenses</li>
          </ol>
        </nav>
        <h1>MLA expenses</h1>
        <div className="page-header-rule"></div>
        <p className={styles.subtitle}>Every current MLA ranked by total expenses claimed from public funds.</p>
        <div className={styles.periodCard}>
          <svg className={styles.periodIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="10" fill="#203F59"/>
            <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
            <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
          </svg>
          <p>Figures cover <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>April 2025 – December 2025</strong>. Updates automatically when new data is published.</p>
        </div>
      </header>

      {missing.length > 0 && (
        <div className={styles.missingSection} role="note" aria-label="MLAs with no expenses on record">
          <h2 className={styles.missingHeading}>
            {missing.length} MLA{missing.length !== 1 ? 's' : ''} {missing.length !== 1 ? 'have' : 'has'} no expenses on record for this period
          </h2>
          <div className={styles.tableWrap}>
            <MissingMlasTable missing={missing} />
          </div>
          <div className="note-card">
            <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p>Co-opted or elected after the period covered by this data.</p>
          </div>
        </div>
      )}

      <ExpensesListClient rows={mappedRows} totalMlaCount={mappedRows.length} />
    </div>
  )
}
