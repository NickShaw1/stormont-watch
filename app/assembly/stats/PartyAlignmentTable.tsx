import { abbreviateParty, partyBorderColor } from '@/lib/format'
import type { PartyAlignmentRow } from '@/lib/db/queries'
import styles from './stats.module.css'

interface Props {
  data: PartyAlignmentRow[]
  totalDivisions: number
}

export default function PartyAlignmentTable({ data, totalDivisions }: Props) {
  const tables = [
    {
      title: 'Agreement with Sinn Féin',
      agreed: (r: PartyAlignmentRow) => r.sfAgreed,
      pct: (r: PartyAlignmentRow) => r.sfAgreePct,
    },
    {
      title: 'Agreement with DUP',
      agreed: (r: PartyAlignmentRow) => r.dupAgreed,
      pct: (r: PartyAlignmentRow) => r.dupAgreePct,
    },
  ]

  return (
    <>
      {tables.map((table) => {
        const sorted = [...data].sort((a, b) => table.pct(b) - table.pct(a))
        return (
          <div key={table.title} className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>{table.title}</p>
            <table className={styles.partyRankingTable}>
              <thead>
                <tr>
                  <th scope="col">Party</th>
                  <th scope="col">Divisions</th>
                  <th scope="col" aria-label="Proportion"></th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const color = partyBorderColor(row.party)
                  const barPct = Math.round((table.pct(row) / 100) * 100)
                  return (
                    <tr key={row.party}>
                      <td>
                        <span className={styles.partyRankingParty}>
                          <span className={styles.partyDot} style={{ background: color }} aria-hidden="true" />
                          {abbreviateParty(row.party)}
                        </span>
                      </td>
                      <td className={styles.cohesionMembers}>{table.agreed(row)}</td>
                      <td className={styles.partyRankingBarCell}>
                        <div className={styles.partyRankingBarTrack} aria-hidden="true">
                          <div className={styles.partyRankingBarFill} style={{ width: `${barPct}%`, background: color }} />
                        </div>
                      </td>
                      <td className={styles.partyRankingValue}>{table.pct(row)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
