export const dynamic = 'force-static'

import type { Metadata } from 'next'
import SittingsPageBody from './SittingsPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Sittings',
  description: `All current MLAs ranked by plenary sittings spoken in since the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
  openGraph: {
    title: 'MLA Sittings - Stormont Watch',
    description: `All current MLAs ranked by plenary sittings spoken in since the ${CURRENT_MANDATE.label} Northern Ireland Assembly mandate.`,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/sittings' },
}

export default function SittingsPage() {
  return <SittingsPageBody mandate={CURRENT_MANDATE} basePath="" />
}
