export const dynamic = 'force-static'

import type { Metadata } from 'next'
import StatsPageBody from './StatsPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Stats',
  description: `Voting, attendance, spending and participation across the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
  openGraph: {
    title: 'Stats — Stormont Watch',
    description: `Voting, attendance, spending and participation across the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats' },
}

export default function StatsPage() {
  return <StatsPageBody mandate={CURRENT_MANDATE} basePath="" />
}
