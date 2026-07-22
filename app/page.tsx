export const dynamic = 'force-static'

import type { Metadata } from 'next'
import HomePageBody from './HomePageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Stormont Watch',
  description: `Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the ${CURRENT_MANDATE.label} mandate.`,
  openGraph: {
    title: 'Stormont Watch',
    description: `Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly. See how your MLA votes, explore the full voting record and follow legislation since the ${CURRENT_MANDATE.label} mandate.`,
    url: 'https://www.stormontwatch.com',
    images: [
      {
        url: 'https://www.stormontwatch.com/opengraph-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'Stormont Watch — NI Assembly Transparency',
      },
    ],
  },
  alternates: { canonical: 'https://www.stormontwatch.com' },
}

export default function HomePage() {
  return <HomePageBody mandate={CURRENT_MANDATE} basePath="" />
}
