export const dynamic = 'force-static'

import type { Metadata } from 'next'
import SalariesPageBody from './SalariesPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Salaries',
  description: 'All current MLAs ranked by salary and mandate earnings.',
  openGraph: {
    title: 'MLA Salaries — Stormont Watch',
    description: 'All current MLAs ranked by salary and mandate earnings.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/salaries' },
}

export default function SalariesPage() {
  return <SalariesPageBody mandate={CURRENT_MANDATE} basePath="" />
}
