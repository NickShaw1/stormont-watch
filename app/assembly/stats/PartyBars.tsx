import { partyBorderColor, abbreviateParty } from '@/lib/format'
import { rankRows } from './rankUtils'
import styles from './statsKit.module.css'

export interface PartyBarRow {
  party: string
  value: number
  meta?: string
}

export default function PartyBars({ rows, suffix = '%', label, format, ranked = false, wide = false }: { rows: PartyBarRow[]; suffix?: string; label: string; format?: (v: number) => string; ranked?: boolean; wide?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className={`${styles.pBars} ${ranked ? styles.pBarsRanked : ''} ${wide ? styles.pBarsWide : ''}`} style={wide ? ({ ['--rows' as string]: Math.ceil(rows.length / 2) } as React.CSSProperties) : undefined} aria-label={label}>
      {(ranked ? rankRows(rows, (r) => r.value) : rows.map((r) => ({ ...r, rank: '' }))).map((r) => (
        <li key={r.party} className={styles.pBar} style={{ ['--pc' as string]: partyBorderColor(r.party) }}>
          {ranked && <span className={styles.pBarRank} aria-hidden="true">{r.rank}</span>}
          <span className={styles.pBarName} title={r.party}>
            <i aria-hidden="true" />
            {r.party === 'Independent' ? 'Independent' : abbreviateParty(r.party)}
            {r.meta && <span className={styles.pBarMeta}>{r.meta}</span>}
          </span>
          <span className={styles.pBarTrack} aria-hidden="true"><span className={styles.pBarFill} style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className={styles.pBarValue}>{format ? format(r.value) : `${r.value}${suffix}`}{r.meta && <small className={styles.pBarMetaPhone}>{r.meta}</small>}</span>
        </li>
      ))}
    </ul>
  )
}
