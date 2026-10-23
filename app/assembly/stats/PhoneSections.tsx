'use client'

import { useState } from 'react'
import { Users, Scale, Handshake, PoundSterling, Activity, Mic, MessageSquare, CalendarCheck, Wallet, Coins, LayoutGrid } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import styles from './statsKit.module.css'

const ICONS: Record<string, LucideIcon> = {
  users: Users,
  scale: Scale,
  handshake: Handshake,
  pound: PoundSterling,
  activity: Activity,
  mic: Mic,
  messages: MessageSquare,
  calendar: CalendarCheck,
  wallet: Wallet,
  coins: Coins,
  grid: LayoutGrid,
}

const COLOURS = ['var(--sw-accent-solid)', '#8b5cf6', 'var(--sw-success-solid)', 'var(--sw-accent-warm)']

export interface PhoneSection {
  key: string
  label: string
  icon: keyof typeof ICONS
  meta?: string
  node: React.ReactNode
}

export default function PhoneSections({ sections }: { sections: PhoneSection[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? '')
  return (
    <>
      <div className={`container ${styles.phoneSwitchOuter}`}>
        <div className={styles.phoneSwitchWrap}>
          <SheetSelect
            className={styles.phoneSwitch}
            options={sections.map((s, i) => ({ key: s.key, label: s.label, icon: ICONS[s.icon] ?? LayoutGrid, meta: s.meta, color: COLOURS[i % COLOURS.length], on: i % COLOURS.length === 3 ? '#1a1d21' : undefined }))}
            value={active}
            onPick={setActive}
            eyebrow="Show"
            title="Section"
            headIcon={LayoutGrid}
            hideTriggerMeta
          />
        </div>
      </div>
      {sections.map((s) => (
        <div key={s.key} className={styles.phoneSection} data-hidden={s.key === active ? undefined : ''}>
          {s.node}
        </div>
      ))}
    </>
  )
}
