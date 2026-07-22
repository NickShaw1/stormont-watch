export const dynamic = 'force-static'

import type { Metadata } from 'next'
import QuestionsPageBody from './QuestionsPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Questions',
  description: 'All current MLAs ranked by total questions tabled in the Northern Ireland Assembly.',
  openGraph: {
    title: 'MLA Questions — Stormont Watch',
    description: 'All current MLAs ranked by total questions tabled in the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/questions' },
}

export default function QuestionsPage() {
  return <QuestionsPageBody mandate={CURRENT_MANDATE} basePath="" />
}
