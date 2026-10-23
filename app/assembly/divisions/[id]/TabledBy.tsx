'use client'

import { useState } from 'react'
import styles from './divisionDetail.module.css'

const SHOW = 3

export default function TabledBy({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false)
  const extra = names.length - SHOW
  const shown = open || extra <= 0 ? names : names.slice(0, SHOW)
  return (
    <span className={styles.factValue}>
      {shown.join(', ')}
      {extra > 0 && (
        <button type="button" className={styles.moreBtn} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `+${extra} more`}
        </button>
      )}
    </span>
  )
}
