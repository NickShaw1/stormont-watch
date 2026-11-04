'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './billDetail.module.css'

export default function SignatoriesAccordion({ count, children }: { count: number; children: React.ReactNode }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.card} ${styles.accRow}${open ? ` ${styles.open}` : ''}`}>
      <h4 className={styles.stageHeading}>
        <button
          type="button"
          className={styles.head}
          id={`${uid}-head`}
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          onClick={() => setOpen(o => !o)}
        >
          <span className={styles.headText}>
            <span className={styles.headLabel}>All signatories ({count})</span>
          </span>
          <span className={styles.chev}><ChevronDown size={18} strokeWidth={2} aria-hidden="true" /></span>
        </button>
      </h4>
      <div id={`${uid}-panel`} role="region" aria-labelledby={`${uid}-head`} className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </div>
  )
}
