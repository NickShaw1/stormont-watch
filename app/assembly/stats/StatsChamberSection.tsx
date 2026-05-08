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

function PartyBarChart({ title, rows, getValue }: {
  title: string
  rows: PartyAvgRow[]
  getValue: (r: PartyAvgRow) => number
}) {
  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a))
  const max = getValue(sorted[0]) || 1
  return (
    <div>
      <h3 className={styles.chartTitle} style={{ margin: 0 }}>{title}</h3>
      <div className={styles.partyAttendanceChart}>
        {sorted.map((r) => {
          const val = getValue(r)
          const color = partyBorderColor(r.party)
          const barPct = Math.round((val / max) * 100)
          return (
            <div key={r.party} className={styles.partyAttendanceRow}>
              <span className={styles.partyAttendanceLabel}>
                <span className={styles.partyAttendanceDot} style={{ background: color }} aria-hidden="true" />
                {abbreviateParty(r.party)}
              </span>
              <div className={styles.partyAttendanceTrack} aria-hidden="true">
                <div className={styles.partyAttendanceFill} style={{ width: `${barPct}%`, background: color }} />
              </div>
              <span className={styles.partyAttendanceValue}>{Number(val).toFixed(1)}</span>
            </div>
          )
        })}
      </div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-8)' }}>
        <div className={styles.overviewGrid}>
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
        <Link href="/assembly/sittings" className={styles.expensesRankingsCard} style={{ margin: 0 }}>
          <span className={styles.expensesRankingsCardLeft}>
            <svg className={styles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
            </svg>
            <span className={styles.expensesRankingsCardText}>View full MLA sittings rankings</span>
          </span>
          <span className={styles.expensesRankingsCardArrow}>↗</span>
        </Link>

        <div className={styles.expensesCardGrid} style={{ marginBottom: 0 }}>
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
        </div>

        <PartyBarChart
          title="By party: avg sittings per current MLA"
          rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
          getValue={r => r.avgSittings}
        />

        <Link href="/assembly/topics" className={styles.expensesRankingsCard} style={{ margin: 0 }}>
          <span className={styles.expensesRankingsCardLeft}>
            <svg className={styles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
            </svg>
            <span className={styles.expensesRankingsCardText}>View full MLA topics rankings</span>
          </span>
          <span className={styles.expensesRankingsCardArrow}>↗</span>
        </Link>

        <div className={styles.expensesCardGrid} style={{ marginBottom: 0 }}>
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
        </div>

        <PartyBarChart
          title="By party: avg topics per current MLA"
          rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
          getValue={r => r.avgDebates}
        />
      </div>
    </section>
  )
}
