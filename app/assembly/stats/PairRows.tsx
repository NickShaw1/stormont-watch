import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty } from '@/lib/format'
import type { MlaPair, PairMla } from '@/lib/db/queries'
import styles from './statsKit.module.css'

const pctText = (p: number) => `${Number(p.toFixed(1))}%`

function Person({ m }: { m: PairMla }) {
  return (
    <span className={styles.pairPerson}>
      <span className={styles.pairPhoto}><MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={128} decorative square personId={m.personId} /></span>
      <span className={styles.pairText}>
        <span className={styles.pairName} title={formatMemberName(m.fullName)}>{formatMemberName(m.fullName)}</span>
        {m.party && <span className="party-pill" data-party={abbreviateParty(m.party)}><PartyName party={m.party} /></span>}
      </span>
    </span>
  )
}

function Row({ pair, rank, mode }: { pair: MlaPair; rank: number; mode: 'agree' | 'split' }) {
  const split = pair.shared - pair.same
  const pct = mode === 'agree' ? pair.pct : (split * 100) / pair.shared
  return (
    <li className={styles.pairItem} data-mode={mode}>
      <span className={styles.pairNum}>{rank}</span>
      <div className={styles.pairBody}>
        <div className={styles.pairPeople}>
          <Person m={pair.a} />
          <span className={styles.pairVs} aria-hidden="true">vs</span>
          <Person m={pair.b} />
        </div>
        <div className={styles.pairMeter}>
          <span className={styles.pairTrack} aria-hidden="true"><i className={styles.pairFill} style={{ width: `${pct}%` }} /></span>
          <span className={styles.pairFigure}>
            <b>{pctText(pct)}</b>
            <span className={styles.pairLong}>{mode === 'agree' ? `voted the same way in ${pair.same} of ${pair.shared} divisions` : `voted differently in ${split} of ${pair.shared} divisions`}</span>
            <span className={styles.pairShort}>{mode === 'agree' ? `${pair.same} of ${pair.shared}` : `${split} of ${pair.shared}`}</span>
          </span>
        </div>
      </div>
    </li>
  )
}

export default function PairRows({ pairs, label, mode }: { pairs: MlaPair[]; label: string; mode: 'agree' | 'split' }) {
  return (
    <ol className={styles.pairList} aria-label={label}>
      {pairs.map((p, i) => <Row key={`${p.a.personId}-${p.b.personId}`} pair={p} rank={i + 1} mode={mode} />)}
    </ol>
  )
}
