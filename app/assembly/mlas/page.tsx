export const dynamic = 'force-static'

import type { Metadata } from 'next'
import MlasPageBody from './MlasPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLAs',
  description: 'All current Members of the Northern Ireland Legislative Assembly. View voting records, expenses and registered interests for every MLA.',
  openGraph: {
    title: 'MLAs — Stormont Watch',
    description: 'All current Members of the Northern Ireland Legislative Assembly. View voting records, expenses and registered interests for every MLA.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/mlas' },
}

export default function MlasPage() {
  return <MlasPageBody mandate={CURRENT_MANDATE} basePath="" />
}
