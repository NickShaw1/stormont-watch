export const dynamic = 'force-static'

import type { Metadata } from 'next'
import PartiesPageBody from './PartiesPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'


export const metadata: Metadata = {
  title: 'Parties',
  description: `Every political party in the Northern Ireland Assembly — voting records, attendance, party cohesion, expenses and MLA profiles for the ${CURRENT_MANDATE.label} mandate.`,
  openGraph: {
    title: 'Parties — Stormont Watch',
    description: `Every political party in the Northern Ireland Assembly — voting records, attendance, party cohesion, expenses and MLA profiles for the ${CURRENT_MANDATE.label} mandate.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/parties' },
}

export default function PartiesPage() {
  return <PartiesPageBody mandate={CURRENT_MANDATE} basePath="" />
}
