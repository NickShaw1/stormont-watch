import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartiesClient from './PartiesClient'
import AssemblyHemicycle from '@/components/AssemblyHemicycle'
import styles from './parties.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the Parties page — rendered by both the live route (current mandate)
 * and the archive route (`/archive/<id>`). `mandate` drives the queries; internal links
 * are built by PartiesClient from mandate context.
 */
export default async function PartiesPageBody({
  mandate,
}: {
  mandate: Mandate
}) {
  const parties = await getAllPartiesWithStats(mandate.id)

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className="eyebrow">The Assembly</span>
          <h1>Parties</h1>
          <p className={styles.lede}>Political parties represented in the Northern Ireland Assembly.</p>
        </div>
        <hr className={styles.mobileRule} />
        <div className={styles.headerChart}>
          <AssemblyHemicycle parties={parties.map(p => ({ party: p.party, mlaCount: p.mlaCount }))} />
        </div>
      </header>
      <PartiesClient parties={parties} />
    </div>
  )
}
