import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency } from '@/lib/format'
import styles from './statsKit.module.css'

export interface MoneyRow {
  personId: string
  fullName: string
  party: string | null
  imgUrl: string | null
  value: string
  sub?: string
  constituency?: string | null
}

export default function MoneyList({ rows, basePath }: { rows: MoneyRow[]; basePath: string }) {
  return (
    <ol className={`${styles.rankList} ${styles.rkCompact}`}>
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
          <span className={styles.rankValue}><b>{m.value}</b></span>
          <ArrowRight className={styles.rankArrow2} size={18} strokeWidth={2} aria-hidden="true" />
        </li>
      ))}
    </ol>
  )
}
