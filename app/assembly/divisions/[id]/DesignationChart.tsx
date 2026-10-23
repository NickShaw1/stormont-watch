import { VOTE_ORDER, VOTE_LABEL, type VoteKey, type Ballot } from './voteMeta'
import styles from './divisionDetail.module.css'

const GROUPS = [
  { key: 'Unionist', colour: '#f97316' },
  { key: 'Nationalist', colour: '#15803d' },
  { key: 'Other', colour: '#9e9e9e' },
] as const

export default function DesignationChart({ ballots, insight }: { ballots: Ballot[]; insight: { label: string; tone: string } | null }) {
  const rows = GROUPS.map((g) => {
    const counts: Record<VoteKey, number> = { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
    for (const b of ballots) if ((b.designation ?? 'Other') === g.key) counts[b.vote]++
    return { ...g, counts }
  })

  return (
    <div className={styles.partyChart}>
      <div className={styles.ledgerHead}>
        <h3 className={styles.lobbiesTitle} id="designation-heading">Across the divide</h3>
        {insight && <span className={styles.pill} data-cat={insight.tone}>{insight.label}</span>}
      </div>
      <ul className={styles.ledger} aria-labelledby="designation-heading">
        {rows.map(({ key, colour, counts }) => (
          <li key={key} className={styles.ledgerRow}>
            <span className={`${styles.desigLabel} ${styles.ledgerName}`}>
              <i style={{ background: colour }} aria-hidden="true" />
              {key}
            </span>
            <div className={styles.ledgerGroups}>
              {VOTE_ORDER.filter((v) => counts[v] > 0).map((v) => (
                <div key={v} className={styles.ledgerGroup} data-vote={v}>
                  <b>{counts[v]}<span className="sr-only"> {VOTE_LABEL[v]}</span></b>
                  <span className={styles.squares} aria-hidden="true">
                    {Array.from({ length: counts[v] }, (_, i) => <i key={i} />)}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
