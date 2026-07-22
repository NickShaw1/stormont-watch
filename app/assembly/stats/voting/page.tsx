export const dynamic = 'force-static'

import type { Metadata } from 'next'
import VotingPageBody from './VotingPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Voting - Stats',
  description: `How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since ${CURRENT_MANDATE.startLabel}.`,
  openGraph: {
    title: 'Voting - Stormont Watch',
    description: `How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since ${CURRENT_MANDATE.startLabel}.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats/voting' },
}

export default function VotingPage() {
  return <VotingPageBody mandate={CURRENT_MANDATE} basePath="" />
}
