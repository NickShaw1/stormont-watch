export const dynamic = 'force-static'

import type { Metadata } from 'next'
import VotesPageBody from './VotesPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Votes',
  description: `Every recorded division in the Northern Ireland Assembly since the ${CURRENT_MANDATE.label} mandate. Search and filter by date, outcome and subject.`,
  openGraph: {
    title: 'Votes — Stormont Watch',
    description: `Every recorded division in the Northern Ireland Assembly since the ${CURRENT_MANDATE.label} mandate. Search and filter by date, outcome and subject.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/votes' },
}

export default function VotesPage() {
  return <VotesPageBody mandate={CURRENT_MANDATE} basePath="" />
}
