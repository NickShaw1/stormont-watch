'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import PartyFilterControls, { partyLabel } from '@/components/PartyFilterControls'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency, orderedParties, gbp } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { sittingAdjective } from '@/lib/constants/mandates'
import styles from '../expenses/expenses.module.css'

export interface CostRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateStart: string | null
  mandateEarnings: number
  totalExpenses: number
  totalCost: number
}

interface Props {
  rows: CostRow[]
}




export default function OverallCostListClient({ rows }: Props) {
  const PARTIES = orderedParties(rows)
  const { mandate, basePath } = useMandate()
  const [partyFilter, setPartyFilter] = useState('ALL')

  const filtered = partyFilter === 'ALL' ? rows : rows.filter(r => r.party === partyFilter)
  const visible = filtered
  const maxVal = rows[0]?.totalCost ?? 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
  }

  return (
    <>
      <div className={styles.filterPanel}>
        <PartyFilterControls styles={styles} parties={PARTIES} active={partyFilter} onSelect={handlePartyFilter} />

        <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
          <Users className={styles.resultCountIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          <strong>{filtered.length}</strong> {partyFilter === 'ALL' ? sittingAdjective(mandate) : partyLabel(partyFilter)} MLA{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className={styles.rankCardHead} aria-hidden="true">
        <span className={styles.rankCardHeadRank}>#</span>
        <span className={styles.rankCardHeadMain}>MLA</span>
        <span className={styles.rankCardHeadParty}>Party</span>
        <span className={styles.rankCardHeadConstituency}>Constituency</span>
        <span className={styles.rankCardHeadValue}>Total cost</span>
      </div>

      <div className={styles.rankCardList} role="list" aria-label="MLA overall cost ranked list">
        {visible.map((row, i) => {
          const barPct = maxVal > 0 ? Math.round(row.totalCost / maxVal * 100) : 0

          return (
            <Link
              key={row.personId}
              href={`${basePath}/assembly/mlas/${row.personId}`}
              className={styles.rankCard}
              aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}${row.constituency ? `, ${formatConstituency(row.constituency)}` : ''}`}
            >
              <span className={styles.rankCardRank} aria-hidden="true">{i + 1}</span>
              <div className={styles.rankCardMain}>
                <div className={styles.rankCardPhoto}>
                  <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={44} decorative square personId={row.personId} />
                </div>
                <div className={styles.rankCardInfo}>
                  <span className={styles.rankCardName}>{formatMemberName(row.fullName)}</span>
                  {row.party && (
                    <span className={`party-pill ${styles.mobilePill}`} data-party={abbreviateParty(row.party)}>
                      <PartyName party={row.party} />
                    </span>
                  )}
                </div>
              </div>

              <span className={styles.rankCardParty}>
                {row.party && (
                  <span className="party-pill" data-party={abbreviateParty(row.party)}>
                    <PartyName party={row.party} />
                  </span>
                )}
              </span>

              <span className={styles.rankCardConstituency}>
                {row.constituency ? formatConstituency(row.constituency) : '-'}
              </span>

              <span className={styles.rankCardValueCol}>
                <span className={styles.rankCardBarTrack} aria-hidden="true">
                  <span
                    className={styles.rankCardBarFill}
                    style={{ display: 'block', width: `${barPct}%`, background: partyBorderColor(row.party) }}
                  />
                </span>
                <span className={styles.rankCardValue}>{gbp(row.totalCost)}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
