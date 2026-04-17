import type { Metadata } from 'next'
import React from 'react'
import Link from 'next/link'
import { getFormerMembers } from '@/lib/db/queries'

export const revalidate = 86400
import { formatDate, formatMemberName, formatConstituency, partyBorderColor } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'
import styles from '../mlas/mlas.module.css'

export const metadata: Metadata = {
  title: 'Former MLAs',
  description: 'Members of the Legislative Assembly who left during the current mandate.',
  openGraph: {
    title: 'Former MLAs — Stormont Watch',
    description: 'Members of the Legislative Assembly who left during the current mandate.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/former-mlas' },
}

export default async function FormerMlasPage() {
  const partyGroups = await getFormerMembers()

  return (
    <div className="container">
      <header className={`page-header ${styles.formerPageHeader}`} style={{ paddingBottom: 0 }}>
        <nav aria-label="Breadcrumb" className={`breadcrumb ${styles.formerBreadcrumb}`}>
          <ol>
            <li><Link href="/assembly/mlas">MLAs</Link></li>
            <li aria-current="page">Former MLAs</li>
          </ol>
        </nav>
        <h1>Former MLAs</h1>
        <div className="page-header-rule"></div>
        <p>Members who left the Assembly during the current mandate.</p>
      </header>

      {partyGroups.map(({ party, mlas }) => (
        <React.Fragment key={party}>
        <hr className={styles.sectionRule} />
        <section
          aria-labelledby={`party-${party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
          className={styles.partySection}
        >
          <h2
            id={`party-${party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
            style={{ borderLeft: `4px solid ${partyBorderColor(party)}` }}
            className={styles.partyHeading}
          >
            {party}
          </h2>
          <ul className={styles.mlaGrid} role="list">
            {mlas.map((mla) => (
              <li key={mla.personId} className={styles.mlaCardWrapper} style={{ '--party-color': partyBorderColor(mla.party) } as React.CSSProperties}>
                <div className={styles.mlaCard}>
                  <MlaPhoto
                    name={mla.fullName}
                    imgUrl={mla.imgUrl ?? ''}
                    size={100}
                    decorative
                  />
                  <Link
                    href={`/assembly/mlas/${mla.personId}`}
                    className={styles.mlaName}
                    aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                  >
                    {formatMemberName(mla.fullName)}
                  </Link>
                  <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                  <span className={styles.attendanceBadge}>
                    {mla.mandateEnd ? `Left ${formatDate(mla.mandateEnd)}` : 'Left Assembly'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        </React.Fragment>
      ))}
    </div>
  )
}
