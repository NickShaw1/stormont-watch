export const dynamic = 'force-static'

import type { Metadata } from 'next'
import ConstituencyStatsBody from './ConstituencyStatsBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

const description = `Every Northern Ireland constituency ranked on attendance, questions, expenses, expenses per seat, MLAs who have left and a fun overall score across the ${CURRENT_MANDATE.label} mandate.`

export const metadata: Metadata = {
  title: 'Constituencies - Stats',
  description,
  openGraph: {
    title: 'Constituency Rankings - Stormont Watch',
    description,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats/constituencies' },
}

export default function ConstituencyStatsPage() {
  return <ConstituencyStatsBody mandate={CURRENT_MANDATE} basePath="" />
}
