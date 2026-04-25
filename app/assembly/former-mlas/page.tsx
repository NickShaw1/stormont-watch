import type { Metadata } from 'next'
import Link from 'next/link'
import { getFormerMembers } from '@/lib/db/queries'
import { formatDate, formatMemberName, formatConstituency, partyBorderColor, abbreviateParty } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'
import styles from '../mlas/mlas.module.css'

export const revalidate = 86400

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
    <div>
      <div className="container">
        <header className={styles.pageHeader} style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 'var(--s-8)' }}>
          <span className="eyebrow">The Assembly</span>
          <h1>Former MLAs</h1>
          <p className={styles.lede}>Members who left the Assembly during the current 2022–2027 mandate.</p>
          <p className={styles.formerMlasLink}>
            <Link href="/assembly/mlas">← Back to all MLAs</Link>
          </p>
        </header>
      </div>

      <div className="container">
        {partyGroups.map(({ party, mlas }) => (
          <section
            key={party}
            aria-labelledby={`party-${party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
            className={styles.partySection}
          >
            <h2
              id={`party-${party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              className={styles.partyHeading}
            >
              <span className={styles.partySwatch} style={{ background: partyBorderColor(party) }} aria-hidden="true" />
              <span className={styles.partyNameFull}>{party}</span>
              <span className={styles.partyNameShort} aria-hidden="true">{abbreviateParty(party)}</span>
              <span className={styles.partyCount}>{mlas.length} MLAs</span>
            </h2>
            <ul className={styles.mlaGrid} role="list">
              {mlas.map((mla) => (
                <li key={mla.personId} className={styles.mlaCardWrapper}>
                  <div className={styles.mlaCard}>
                    <div className={styles.mlaPhoto}>
                      <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={64} decorative />
                    </div>
                    <Link
                      href={`/assembly/mlas/${mla.personId}`}
                      className={styles.mlaName}
                      aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                    >
                      {formatMemberName(mla.fullName)}
                    </Link>
                    <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                    <div className={styles.mlaFoot}>
                      <span className={styles.mlaAtt}>
                        {mla.mandateEnd ? `Left ${formatDate(mla.mandateEnd)}` : 'Left Assembly'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
