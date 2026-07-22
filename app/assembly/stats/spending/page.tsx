export const dynamic = 'force-static'

import type { Metadata } from 'next'
import SpendingPageBody from './SpendingPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Spending - Stats',
  description: `Salaries, office expenses and overall public cost of the Northern Ireland Assembly since ${CURRENT_MANDATE.startLabel}.`,
  openGraph: {
    title: 'Spending - Stormont Watch',
    description: `Salaries, office expenses and overall public cost of the Northern Ireland Assembly since ${CURRENT_MANDATE.startLabel}.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats/spending' },
}

export default function SpendingPage() {
  return <SpendingPageBody mandate={CURRENT_MANDATE} basePath="" />
}
