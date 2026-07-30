import { PoundSterling, AlertTriangle } from 'lucide-react'
import { getAllExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import ExpensesListClient from './ExpensesListClient'
import MissingMlasTable from './MissingMlasTable'
import StatsBreadcrumb from '../stats/StatsBreadcrumb'
import styles from './expenses.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the expenses page — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function ExpensesPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [allRows, missing] = await Promise.all([
    getAllExpensesLeagueTable(mandate.id),
    getMlasWithoutExpenses(mandate.id),
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
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="MLA expenses" basePath={basePath} />
        <span className={styles.pageHeaderEyebrow}>Rankings</span>
        <h1 className={styles.pageHeaderTitle}>
          <PoundSterling className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          MLA expenses
        </h1>
        <p className={styles.lede}>Expenses claimed by every MLA: office costs, travel, constituency support and staff salaries.</p>
      </header>

      {missing.length > 0 && (
        <div className={styles.missingSection} role="note" aria-label="MLAs with no expenses on record">
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Data gap</span>
            <h2 className={styles.sectionHeading}>
              <AlertTriangle className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              No record
            </h2>
            <p className={styles.sectionSubtitle}>{missing.length} MLA{missing.length !== 1 ? 's' : ''} {missing.length !== 1 ? 'have' : 'has'} no expenses on record for this period.</p>
          </div>
          <MissingMlasTable missing={missing} />
        </div>
      )}

      <ExpensesListClient rows={mappedRows} years={years} latestYear={latestYear} />
    </div>
  )
}
