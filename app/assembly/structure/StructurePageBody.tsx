import { getAllMinisters, getAllCommitteeChairs, getPresidingOfficers } from '@/lib/db/queries'

import StructureClient from './StructureClient'
import styles from './structure.module.css'
import type { Mandate } from '@/lib/constants/mandates'

/**
 * Official links for departments (mandate-independent) and standing committees. Committee
 * pages on niassembly.gov.uk are namespaced by the mandate id (e.g. `.../committees/2022-2027/…`),
 * so the committee URLs are built from the active mandate. Note: a future mandate's committee
 * pages only exist once that Assembly forms, so the 2027-2032 links resolve at the boundary.
 */
function officialLinksFor(mandateId: string): Record<string, string> {
  const c = `https://www.niassembly.gov.uk/assembly-business/committees/${mandateId}`
  return {
    'Department for Communities': 'https://www.communities-ni.gov.uk/',
    'Department for Infrastructure': 'https://www.infrastructure-ni.gov.uk/',
    'Department for the Economy': 'https://www.economy-ni.gov.uk/',
    'Department of Agriculture, Environment and Rural Affairs': 'https://www.daera-ni.gov.uk/',
    'Department of Education': 'https://www.education-ni.gov.uk/',
    'Department of Finance': 'https://www.finance-ni.gov.uk/',
    'Department of Health': 'https://www.health-ni.gov.uk/',
    'Department of Justice': 'https://www.justice-ni.gov.uk/',
    'Assembly and Executive Review Committee': `${c}/assembly-and-executive-review-committee/`,
    'Audit Committee': `${c}/audit/`,
    'Committee for Agriculture, Environment and Rural Affairs': `${c}/agriculture-environment-and-rural-affairs/`,
    'Committee for Communities': `${c}/communities/`,
    'Committee for Education': `${c}/education/`,
    'Committee for Finance': `${c}/finance/`,
    'Committee for Health': `${c}/health/`,
    'Committee for Infrastructure': `${c}/infrastructure/`,
    'Committee for Justice': `${c}/justice/`,
    'Committee for The Executive Office': `${c}/executive-office/`,
    'Committee for the Economy': `${c}/economy/`,
    'Committee on Procedures': `${c}/procedures/`,
    'Committee on Standards and Privileges': `${c}/standards-and-privileges/`,
    'Northern Ireland Assembly Commission': 'https://www.niassembly.gov.uk/about-the-assembly/assembly-commission/',
    'Public Accounts Committee': `${c}/public-accounts/`,
    'Windsor Framework Democratic Scrutiny Committee': `${c}/windsor-framework-democratic-scrutiny-committee/`,
  }
}

/**
 * Shared body for the Assembly structure page — rendered by both the live route (current
 * mandate) and the archive route (`/archive/<id>`). `mandate` drives the queries; internal
 * links are built by StructureClient from mandate context.
 */
export default async function StructurePageBody({
  mandate,
}: {
  mandate: Mandate
}) {
  const [ministers, chairs, presidingOfficers] = await Promise.all([
    getAllMinisters(mandate.id),
    getAllCommitteeChairs(mandate.id),
    getPresidingOfficers(mandate.id),
  ])

  const fm = ministers.find(
    (m) => /first minister/i.test(m.roleTitle ?? '') &&
    !/deputy/i.test(m.roleTitle ?? ''),
  )
  const dfm = ministers.find(
    (m) => /deputy first minister/i.test(m.roleTitle ?? ''),
  )
  const juniorMinisters = ministers.filter(
    (m) => m.roleTitle?.toLowerCase() === 'junior minister',
  )
  const departments = ministers.filter(
    (m) => m.department !== 'The Executive Office',
  )

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <span className="eyebrow">The Assembly</span>
        <h1>Who&apos;s in Charge</h1>
        <p className={styles.lede}>The power-sharing Executive, ministerial departments and committee chairs of the Northern Ireland Assembly.</p>
      </header>
      <StructureClient
        fm={fm}
        dfm={dfm}
        juniorMinisters={juniorMinisters}
        departments={departments}
        chairs={chairs}
        officialLinks={officialLinksFor(mandate.id)}
        presidingOfficers={presidingOfficers}
      />
    </div>
  )
}
