'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, partyFilterActiveStyle, formatConstituency } from '@/lib/format'
import styles from './expenses.module.css'

export interface ExpenseRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateStart: string | null
  total: string | null
  period: string | null
  financialYear: string
}

interface Props {
  rows: ExpenseRow[]
  years: string[]
  latestYear: string | null
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

function gbp(val: string | null | undefined) {
  return `£${parseFloat(val ?? '0').toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function serviceMonths(mandateStart: string | null): number {
  if (!mandateStart) return 0
  const start = new Date(mandateStart)
  const now = new Date()
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

function serviceLabel(mandateStart: string | null): string {
  if (!mandateStart) return '—'
  const total = serviceMonths(mandateStart)
  const years = Math.floor(total / 12)
  const months = total % 12
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}

function partyLabel(party: string): string {
  return abbreviateParty(party) || party
}

const OVERALL = 'overall'

function buildOverallRows(rows: ExpenseRow[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>()
  for (const r of rows) {
    if (!map.has(r.personId)) {
      map.set(r.personId, { ...r })
    } else {
      const existing = map.get(r.personId)!
      const newTotal = (parseFloat(existing.total ?? '0') + parseFloat(r.total ?? '0')).toFixed(2)
      map.set(r.personId, { ...existing, total: newTotal })
    }
  }
  return [...map.values()].sort((a, b) => parseFloat(b.total ?? '0') - parseFloat(a.total ?? '0'))
}

export default function ExpensesListClient({ rows, years }: Props) {
  const [selectedYear, setSelectedYear] = useState<string>(OVERALL)
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false)
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const firstNewRef = useRef<HTMLTableRowElement | null>(null)
  const yearDropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!yearDropdownOpen) return
    function onOutside(e: MouseEvent) {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [yearDropdownOpen])

  const yearRows = selectedYear === OVERALL
    ? buildOverallRows(rows)
    : rows.filter(r => r.financialYear === selectedYear)

  const periodLabel = selectedYear === OVERALL
    ? `All years (${years[years.length - 1]}–${years[0]})`
    : yearRows[0]?.period ?? selectedYear

  const filtered = partyFilter === 'ALL'
    ? yearRows
    : yearRows.filter(r => r.party === partyFilter)

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const maxTotal = yearRows[0] ? parseFloat(yearRows[0].total ?? '0') : 1

  function handleYearChange(year: string) {
    setSelectedYear(year)
    setPartyFilter('ALL')
    setVisibleCount(PAGE_SIZE)
  }

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
    setVisibleCount(PAGE_SIZE)
  }

  const handleLoadMore = useCallback(() => {
    setVisibleCount(c => c + 50)
    requestAnimationFrame(() => {
      if (firstNewRef.current) firstNewRef.current.focus()
    })
  }, [])

  return (
    <>
      {/* Year dropdown */}
      {years.length > 1 && (
        <div className={styles.yearDropdownWrap} ref={yearDropdownRef}>
          <button
            className={styles.yearDropdownTrigger}
            onClick={() => setYearDropdownOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={yearDropdownOpen}
          >
            <span>{selectedYear === OVERALL ? 'Overall' : selectedYear}</span>
            <svg
              className={`${styles.yearDropdownChevron} ${yearDropdownOpen ? styles.yearDropdownChevronOpen : ''}`}
              width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {yearDropdownOpen && (
            <ul className={styles.yearDropdownList} role="listbox">
              <li
                role="option"
                aria-selected={selectedYear === OVERALL}
                className={`${styles.yearDropdownItem} ${selectedYear === OVERALL ? styles.yearDropdownItemSelected : ''}`}
                onClick={() => { handleYearChange(OVERALL); setYearDropdownOpen(false) }}
              >
                Overall
              </li>
              {years.map(year => (
                <li
                  key={year}
                  role="option"
                  aria-selected={year === selectedYear}
                  className={`${styles.yearDropdownItem} ${year === selectedYear ? styles.yearDropdownItemSelected : ''}`}
                  onClick={() => { handleYearChange(year); setYearDropdownOpen(false) }}
                >
                  {year}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Coverage note */}
      <p className={styles.coverageNote}>
        {selectedYear === OVERALL
          ? <>Totals combine all published financial years: <strong>{years[years.length - 1]} to {years[0]}</strong>.</>
          : <>Figures cover <strong>{periodLabel}</strong> ({selectedYear}).</>}
      </p>

      {/* Mobile title */}
      <h2 className={styles.mobileRankingsTitle}>Rankings</h2>

      {/* Party filter pills */}
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

      {/* Result count */}
      <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
        <strong>{filtered.length}</strong>{' '}
        <span className={styles.resultCountDesktop}>{partyFilter === 'ALL' ? 'current' : partyLabel(partyFilter)} MLA{filtered.length !== 1 ? 's' : ''} with published expenses for this period</span>
        <span className={styles.resultCountMobile}>Current MLA{filtered.length !== 1 ? 's' : ''}</span>
      </p>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="MLA expenses ranked table">
          <colgroup>
            <col className={styles.colRank} />
            <col className={styles.colMla} />
            <col className={`${styles.colParty} ${styles.hideMobile}`} />
            <col className={`${styles.colConstituency} ${styles.hideMobile} ${styles.hideTablet}`} />
            <col className={`${styles.colService} ${styles.hideMobile} ${styles.hideTablet}`} />
            <col className={styles.colExpenses} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.colRank}>#</th>
              <th scope="col">MLA</th>
              <th scope="col" className={styles.hideMobile}>Party</th>
              <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Constituency</th>
              <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`} title="Years and months of service since mandate start">Service</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const total = parseFloat(row.total ?? '0')
              const barPct = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0
              const globalRank = i + 1
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
                  <th scope="row" className={styles.tdRank} aria-label={`Rank ${globalRank}`}>{globalRank}</th>

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

                  <td className={`${styles.tdService} ${styles.hideMobile} ${styles.hideTablet}`}>
                    {serviceLabel(row.mandateStart)}
                  </td>

                  <td className={styles.tdExpenses}>
                    <div className={styles.expensesInner}>
                      <div className={styles.barTrack} aria-hidden="true">
                        <div
                          className={styles.barFill}
                          style={{ width: `${barPct}%`, background: partyBorderColor(row.party) }}
                        />
                      </div>
                      <span className={styles.expensesValue}>{gbp(row.total)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={handleLoadMore}
          aria-label="Load more MLAs"
        >
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </>
  )
}
