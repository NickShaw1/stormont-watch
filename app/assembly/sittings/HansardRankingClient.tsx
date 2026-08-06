'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import PartyFilterControls, { partyLabel } from '@/components/PartyFilterControls'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency, orderedParties } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { sittingAdjective } from '@/lib/constants/mandates'
import styles from './hansard-ranking.module.css'

export interface HansardRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  sittings: number
  debates: number
}

interface Props {
  rows: HansardRow[]
  metric: 'sittings' | 'debates'
  totalMlaCount: number
}




export default function HansardRankingClient({ rows, metric, totalMlaCount }: Props) {
  const PARTIES = orderedParties(rows)
  const { mandate, basePath } = useMandate()
  const [partyFilter, setPartyFilter] = useState<string>('ALL')

  const getValue = (r: HansardRow) => metric === 'sittings' ? r.sittings : r.debates

  const filtered = partyFilter === 'ALL'
    ? rows
    : rows.filter(r => r.party === partyFilter)

  const visible = filtered
  const maxVal = getValue(rows[0] ?? { sittings: 1, debates: 1 }) || 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
  }

  const displayCount = partyFilter === 'ALL' ? totalMlaCount : filtered.length
  const colLabel = metric === 'sittings' ? 'Sittings' : 'Topics'

  return (
    <>
      <div className={styles.filterPanel}>
        <PartyFilterControls styles={styles} parties={PARTIES} active={partyFilter} onSelect={handlePartyFilter} />

        <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
          <Users className={styles.resultCountIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          <strong>{displayCount}</strong>{' '}
          <span className={styles.resultCountDesktop}>{partyFilter === 'ALL' ? sittingAdjective(mandate) : partyLabel(partyFilter)} MLA{displayCount !== 1 ? 's' : ''} on record</span>
          <span className={styles.resultCountMobile}>MLA{displayCount !== 1 ? 's' : ''}</span>
        </p>
      </div>

      <div className={styles.rankCardHead} aria-hidden="true">
        <span className={styles.rankCardHeadRank}>#</span>
        <span className={styles.rankCardHeadMain}>MLA</span>
        <span className={styles.rankCardHeadParty}>Party</span>
        <span className={styles.rankCardHeadConstituency}>Constituency</span>
        <span className={styles.rankCardHeadValue}>{colLabel}</span>
      </div>

      <div className={styles.rankCardList} role="list" aria-label={`MLA ${colLabel.toLowerCase()} ranked list`}>
        {visible.map((row, i) => {
          const val = getValue(row)
          const barPct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0
          const globalRank = i + 1

          return (
            <Link
              key={row.personId}
              href={`${basePath}/assembly/mlas/${row.personId}`}
              className={styles.rankCard}
              aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}${row.constituency ? `, ${formatConstituency(row.constituency)}` : ''}`}
            >
              <span className={styles.rankCardRank} aria-hidden="true">{globalRank}</span>
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
                <span className={styles.rankCardValue}>{val.toLocaleString()}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
