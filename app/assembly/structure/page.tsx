export const dynamic = 'force-static'

import type { Metadata } from 'next'
import StructurePageBody from './StructurePageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'Assembly Structure',
  description: 'The Executive, presiding officers, departments and committee chairs of the Northern Ireland Assembly.',
  openGraph: {
    title: 'Assembly Structure — Stormont Watch',
    description: 'The Executive, presiding officers, departments and committee chairs of the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/structure' },
}

export default function StructurePage() {
  return <StructurePageBody mandate={CURRENT_MANDATE} />
}
