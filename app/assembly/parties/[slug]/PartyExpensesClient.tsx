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

function MlaExpenseRow({ mla, rankSub }: { mla: PartyExpenseStats['highestMla']; rankSub?: string }) {
  return (
    <Link href={`/assembly/mlas/${mla.personId}`} className={styles.expMlaRow}>
      <div className={styles.statMlaPhoto}>
        <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={40} decorative square />
      </div>
      <div className={styles.expMlaInfo}>
        <span className={styles.expMlaName}>{formatMemberName(mla.fullName)}</span>
        {mla.constituency && (
          <span className={styles.expMlaSub}>{formatConstituency(mla.constituency)}</span>
        )}
      </div>
      <div className={styles.expMlaRight}>
        <span className={styles.expMlaAmount}>{gbp(mla.total)}</span>
        {rankSub && <span className={styles.expMlaSub}>{rankSub}</span>}
      </div>
    </Link>
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
      <div className={styles.expCardGrid}>
        {/* Left card — Total + Highest/Lowest */}
        <div className={styles.expCard}>
          <span className={styles.expMetricLabel}>Total expenses</span>
          <span className={styles.expMetricValue}>{gbp(expenses.partyTotal)}</span>
          <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankTotal, expenses.partyCount) }}>{ordinal(expenses.rankTotal)} of {expenses.partyCount} parties</span>
          <hr className={styles.expDivider} />
          {singleMla ? (
            <MlaExpenseRow mla={expenses.highestMla} />
          ) : (
            <>
              <span className={styles.expSectionLabelHigh}>↑ Highest</span>
              <MlaExpenseRow mla={expenses.highestMla} />
              <div className={styles.statMlaSep} />
              <span className={styles.expSectionLabelLow}>↓ Lowest</span>
              <MlaExpenseRow mla={expenses.lowestMla} />
            </>
          )}
        </div>

        {/* Right card — Average + Visits */}
        <div className={styles.expCardRight}>
          <div className={styles.expMiniCard}>
            <span className={styles.expMetricLabel}>Average per MLA</span>
            <span className={styles.expMetricValue}>{gbp(expenses.avgPerMla)}</span>
            <span className={styles.expMetricSub}>Per current MLA</span>
            <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankAvg, expenses.partyCount) }}>{ordinal(expenses.rankAvg)} of {expenses.partyCount} parties</span>
          </div>
          <div className={styles.expMiniCard}>
            <span className={styles.expMetricLabel}>Registered visits</span>
            <span className={styles.expMetricValue}>{expenses.visitCount}</span>
            <span className={styles.expMetricSub}>
              {expenses.visitCount === 0 ? 'None declared' : 'Declared in register of interests'}
            </span>
            {expenses.rankVisits && (
              <span className={styles.rankBadge} style={{ color: rankColor(expenses.rankVisits, expenses.partyCount) }}>{ordinal(expenses.rankVisits)} of {expenses.partyCount} parties</span>
            )}
          </div>
        </div>
      </div>

      <hr className="section-rule" />
      <h3 className={styles.statsHeading}>MLA Breakdown</h3>

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
