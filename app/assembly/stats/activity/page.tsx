export const dynamic = 'force-static'

import type { Metadata } from 'next'
import ActivityPageBody from './ActivityPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Activity - Stats',
  description: `Questions to ministers and chamber participation across the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
  openGraph: {
    title: 'Activity - Stormont Watch',
    description: `Questions to ministers and chamber participation across the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/stats/activity' },
}

export default function ActivityPage() {
  return <ActivityPageBody mandate={CURRENT_MANDATE} basePath="" />
}
