import type { Metadata } from 'next'
import { getAllDivisionsForList } from '@/lib/db/queries'

export const revalidate = 86400
import { isPassed } from '@/lib/bills'
import VotesListClient from './VotesListClient'
import type { VoteItem } from './VotesListClient'
import styles from './votes.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const rows = await getAllDivisionsForList()
  const count = rows.length
  const description = `Browse ${count} votes cast in the Northern Ireland Assembly since February 2024.`
  return {
    title: 'Votes',
    description,
    openGraph: {
      title: 'Votes — Stormont Watch',
      description,
    },
    alternates: { canonical: 'https://www.stormontwatch.com/assembly/votes' },
  }
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
    isBill: /NIA Bill/i.test(d.subject ?? ''),
    isCrossCommunity: d.divisionType === 'Cross-Community',
  }))

  return (
    <div>
      <div className="container">
        <header className={`page-header ${styles.pageHeader}`}>
          <h1>Votes</h1>
          <div className="page-header-rule"></div>
          <p>Every vote in the Northern Ireland Assembly since February 2024.</p>
        </header>
      </div>
      <VotesListClient allItems={allItems} />
    </div>
  )
}
