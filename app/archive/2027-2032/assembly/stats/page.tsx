export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import StatsPageBody from '@/app/assembly/stats/StatsPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Stats - ${mandate.label} archive`,
  description: `Voting, attendance, spending and participation across the ${mandate.label} Northern Ireland Assembly mandate.`,
}

export default function ArchiveStatsPage() {
  return <StatsPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
