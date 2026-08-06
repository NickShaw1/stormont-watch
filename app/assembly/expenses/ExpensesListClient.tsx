'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Users, ListChecks, CalendarDays } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import PartyFilterControls, { partyLabel } from '@/components/PartyFilterControls'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency, orderedParties } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { sittingAdjective } from '@/lib/constants/mandates'
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
  if (!mandateStart) return '-'
  const total = serviceMonths(mandateStart)
  const years = Math.floor(total / 12)
  const months = total % 12
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
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
  const PARTIES = orderedParties(rows)
  const { mandate, basePath } = useMandate()
  const [selectedYear, setSelectedYear] = useState<string>(OVERALL)
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false)
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const yearDropdownRef = useRef<HTMLDivElement>(null)

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
    ? (years.length ? `All years (${years[years.length - 1]}–${years[0]})` : 'All years')
    : yearRows[0]?.period ?? selectedYear

  const filtered = partyFilter === 'ALL'
    ? yearRows
    : yearRows.filter(r => r.party === partyFilter)

  const visible = filtered
  const maxTotal = yearRows[0] ? parseFloat(yearRows[0].total ?? '0') : 1

  function handleYearChange(year: string) {
    setSelectedYear(year)
    setPartyFilter('ALL')
  }

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
  }

  return (
    <>
      {/* Rankings header */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionEyebrow}>Rankings</span>
        <h2 className={styles.sectionHeading}>
          <ListChecks className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          MLA expenses rankings
        </h2>
        <p className={styles.sectionSubtitle}>Showing overall expenses across all published years by default. Use the filter to view a specific financial year.</p>
      </div>

      <div className={styles.filterPanel}>
        <div className={styles.filterTopRow}>
          <PartyFilterControls styles={styles} parties={PARTIES} active={partyFilter} onSelect={handlePartyFilter} />

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
        </div>

        {/* Coverage note */}
        <p className={styles.coverageNote}>
          <CalendarDays className={styles.resultCountIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          {selectedYear === OVERALL
            ? <>Totals combine all published financial years: <strong>{years[years.length - 1]} to {years[0]}</strong>.</>
            : <>Figures cover <strong>{periodLabel}</strong> ({selectedYear}).</>}
        </p>

        <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
          <Users className={styles.resultCountIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          <strong>{filtered.length}</strong>{' '}
          <span className={styles.resultCountDesktop}>{partyFilter === 'ALL' ? sittingAdjective(mandate) : partyLabel(partyFilter)} MLA{filtered.length !== 1 ? 's' : ''} with published expenses for this period</span>
          <span className={styles.resultCountMobile}>{mandate.isCurrent ? 'Current' : 'Sitting'} MLA{filtered.length !== 1 ? 's' : ''}</span>
        </p>
      </div>

      <div className={styles.rankCardHead} aria-hidden="true">
        <span className={styles.rankCardHeadRank}>#</span>
        <span className={styles.rankCardHeadMain}>MLA</span>
        <span className={styles.rankCardHeadParty}>Party</span>
        <span className={styles.rankCardHeadConstituency}>Constituency</span>
        <span className={styles.rankCardHeadService} title="Years and months of service since mandate start">Service</span>
        <span className={styles.rankCardHeadValue}>Expenses</span>
      </div>

      <div className={styles.rankCardList} role="list" aria-label="MLA expenses ranked list">
        {visible.map((row, i) => {
          const total = parseFloat(row.total ?? '0')
          const barPct = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0
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

              <span className={styles.rankCardService}>
                {serviceLabel(row.mandateStart)}
              </span>

              <span className={styles.rankCardValueCol}>
                <span className={styles.rankCardBarTrack} aria-hidden="true">
                  <span
                    className={styles.rankCardBarFill}
                    style={{ display: 'block', width: `${barPct}%`, background: partyBorderColor(row.party) }}
                  />
                </span>
                <span className={styles.rankCardValue}>{gbp(row.total)}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
