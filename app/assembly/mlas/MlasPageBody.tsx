import { UsersRound } from 'lucide-react'
import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs, getFormerMembers } from '@/lib/db/queries'
import MlasListClient from './MlasListClient'
import styles from './mlas.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the MLA list, rendered by both the live route (current mandate)
 * and the archive route. Also fetches former members so the client can offer a
 * "Former MLAs" toggle alongside By Party/By Constituency.
 */
export default async function MlasPageBody({
  mandate,
}: {
  mandate: Mandate
}) {
  const [partyGroups, ministers, chairs, formerGroups] = await Promise.all([
    getMembersGroupedByParty(mandate.id),
    getAllMinisters(mandate.id),
    getAllCommitteeChairs(mandate.id),
    getFormerMembers(mandate.id),
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
          <span className={styles.pageHeaderEyebrow}>The Assembly</span>
          <h1 className={styles.pageHeaderTitle}>
            <UsersRound className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
            All {total} MLAs
          </h1>
          <p className={styles.lede}>Every Member of the Legislative Assembly elected to the {mandate.label} mandate.</p>
        </header>
      </div>
      <MlasListClient partyGroups={partyGroups} roleLookup={roleLookup} formerGroups={formerGroups} />
    </div>
  )
}
