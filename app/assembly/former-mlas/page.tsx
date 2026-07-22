export const dynamic = 'force-static'

import type { Metadata } from 'next'
import FormerMlasPageBody from './FormerMlasPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'


export const metadata: Metadata = {
  title: 'Former MLAs',
  description: 'Members of the Legislative Assembly who left during the current mandate.',
  openGraph: {
    title: 'Former MLAs — Stormont Watch',
    description: 'Members of the Legislative Assembly who left during the current mandate.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/former-mlas' },
}

export default function FormerMlasPage() {
  return <FormerMlasPageBody mandate={CURRENT_MANDATE} basePath="" />
}
