'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { PoundSterling, Wallet, Users, MapPin, ListChecks } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatConstituency, gbp } from '@/lib/format'
import type { PartyExpenseStats } from '@/lib/db/queries'
import styles from './partyDetail.module.css'
import { useMandate } from '@/components/MandateContext'

interface PartyExpensesProps {
  expenses: PartyExpenseStats
  mandateExpenses: { mandateTotal: number; mandateAvgPerMla: number; mlaCount: number; rankTotal: number; rankAvg: number; partyCount: number } | null
  partyColor: string
}

// Same 3-tier semantic scheme used on the Attendance/Chamber tabs and MLA detail page.
function rankColor(rank: number, total: number): string {
  const pctile = total > 1 ? (rank - 1) / (total - 1) : 0
  return pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function MlaExpenseRow({ mla, rankSub }: { mla: PartyExpenseStats['highestMla']; rankSub?: string }) {
  const { basePath } = useMandate()
  return (
    <Link href={`${basePath}/assembly/mlas/${mla.personId}`} className={styles.factRow}>
      <div className={styles.factRowPhoto}>
        <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={40} decorative square personId={mla.personId} />
      </div>
      <div className={styles.factRowInfo}>
        <span className={styles.factRowName}>{formatMemberName(mla.fullName)}</span>
        {mla.constituency && (
          <span className={styles.factRowConstituency}>{formatConstituency(mla.constituency)}</span>
        )}
        {!mla.isCurrent && (
          <span className={styles.formerPill}>Former MLA</span>
        )}
      </div>
      <div className={styles.factRowValueCol}>
        <span className={styles.factRowValue}>{gbp(mla.total)}</span>
        {rankSub && <span className={styles.factRowSub}>{rankSub}</span>}
      </div>
    </Link>
  )
}

export default function PartyExpensesClient({ expenses, mandateExpenses, partyColor }: PartyExpensesProps) {
  const { mandate, basePath } = useMandate()
  const singleMla = expenses.mlas.length === 1
  const maxTotal = expenses.highestMla.total

  return (
    <div>
      {/* Mandate totals — tinted Key Figures-style stat strip (§4.1). */}
      {mandateExpenses && (
        <>
          <div className={`${styles.sectionHead} ${styles.sectionHeadWithSubtitle}`}>
            <span className={styles.sectionEyebrow}>This mandate</span>
            <h3 className={styles.sectionHeading}>
              <PoundSterling className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Total mandate expenses
            </h3>
            <span className={styles.sectionSubtitleTag}>{mandate.startLabel} - present</span>
          </div>
          <div className={`${styles.statStrip} ${styles.statStripTwo}`}>
            <div className={styles.statCard}>
              <div className={styles.statCardLabelRow}>
                <span className={styles.statCardLabel}>Total claimed</span>
                <Wallet className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.statCardValue}>{gbp(mandateExpenses.mandateTotal)}</span>
              <span className={styles.statCardSub}>all published years</span>
              <span className={styles.statCardSub} style={{ color: rankColor(mandateExpenses.rankTotal, mandateExpenses.partyCount) }}>{ordinal(mandateExpenses.rankTotal)} of {mandateExpenses.partyCount} parties</span>
            </div>
            <div className={styles.statCard} data-tone="amber">
              <div className={styles.statCardLabelRow}>
                <span className={styles.statCardLabel}>Average per MLA</span>
                <Users className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.statCardValue}>{gbp(mandateExpenses.mandateAvgPerMla)}</span>
              <span className={styles.statCardSub}>across {mandateExpenses.mlaCount} MLA{mandateExpenses.mlaCount !== 1 ? 's' : ''} (current &amp; former) with published data</span>
              <span className={styles.statCardSub} style={{ color: rankColor(mandateExpenses.rankAvg, mandateExpenses.partyCount) }}>{ordinal(mandateExpenses.rankAvg)} of {mandateExpenses.partyCount} parties</span>
            </div>
          </div>

          <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced} ${styles.sectionHeadWithSubtitle}`}>
            <span className={styles.sectionEyebrow}>This year</span>
            <h3 className={styles.sectionHeading}>
              <PoundSterling className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Latest published expenses
            </h3>
            <span className={`${styles.sectionSubtitleTag} ${styles.sectionSubtitleTagHideMobile}`}>{expenses.period}</span>
            <p className={styles.sectionSubtitle}>All current and former {expenses.mlas.length > 0 ? `${expenses.mlas.length} ` : ''}MLAs who claimed expenses in this financial year.</p>
          </div>
        </>
      )}

      {/* Coverage note — only shown when there's no mandate section (which already shows the period) */}
      {!mandateExpenses && (
        <p className={styles.sectionNote} style={{ marginTop: 0 }}>
          Figures shown cover {expenses.period}
        </p>
      )}

      {/* Row 1 — three tinted stat cards, like the homepage's Key Figures strip. */}
      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabelRow}>
            <span className={styles.statCardLabel}>Total expenses</span>
            <Wallet className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.statCardValue}>{gbp(expenses.partyTotal)}</span>
          <span className={styles.statCardSub}>All claims for {expenses.period}</span>
          <span className={styles.statCardSub} style={{ color: rankColor(expenses.rankTotal, expenses.partyCount) }}>{ordinal(expenses.rankTotal)} of {expenses.partyCount} parties</span>
        </div>
        <div className={styles.statCard} data-tone="amber">
          <div className={styles.statCardLabelRow}>
            <span className={styles.statCardLabel}>Average per MLA</span>
            <Users className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.statCardValue}>{gbp(expenses.avgPerMla)}</span>
          <span className={styles.statCardSub}>Per MLA who claimed</span>
          <span className={styles.statCardSub} style={{ color: rankColor(expenses.rankAvg, expenses.partyCount) }}>{ordinal(expenses.rankAvg)} of {expenses.partyCount} parties</span>
        </div>
        <div className={styles.statCard} data-tone="neutral">
          <div className={styles.statCardLabelRow}>
            <span className={styles.statCardLabel}>Registered visits</span>
            <MapPin className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.statCardValue}>{expenses.visitCount}</span>
          <span className={styles.statCardSub}>
            {expenses.visitCount === 0 ? 'None declared' : 'Declared in register of interests'}
          </span>
          {expenses.rankVisits && (
            <span className={styles.statCardSub} style={{ color: rankColor(expenses.rankVisits, expenses.partyCount) }}>{ordinal(expenses.rankVisits)} of {expenses.partyCount} parties</span>
          )}
        </div>
      </div>

      {/* Row 2 — Highest/Lowest MLA, two half-width plain-bordered cards. */}
      <div className={`${styles.rankPanelGrid} ${styles.subHeadingSpaced}`}>
        <div className={styles.rankPanel}>
          <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-success)' } as CSSProperties}>
            <span className={styles.factRankLabel} style={{ color: 'var(--sw-success)' }}>↑ Highest</span>
            <MlaExpenseRow mla={expenses.highestMla} />
          </div>
        </div>
        {!singleMla && (
          <div className={styles.rankPanel}>
            <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-error)' } as CSSProperties}>
              <span className={styles.factRankLabel} style={{ color: 'var(--sw-error)' }}>↓ Lowest</span>
              <MlaExpenseRow mla={expenses.lowestMla} />
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced} ${styles.sectionHeadWithSubtitle}`}>
        <span className={styles.sectionEyebrow}>Rankings</span>
        <h3 className={styles.sectionHeading}>
          <ListChecks className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          MLA expenses, ranked highest to lowest
        </h3>
        <p className={styles.sectionSubtitle}>
          All current and former {expenses.mlas.length} MLAs who claimed expenses in {expenses.period}, ranked by total amount claimed.
        </p>
      </div>
      <div className={styles.barRowList}>
        {expenses.mlas.map((mla, i) => {
          const barPct = maxTotal > 0 ? Math.round(mla.total / maxTotal * 100) : 0
          return (
            <Link
              key={mla.personId}
              href={`${basePath}/assembly/mlas/${mla.personId}`}
              className={styles.barRow}
            >
              <span className={styles.barRowRank}>{i + 1}</span>
              <div className={styles.barRowPhoto}>
                <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={36} decorative square personId={mla.personId} />
              </div>
              <div className={styles.barRowInfo}>
                <span className={styles.barRowName}>{formatMemberName(mla.fullName)}</span>
                {mla.constituency && (
                  <span className={`${styles.barRowConstituency} ${styles.barRowConstituencyHideMobile}`}>
                    {formatConstituency(mla.constituency)}
                  </span>
                )}
                {!mla.isCurrent && (
                  <span className={styles.formerPill}>Former MLA</span>
                )}
              </div>
              <div className={styles.barRowBarWrap}>
                <div className={styles.barRowTrack} aria-hidden="true">
                  <div
                    className={styles.barRowFill}
                    style={{ width: `${barPct}%`, background: partyColor }}
                  />
                </div>
                <span className={styles.barRowValue}>{gbp(mla.total)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
