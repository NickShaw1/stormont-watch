export const dynamic = 'force-static'

import type { Metadata } from 'next'
import OverallCostPageBody from './OverallCostPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Overall Cost',
  description: `Every ${CURRENT_MANDATE.label} MLA, current and former, ranked by estimated salary plus all published expenses.`,
  openGraph: {
    title: 'MLA Overall Cost - Stormont Watch',
    description: `Every ${CURRENT_MANDATE.label} MLA, current and former, ranked by estimated salary plus all published expenses.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/overall-cost' },
}

export default function OverallCostPage() {
  return <OverallCostPageBody mandate={CURRENT_MANDATE} basePath="" />
}
