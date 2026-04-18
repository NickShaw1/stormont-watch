'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, formatConstituency } from '@/lib/format'
import styles from './expenses.module.css'

interface MissingMla {
  person_id: string
  full_name: string
  party: string | null
  constituency: string | null
  img_url: string | null
  mandate_start: string | null
}

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

export default function MissingMlasTable({ missing }: { missing: MissingMla[] }) {
  const router = useRouter()

  return (
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
          <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`} title="Years and months of service since mandate start">Service</th>
          <th scope="col">Expenses</th>
        </tr>
      </thead>
      <tbody>
        {missing.map(mla => (
          <tr
            key={mla.person_id}
            className={styles.tableRow}
            style={{ cursor: 'pointer' }}
            onClick={() => router.push(`/assembly/mlas/${mla.person_id}`)}
          >
            <td className={styles.tdRank} style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</td>
            <td>
              <div className={styles.mlaCell}>
                <span className={styles.photoDesktop}>
                  <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={36} decorative square />
                </span>
                <span className={styles.photoMobile}>
                  <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={50} decorative square />
                </span>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/assembly/mlas/${mla.person_id}`} className={styles.mlaName}>
                    {formatMemberName(mla.full_name)}
                  </Link>
                  {mla.party && (
                    <span
                      className={`party-pill ${styles.mobilePill}`}
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
                <span className="party-pill" data-party={abbreviateParty(mla.party)}>
                  <PartyName party={mla.party} />
                </span>
              )}
            </td>
            <td className={`${styles.tdConstituency} ${styles.hideMobile} ${styles.hideTablet}`}>
              {mla.constituency ? formatConstituency(mla.constituency) : '—'}
            </td>
            <td className={`${styles.tdService} ${styles.hideMobile} ${styles.hideTablet}`}>
              {serviceLabel(mla.mandate_start)}
            </td>
            <td className={styles.tdExpenses}>
              <div className={styles.expensesInner}>
                <span className={styles.expensesValue} style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>No data</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
