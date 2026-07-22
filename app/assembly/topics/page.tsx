export const dynamic = 'force-static'

import type { Metadata } from 'next'
import TopicsPageBody from './TopicsPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Topics',
  description: `All current MLAs ranked by debate topics spoken on since the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
  openGraph: {
    title: 'MLA Topics - Stormont Watch',
    description: `All current MLAs ranked by debate topics spoken on since the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/topics' },
}

export default function TopicsPage() {
  return <TopicsPageBody mandate={CURRENT_MANDATE} basePath="" />
}
