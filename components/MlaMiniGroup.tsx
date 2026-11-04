import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { displayParty, formatMemberName, partyBorderColor } from '@/lib/format'
import styles from './MlaMiniGroup.module.css'

export interface MlaMini {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
}

export default function MlaMiniGroup({ party, members, basePath }: { party: string; members: MlaMini[]; basePath: string }) {
  return (
    <div className={styles.partyGroup}>
      <div className={styles.partyGroupHead}>
        <i className={styles.partySquare} style={{ background: partyBorderColor(party) }} aria-hidden="true" />
        <span className={styles.partyFull}>
          <span className={styles.partyLong}>{party}</span>
          <span className={styles.partyShort} aria-hidden="true">{displayParty(party)}</span>
        </span>
        <span className={styles.partyGroupCount}>{members.length}</span>
      </div>
      <ul className={styles.minis} aria-label={party}>
        {members.map(m => (
          <li key={m.personId} className={styles.mini}>
            <span className={styles.miniPhoto}>
              <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={128} decorative square personId={m.personId} />
            </span>
            <Link
              href={`${basePath}/assembly/mlas/${m.personId}`}
              className={styles.miniName}
              title={`${formatMemberName(m.fullName)}${m.constituency ? `, ${m.constituency}` : ''}`}
            >
              {formatMemberName(m.fullName)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
