export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { getCompareData } from '@/lib/db/queries/compare'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import CompareClient from './CompareClient'
import styles from './compare.module.css'

export const metadata: Metadata = {
  title: 'Compare MLAs',
  description: 'Put two MLAs side by side: how often they vote the same way, and how they compare on attendance, questions, speaking and expenses.',
  openGraph: {
    title: 'Compare MLAs - Stormont Watch',
    description: 'Put two MLAs side by side: how often they vote the same way, and how they compare on attendance, questions, speaking and expenses.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/mlas/compare' },
}

export default async function CompareMlasPage() {
  const data = await getCompareData(CURRENT_MANDATE.id)
  return (
    <div className={styles.page}>
      <CompareClient data={data} mandateLabel={CURRENT_MANDATE.label} />
    </div>
  )
}
