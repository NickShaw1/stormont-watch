import { buildSeats, SR, VIEW_TOP, VIEW_X, VIEW_W, H, type HemicycleParty } from '@/lib/hemicycle'
import styles from './partyDetail.module.css'

// The Assembly's hemicycle with one party's seats lit; colours come from the hero's CSS variables.
export default function PartySeats({ parties, party, label }: { parties: HemicycleParty[]; party: string; label: string }) {
  const seats = buildSeats(parties)
  const total = parties.reduce((sum, p) => sum + p.mlaCount, 0)
  const own = parties.find((p) => p.party === party)?.mlaCount ?? 0

  return (
    <figure className={styles.seats}>
      <div className={styles.seatsPlot}>
        <svg viewBox={`${VIEW_X} ${VIEW_TOP} ${VIEW_W} ${H - VIEW_TOP}`} role="img" aria-label={label}>
          {seats.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={SR + 1.5} className={s.party === party ? styles.seatLit : styles.seatDim} />
          ))}
        </svg>
        <div className={styles.seatsCentre} aria-hidden="true">
          <span className={styles.seatsNum}>{own}</span>
          <span className={styles.seatsOf}>of {total} seats</span>
        </div>
      </div>
    </figure>
  )
}
