'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, abbreviateParty, partyBorderColor } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from './statsRankingTabs.module.css'
import type { getQuestionsLeaderboard, getUnansweredByDeptSinceRestoration } from '@/lib/db/queries'

type LeaderboardData = Awaited<ReturnType<typeof getQuestionsLeaderboard>>

interface Props {
  data: LeaderboardData
  unansweredSinceRestoration: Awaited<ReturnType<typeof getUnansweredByDeptSinceRestoration>>
}

type MlaRow = LeaderboardData['mostOverall'][number]
type PartyRow = LeaderboardData['byParty'][number]

const FOOTNOTE = '* Excluding current ministers and speakers'

function MlaStatCard({ title, rows, footnote }: { title: string; rows: MlaRow[]; footnote?: string }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {rows.map((m, i) => (
          <li key={m.personId} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={48} decorative square />
            <div className={styles.info}>
              <Link href={`/assembly/mlas/${m.personId}`} className={styles.name}>
                {formatMemberName(m.fullName)}
              </Link>
              {m.party && (
                <span className="party-pill" data-party={abbreviateParty(m.party)}>
                  <PartyName party={m.party} />
                </span>
              )}
              {m.constituency && (
                <span className={styles.voteCounts}>{m.constituency}</span>
              )}
            </div>
            <div className={styles.valueCol}>
              <span className={styles.value}>{Number(m.count).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ol>
      {footnote && <p className={styles.voteCounts} style={{ marginTop: 8 }}>{footnote}</p>}
    </div>
  )
}

function PartyStatCard({ title, rows }: { title: string; rows: PartyRow[] }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {rows.map((r, i) => (
          <li key={r.party ?? i} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            {r.party && (
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: partyBorderColor(r.party),
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            )}
            <div className={styles.info}>
              <span className={styles.name} style={{ color: 'var(--ink)' }}>
                {r.party ? <PartyName party={r.party} /> : 'Unknown'}
              </span>
              <span className={styles.voteCounts}>{Number(r.memberCount).toLocaleString()} members</span>
            </div>
            <div className={styles.valueCol}>
              <span className={styles.value}>{Number(r.count).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

type DeptLike = { department: string | null; unanswered: number; total: number }

function DeptStatCard({ title, subtitle, rows, footnote }: { title: string; subtitle?: string; rows: DeptLike[]; footnote?: string }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {title}{subtitle && <> <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{subtitle}</strong></>}
      </h3>
      <ol className={styles.list}>
        {rows.map((r, i) => (
          <li key={r.department ?? i} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            <div className={styles.info}>
              <span className={styles.name} style={{ color: 'var(--ink)', whiteSpace: 'normal' }}>
                {r.department ?? 'Unknown'}
              </span>
              <span className={styles.voteCounts}>
                {((Number(r.unanswered) / Number(r.total)) * 100).toFixed(1)}% of {Number(r.total).toLocaleString()} questions
              </span>
            </div>
            <div className={styles.valueCol}>
              <span className={styles.value}>{Number(r.unanswered).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ol>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </div>
  )
}

function PartyPerMlaCard({ title, rows }: { title: string; rows: PartyRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const aAvg = Number(a.memberCount) > 0 ? Math.round(Number(a.count) / Number(a.memberCount)) : 0
    const bAvg = Number(b.memberCount) > 0 ? Math.round(Number(b.count) / Number(b.memberCount)) : 0
    return bAvg - aAvg
  })
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {sorted.map((r, i) => {
          const avg = Number(r.memberCount) > 0 ? Math.round(Number(r.count) / Number(r.memberCount)) : 0
          return (
            <li key={r.party ?? i} className={styles.row}>
              <span className={styles.rank}>{i + 1}</span>
              {r.party && (
                <span
                  style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: partyBorderColor(r.party), flexShrink: 0 }}
                  aria-hidden="true"
                />
              )}
              <div className={styles.info}>
                <span className={styles.name} style={{ color: 'var(--ink)' }}>
                  {r.party ? <PartyName party={r.party} /> : 'Unknown'}
                </span>
                <span className={styles.voteCounts}>{Number(r.count).toLocaleString()} total</span>
              </div>
              <div className={styles.valueCol}>
                <span className={styles.value}>{avg.toLocaleString()}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const TABS = [
  { id: 'most-overall',        label: 'Most' },
  { id: 'fewest-overall',      label: 'Fewest' },
  { id: 'most-6mo',            label: 'Most (6mo)' },
  { id: 'fewest-6mo',          label: 'Fewest (6mo)' },
  { id: 'unanswered',          label: 'Unanswered' },
  { id: 'unanswered-by-dept',  label: 'By dept (restored)' },
  { id: 'by-party',            label: 'By party' },
  { id: 'per-mla',             label: 'Per MLA' },
]

export default function StatsQuestionsSection({ data, unansweredSinceRestoration }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [fadingOutTab, setFadingOutTab] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTabChange = (i: number) => {
    if (i === activeTab) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setFadingOutTab(activeTab)
    timerRef.current = setTimeout(() => {
      setActiveTab(i)
      setFadingOutTab(null)
    }, 150)
  }

  const panels = [
    <MlaStatCard key="most-overall"   title="Most questions asked"        rows={data.mostOverall}   footnote={FOOTNOTE} />,
    <MlaStatCard key="fewest-overall" title="Fewest questions asked"      rows={data.leastOverall}  footnote={FOOTNOTE} />,
    <MlaStatCard key="most-6mo"       title="Most active (last 6 months)" rows={data.mostSixMonths} footnote={FOOTNOTE} />,
    <MlaStatCard key="fewest-6mo"     title="Least active (last 6 months)"rows={data.leastSixMonths}footnote={FOOTNOTE} />,
    <DeptStatCard key="unanswered" title="Most unanswered questions" subtitle="(Since start of mandate)" rows={data.unansweredByDept} footnote="* Written and oral questions with no recorded answer, since start of mandate" />,
    <DeptStatCard key="unanswered-by-dept" title="Unanswered by department" subtitle="(Since restoration)" rows={unansweredSinceRestoration.byDept} footnote="* Written and oral questions with no recorded answer, since 3 Feb 2024" />,
    <PartyStatCard key="by-party" title="Questions by party" rows={data.byParty} />,
    <PartyPerMlaCard key="per-mla" title="Average questions per MLA" rows={data.byParty} />,
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabList} role="tablist" aria-label="Questions ranking categories">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            id={`qtab-${tab.id}`}
            aria-selected={activeTab === i}
            aria-controls={`qpanel-${tab.id}`}
            className={`${styles.tab}${activeTab === i ? ` ${styles.tabActive}` : ''}`}
            onClick={() => handleTabChange(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {panels.map((panel, i) => {
          const isActive = i === activeTab
          const isFadingOut = i === fadingOutTab
          let panelClass = styles.panel
          if (isActive) panelClass += ` ${styles.panelActive}`
          if (isFadingOut) panelClass += ` ${styles.panelFadingOut}`
          return (
            <div
              key={TABS[i].id}
              role="tabpanel"
              id={`qpanel-${TABS[i].id}`}
              aria-labelledby={`qtab-${TABS[i].id}`}
              className={panelClass}
            >
              {panel}
            </div>
          )
        })}
      </div>
    </div>
  )
}
