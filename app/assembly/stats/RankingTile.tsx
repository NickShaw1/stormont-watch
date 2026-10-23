'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import styles from './statsKit.module.css'

export interface MlaRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  attendancePct: number
  ayes: number
  noes: number
  present: number
  total: number
}

type Key = 'attendancePct' | 'ayes' | 'noes'

const TABS: { id: string; label: string; key: Key; desc: boolean; suffix: string; counts: boolean }[] = [
  { id: 'top', label: 'Top attended', key: 'attendancePct', desc: true, suffix: '%', counts: true },
  { id: 'low', label: 'Least attended', key: 'attendancePct', desc: false, suffix: '%', counts: true },
  { id: 'ayes', label: 'Most Ayes', key: 'ayes', desc: true, suffix: '', counts: false },
  { id: 'noes', label: 'Most Noes', key: 'noes', desc: true, suffix: '', counts: false },
]

function top5(data: MlaRow[], key: Key, desc: boolean) {
  return [...data]
    .sort((a, b) => {
      const diff = desc ? b[key] - a[key] : a[key] - b[key]
      if (diff !== 0) return diff
      return key === 'attendancePct' ? b.total - a.total : 0
    })
    .slice(0, 5)
}

function RankList({ rows, t, basePath }: { rows: MlaRow[]; t: (typeof TABS)[number]; basePath: string }) {
  return (
    <ol className={styles.rankList}>
      {rows.map((m, i) => (
        <li key={m.personId} className={styles.rankItem}>
          <span className={styles.rankNum}>{i + 1}</span>
          <span className={styles.rankPhoto}><MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={128} decorative square personId={m.personId} /></span>
          <span className={styles.rankWho}>
            <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.rankName}>{formatMemberName(m.fullName)}</Link>
            <span className={styles.rankMeta}>
              {m.party && <span className="party-pill" data-party={abbreviateParty(m.party)}><PartyName party={m.party} /></span>}
              {m.constituency && <span className={styles.rankConst}>{formatConstituency(m.constituency)}</span>}
            </span>
            <span className={styles.rankMetaPhone}>
              {m.party && <i style={{ background: partyBorderColor(m.party) }} aria-hidden="true" />}
              <span>{m.party ? abbreviateParty(m.party) : ''}</span>
            </span>
          </span>
          <span className={styles.rankValue}>
            <b>{m[t.key]}{t.suffix}</b>
            {t.counts && <span className={styles.rankCount}>{m.present.toLocaleString()} of {m.total.toLocaleString()}</span>}
          </span>
          <ArrowRight className={styles.rankArrow2} size={18} strokeWidth={2} aria-hidden="true" />
        </li>
      ))}
    </ol>
  )
}

export default function RankingTile({ data }: { data: MlaRow[] }) {
  const { basePath } = useMandate()
  const [tab, setTab] = useState(0)
  const t = TABS[tab]

  return (
    <>
      <div className={styles.rkDesktop}>
        <div className={styles.tabs} role="group" aria-label="Ranking">
          {TABS.map((x, i) => (
            <button key={x.id} type="button" className={styles.tabBtn} aria-pressed={tab === i} onClick={() => setTab(i)}>{x.label}</button>
          ))}
        </div>
        <RankList rows={top5(data, t.key, t.desc)} t={t} basePath={basePath} />
      </div>
      <div className={styles.rkPhone}>
        {TABS.map((x) => (
          <section key={x.id} className={styles.rkGroup} aria-label={x.label}>
            <h4 className={styles.rkHeading}>{x.label}</h4>
            <RankList rows={top5(data, x.key, x.desc)} t={x} basePath={basePath} />
          </section>
        ))}
      </div>
    </>
  )
}
