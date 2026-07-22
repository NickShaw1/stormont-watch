import Link from 'next/link'
import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs } from '@/lib/db/queries'
import MlasListClient from './MlasListClient'
import styles from './mlas.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the MLA list — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function MlasPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [partyGroups, ministers, chairs] = await Promise.all([
    getMembersGroupedByParty(mandate.id),
    getAllMinisters(mandate.id),
    getAllCommitteeChairs(mandate.id),
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

  const total = partyGroups.reduce((s, g) => s + g.mlas.length, 0)

  return (
    <div>
      <div className="container">
        <header className={styles.pageHeader}>
          <span className="eyebrow">The Assembly</span>
          <h1>All {total} MLAs</h1>
          <p className={styles.lede}>Every Member of the Legislative Assembly elected to the {mandate.label} mandate.</p>
          <p className={styles.formerMlasLink}>
            <Link href={`${basePath}/assembly/former-mlas`}>Former MLAs from this mandate ↗</Link>
          </p>
        </header>
      </div>
      <MlasListClient partyGroups={partyGroups} roleLookup={roleLookup} />
    </div>
  )
}
