'use client'

import { useState } from 'react'
import { gbp } from '@/lib/format'
import RankingList from '../stats/RankingList'
import FilterField from '../stats/FilterField'
import { rankRows } from '../stats/rankUtils'

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
  const [sortMode, setSortMode] = useState<SortMode>('salary')
  const source = sortMode === 'salary' ? bySalary : byEarnings
  const value = (r: SalaryRow) => (sortMode === 'salary' ? r.currentSalary : r.mandateEarnings)
  const rows = rankRows(
    source.map(r => ({ id: r.personId, fullName: r.fullName, party: r.party, constituency: r.constituency, imgUrl: r.imgUrl, value: value(r), display: gbp(value(r)) })),
    r => r.value,
  )

  return (
    <RankingList
      rows={rows}
      ariaLabel="MLA salary ranked list"
      toolbar={
        <FilterField
          label="Rank by"
          value={sortMode}
          onPick={setSortMode}
          options={[{ key: 'salary', label: 'Current salaries' }, { key: 'earnings', label: 'Mandate earnings' }]}
        />
      }
    />
  )
}
