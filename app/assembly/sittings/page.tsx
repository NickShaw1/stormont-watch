export const dynamic = 'force-static'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getHansardAllByMLA } from '@/lib/db/queries'
import HansardRankingClient from './HansardRankingClient'

export const metadata: Metadata = {
  title: 'MLA Sittings',
  description: 'All current MLAs ranked by plenary sittings spoken in since the 2022 Northern Ireland Assembly mandate.',
  openGraph: {
    title: 'MLA Sittings - Stormont Watch',
    description: 'All current MLAs ranked by plenary sittings spoken in since the 2022 Northern Ireland Assembly mandate.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/sittings' },
}

export default async function SittingsPage() {
  const raw = await getHansardAllByMLA()

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
            <li><Link href="/assembly/stats">Statistics</Link></li>
            <li aria-current="page">MLA sittings</li>
          </ol>
        </nav>
        <h1>MLA sittings</h1>
        <p className="lede">Plenary sittings spoken in by every <strong>current MLA</strong> since the 2022 mandate. Excludes presiding officers. Data sourced from Hansard.</p>
      </header>

      <HansardRankingClient rows={rows} metric="sittings" totalMlaCount={rows.length} />
    </div>
  )
}
