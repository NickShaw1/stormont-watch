'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from './statsRankingTabs.module.css'

type MlaRow = {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  attendancePct: number
  ayes: number
  noes: number
}

interface Props {
  data: MlaRow[]
}

const TABS: {
  id: string
  label: string
  title: string
  key: keyof Pick<MlaRow, 'attendancePct' | 'ayes' | 'noes'>
  suffix: string
  desc: boolean
}[] = [
  { id: 'highest-attendance', label: 'Top Attended',   title: 'Highest Voting Attendance', key: 'attendancePct', suffix: '%', desc: true },
  { id: 'lowest-attendance',  label: 'Least Attended', title: 'Lowest Voting Attendance',  key: 'attendancePct', suffix: '%', desc: false },
  { id: 'most-ayes',          label: 'Most Ayes',      title: 'Most Ayes cast',     key: 'ayes',          suffix: '',  desc: true },
  { id: 'most-noes',          label: 'Most Noes',      title: 'Most Noes cast',     key: 'noes',          suffix: '',  desc: true },
]

function sortRows(
  data: MlaRow[],
  key: keyof Pick<MlaRow, 'attendancePct' | 'ayes' | 'noes'>,
  desc: boolean,
) {
  return [...data].sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key]).slice(0, 5)
}

function StatCard({
  title,
  rows,
  valueKey,
  valueSuffix = '',
}: {
  title: string
  rows: MlaRow[]
  valueKey: keyof Pick<MlaRow, 'attendancePct' | 'ayes' | 'noes'>
  valueSuffix?: string
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {rows.map((m, i) => (
          <li key={m.personId} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            <MlaPhoto
              name={m.fullName}
              imgUrl={m.imgUrl ?? ''}
              size={48}
              decorative
            />
            <div className={styles.info}>
              <Link href={`/assembly/mlas/${m.personId}`} className={styles.name}>
                {formatMemberName(m.fullName)}
              </Link>
              {m.party && (
                <span className={styles.partyPill} data-party={abbreviateParty(m.party)}>
                  <PartyName party={m.party} />
                </span>
              )}
            </div>
            <span className={styles.value}>{m[valueKey]}{valueSuffix}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function StatsRankingTabs({ data }: Props) {
  // activeTab: the tab whose content is currently displayed
  // fadingOutTab: the previous tab, kept mounted briefly while its panel animates out
  const [activeTab, setActiveTab] = useState(0)
  const [fadingOutTab, setFadingOutTab] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTabChange = (i: number) => {
    if (i === activeTab) return
    // Cancel any in-flight transition so rapid clicks don't stack
    if (timerRef.current) clearTimeout(timerRef.current)
    setFadingOutTab(activeTab)
    timerRef.current = setTimeout(() => {
      setActiveTab(i)
      setFadingOutTab(null)
    }, 150)
  }

  const panels = TABS.map((tab) => ({
    ...tab,
    rows: sortRows(data, tab.key, tab.desc),
  }))

  return (
    <div className={styles.wrapper}>
      {/* Tab controls — CSS hides these on desktop */}
      <div className={styles.tabList} role="tablist" aria-label="MLA ranking categories">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === i}
            aria-controls={`panel-${tab.id}`}
            className={`${styles.tab}${activeTab === i ? ` ${styles.tabActive}` : ''}`}
            onClick={() => handleTabChange(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels — CSS shows all on desktop, animates on mobile */}
      <div className={styles.grid}>
        {panels.map((panel, i) => {
          const isActive = i === activeTab
          const isFadingOut = i === fadingOutTab
          let panelClass = styles.panel
          if (isActive) panelClass += ` ${styles.panelActive}`
          if (isFadingOut) panelClass += ` ${styles.panelFadingOut}`
          return (
            <div
              key={panel.id}
              role="tabpanel"
              id={`panel-${panel.id}`}
              aria-labelledby={`tab-${panel.id}`}
              className={panelClass}
            >
              <StatCard
                title={panel.title}
                rows={panel.rows}
                valueKey={panel.key}
                valueSuffix={panel.suffix}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
