'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, partyFilterActiveStyle, formatConstituency } from '@/lib/format'
import styles from './questions.module.css'

export interface QuestionRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  total: number
}

interface Props {
  rows: QuestionRow[]
  totalMlaCount: number
}



const PARTIES = [
  'Democratic Unionist Party',
  'Sinn Féin',
  'Ulster Unionist Party',
  'Alliance Party',
  'Social Democratic and Labour Party',
  'Traditional Unionist Voice',
  'People Before Profit Alliance',
  'Independent',
]

function partyLabel(party: string): string {
  return abbreviateParty(party) || party
}

export default function QuestionsRankingClient({ rows, totalMlaCount }: Props) {
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const router = useRouter()

  const filtered = partyFilter === 'ALL'
    ? rows
    : rows.filter(r => r.party === partyFilter)

  const visible = filtered
  const maxTotal = rows[0]?.total ?? 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
  }

  const displayCount = partyFilter === 'ALL' ? totalMlaCount : filtered.length

  return (
    <>
      <h2 className={styles.mobileRankingsTitle}>Rankings</h2>

      <div className={`${styles.filterRow} ${styles.filterRowDesktop}`} role="group" aria-label="Filter by party">
        <button
          className={`${styles.filterBtn} ${partyFilter === 'ALL' ? `${styles.filterBtnActive} ${styles.filterBtnActiveAll}` : ''}`}
          onClick={() => handlePartyFilter('ALL')}
          aria-pressed={partyFilter === 'ALL'}
        >
          All parties
        </button>
        {PARTIES.map(party => {
          const isActive = partyFilter === party
          const activeStyle = isActive ? partyFilterActiveStyle(party) : null
          return (
            <button
              key={party}
              className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ''}`}
              style={activeStyle ? {
                background: activeStyle.background,
                color: activeStyle.color,
                borderColor: activeStyle.borderColor,
              } : undefined}
              onClick={() => handlePartyFilter(party)}
              aria-pressed={isActive}
            >
              {partyLabel(party)}
            </button>
          )
        })}
      </div>

      <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
        <strong>{displayCount}</strong>{' '}
        <span className={styles.resultCountDesktop}>{partyFilter === 'ALL' ? 'current' : partyLabel(partyFilter)} MLA{displayCount !== 1 ? 's' : ''} with questions on record</span>
        <span className={styles.resultCountMobile}>MLA{displayCount !== 1 ? 's' : ''}</span>
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="MLA questions ranked table">
          <colgroup>
            <col className={styles.colRank} />
            <col className={styles.colMla} />
            <col className={`${styles.colParty} ${styles.hideMobile}`} />
            <col className={`${styles.colConstituency} ${styles.hideMobile} ${styles.hideTablet}`} />
            <col className={styles.colQuestions} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.colRank}>#</th>
              <th scope="col">MLA</th>
              <th scope="col" className={styles.hideMobile}>Party</th>
              <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Constituency</th>
              <th scope="col">Questions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const barPct = maxTotal > 0 ? Math.round(row.total / maxTotal * 100) : 0
              const globalRank = i + 1
              const isTop = i === 0

              return (
                <tr
                  key={row.personId}
                  className={`${styles.tableRow} ${isTop ? styles.rowGold : ''}`}
                  onClick={() => router.push(`/assembly/mlas/${row.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={styles.tdRank} aria-label={`Rank ${globalRank}`}>{globalRank}</td>

                  <td>
                    <div className={styles.mlaCell}>
                      <span className={styles.photoDesktop}>
                        <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={36} decorative square />
                      </span>
                      <span className={styles.photoMobile}>
                        <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={50} decorative square />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          href={`/assembly/mlas/${row.personId}`}
                          className={styles.mlaName}
                          aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}${row.constituency ? `, ${formatConstituency(row.constituency)}` : ''}`}
                        >
                          {formatMemberName(row.fullName)}
                        </Link>
                        {row.party && partyFilter === 'ALL' && (
                          <span
                            className={`party-pill ${styles.mobilePill}`}
                            data-party={abbreviateParty(row.party)}
                          >
                            <PartyName party={row.party} />
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className={`${styles.tdParty} ${styles.hideMobile}`}>
                    {row.party && (
                      <span className="party-pill" data-party={abbreviateParty(row.party)}>
                        <PartyName party={row.party} />
                      </span>
                    )}
                  </td>

                  <td className={`${styles.tdConstituency} ${styles.hideMobile} ${styles.hideTablet}`}>
                    {row.constituency ? formatConstituency(row.constituency) : '—'}
                  </td>

                  <td className={styles.tdQuestions}>
                    <div className={styles.questionsInner}>
                      <div className={styles.barTrack} aria-hidden="true">
                        <div
                          className={styles.barFill}
                          style={{ width: `${barPct}%`, background: partyBorderColor(row.party) }}
                        />
                      </div>
                      <span className={styles.questionsValue}>{row.total.toLocaleString()}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </>
  )
}
