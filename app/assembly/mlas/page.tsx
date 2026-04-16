import type { Metadata } from 'next'
import Link from 'next/link'
import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs, getAllMembers } from '@/lib/db/queries'

export const revalidate = 86400
import MlasListClient from './MlasListClient'
import styles from './mlas.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const members = await getAllMembers()
  const count = members.length
  const description = `Track how all ${count} current MLAs vote in the Northern Ireland Assembly. View attendance, expenses and registered interests.`
  return {
    title: 'MLAs',
    description,
    openGraph: {
      title: 'MLAs — Stormont Watch',
      description,
    },
    alternates: { canonical: 'https://www.stormontwatch.com/assembly/mlas' },
  }
}

export default async function MlasPage() {
  const [partyGroups, ministers, chairs] = await Promise.all([
    getMembersGroupedByParty(),
    getAllMinisters(),
    getAllCommitteeChairs(),
  ])

  // Short labels for desktop badge
  const roleLookup: Record<string, string> = {}
  // Full labels for mobile banner
  const roleLookupFull: Record<string, string> = {}

  for (const m of ministers) {
    if (m.roleTitle === 'First Minister') {
      roleLookup[m.personId] = 'First Minister'
      roleLookupFull[m.personId] = 'First Minister'
    } else if (m.roleTitle === 'deputy First Minister') {
      roleLookup[m.personId] = 'Deputy FM'
      roleLookupFull[m.personId] = 'Deputy First Minister'
    } else if (m.roleTitle?.toLowerCase() === 'junior minister') {
      roleLookup[m.personId] = 'Junior Minister'
      roleLookupFull[m.personId] = 'Junior Minister'
    } else {
      const dept = (m.department ?? '').trim()
      roleLookup[m.personId] = 'Minister'
      roleLookupFull[m.personId] = dept ? `Minister, ${dept}` : 'Minister'
    }
  }
  for (const c of chairs) {
    if (!roleLookup[c.personId]) {
      roleLookup[c.personId] = 'Chair'
      const committeeName = (c.committeeName ?? '').trim()
      roleLookupFull[c.personId] = committeeName ? `Chair, ${committeeName}` : 'Committee Chair'
    }
  }

  return (
    <div>
      <div className="container">
        <header className={`page-header ${styles.pageHeader}`}>
          <h1>MLAs</h1>
          <div className="page-header-rule"></div>
          <p>All current Members of the Legislative Assembly.</p>
        </header>
      </div>
      <MlasListClient partyGroups={partyGroups} roleLookup={roleLookup} roleLookupFull={roleLookupFull} />
      <div className="container">
        <hr className={styles.searchRule} />
        <p className={styles.formerMlasLink}>
          <Link href="/assembly/former-mlas">Former MLAs from this mandate <span aria-hidden="true">↗</span></Link>
        </p>
      </div>
    </div>
  )
}
