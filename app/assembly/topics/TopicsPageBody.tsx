import HansardRankingPage from '../stats/HansardRankingPage'
import type { Mandate } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default function TopicsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  return <HansardRankingPage mandate={mandate} metric="debates" basePath={basePath} />
}
