'use client'

import { useState } from 'react'
import RankingList, { type RankRow } from '../stats/RankingList'
import FilterField from '../stats/FilterField'
import { rankRows } from '../stats/rankUtils'
import { useMandate } from '@/components/MandateContext'
import { orderedParties } from '@/lib/format'
import styles from '../stats/statsKit.module.css'

export interface CostRow extends RankRow {
  isCurrent: boolean
}

export default function OverallCostListClient({ rows }: { rows: CostRow[] }) {
  const { mandate } = useMandate()
  const [currentOnly, setCurrentOnly] = useState(false)
  const shown: CostRow[] = currentOnly ? (rankRows(rows.filter((r) => r.isCurrent), (r) => r.value) as CostRow[]) : rows

  return (
    <RankingList
      rows={shown}
      partyOptions={orderedParties(rows)}
      dirty={currentOnly}
      onClear={() => setCurrentOnly(false)}
      ariaLabel="MLA overall cost ranked list"      toolbar={
        <div className={`${styles.rlFields} ${styles.rlFieldsOne}`}>
          <FilterField
            label="Show"
            value={currentOnly ? 'current' : 'all'}
            onPick={(k) => setCurrentOnly(k === 'current')}
            options={[{ key: 'all', label: 'Current and former' }, { key: 'current', label: `${mandate.isCurrent ? 'Current' : 'Sitting'} only` }]}
          />
        </div>
      }
    />
  )
}
