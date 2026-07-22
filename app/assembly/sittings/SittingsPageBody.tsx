import Link from 'next/link'
import { getHansardAllByMLA } from '@/lib/db/queries'
import HansardRankingClient from './HansardRankingClient'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

/**
 * Shared body for the sittings page — rendered by both the live route (current mandate,
 * basePath '') and the archive route (`/archive/<id>`). `mandate` drives the queries
 * and copy; `basePath` prefixes internal links.
 */
export default async function SittingsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const raw = await getHansardAllByMLA(mandate.id)

  const rows = raw.map(r => ({
    personId: r.personId,
    fullName: r.fullName,
    party: r.party,
    constituency: r.constituency,
    imgUrl: r.imgUrl,
    sittings: Number(r.sittings),
    debates: Number(r.debates),
  })).sort((a, b) => b.sittings - a.sittings)

  return (
    <div className="container">
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={`${basePath}/assembly/stats`}>Statistics</Link></li>
            <li aria-current="page">MLA sittings</li>
          </ol>
        </nav>
        <h1>MLA sittings</h1>
        <p className="lede">Plenary sittings spoken in by every <strong>{sittingAdjective(mandate)} MLA</strong> since the {mandate.label} mandate began. Excludes presiding officers. Data sourced from Hansard.</p>
      </header>

      <HansardRankingClient rows={rows} metric="sittings" totalMlaCount={rows.length} />
    </div>
  )
}
