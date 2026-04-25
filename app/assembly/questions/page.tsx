export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getQuestionTotalsAllMembers, getAllMembers, getAllMinisters } from '@/lib/db/queries'
import QuestionsRankingClient from './QuestionsRankingClient'

export const metadata: Metadata = {
  title: 'MLA Questions',
  description: 'All current MLAs ranked by total questions tabled in the Northern Ireland Assembly.',
  openGraph: {
    title: 'MLA Questions — Stormont Watch',
    description: 'All current MLAs ranked by total questions tabled in the Northern Ireland Assembly.',
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/questions' },
}

export default async function QuestionsPage() {
  const [questionTotals, allCurrentMembers, ministerRows] = await Promise.all([
    getQuestionTotalsAllMembers(),
    getAllMembers(),
    getAllMinisters(),
  ])

  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const ministerIds = new Set(ministerRows.map(m => m.personId))

  const rows = questionTotals
    .map(r => {
      const m = memberMap.get(r.personId)
      if (!m) return null
      if (m.assemblyRole || ministerIds.has(r.personId)) return null
      return {
        personId: r.personId,
        fullName: m.fullName,
        party: m.party,
        constituency: m.constituency,
        imgUrl: m.imgUrl,
        total: Number(r.total),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href="/assembly/stats">Stats</Link></li>
            <li aria-current="page">MLA questions</li>
          </ol>
        </nav>
        <h1>MLA questions</h1>
        <p className="lede">Questions tabled by every current MLA since the 2022 mandate. Excludes presiding officers. Data sourced from the NI Assembly.</p>
      </header>

      <QuestionsRankingClient rows={rows} totalMlaCount={rows.length} />
    </div>
  )
}
