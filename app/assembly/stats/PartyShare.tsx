import { partyBorderColor, abbreviateParty } from '@/lib/format'
import { rankRows } from './rankUtils'
import styles from './statsKit.module.css'

export interface ShareRow {
  party: string
  value: number
  display: string
  sub: string
}

export default function PartyShare({ rows, label }: { rows: ShareRow[]; label: string }) {
  const clean = rows.map((r) => ({ ...r, value: Number(r.value) }))
  const total = clean.reduce((s, r) => s + r.value, 0) || 1
  const sorted = rankRows([...clean].sort((a, b) => b.value - a.value), (r) => r.value)
  const max = Math.max(1, ...clean.map((r) => r.value))
  const name = (p: string) => (p === 'Independent' ? 'Independent' : abbreviateParty(p))
  const pct = (v: number) => `${Math.round((v / total) * 1000) / 10}%`
  return (
    <ol className={styles.shList} aria-label={label}>
      {sorted.map((r) => (
        <li key={r.party} className={styles.shRow} style={{ ['--pc' as string]: partyBorderColor(r.party) }}>
          <span className={styles.shRank} aria-hidden="true">{r.rank}</span>
          <span className={styles.shWho}>
            <span className={styles.shName}><i aria-hidden="true" />{name(r.party)}</span>
            <span className={styles.shSub}><span>{r.sub.split(', ')[0]}<span className={styles.shCount}>{r.sub.includes(', ') ? `, ${r.sub.split(', ').slice(1).join(', ')}` : ''}</span></span><em className={styles.shPctInline}>{pct(r.value)}</em></span>
          </span>
          <span className={styles.shTrack} aria-hidden="true"><span style={{ width: `${Math.round((r.value / max) * 100)}%` }} /></span>
          <span className={styles.shVal}><b>{r.display}</b><small>{pct(r.value)}</small></span>
        </li>
      ))}
    </ol>
  )
}
