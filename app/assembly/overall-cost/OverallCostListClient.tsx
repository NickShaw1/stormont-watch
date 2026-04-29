'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, partyFilterActiveStyle, formatConstituency } from '@/lib/format'
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

const PAGE_SIZE = 25

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

function gbp(val: number) {
  return `£${Math.round(val).toLocaleString('en-GB')}`
}

function partyLabel(party: string) {
  return abbreviateParty(party) || party
}

export default function OverallCostListClient({ rows }: Props) {
  const [partyFilter, setPartyFilter] = useState('ALL')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const firstNewRef = useRef<HTMLTableRowElement | null>(null)
  const router = useRouter()

  const filtered = partyFilter === 'ALL' ? rows : rows.filter(r => r.party === partyFilter)
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const maxVal = rows[0]?.totalCost ?? 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
    setVisibleCount(PAGE_SIZE)
  }

  const handleLoadMore = useCallback(() => {
    setVisibleCount(c => c + 50)
    requestAnimationFrame(() => {
      if (firstNewRef.current) {
        firstNewRef.current.scrollIntoView({ block: 'start' })
        firstNewRef.current.focus({ preventScroll: true })
      }
    })
  }, [])

  return (
    <>
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
              style={activeStyle ? { background: activeStyle.background, color: activeStyle.color, borderColor: activeStyle.borderColor } : undefined}
              onClick={() => handlePartyFilter(party)}
              aria-pressed={isActive}
            >
              {partyLabel(party)}
            </button>
          )
        })}
      </div>

      <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
        <strong>{filtered.length}</strong> {partyFilter === 'ALL' ? 'current' : partyLabel(partyFilter)} MLA{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="MLA overall cost ranked table">
          <colgroup>
            <col className={styles.colRank} />
            <col className={styles.colMla} />
            <col className={`${styles.colParty} ${styles.hideMobile}`} />
            <col className={`${styles.colConstituency} ${styles.hideMobile} ${styles.hideTablet}`} />
            <col className={styles.colExpenses} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.colRank}>#</th>
              <th scope="col">MLA</th>
              <th scope="col" className={styles.hideMobile}>Party</th>
              <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Constituency</th>
              <th scope="col">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const barPct = maxVal > 0 ? Math.round(row.totalCost / maxVal * 100) : 0
              const isFirstNew = i === visibleCount - PAGE_SIZE && i > 0
              const isTop = i === 0

              return (
                <tr
                  key={row.personId}
                  className={`${styles.tableRow} ${isTop ? styles.rowGold : ''}`}
                  ref={isFirstNew ? firstNewRef : undefined}
                  tabIndex={isFirstNew ? -1 : undefined}
                  onClick={() => router.push(`/assembly/mlas/${row.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <th scope="row" className={styles.tdRank} aria-label={`Rank ${i + 1}`}>{i + 1}</th>

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
                          aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}`}
                        >
                          {formatMemberName(row.fullName)}
                        </Link>
                        {row.party && partyFilter === 'ALL' && (
                          <span className={`party-pill ${styles.mobilePill}`} data-party={abbreviateParty(row.party)}>
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

                  <td className={styles.tdExpenses}>
                    <div className={styles.expensesInner}>
                      <div className={styles.barTrack} aria-hidden="true">
                        <div
                          className={styles.barFill}
                          style={{ width: `${barPct}%`, background: partyBorderColor(row.party) }}
                        />
                      </div>
                      <span className={styles.expensesValue}>{gbp(row.totalCost)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button className={styles.loadMore} onClick={handleLoadMore} aria-label="Load more MLAs">
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </>
  )
}
