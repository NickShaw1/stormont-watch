'use client'

import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor } from '@/lib/format'
import styles from './stats.module.css'

type MlaRow = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  sittings: number
  debates: number
}

type PartyAvgRow = {
  party: string
  avgSittings: number
  avgDebates: number
}

type SiteStats = {
  totalSittings: number
  totalDebates: number
  totalParticipations: number
}

interface Props {
  topBySittings: MlaRow[]
  bottomBySittings: MlaRow[]
  topByTopics: MlaRow[]
  bottomByTopics: MlaRow[]
  partyAverages: PartyAvgRow[]
  thisMonth: number
  siteStats: SiteStats
}

function MlaCard({ title, rows, getValue }: {
  title: string
  rows: MlaRow[]
  getValue: (r: MlaRow) => number
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {rows.map((m, i) => {
          const val = getValue(m)
          return (
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
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span className={styles.value}>{val.toLocaleString()}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function PartyCard({ title, rows, getValue }: {
  title: string
  rows: PartyAvgRow[]
  getValue: (r: PartyAvgRow) => number
}) {
  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a))
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ol className={styles.list}>
        {sorted.map((r, i) => {
          const val = getValue(r)
          return (
            <li key={r.party} className={styles.row}>
              <span className={styles.rank}>{i + 1}</span>
              <span
                style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: partyBorderColor(r.party), flexShrink: 0 }}
                aria-hidden="true"
              />
              <div className={styles.info}>
                <span className={styles.name} style={{ color: 'var(--ink)' }}>
                  <PartyName party={r.party} />
                </span>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span className={styles.value}>{Number(val).toFixed(1)}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function StatsChamberSection({
  topBySittings,
  bottomBySittings,
  topByTopics,
  bottomByTopics,
  partyAverages,
  thisMonth,
  siteStats,
}: Props) {
  const topSitter = topBySittings[0]
  const topTopics = topByTopics[0]

  return (
    <section aria-labelledby="chamber-heading" className={styles.section}>
      <div className={styles.sectionHeader}>
        <p className="eyebrow">Plenary chamber</p>
        <h2 id="chamber-heading" className={styles.sectionTitle}>Chamber Activity</h2>
        <div className={styles.sectionRule}></div>
        <p className={styles.sectionDesc}>Plenary sittings spoken in and debate topics contributed to since May 2022. Excludes presiding officers.</p>
      </div>

      <div className={styles.overviewGrid} style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Sittings this mandate</span>
          <span className={styles.overviewValue} style={{ fontSize: '1.5rem' }}>{Number(siteStats.totalSittings).toLocaleString()}</span>
          <span className={styles.overviewMeta}>since May 2022</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>This month</span>
          <span className={styles.overviewValue} style={{ fontSize: '1.5rem' }}>{Number(thisMonth).toLocaleString()}</span>
          <span className={styles.overviewMeta}>{Number(thisMonth) === 1 ? 'sitting' : 'sittings'}</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Most active MLA</span>
          <span className={styles.overviewValue} style={{ fontSize: '1.5rem' }}>{topSitter ? formatMemberName(topSitter.fullName) : '—'}</span>
          <span className={styles.overviewMeta}>{topSitter ? `${Number(topSitter.sittings).toLocaleString()} sittings` : ''}</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Most topics</span>
          <span className={styles.overviewValue} style={{ fontSize: '1.5rem' }}>{topTopics ? formatMemberName(topTopics.fullName) : '—'}</span>
          <span className={styles.overviewMeta}>{topTopics ? `${Number(topTopics.debates).toLocaleString()} topics spoken on` : ''}</span>
        </div>
      </div>

      <div className={styles.expensesCardGrid}>
        <MlaCard
          title="Most sittings spoken in"
          rows={topBySittings.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.sittings}
        />
        <MlaCard
          title="Fewest sittings spoken in"
          rows={bottomBySittings.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.sittings}
        />
        <MlaCard
          title="Most topics spoken on"
          rows={topByTopics.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.debates}
        />
        <MlaCard
          title="Fewest topics spoken on"
          rows={bottomByTopics.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.debates}
        />
        <PartyCard
          title="By party: avg sittings per current MLA"
          rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
          getValue={r => r.avgSittings}
        />
        <PartyCard
          title="By party: avg topics per current MLA"
          rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
          getValue={r => r.avgDebates}
        />
      </div>
    </section>
  )
}
