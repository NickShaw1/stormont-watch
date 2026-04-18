import type { Metadata } from 'next'
import { getAllDivisionsForList } from '@/lib/db/queries'

export const revalidate = 86400
import { isPassed } from '@/lib/bills'
import VotesListClient from './VotesListClient'
import type { VoteItem } from './VotesListClient'
import styles from './votes.module.css'

export const metadata: Metadata = {
  title: 'Votes',
  description: 'Every recorded vote in the Northern Ireland Assembly since the 2022 mandate. Search and filter divisions by date, outcome and subject.',
  openGraph: {
    title: 'Votes — Stormont Watch',
    description: 'Every recorded vote in the Northern Ireland Assembly since the 2022 mandate. Search and filter divisions by date, outcome and subject.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/votes' },
}

export default async function VotesPage() {
  const rows = await getAllDivisionsForList()

  const allItems: VoteItem[] = rows.map((d) => ({
    key: d.documentId,
    href: `/assembly/divisions/${d.documentId}`,
    rawTitle: d.title ?? null,
    subject: d.subject ?? '',
    latestDate: d.divisionDate.toISOString(),
    passed: isPassed(d.outcome ?? null),
    motionText: d.motionText ?? null,
    isBill: /NIA Bill/i.test(d.subject ?? '') || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(d.subject ?? ''),
    isCrossCommunity: d.divisionType === 'Cross-Community',
  }))

  return (
    <div>
      <div className="container">
        <header className={`page-header ${styles.pageHeader}`}>
          <h1>Votes</h1>
          <div className="page-header-rule"></div>
          <p>Every vote in the Northern Ireland Assembly since May 2022.</p>
          <div className={styles.suspensionCard}>
            <svg className={styles.suspensionIcon} aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#203F59"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p className={styles.suspensionNote}>The Assembly did not sit between May 2022 and February 2024. The only divisions recorded during this period were procedural Speaker nomination votes.</p>
          </div>
        </header>
      </div>
      <VotesListClient allItems={allItems} />
    </div>
  )
}
