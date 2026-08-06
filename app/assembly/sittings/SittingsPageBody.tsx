import { Mic2 } from 'lucide-react'
import { getHansardAllByMLA } from '@/lib/db/queries'
import HansardRankingClient from './HansardRankingClient'
import StatsBreadcrumb from '../stats/StatsBreadcrumb'
import styles from './hansard-ranking.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
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
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="MLA sittings" basePath={basePath} />
        <span className={styles.pageHeaderEyebrow}>Rankings</span>
        <h1 className={styles.pageHeaderTitle}>
          <Mic2 className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          MLA sittings
        </h1>
        <p className={styles.lede}>Plenary sittings spoken in by every {sittingAdjective(mandate)} MLA since the {mandate.label} mandate began. Excludes presiding officers. Data sourced from Hansard.</p>
      </header>

      <HansardRankingClient rows={rows} metric="sittings" totalMlaCount={rows.length} />
    </div>
  )
}
