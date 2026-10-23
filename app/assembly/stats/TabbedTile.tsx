'use client'

import { useState } from 'react'
import styles from './statsKit.module.css'

export interface Tab {
  key: string
  label: string
  node: React.ReactNode
}

export default function TabbedTile({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(0)
  return (
    <>
      <div className={styles.tabs} role="group" aria-label={label}>
        {tabs.map((t, i) => (
          <button key={t.key} type="button" className={styles.tabBtn} aria-pressed={active === i} onClick={() => setActive(i)}>{t.label}</button>
        ))}
      </div>
      {tabs[active].node}
    </>
  )
}
