import type { Metadata } from 'next'
import { getAllDivisionsForList } from '@/lib/db/queries'

export const revalidate = 86400
import { isPassed } from '@/lib/bills'
import VotesListClient from './VotesListClient'
import type { VoteItem } from './VotesListClient'
import styles from './votes.module.css'

export const metadata: Metadata = {
  title: 'Votes',
  description: 'Every recorded division in the Northern Ireland Assembly since the 2022 mandate. Search and filter by date, outcome and subject.',
  openGraph: {
    title: 'Votes — Stormont Watch',
    description: 'Every recorded division in the Northern Ireland Assembly since the 2022 mandate. Search and filter by date, outcome and subject.',
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
    totalAyes: d.totalAyes ?? null,
    totalNoes: d.totalNoes ?? null,
  }))

  return (
    <div className="container">
      <header className={`${styles.pageHeader} page-header`}>
        <span className="eyebrow">The vote record</span>
        <h1>Divisions</h1>
        <p className={styles.lede}>Every recorded division in the Assembly since May 2022 including cross-community votes, opposition motions and bill stages. Click any division to see the full roll-call.</p>
      </header>
      <p className={styles.notice}>The Assembly did not sit between May 2022 and February 2024. No divisions were recorded during this period aside from procedural Speaker nomination votes.</p>
      <VotesListClient allItems={allItems} />
    </div>
  )
}
