import type { Metadata } from 'next'
import Link from 'next/link'
import { getExpensesLeagueTable, getMlasWithoutExpenses } from '@/lib/db/queries'
import ExpensesListClient from './ExpensesListClient'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, formatConstituency } from '@/lib/format'

function serviceLabel(mandateStart: string | null): string {
  if (!mandateStart) return '—'
  const start = new Date(mandateStart)
  const now = new Date()
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}
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
        <p className={styles.periodLabel}>Figures cover <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>April 2025 – December 2025</strong>. Updates automatically when new data is published.</p>
      </header>

      {missing.length > 0 && (
        <div className={styles.missingSection} role="note" aria-label="MLAs with no expenses on record">
          <h2 className={styles.missingHeading}>
            {missing.length} MLA{missing.length !== 1 ? 's' : ''} {missing.length !== 1 ? 'have' : 'has'} no expenses on record for this period
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="MLAs with no expenses">
              <colgroup>
                <col className={styles.colRank} />
                <col className={styles.colMla} />
                <col className={`${styles.colParty} ${styles.hideMobile}`} />
                <col className={`${styles.colConstituency} ${styles.hideMobile} ${styles.hideTablet}`} />
                <col className={`${styles.colService} ${styles.hideMobile} ${styles.hideTablet}`} />
                <col className={styles.colExpenses} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">MLA</th>
                  <th scope="col" className={styles.hideMobile}>Party</th>
                  <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Constituency</th>
                  <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Service</th>
                  <th scope="col">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {missing.map(mla => (
                  <tr key={mla.person_id} className={styles.tableRow} style={{ cursor: 'default' }}>
                    <td className={styles.tdRank} style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</td>
                    <td>
                      <div className={styles.mlaCell}>
                        <span className={styles.photoDesktop}>
                          <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={36} decorative />
                        </span>
                        <span className={styles.photoMobile}>
                          <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={50} decorative />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/assembly/mlas/${mla.person_id}`} className={styles.mlaName} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {formatMemberName(mla.full_name)}
                          </Link>
                          {mla.party && (
                            <span
                              className={`${styles.partyPill} ${styles.mobilePill}`}
                              data-party={abbreviateParty(mla.party)}
                            >
                              <PartyName party={mla.party} />
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`${styles.tdParty} ${styles.hideMobile}`}>
                      {mla.party && (
                        <span className={styles.partyPill} data-party={abbreviateParty(mla.party)}>
                          <PartyName party={mla.party} />
                        </span>
                      )}
                    </td>
                    <td className={`${styles.tdConstituency} ${styles.hideMobile} ${styles.hideTablet}`}>
                      {mla.constituency ? formatConstituency(mla.constituency) : '—'}
                    </td>
                    <td className={`${styles.tdService} ${styles.hideMobile} ${styles.hideTablet}`}>{serviceLabel(mla.mandate_start)}</td>
                    <td className={styles.tdExpenses}>
                      <div className={styles.expensesInner}>
                        <span className={styles.expensesValue} style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>No data</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.missingFooter}>* Co-opted or elected after the period covered by this data.</p>
        </div>
      )}

      <ExpensesListClient rows={mappedRows} totalMlaCount={mappedRows.length + missing.length} />
    </div>
  )
}
