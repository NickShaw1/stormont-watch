import Link from 'next/link'
import { ArrowUpWideNarrow, ArrowDownWideNarrow, Users, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, abbreviateParty, partyBorderColor } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from './stats.module.css'

type MlaRow = {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  total: number
}

type PartyRow = {
  party: string
  total: number
  memberCount: number
}

interface Props {
  top5: MlaRow[]
  bottom5: MlaRow[]
  byParty: PartyRow[]
  basePath?: string
}

function MlaCard({ title, icon: Icon, rows, basePath }: { title: string; icon: LucideIcon; rows: MlaRow[]; basePath: string }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {title}
        <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </h3>
      <ol className={styles.list}>
        {rows.map((m, i) => (
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
            <div className={styles.valueCol}>
              <span className={styles.value}>{m.total.toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function PartyCard({ title, icon: Icon, rows, getValue }: { title: string; icon: LucideIcon; rows: PartyRow[]; getValue: (r: PartyRow) => number }) {
  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a))
  const max = (sorted.length ? getValue(sorted[0]) : 0) || 1
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {title}
        <Icon className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      </h3>
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
              <span className={styles.name} style={{ color: 'var(--sw-text-primary)', flexShrink: 0, width: 66 }}>
                <PartyName party={r.party} />
              </span>
              <div style={{ flex: 1, minWidth: 0, height: 4, background: 'var(--sw-surface-subtle)', borderRadius: 2 }} aria-hidden="true">
                <div style={{ height: 4, borderRadius: 2, background: partyBorderColor(r.party), width: `${Math.round(val / max * 100)}%`, opacity: 0.85 }} />
              </div>
              <div className={styles.valueCol} style={{ width: 52 }}>
                <span className={styles.value}>{val.toLocaleString()}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function StatsQuestionsSection({ top5, bottom5, byParty, basePath = '' }: Props) {
  return (
    <>
      <div className={styles.cardGrid}>
        <MlaCard title="Most questions asked" icon={ArrowUpWideNarrow} rows={top5} basePath={basePath} />
        <MlaCard title="Fewest questions asked" icon={ArrowDownWideNarrow} rows={bottom5} basePath={basePath} />
      </div>
      <div className={styles.cardGrid} style={{ marginTop: 'var(--s-5)' }}>
        <PartyCard title="By party (total)" icon={Users} rows={byParty} getValue={r => r.total} />
        <PartyCard title="Average questions per MLA" icon={UserCheck} rows={byParty} getValue={r => Math.round(r.total / r.memberCount)} />
      </div>
    </>
  )
}
