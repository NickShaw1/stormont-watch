export const dynamic = 'force-static'

import type { Metadata } from 'next'
import ExpensesPageBody from './ExpensesPageBody'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'

export const metadata: Metadata = {
  title: 'MLA Expenses',
  description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
  openGraph: {
    title: 'MLA Expenses — Stormont Watch',
    description: 'All current MLAs ranked by total expenses claimed from the Northern Ireland Assembly.',
    images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
  },
  alternates: { canonical: 'https://www.stormontwatch.com/assembly/expenses' },
}

export default function ExpensesPage() {
  return <ExpensesPageBody mandate={CURRENT_MANDATE} basePath="" />
}
