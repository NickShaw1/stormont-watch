'use client'

import { useState } from 'react'
import RankingList, { type RankRow } from '../stats/RankingList'
import FilterField from '../stats/FilterField'
import { serviceLabel, rankRows } from '../stats/rankUtils'
import { useMandate } from '@/components/MandateContext'
import { orderedParties } from '@/lib/format'
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
}

const gbp = (val: string | null | undefined) =>
  `£${parseFloat(val ?? '0').toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const OVERALL = 'overall'

function buildOverallRows(rows: ExpenseRow[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>()
  for (const r of rows) {
    const existing = map.get(r.personId)
    if (!existing) map.set(r.personId, { ...r })
    else map.set(r.personId, { ...existing, total: (parseFloat(existing.total ?? '0') + parseFloat(r.total ?? '0')).toFixed(2) })
  }
  return [...map.values()].sort((a, b) => parseFloat(b.total ?? '0') - parseFloat(a.total ?? '0'))
}

export default function ExpensesListClient({ rows, years, missing }: Props) {
  const { mandate } = useMandate()
  const [selectedYear, setSelectedYear] = useState<string>(OVERALL)
  const [currentOnly, setCurrentOnly] = useState(false)

  const yearRows = (selectedYear === OVERALL ? buildOverallRows(rows) : rows.filter(r => r.financialYear === selectedYear)).filter(r => !currentOnly || r.isCurrent)

  const poolSize = selectedYear === OVERALL
    ? rows.find(r => r.mandatePool !== null)?.mandatePool ?? null
    : rows.find(r => r.financialYear === selectedYear && r.yearPool !== null)?.yearPool ?? null

  const periodLabel = selectedYear === OVERALL
    ? (years.length ? `All years (${years[years.length - 1]}–${years[0]})` : 'All years')
    : yearRows[0]?.period ?? selectedYear

  const baseRows = yearRows.map(r => ({
    id: r.personId,
    fullName: r.fullName,
    party: r.party,
    constituency: r.constituency,
    imgUrl: r.imgUrl,
    value: parseFloat(r.total ?? '0'),
    display: gbp(r.total),
    rank: selectedYear === OVERALL ? r.mandateRank : r.yearRank,
    note: !r.isCurrent && r.mandateEnd ? `Left ${new Date(r.mandateEnd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : undefined,
    service: serviceLabel(r.mandateStart, r.isCurrent ? null : r.mandateEnd),
  }))
  const listRows = currentOnly ? (rankRows(baseRows, r => r.value) as typeof baseRows) : baseRows

  return (
    <RankingList
      rows={listRows}
      partyOptions={orderedParties(rows)}
      ariaLabel="MLA expenses ranked list"
      showService
      dirty={selectedYear !== OVERALL || currentOnly}
      onClear={() => { setSelectedYear(OVERALL); setCurrentOnly(false) }}
      countSuffix=" with published expenses for this period"
      toolbar={
        <div className={styles.rlFields}>
          {years.length > 1 && (
            <FilterField
              label="Financial year"
              sheetOnPhone
              value={selectedYear}
              onPick={setSelectedYear}
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
        if (none.length === 0) return null
        return (
          <div className={styles.rlMissing} role="note" aria-label="MLAs with no expenses on record">
            <h2 className={styles.tileTitle}>No record</h2>
            <p className={styles.tileSub}>{none.length} MLA{none.length !== 1 ? 's' : ''} {none.length !== 1 ? 'have' : 'has'} no expenses on record in any published year.</p>
            <RankingList rows={none} ariaLabel="MLAs with no expenses" filterable={false} />
          </div>
        )
      }}
      note={
        <p className={styles.rlNote2}>
          {selectedYear === OVERALL
            ? <>Totals combine all published financial years, {years[years.length - 1]} to {years[0]}. </>
            : <>Figures cover {periodLabel} ({selectedYear}). </>}
          {currentOnly
            ? <>Ranks are among the {mandate.isCurrent ? 'current' : 'sitting'} MLAs listed.</>
            : poolSize !== null && <>Ranks are among all {poolSize} MLAs with published expenses {selectedYear === OVERALL ? 'this mandate' : 'in this period'}, current and former, so they match each MLA&apos;s own page.</>}
        </p>
      }
    />
  )
}
