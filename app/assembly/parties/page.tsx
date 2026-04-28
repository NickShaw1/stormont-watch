export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartiesClient from './PartiesClient'
import AssemblyHemicycle from '@/components/AssemblyHemicycle'
import styles from './parties.module.css'


export const metadata: Metadata = {
  title: 'Parties',
  description: 'Every political party in the Northern Ireland Assembly — voting records, attendance, party cohesion, expenses and MLA profiles for the 2022–2027 mandate.',
  openGraph: {
    title: 'Parties — Stormont Watch',
    description: 'Every political party in the Northern Ireland Assembly — voting records, attendance, party cohesion, expenses and MLA profiles for the 2022–2027 mandate.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/parties' },
}

export default async function PartiesPage() {
  const parties = await getAllPartiesWithStats()

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
