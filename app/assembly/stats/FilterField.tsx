'use client'

import { useId } from 'react'
import { CalendarDays } from 'lucide-react'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import styles from './statsKit.module.css'

export interface FilterOption<K extends string> {
  key: K
  label: string
}

interface Props<K extends string> {
  label: string
  options: FilterOption<K>[]
  value: K
  onPick: (k: K) => void
  sheetOnPhone?: boolean
  disabled?: boolean
}

export default function FilterField<K extends string>({ label, options, value, onPick, sheetOnPhone = false, disabled = false }: Props<K>) {
  const id = useId()
  return (
    <div className={styles.rlField}>
      <span className={styles.rlFieldLabel} id={id}>{label}</span>
      <div className={`${styles.chipRow} ${styles.rlStretch} ${sheetOnPhone ? styles.rlChips : ''}`} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.key} type="button" className={styles.chipBtn} aria-pressed={value === o.key} disabled={disabled} onClick={() => onPick(o.key)}>{o.label}</button>
        ))}
      </div>
      {sheetOnPhone && (
        <div className={styles.rlSheet}>
          <SheetSelect
            className={styles.phoneSwitch}
            options={options.map((o) => ({ key: o.key, label: o.label, icon: CalendarDays, color: 'var(--sw-accent-solid)' }))}
            value={value}
            onPick={(k) => onPick(k as K)}
            eyebrow="Choose"
            title={label}
            headIcon={CalendarDays}
            hideTriggerMeta
          />
        </div>
      )}
    </div>
  )
}
