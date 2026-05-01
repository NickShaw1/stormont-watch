'use client'

import { partyBorderColor, abbreviateParty } from '@/lib/format'
import styles from './stats.module.css'

interface Props {
  data: { party: string; attendancePct: number; memberCount: number }[]
}

export default function PartyAttendanceChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.attendancePct), 1)

  return (
    <div className={styles.partyAttendanceChart}>
      {data.map((row) => {
        const color = partyBorderColor(row.party)
        const barPct = Math.round((row.attendancePct / max) * 100)
        return (
          <div key={row.party} className={styles.partyAttendanceRow}>
            <span className={styles.partyAttendanceLabel}>
              <span
                className={styles.partyAttendanceDot}
                style={{ background: color }}
                aria-hidden="true"
              />
              {abbreviateParty(row.party)}
            </span>
            <div className={styles.partyAttendanceTrack} aria-hidden="true">
              <div
                className={styles.partyAttendanceFill}
                style={{ width: `${barPct}%`, background: color }}
              />
            </div>
            <span className={styles.partyAttendanceValue}>{row.attendancePct}%</span>
          </div>
        )
      })}
    </div>
  )
}
