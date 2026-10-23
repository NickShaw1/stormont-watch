import { abbreviateParty } from '@/lib/format'
import { VOTE_ORDER, VOTE_LABEL, type VoteKey, type Ballot } from './voteMeta'
import styles from './divisionDetail.module.css'

export default function PartyChart({ ballots }: { ballots: Ballot[] }) {
  const map = new Map<string, Record<VoteKey, number>>()
  for (const b of ballots) {
    const key = b.party ?? 'Independent'
    const row = map.get(key) ?? { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
    row[b.vote]++
    map.set(key, row)
  }
  const parties = [...map.entries()]
    .map(([party, counts]) => ({ party, counts, total: VOTE_ORDER.reduce((n, v) => n + counts[v], 0) }))
    .sort((a, b) => b.total - a.total)
  const present = VOTE_ORDER.filter((v) => parties.some((p) => p.counts[v] > 0))
  const shortOf = (party: string) => (party === 'Independent' ? 'Independent' : abbreviateParty(party))

  return (
    <div className={styles.partyChart}>
      <div className={styles.ledgerHead}>
        <h3 className={styles.lobbiesTitle} id="party-chart-heading">How each party voted</h3>
        <ul className={styles.ledgerKey} aria-label="Key: one square is one MLA">
          {present.map((v) => (
            <li key={v} data-vote={v}>
              <i aria-hidden="true" />
              {VOTE_LABEL[v]}
            </li>
          ))}
        </ul>
      </div>
      <ul className={styles.ledger} aria-labelledby="party-chart-heading">
        {parties.map(({ party, counts }) => (
          <li key={party} className={styles.ledgerRow}>
            <span className={`party-pill ${styles.ledgerName}`} data-party={shortOf(party)} title={party}>{shortOf(party)}</span>
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
