export const dynamic = 'force-static'

import type { Metadata } from 'next'
import ConstituenciesPageBody from './ConstituenciesPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

const description = `All 18 Northern Ireland constituencies and the MLAs who have held their seats in the ${CURRENT_MANDATE.label} mandate, current and former, with attendance, questions and expenses.`

export const metadata: Metadata = {
  title: 'Constituencies',
  description,
  openGraph: {
    title: 'Constituencies - Stormont Watch',
    description,
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/constituencies' },
}

export default function ConstituenciesPage() {
  return <ConstituenciesPageBody mandate={CURRENT_MANDATE} basePath="" />
}
