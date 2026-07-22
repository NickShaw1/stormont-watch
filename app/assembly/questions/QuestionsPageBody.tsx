import Link from 'next/link'
import { getQuestionTotalsAllMembers, getAllMembers, getAllMinisters } from '@/lib/db/queries'
import QuestionsRankingClient from './QuestionsRankingClient'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

/**
 * Shared body for the questions page — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function QuestionsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [questionTotals, allCurrentMembers, ministerRows] = await Promise.all([
    getQuestionTotalsAllMembers(mandate.id),
    getAllMembers(mandate.id),
    getAllMinisters(mandate.id),
  ])

  const memberMap = new Map(allCurrentMembers.map(m => [m.personId, m]))
  const ministerIds = new Set(ministerRows.map(m => m.personId))

  const rows = questionTotals
    .map(r => {
      const m = memberMap.get(r.personId)
      if (!m) return null
      if (m.assemblyRole === 'Speaker' || ministerIds.has(r.personId)) return null
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
            <li><Link href={`${basePath}/assembly/stats`}>Statistics</Link></li>
            <li aria-current="page">MLA questions</li>
          </ol>
        </nav>
        <h1>MLA questions</h1>
        <p className="lede">Questions tabled by every <strong>{sittingAdjective(mandate)} MLA</strong> since the {mandate.label} mandate began. Excludes current ministers and the Speaker. Data sourced from the NI Assembly.</p>
      </header>

      <QuestionsRankingClient rows={rows} totalMlaCount={rows.length} />
    </div>
  )
}
