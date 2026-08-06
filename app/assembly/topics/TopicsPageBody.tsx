import { Mic2 } from 'lucide-react'
import { getHansardAllByMLA } from '@/lib/db/queries'
import HansardRankingClient from '../sittings/HansardRankingClient'
import StatsBreadcrumb from '../stats/StatsBreadcrumb'
import styles from '../sittings/hansard-ranking.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function TopicsPageBody({
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
  })).sort((a, b) => b.debates - a.debates)

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="MLA topics" basePath={basePath} />
        <span className={styles.pageHeaderEyebrow}>Rankings</span>
        <h1 className={styles.pageHeaderTitle}>
          <Mic2 className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          MLA topics
        </h1>
        <p className={styles.lede}>Debate topics spoken on by every {sittingAdjective(mandate)} MLA since the {mandate.label} mandate began. Excludes presiding officers. Data sourced from Hansard.</p>
      </header>

      <HansardRankingClient rows={rows} metric="debates" totalMlaCount={rows.length} />
    </div>
  )
}
