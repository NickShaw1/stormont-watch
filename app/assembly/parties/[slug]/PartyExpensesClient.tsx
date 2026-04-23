'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatConstituency } from '@/lib/format'
import type { PartyExpenseStats } from '@/lib/db/queries'
import styles from './partyDetail.module.css'

interface PartyExpensesProps {
  expenses: PartyExpenseStats
  partyColor: string
}

function gbp(val: number): string {
  return `£${Math.round(val).toLocaleString('en-GB')}`
}

function rankColor(rank: number, total: number): string {
  const hue = Math.round(((rank - 1) / Math.max(total - 1, 1)) * 120)
  return `hsl(${hue}, 60%, 38%)`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function MlaHighLowRow({ mla, direction }: { mla: PartyExpenseStats['highestMla']; direction: 'up' | 'down' }) {
  const color = direction === 'up' ? 'var(--forest)' : 'var(--crimson)'
  const arrow = direction === 'up' ? '↑' : '↓'
  return (
    <div className={styles.expHlRow}>
      <span className={styles.expHlArrow} style={{ color }}>{arrow}</span>
      <Link href={`/assembly/mlas/${mla.personId}`} className={styles.expHlName}>
        {formatMemberName(mla.fullName)}
      </Link>
      <span className={styles.expHlValue}>{gbp(mla.total)}</span>
    </div>
  )
}

export default function PartyExpensesClient({ expenses, partyColor }: PartyExpensesProps) {
  const router = useRouter()
  const singleMla = expenses.mlas.length === 1
  const maxTotal = expenses.highestMla.total

  return (
    <div className={styles.expSection}>
      {/* Coverage note */}
      <p className={styles.expCoverageNote}>
        <span className={styles.expHideMobile}>Figures shown cover </span><span className={styles.expShowMobile}>Figures for: </span><strong>{expenses.period}</strong>
      </p>

      {/* Metric cards */}
      <div className={styles.expMetricGrid}>
        {/* Total */}
        <div className={styles.expMetricCard}>
          <span className={styles.expMetricLabel}>Total expenses</span>
          <span className={styles.expMetricValue}>{gbp(expenses.partyTotal)}</span>
          <span className={`${styles.expMetricSub} ${styles.expHideMobile}`}>{expenses.financialYear}</span>
          <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankTotal, expenses.partyCount) }}>{ordinal(expenses.rankTotal)} of {expenses.partyCount} parties</span>
        </div>

        {/* Average */}
        <div className={styles.expMetricCard}>
          <span className={styles.expMetricLabel}>Average per MLA</span>
          <span className={styles.expMetricValue}>{gbp(expenses.avgPerMla)}</span>
          <span className={`${styles.expMetricSub} ${styles.expHideMobile}`}>Per current MLA</span>
          <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankAvg, expenses.partyCount) }}>{ordinal(expenses.rankAvg)} of {expenses.partyCount} parties</span>
        </div>

        {/* Highest / Lowest */}
        <div className={styles.expMetricCard}>
          <span className={styles.expMetricLabel}>Highest / Lowest</span>
          {singleMla ? (
            <span className={styles.expMetricValue}>{gbp(expenses.highestMla.total)}</span>
          ) : (
            <div className={styles.expHlStack}>
              <MlaHighLowRow mla={expenses.highestMla} direction="up" />
              <MlaHighLowRow mla={expenses.lowestMla} direction="down" />
            </div>
          )}
        </div>

        {/* Registered visits */}
        <div className={styles.expMetricCard}>
          <span className={styles.expMetricLabel}>Registered visits</span>
          <span className={styles.expMetricValue}>{expenses.visitCount}</span>
          <span className={styles.expMetricSub}>
            {expenses.visitCount === 0 ? 'None declared' : 'Declared in register of interests'}
          </span>
          <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankVisits, expenses.partyCount) }}>{ordinal(expenses.rankVisits)} of {expenses.partyCount} parties</span>
        </div>
      </div>

      {/* MLA table */}
      <div className={styles.expTableWrap}>
        <table className={styles.expTable}>
          <colgroup>
            <col className={styles.expColRank} />
            <col className={styles.expColMla} />
            <col className={`${styles.expColConstituency} ${styles.expHideMobile}`} />
            <col className={styles.expColExpenses} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.expColRank}>#</th>
              <th scope="col">MLA</th>
              <th scope="col" className={styles.expHideMobile}>Constituency</th>
              <th scope="col">
                <span className={styles.expHideMobile}>Expenses</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.mlas.map((mla, i) => {
              const barPct = maxTotal > 0 ? Math.round(mla.total / maxTotal * 100) : 0
              return (
                <tr
                  key={mla.personId}
                  className={styles.expTableRow}
                  onClick={() => router.push(`/assembly/mlas/${mla.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={styles.expTdRank} aria-label={`Rank ${i + 1}`}>{i + 1}</td>
                  <td>
                    <div className={styles.expMlaCell}>
                      <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={36} decorative square />
                      <Link href={`/assembly/mlas/${mla.personId}`} className={styles.expMlaName}>
                        {formatMemberName(mla.fullName)}
                      </Link>
                    </div>
                  </td>
                  <td className={`${styles.expTdConstituency} ${styles.expHideMobile}`}>
                    {mla.constituency ? formatConstituency(mla.constituency) : '—'}
                  </td>
                  <td className={styles.expTdExpenses}>
                    <div className={styles.expExpensesInner}>
                      <div className={styles.expBarTrack} aria-hidden="true">
                        <div
                          className={styles.expBarFill}
                          style={{ width: `${barPct}%`, background: partyColor }}
                        />
                      </div>
                      <span className={styles.expExpensesValue}>{gbp(mla.total)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
