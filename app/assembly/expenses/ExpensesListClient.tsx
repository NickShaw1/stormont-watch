'use client'

import { useState } from 'react'
import RankingList, { type RankRow } from '../stats/RankingList'
import FilterField from '../stats/FilterField'
import { serviceLabel, rankRows } from '../stats/rankUtils'
import { useMandate } from '@/components/MandateContext'
import { abbreviateParty, orderedParties } from '@/lib/format'
import { monthsInOffice } from '@/lib/constituencies'
import styles from '../stats/statsKit.module.css'

export interface ExpenseRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateStart: string | null
  mandateEnd: string | null
  isCurrent: boolean
  total: string | null
  period: string | null
  financialYear: string
  yearRank: number | null
  yearPool: number | null
  mandateRank: number | null
  mandatePool: number | null
}

interface Props {
  rows: ExpenseRow[]
  years: string[]
  latestYear: string | null
  missing: RankRow[]
  windowStart: string
  windowEnd: string | null
}

const gbp = (val: string | null | undefined) =>
  `£${parseFloat(val ?? '0').toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const OVERALL = 'overall'
const MIN_MONTHS = 12

function buildOverallRows(rows: ExpenseRow[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>()
  for (const r of rows) {
    const existing = map.get(r.personId)
    if (!existing) map.set(r.personId, { ...r })
    else map.set(r.personId, { ...existing, total: (parseFloat(existing.total ?? '0') + parseFloat(r.total ?? '0')).toFixed(2) })
  }
  return [...map.values()].sort((a, b) => parseFloat(b.total ?? '0') - parseFloat(a.total ?? '0'))
}

export default function ExpensesListClient({ rows, years, missing, windowStart, windowEnd }: Props) {
  const { mandate } = useMandate()
  const [selectedYear, setSelectedYear] = useState<string>(OVERALL)
  const [currentOnly, setCurrentOnly] = useState(false)
  const [rankBy, setRankBy] = useState<'total' | 'month'>('total')
  const monthly = rankBy === 'month' && windowEnd !== null
  const showYear = years.length > 1

  const yearRows = (monthly || selectedYear === OVERALL ? buildOverallRows(rows) : rows.filter(r => r.financialYear === selectedYear)).filter(r => !currentOnly || r.isCurrent)

  const poolSize = selectedYear === OVERALL
    ? rows.find(r => r.mandatePool !== null)?.mandatePool ?? null
    : rows.find(r => r.financialYear === selectedYear && r.yearPool !== null)?.yearPool ?? null

  const periodLabel = selectedYear === OVERALL
    ? (years.length ? `All years (${years[years.length - 1]}–${years[0]})` : 'All years')
    : yearRows[0]?.period ?? selectedYear

  const monthsOf = (r: ExpenseRow) =>
    windowEnd ? Math.round(monthsInOffice({ mandateStart: r.mandateStart, mandateEnd: r.isCurrent ? null : r.mandateEnd }, windowStart, windowEnd) * 10) / 10 : 0
  const rankable = monthly ? yearRows.filter(r => monthsOf(r) >= MIN_MONTHS) : yearRows
  const shortRows = monthly
    ? yearRows
        .filter(r => monthsOf(r) < MIN_MONTHS)
        .sort((a, b) => monthsOf(b) - monthsOf(a))
        .map(r => ({
          id: r.personId,
          fullName: r.fullName,
          party: r.party,
          constituency: r.constituency,
          imgUrl: r.imgUrl,
          value: 0,
          display: `${monthsOf(r).toFixed(1)} months`,
          rank: '-',
          note: !r.isCurrent && r.mandateEnd ? `Left ${new Date(r.mandateEnd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : undefined,
          detail: `${gbp(r.total)} claimed`,
        }))
    : []
  const notRanked = shortRows.length

  const baseRows = rankable.map(r => {
    const perMonth = monthly ? parseFloat(r.total ?? '0') / monthsOf(r) : 0
    return {
      id: r.personId,
      fullName: r.fullName,
      party: r.party,
      constituency: r.constituency,
      imgUrl: r.imgUrl,
      value: monthly ? perMonth : parseFloat(r.total ?? '0'),
      display: monthly ? gbp(perMonth.toFixed(2)) : gbp(r.total),
      rank: selectedYear === OVERALL ? r.mandateRank : r.yearRank,
      note: !r.isCurrent && r.mandateEnd ? `Left ${new Date(r.mandateEnd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : undefined,
      service: serviceLabel(r.mandateStart, r.isCurrent ? null : r.mandateEnd),
    }
  })
  const listRows = monthly
    ? (rankRows([...baseRows].sort((x, y) => y.value - x.value), r => r.value) as typeof baseRows)
    : currentOnly
      ? (rankRows(baseRows, r => r.value) as typeof baseRows)
      : baseRows
  const windowLabel = windowEnd ? new Date(windowEnd).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

  return (
    <RankingList
      rows={listRows}
      partyOptions={orderedParties(rows)}
      ariaLabel="MLA expenses ranked list"
      showService
      dirty={selectedYear !== OVERALL || currentOnly || rankBy === 'month'}
      onClear={() => { setSelectedYear(OVERALL); setCurrentOnly(false); setRankBy('total') }}
      countSuffix={monthly ? ' ranked by average claim per month' : ' with published expenses for this period'}
      toolbarTop={
        windowEnd ? (
          <div className={styles.tabs} role="group" aria-label="Rank by">
            <button type="button" className={styles.tabBtn} aria-pressed={!monthly} onClick={() => setRankBy('total')}>Total claimed</button>
            <button type="button" className={styles.tabBtn} aria-pressed={monthly} onClick={() => setRankBy('month')}>Per month</button>
          </div>
        ) : undefined
      }
      toolbar={
          <div className={`${styles.rlFields} ${showYear ? styles.rlFieldsYear : ''}`}>
          {showYear && (
            <FilterField
              label="Financial year"
              sheetOnPhone
              value={monthly ? OVERALL : selectedYear}
              disabled={monthly}
              onPick={(k) => { setRankBy('total'); setSelectedYear(k) }}
              options={[{ key: OVERALL, label: 'Overall' }, ...years.map((y) => ({ key: y, label: y }))]}
            />
          )}
          <FilterField
            label="Show"
            value={currentOnly ? 'current' : 'all'}
            onPick={(k) => setCurrentOnly(k === 'current')}
            options={[{ key: 'all', label: 'Current and former' }, { key: 'current', label: `${mandate.isCurrent ? 'Current' : 'Sitting'} only` }]}
          />
          </div>
      }
      after={(party) => {
        const none = party === 'ALL' ? missing : missing.filter((m) => m.party === party)
        const short = party === 'ALL' ? shortRows : shortRows.filter((m) => m.party === party)
        if (none.length === 0 && short.length === 0) return null
        return (
          <>
            {short.length > 0 && (
              <div className={styles.rlMissing} role="note" aria-label="MLAs not ranked per month">
                <h2 className={styles.tileTitle}>Not ranked per month</h2>
                <p className={styles.tileSub}>{short.length} MLA{short.length !== 1 ? 's' : ''} {short.length !== 1 ? 'have' : 'has'} under {MIN_MONTHS} months of published expenses up to {windowLabel}, so a monthly average would not be comparable. The months shown are how much of their service the expenses cover.</p>
                <RankingList rows={short} ariaLabel="MLAs with under 12 months of published expenses" filterable={false} />
              </div>
            )}
            {none.length > 0 && (
              <div className={styles.rlMissing} role="note" aria-label="MLAs with no expenses on record">
                <h2 className={styles.tileTitle}>No record</h2>
                <p className={styles.tileSub}>{none.length} MLA{none.length !== 1 ? 's' : ''} {none.length !== 1 ? 'have' : 'has'} no expenses on record in any published year.</p>
                <RankingList rows={none} ariaLabel="MLAs with no expenses" filterable={false} />
              </div>
            )}
          </>
        )
      }}
      note={(party) => {
        const unranked = party === 'ALL' ? notRanked : shortRows.filter((m) => m.party === party).length
        return (
        <p className={styles.rlNote2}>
          {monthly
            ? <>Average claimed per month in office: all published years divided by the months each MLA served, from joining to leaving or to {windowLabel}, whichever is earlier. MLAs with under {MIN_MONTHS} months of published expenses are not ranked{unranked > 0 ? <> and are listed below ({unranked})</> : null}. </>
            : selectedYear === OVERALL
            ? <>Totals combine all published financial years, {years[years.length - 1]} to {years[0]}. </>
            : <>Figures cover {periodLabel} ({selectedYear}). </>}
          {party !== 'ALL'
            ? <>Ranks are among the {listRows.filter((r) => r.party === party).length} {abbreviateParty(party)} MLAs listed.</>
            : monthly
            ? <>Ranks are among the {listRows.length} MLAs ranked.</>
            : currentOnly
            ? <>Ranks are among the {mandate.isCurrent ? 'current' : 'sitting'} MLAs listed.</>
            : poolSize !== null && <>Ranks are among all {poolSize} MLAs with published expenses {selectedYear === OVERALL ? 'this mandate' : 'in this period'}, current and former, so they match each MLA&apos;s own page.</>}
        </p>
        )
      }}
    />
  )
}
