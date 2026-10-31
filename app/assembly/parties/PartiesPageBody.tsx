import { getAllPartiesWithStats, getMembersGroupedByParty, getAverageAttendance } from '@/lib/db/queries'
import { attendanceFloor, gradeAttendance } from '@/lib/attendance'
import PartiesClient from './PartiesClient'
import AssemblyHemicycle from '@/components/AssemblyHemicycle'
import HeadArt from './HeadArt'
import styles from './parties.module.css'
import type { Mandate } from '@/lib/constants/mandates'

// Shared by the live route and the archive route.
// Internal links are built by PartiesClient from mandate context.
export default async function PartiesPageBody({
  mandate,
}: {
  mandate: Mandate
}) {
  const [parties, partyGroups, averageAttendance] = await Promise.all([
    getAllPartiesWithStats(mandate.id),
    getMembersGroupedByParty(mandate.id),
    getAverageAttendance(mandate.id),
  ])

  // Mean of each current MLA's own figure, the same method as the shared average.
  const floor = attendanceFloor(partyGroups.flatMap((g) => g.mlas), averageAttendance)
  const attendance: Record<string, { pct: number; grade: 'good' | 'low' | 'poor' }> = {}
  for (const group of partyGroups) {
    const values = group.mlas
      .map((m) => m.attendance_pct)
      .filter((v): v is number => v !== null)
      .map(Number)
    if (values.length === 0) continue
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    attendance[group.party] = { pct: Math.round(mean), grade: gradeAttendance(mean, averageAttendance, floor) }
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage} ${styles.chartBand}`} aria-label="Assembly seats by party">
        <div className="container">
          <div className={styles.chart}>
            <p className={styles.chartLabel}>Northern Ireland Assembly: {mandate.label}</p>
            <AssemblyHemicycle parties={parties.map(p => ({ party: p.party, slug: p.slug, mlaCount: p.mlaCount }))} />
            <p className={styles.chartHint}>Select a seat or a party to see its MLAs.</p>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandPage} ${styles.phoneHead}`} aria-labelledby="parties-title-phone">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>The Assembly</span>
            <h1 className={styles.h1} id="parties-title-phone">Parties</h1>
            <p className={styles.headSub}>Political parties represented in the Assembly.</p>
          </header>
          <HeadArt className={styles.headArt} parties={parties.map(p => ({ party: p.party, slug: p.slug, mlaCount: p.mlaCount }))} />
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint} ${styles.listBand}`} aria-label="Parties list">
        <div className="container">
          <header className={`${styles.head} ${styles.deskHead}`}>
            <span className={styles.eyebrow}>The Assembly</span>
            <h1 className={styles.h1} id="parties-title">Parties</h1>
            <p className={styles.headSub}>Political parties represented in the Assembly.</p>
          </header>
          <PartiesClient parties={parties} attendance={attendance} averageAttendance={averageAttendance} />
        </div>
      </section>
    </div>
  )
}
