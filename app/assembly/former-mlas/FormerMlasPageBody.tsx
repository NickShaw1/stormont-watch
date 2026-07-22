import Link from 'next/link'
import { getFormerMembers } from '@/lib/db/queries'
import { formatDate, formatMemberName, formatConstituency, partyBorderColor, abbreviateParty } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'
import styles from '../mlas/mlas.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Shared body for the Former MLAs page — rendered by both the live route (current
 * mandate, basePath '') and the archive route (`/archive/<id>`). `mandate` drives the
 * query and copy; `basePath` prefixes internal links.
 */
export default async function FormerMlasPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const partyGroups = await getFormerMembers(mandate.id)

  return (
    <div>
      <div className="container">
        <header className={styles.pageHeader} style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 'var(--s-8)' }}>
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <ol>
              <li><Link href={`${basePath}/assembly/mlas`}>MLAs</Link></li>
              <li aria-current="page"><span>Former MLAs</span></li>
            </ol>
          </nav>
          <h1>Former MLAs</h1>
          <p className={styles.lede}>Members who left the Assembly during the current {mandate.label} mandate.</p>
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
                      href={`${basePath}/assembly/mlas/${mla.personId}`}
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
