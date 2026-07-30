'use client'

import { useState } from 'react'
import { ChevronDown, Handshake } from 'lucide-react'
import type { AgreedDivisionRow } from '@/lib/db/queries'
import PartyDivisionList from './PartyDivisionList'
import styles from './stats.module.css'

interface Props {
  title: string
  agreePct: number
  agreed: number
  totalDivisions: number
  items: { label: string; value: number }[]
  /** Overrides the default teal bar. */
  barColor?: string
  /** When present, adds an expand button revealing the divisions behind agreePct. */
  expandable?: {
    partyA: string
    partyB: string
    divisions: AgreedDivisionRow[]
    basePath?: string
  }
}

export default function AgreementCard({ title, agreePct, agreed, totalDivisions, items, barColor, expandable }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.partyRankingCard}>
      <p className={styles.partyRankingTitle}>
        {title}
        <Handshake className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </p>

      <div className={styles.bigTwoValueRow}>
        <span className={styles.patternBigValue}>{agreePct}%</span>
        <span className={styles.bigTwoMeta}>
          {agreed} of {totalDivisions} divisions
        </span>
      </div>

      <div className={styles.bigTwoBarTrack} aria-hidden="true">
        <div
          className={styles.bigTwoBarFill}
          style={{ width: `${agreePct}%`, ...(barColor ? { background: barColor } : {}) }}
        />
      </div>

      <dl className={styles.bigTwoBreakdown}>
        {items.map((item) => (
          <div key={item.label} className={styles.bigTwoBreakdownItem}>
            <dt>{item.label}</dt>
            <dd className={styles.bigTwoBreakdownValue}>{item.value}</dd>
          </div>
        ))}
      </dl>

      {expandable && (
        <>
          <button
            className={styles.agreementExpandBtn}
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Hide divisions' : 'View divisions'}</span>
            <ChevronDown className={`${styles.rowExpandChevron} ${expanded ? styles.rowExpandChevronOpen : ''}`} size={16} strokeWidth={2.25} aria-hidden="true" />
          </button>
          {expanded && (
            <div className={styles.agreementExpandPanel}>
              <PartyDivisionList
                partyA={expandable.partyA}
                partyB={expandable.partyB}
                divisions={expandable.divisions}
                basePath={expandable.basePath}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
