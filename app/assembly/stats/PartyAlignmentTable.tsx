'use client'

import { useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import { abbreviateParty, partyBorderColor } from '@/lib/format'
import type { PartyAlignmentRow, PartyAgreedDivisions } from '@/lib/db/queries'
import PartyDivisionList from './PartyDivisionList'
import styles from './stats.module.css'

interface Props {
  data: PartyAlignmentRow[]
  agreedDivisions: PartyAgreedDivisions[]
  tableKey: 'sf' | 'dup'
  title: string
  partnerParty: string
  basePath?: string
}

export default function PartyAlignmentTable({ data, agreedDivisions, tableKey, title, partnerParty, basePath = '' }: Props) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())

  const getAgreed = (r: PartyAlignmentRow) => (tableKey === 'sf' ? r.sfAgreed : r.dupAgreed)
  const getPct = (r: PartyAlignmentRow) => (tableKey === 'sf' ? r.sfAgreePct : r.dupAgreePct)
  const divisionsByParty = new Map(agreedDivisions.map(p => [p.party, tableKey === 'sf' ? p.sfAgreed : p.dupAgreed]))

  const sorted = [...data].sort((a, b) => getPct(b) - getPct(a))

  function toggleRow(party: string) {
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(party)) next.delete(party)
      else next.add(party)
      return next
    })
  }

  return (
    <div className={styles.partyRankingCard}>
      <p className={styles.partyRankingTitle}>
        {title}
        <Users className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </p>
      <ul className={styles.partyRankingSubtitleList}>
        <li>Number of divisions where the party&apos;s majority position matched {partnerParty}&apos;s, and what share of all divisions that is.</li>
        <li>Click a party to see the divisions behind its figures.</li>
      </ul>
      <div className={styles.alignRowHead} aria-hidden="true">
        <span />
        <span>Party</span>
        <span>Divisions</span>
        <span />
        <span>%</span>
        <span />
      </div>
      <div className={styles.alignRowList}>
        {sorted.map((row, i) => {
          const color = partyBorderColor(row.party)
          const barPct = Math.round((getPct(row) / 100) * 100)
          const isOpen = openRows.has(row.party)
          const divisions = divisionsByParty.get(row.party) ?? []
          return (
            <div key={row.party} className={styles.alignRowCard}>
              <button
                type="button"
                className={styles.alignRowTrigger}
                onClick={() => toggleRow(row.party)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Hide' : 'Show'} divisions where ${abbreviateParty(row.party)} agreed with ${partnerParty}`}
              >
                <span className={styles.partyRankingRank}>{i + 1}</span>
                <span className={styles.alignRowParty}>
                  <span className={styles.partyDot} style={{ background: color }} aria-hidden="true" />
                  {abbreviateParty(row.party)}
                </span>
                <span className={styles.alignRowDivisions}>{getAgreed(row)}</span>
                <span className={styles.alignRowBarCell}>
                  <span className={styles.partyRankingBarTrack} aria-hidden="true">
                    <span className={styles.partyRankingBarFill} style={{ width: `${barPct}%`, background: color }} />
                  </span>
                </span>
                <span className={styles.alignRowPct}>{getPct(row)}%</span>
                <span className={styles.rowExpandChevronBtn}>
                  <ChevronDown className={`${styles.rowExpandChevron} ${isOpen ? styles.rowExpandChevronOpen : ''}`} size={16} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </button>
              {isOpen && (
                <div className={styles.rowExpandPanel}>
                  <PartyDivisionList partyA={abbreviateParty(row.party)} partyB={partnerParty} divisions={divisions} basePath={basePath} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
