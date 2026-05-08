import Link from 'next/link'
import statsStyles from './stats.module.css'
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
}

function MlaCard({ title, rows }: { title: string; rows: MlaRow[] }) {
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

function PartyCard({ title, rows, getValue }: { title: string; rows: PartyRow[]; getValue: (r: PartyRow) => number }) {
  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a))
  const max = getValue(sorted[0]) || 1
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
                <div style={{ marginTop: 4, height: 4, background: 'var(--surface-2)', borderRadius: 2, width: '100%' }} aria-hidden="true">
                  <div style={{ height: 4, borderRadius: 2, background: partyBorderColor(r.party), width: `${Math.round(val / max * 100)}%` }} />
                </div>
              </div>
              <div className={styles.valueCol}>
                <span className={styles.value}>{val.toLocaleString()}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function StatsQuestionsSection({ top5, bottom5, byParty }: Props) {
  return (
    <>
      <Link href="/assembly/questions" className={statsStyles.expensesRankingsCard} style={{ marginTop: 0, marginBottom: 'var(--s-8)' }}>
        <span className={statsStyles.expensesRankingsCardLeft}>
          <svg className={statsStyles.expensesRankingsCardIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
            <rect x="9" y="9" width="2" height="6" rx="1" fill="currentColor"/>
            <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
          </svg>
          <span className={statsStyles.expensesRankingsCardText}>View full MLA questions rankings</span>
        </span>
        <span className={statsStyles.expensesRankingsCardArrow}>↗</span>
      </Link>
      <div className={styles.expensesCardGrid}>
        <MlaCard title="Most questions asked" rows={top5} />
        <MlaCard title="Fewest questions asked" rows={bottom5} />
        <PartyCard title="By party (total)" rows={byParty} getValue={r => r.total} />
        <PartyCard title="Average questions per MLA" rows={byParty} getValue={r => Math.round(r.total / r.memberCount)} />
      </div>
    </>
  )
}
