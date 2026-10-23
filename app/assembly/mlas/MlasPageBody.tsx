import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs, getFormerMembers, getAverageAttendance } from '@/lib/db/queries'
import type { Mandate } from '@/lib/constants/mandates'
import { attendanceFloor } from '@/lib/attendance'
import MlasListClient from './MlasListClient'
import styles from './mlas.module.css'

// Shared by the live route and the archive route.
export default async function MlasPageBody({ mandate }: { mandate: Mandate }) {
  const [partyGroups, ministers, chairs, formerGroups, averageAttendance] = await Promise.all([
    getMembersGroupedByParty(mandate.id),
    getAllMinisters(mandate.id),
    getAllCommitteeChairs(mandate.id),
    getFormerMembers(mandate.id),
    getAverageAttendance(mandate.id),
  ])

  const roleLookup: Record<string, string> = {}
  for (const m of ministers) {
    if (m.roleTitle === 'First Minister') {
      roleLookup[m.personId] = 'First Minister'
    } else if (m.roleTitle === 'deputy First Minister') {
      roleLookup[m.personId] = 'Deputy FM'
    } else if (m.roleTitle?.toLowerCase() === 'junior minister') {
      roleLookup[m.personId] = 'Junior Minister'
    } else {
      roleLookup[m.personId] = 'Minister'
    }
  }
  for (const c of chairs) {
    if (!roleLookup[c.personId]) roleLookup[c.personId] = 'Chair'
  }

  const allMlas = partyGroups.flatMap((g) => g.mlas)

  return (
    <div className={styles.page}>
      <MlasListClient
        partyGroups={partyGroups}
        roleLookup={roleLookup}
        formerGroups={formerGroups}
        averageAttendance={averageAttendance}
        attendanceFloor={attendanceFloor(allMlas, averageAttendance)}
        totalMlas={allMlas.length}
        mandateLabel={mandate.label}
      />
    </div>
  )
}
