'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, partyFilterActiveStyle, formatConstituency } from '@/lib/format'
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
  return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function partyLabel(party: string) {
  return abbreviateParty(party) || party
}

type SortMode = 'salary' | 'earnings'

export default function SalariesListClient({ bySalary, byEarnings }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('salary')
  const [partyFilter, setPartyFilter] = useState('ALL')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const firstNewRef = useRef<HTMLTableRowElement | null>(null)
  const router = useRouter()

  const baseRows = sortMode === 'salary' ? bySalary : byEarnings
  const filtered = partyFilter === 'ALL' ? baseRows : baseRows.filter(r => r.party === partyFilter)
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const maxVal = baseRows[0] ? (sortMode === 'salary' ? baseRows[0].currentSalary : baseRows[0].mandateEarnings) : 1

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
    setVisibleCount(PAGE_SIZE)
  }

  function handleSort(mode: SortMode) {
    setSortMode(mode)
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

  const colLabel = sortMode === 'salary' ? 'Current salary' : 'Mandate earnings'

  return (
    <>
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
        <table className={styles.table} aria-label="MLA salary ranked table">
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
              <th scope="col">
                <span className={salaryStyles.colLabelDesktop}>{colLabel}</span>
                <span className={salaryStyles.colLabelMobile} aria-hidden="true">Salary</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const val = sortMode === 'salary' ? row.currentSalary : row.mandateEarnings
              const barPct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0
              const globalI = filtered.indexOf(row)
              const prevVal = globalI > 0 ? (sortMode === 'salary' ? filtered[globalI - 1].currentSalary : filtered[globalI - 1].mandateEarnings) : null
              const isTied = prevVal !== null && prevVal === val
              const rank = filtered.slice(0, globalI).filter(r => (sortMode === 'salary' ? r.currentSalary : r.mandateEarnings) > val).length + 1
              const rankDisplay = isTied ? '=' : rank
              const isFirstNew = i === visibleCount - PAGE_SIZE && i > 0
              const isTop = rank === 1 && !isTied

              return (
                <tr
                  key={row.personId}
                  className={`${styles.tableRow} ${isTop ? styles.rowGold : ''}`}
                  ref={isFirstNew ? firstNewRef : undefined}
                  tabIndex={isFirstNew ? -1 : undefined}
                  onClick={() => router.push(`/assembly/mlas/${row.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <th scope="row" className={styles.tdRank} aria-label={`Rank ${rank}`}>{rankDisplay}</th>

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
                      <span className={styles.expensesValue}>{gbp(val)}</span>
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
