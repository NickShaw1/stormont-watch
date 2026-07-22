export const dynamic = 'force-static'

import type { Metadata } from 'next'
import BillsPageBody from './BillsPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export type { BillItem } from './BillsPageBody'

export const metadata: Metadata = {
  title: 'Legislation',
  description: `Browse all bills and acts in the Northern Ireland Assembly since the ${CURRENT_MANDATE.label} mandate. Track legislation from introduction through to Royal Assent.`,
  openGraph: {
    title: 'Legislation — Stormont Watch',
    description: `Browse all bills and acts in the Northern Ireland Assembly since the ${CURRENT_MANDATE.label} mandate. Track legislation from introduction through to Royal Assent.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/bills' },
}

export default function BillsPage() {
  return <BillsPageBody mandate={CURRENT_MANDATE} basePath="" />
}
