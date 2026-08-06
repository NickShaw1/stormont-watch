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
import salaryStyles from './salaries.module.css'

export interface SalaryRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateStart: string | null
  currentSalary: number
  mandateEarnings: number
}

interface Props {
  bySalary: SalaryRow[]
  byEarnings: SalaryRow[]
}




type SortMode = 'salary' | 'earnings'

export default function SalariesListClient({ bySalary, byEarnings }: Props) {
  const PARTIES = orderedParties(bySalary)
  const { mandate, basePath } = useMandate()
  const [sortMode, setSortMode] = useState<SortMode>('salary')
  const [partyFilter, setPartyFilter] = useState('ALL')

  const baseRows = sortMode === 'salary' ? bySalary : byEarnings
  const filtered = partyFilter === 'ALL' ? baseRows : baseRows.filter(r => r.party === partyFilter)
  const visible = filtered
  const maxVal = baseRows[0] ? (sortMode === 'salary' ? baseRows[0].currentSalary : baseRows[0].mandateEarnings) : 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
  }

  function handleSort(mode: SortMode) {
    setSortMode(mode)
  }

  const colLabel = sortMode === 'salary' ? 'Current salary' : 'Mandate earnings'

  return (
    <>
      <div className={styles.filterPanel}>
        <div className={salaryStyles.sortRow} role="group" aria-label="Sort by">
          <button
            className={`${salaryStyles.sortBtn} ${sortMode === 'salary' ? salaryStyles.sortBtnActive : ''}`}
            onClick={() => handleSort('salary')}
            aria-pressed={sortMode === 'salary'}
          >
            Current salaries
          </button>
          <button
            className={`${salaryStyles.sortBtn} ${sortMode === 'earnings' ? salaryStyles.sortBtnActive : ''}`}
            onClick={() => handleSort('earnings')}
            aria-pressed={sortMode === 'earnings'}
          >
            <span className={salaryStyles.sortBtnLabelDesktop}>Overall mandate earnings</span>
            <span className={salaryStyles.sortBtnLabelMobile} aria-hidden="true">Overall earnings</span>
          </button>
        </div>

        <PartyFilterControls styles={styles} parties={PARTIES} active={partyFilter} onSelect={handlePartyFilter} />

        <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
          <Users className={styles.resultCountIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          <strong>{filtered.length}</strong> {partyFilter === 'ALL' ? sittingAdjective(mandate) : partyLabel(partyFilter)} MLA{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {(() => {
        const computed = visible.map((row) => {
          const val = sortMode === 'salary' ? row.currentSalary : row.mandateEarnings
          const barPct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0
          const globalI = filtered.indexOf(row)
          const prevVal = globalI > 0 ? (sortMode === 'salary' ? filtered[globalI - 1].currentSalary : filtered[globalI - 1].mandateEarnings) : null
          const isTied = prevVal !== null && prevVal === val
          const rank = filtered.slice(0, globalI).filter(r => (sortMode === 'salary' ? r.currentSalary : r.mandateEarnings) > val).length + 1
          const rankDisplay = isTied ? '=' : rank
          const isTop = rank === 1 && !isTied
          return { row, val, barPct, rank, rankDisplay, isTop }
        })

        return (
          <>
            <div className={styles.rankCardHead} aria-hidden="true">
              <span className={styles.rankCardHeadRank}>#</span>
              <span className={styles.rankCardHeadMain}>MLA</span>
              <span className={styles.rankCardHeadParty}>Party</span>
              <span className={styles.rankCardHeadConstituency}>Constituency</span>
              <span className={styles.rankCardHeadValue}>{colLabel}</span>
            </div>

            <div className={styles.rankCardList} role="list" aria-label="MLA salary ranked list">
              {computed.map(({ row, val, barPct, rankDisplay }) => (
                <Link
                  key={row.personId}
                  href={`${basePath}/assembly/mlas/${row.personId}`}
                  className={styles.rankCard}
                  aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}${row.constituency ? `, ${formatConstituency(row.constituency)}` : ''}`}
                >
                  <span className={styles.rankCardRank} aria-hidden="true">{rankDisplay}</span>
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
                    <span className={styles.rankCardValue}>{gbp(val)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )
      })()}

    </>
  )
}
