'use client'

import Link from 'next/link'
import { Mic2, ArrowUpWideNarrow, ArrowDownWideNarrow, CalendarDays, CalendarClock, Trophy, MessageSquare, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import styles from './stats.module.css'
import { sittingAdjective } from '@/lib/constants/mandates'

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

function MlaCard({ title, icon: Icon, rows, getValue, basePath }: {
  title: string
  icon: LucideIcon
  rows: MlaRow[]
  getValue: (r: MlaRow) => number
  basePath: string
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {title}
        <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </h3>
      <ol className={styles.list}>
        {rows.map((m, i) => {
          const val = getValue(m)
          return (
            <li key={m.personId} className={styles.row}>
              <span className={styles.rank}>{i + 1}</span>
              <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={48} decorative square personId={m.personId} />
              <div className={styles.info}>
                <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.name}>
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

function PartyBarChart({ title, icon: Icon, rows, getValue }: {
  title: string
  icon: LucideIcon
  rows: PartyAvgRow[]
  getValue: (r: PartyAvgRow) => number
}) {
  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a))
  const max = (sorted.length ? getValue(sorted[0]) : 0) || 1
  return (
    <div>
      <h3 className={styles.chartTitle}>
        <Icon className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h3>
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
  const { mandate, basePath } = useMandate()
  const topSitter = topBySittings[0]
  const topTopics = topByTopics[0]

  return (
    <section aria-labelledby="chamber-heading" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionEyebrow}>Plenary chamber</span>
        <h2 id="chamber-heading" className={styles.sectionTitle}>
          <Mic2 className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          Chamber Activity
        </h2>
        <p className={styles.sectionDesc}>Plenary sittings spoken in and debate topics contributed to since {mandate.startLabel}. Excludes presiding officers.</p>
      </div>

      <div className={styles.glanceBarFour}>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Sittings this mandate</span>
            <CalendarDays className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{Number(siteStats.totalSittings).toLocaleString()}</span>
          <span className={styles.glanceCellMeta}>since {mandate.startLabel}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>This month</span>
            <CalendarClock className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{Number(thisMonth).toLocaleString()}</span>
          <span className={styles.glanceCellMeta}>{Number(thisMonth) === 1 ? 'sitting' : 'sittings'}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Most active MLA</span>
            <Trophy className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{topSitter ? formatMemberName(topSitter.fullName) : '-'}</span>
          <span className={styles.glanceCellMeta}>{topSitter ? `${Number(topSitter.sittings).toLocaleString()} sittings` : ''}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Most topics</span>
            <MessageSquare className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{topTopics ? formatMemberName(topTopics.fullName) : '-'}</span>
          <span className={styles.glanceCellMeta}>{topTopics ? `${Number(topTopics.debates).toLocaleString()} topics spoken on` : ''}</span>
        </div>
      </div>

      <div className={styles.sectionHeadRow}>
        <h3 className={styles.chartTitle} style={{ margin: 0 }}>
          <CalendarDays className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          Sittings
        </h3>
        <Link href={`${basePath}/assembly/sittings`} className={styles.viewAllBtn}>View full rankings</Link>
      </div>

      <div className={styles.cardGrid}>
        <MlaCard
          title="Most sittings spoken in"
          icon={ArrowUpWideNarrow}
          rows={topBySittings.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.sittings}
          basePath={basePath}
        />
        <MlaCard
          title="Fewest sittings spoken in"
          icon={ArrowDownWideNarrow}
          rows={bottomBySittings.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.sittings}
          basePath={basePath}
        />
      </div>

      <PartyBarChart
        title={`By party: avg sittings per ${sittingAdjective(mandate)} MLA`}
        icon={Users}
        rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
        getValue={r => r.avgSittings}
      />

      <div className={styles.sectionHeadRow} style={{ marginTop: 'var(--sw-space-9)' }}>
        <h3 className={styles.chartTitle} style={{ margin: 0 }}>
          <MessageSquare className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          Topics
        </h3>
        <Link href={`${basePath}/assembly/topics`} className={styles.viewAllBtn}>View full rankings</Link>
      </div>

      <div className={styles.cardGrid}>
        <MlaCard
          title="Most topics spoken on"
          icon={ArrowUpWideNarrow}
          rows={topByTopics.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.debates}
          basePath={basePath}
        />
        <MlaCard
          title="Fewest topics spoken on"
          icon={ArrowDownWideNarrow}
          rows={bottomByTopics.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) }))}
          getValue={r => r.debates}
          basePath={basePath}
        />
      </div>

      <PartyBarChart
        title={`By party: avg topics per ${sittingAdjective(mandate)} MLA`}
        icon={Users}
        rows={partyAverages.map(r => ({ ...r, avgSittings: Number(r.avgSittings), avgDebates: Number(r.avgDebates) }))}
        getValue={r => r.avgDebates}
      />
    </section>
  )
}
