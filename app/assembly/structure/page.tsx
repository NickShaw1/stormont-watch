import type { Metadata } from 'next'
import { getAllMinisters, getAllCommitteeChairs } from '@/lib/db/queries'

export const revalidate = 86400
import StructureClient from './StructureClient'
import styles from './structure.module.css'

export const metadata: Metadata = {
  title: 'Assembly Structure',
  description: 'The Executive, departments and committee chairs of the Northern Ireland Assembly.',
  openGraph: {
    title: 'Assembly Structure — Stormont Watch',
    description: 'The Executive, departments and committee chairs of the Northern Ireland Assembly.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/structure' },
}

const officialLinks: Record<string, string> = {
  'Department for Communities': 'https://www.communities-ni.gov.uk/',
  'Department for Infrastructure': 'https://www.infrastructure-ni.gov.uk/',
  'Department for the Economy': 'https://www.economy-ni.gov.uk/',
  'Department of Agriculture, Environment and Rural Affairs': 'https://www.daera-ni.gov.uk/',
  'Department of Education': 'https://www.education-ni.gov.uk/',
  'Department of Finance': 'https://www.finance-ni.gov.uk/',
  'Department of Health': 'https://www.health-ni.gov.uk/',
  'Department of Justice': 'https://www.justice-ni.gov.uk/',
  'Assembly and Executive Review Committee': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/assembly-and-executive-review-committee/',
  'Audit Committee': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/audit/',
  'Committee for Agriculture, Environment and Rural Affairs': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/agriculture-environment-and-rural-affairs/',
  'Committee for Communities': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/communities/',
  'Committee for Education': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/education/',
  'Committee for Finance': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/finance/',
  'Committee for Health': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/health/',
  'Committee for Infrastructure': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/infrastructure/',
  'Committee for Justice': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/justice/',
  'Committee for The Executive Office': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/executive-office/',
  'Committee for the Economy': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/economy/',
  'Committee on Procedures': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/procedures/',
  'Committee on Standards and Privileges': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/standards-and-privileges/',
  'Northern Ireland Assembly Commission': 'https://www.niassembly.gov.uk/about-the-assembly/assembly-commission/',
  'Public Accounts Committee': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/public-accounts/',
  'Windsor Framework Democratic Scrutiny Committee': 'https://www.niassembly.gov.uk/assembly-business/committees/2022-2027/windsor-framework-democratic-scrutiny-committee/',
}

export default async function StructurePage() {
  const [ministers, chairs] = await Promise.all([
    getAllMinisters(),
    getAllCommitteeChairs(),
  ])

  const fm = ministers.find(
    (m) => m.roleTitle?.toLowerCase().includes('first minister') &&
    !m.roleTitle?.toLowerCase().includes('deputy'),
  )
  const dfm = ministers.find(
    (m) => m.roleTitle?.toLowerCase().includes('deputy first minister'),
  )
  const juniorMinisters = ministers.filter(
    (m) => m.roleTitle?.toLowerCase() === 'junior minister',
  )
  const departments = ministers.filter(
    (m) => m.department !== 'The Executive Office',
  )

  return (
    <div className="container">
      <header className={`page-header ${styles.pageHeader}`}>
        <h1>Assembly Structure</h1>
        <div className="page-header-rule"></div>
        <p>The Executive, ministerial departments and committee chairs.</p>
      </header>
      <StructureClient
        fm={fm}
        dfm={dfm}
        juniorMinisters={juniorMinisters}
        departments={departments}
        chairs={chairs}
        officialLinks={officialLinks}
      />
    </div>
  )
}
