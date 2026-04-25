import type { Metadata } from 'next'
import Link from 'next/link'
import { getQuestionsRankingTable } from '@/lib/db/queries'
import QuestionsRankingClient from './QuestionsRankingClient'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Questions Rankings',
  description: 'All current MLAs ranked by total questions asked since the start of the 2022–27 mandate.',
  openGraph: {
    title: 'Questions Rankings — Stormont Watch',
    description: 'All current MLAs ranked by total questions asked since the start of the 2022–27 mandate.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/questions' },
}

export default async function QuestionsRankingPage() {
  const rawRows = await getQuestionsRankingTable()

  const rows = rawRows.map(r => ({
    personId: r.personId,
    fullName: r.fullName,
    party: r.party,
    constituency: r.constituency,
    imgUrl: r.imgUrl,
    count: Number(r.count),
  }))

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">Questions</li>
          </ol>
        </nav>
        <span className="eyebrow">Northern Ireland Assembly</span>
        <h1>Questions Rankings</h1>
        <p className="lede">
          All current MLAs ranked by total questions asked since the start of the 2022–27 mandate. Excludes current ministers and speakers.
        </p>
      </header>
      <QuestionsRankingClient rows={rows} />
    </div>
  )
}
