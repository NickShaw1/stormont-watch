export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getMembersGroupedByParty, getAllMinisters, getAllCommitteeChairs } from '@/lib/db/queries'

import MlasListClient from './MlasListClient'
import styles from './mlas.module.css'

export const metadata: Metadata = {
  title: 'MLAs',
  description: 'All current Members of the Northern Ireland Legislative Assembly. View voting records, expenses and registered interests for every MLA.',
  openGraph: {
    title: 'MLAs — Stormont Watch',
    description: 'All current Members of the Northern Ireland Legislative Assembly. View voting records, expenses and registered interests for every MLA.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/mlas' },
}

export default async function MlasPage() {
  const [partyGroups, ministers, chairs] = await Promise.all([
    getMembersGroupedByParty(),
    getAllMinisters(),
    getAllCommitteeChairs(),
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

  return (
    <div>
      <div className="container">
        <header className={styles.pageHeader}>
          <span className="eyebrow">The Assembly</span>
          <h1>All 90 MLAs</h1>
          <p className={styles.lede}>Every Member of the Legislative Assembly elected to the 2022–2027 mandate.</p>
          <p className={styles.formerMlasLink}>
            <Link href="/assembly/former-mlas">Former MLAs from this mandate ↗</Link>
          </p>
        </header>
      </div>
      <MlasListClient partyGroups={partyGroups} roleLookup={roleLookup} />
    </div>
  )
}
