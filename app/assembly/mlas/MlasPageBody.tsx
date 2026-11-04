import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs, getFormerMembers, getAverageAttendance } from '@/lib/db/queries'
import type { Mandate } from '@/lib/constants/mandates'
import { attendanceFloor } from '@/lib/attendance'
import { buildRoleLookup } from '@/lib/mlaRow'
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

  const roleLookup = buildRoleLookup(ministers, chairs)

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
