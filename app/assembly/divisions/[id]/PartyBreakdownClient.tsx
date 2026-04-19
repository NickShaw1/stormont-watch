'use client'
import { abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import RollCallChartClient from './RollCallChartClient'
import styles from './divisionDetail.module.css'

type Vote = {
  personId: string
  fullName: string
  party?: string | null
  vote: string
}

type PartyRow = {
  party: string
  ayes: number
  noes: number
  noShows: number
  abstains: number
}

function buildPartyRows(votes: Vote[]): PartyRow[] {
  const map = new Map<string, PartyRow>()
  for (const v of votes) {
    const party = v.party ?? 'Independent'
    if (!map.has(party)) map.set(party, { party, ayes: 0, noes: 0, noShows: 0, abstains: 0 })
    const row = map.get(party)!
    if (v.vote === 'AYE') row.ayes++
    else if (v.vote === 'NO') row.noes++
    else if (v.vote === 'NO_SHOW') row.noShows++
    else if (v.vote === 'ABSTAINED') row.abstains++
  }
  return [...map.values()].sort((a, b) => (b.ayes + b.noes + b.noShows + b.abstains) - (a.ayes + a.noes + a.noShows + a.abstains))
}

export default function PartyBreakdownClient({ votes }: { votes: Vote[] }) {
  const rows = buildPartyRows(votes)
  const hasNoShow = votes.some((v) => v.vote === 'NO_SHOW')

  const fmt = (n: number) => n === 0 ? '-' : n

  return (
    <div className={styles.designationLayout}>
      <div className={styles.partyBlocGrid}>
        <div className={styles.partyBlocHeaderRow}>
          <span />
          <span className={styles.blocColHead}>Aye</span>
          <span className={styles.blocColHead}>No</span>
          {hasNoShow && <span className={styles.blocColHead}>NS</span>}
          <span className={styles.blocColHead}>Abs</span>
        </div>
        {rows.map((row) => (
          <div key={row.party} className={styles.partyBlocItem}>
            <span className={styles.partyBlocLabel}>
              <span className="party-pill" data-party={abbreviateParty(row.party)}>
                <PartyName party={row.party} />
              </span>
            </span>
            <span className={styles.blocCell}>{fmt(row.ayes)}</span>
            <span className={styles.blocCell}>{fmt(row.noes)}</span>
            {hasNoShow && <span className={styles.blocCell}>{fmt(row.noShows)}</span>}
            <span className={styles.blocCell}>{fmt(row.abstains)}</span>
          </div>
        ))}
      </div>
      <div className={styles.designationSep} />
      <RollCallChartClient votes={votes} />
    </div>
  )
}
