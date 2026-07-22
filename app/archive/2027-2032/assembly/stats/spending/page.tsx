export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import SpendingPageBody from '@/app/assembly/stats/spending/SpendingPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Spending - Stats - ${mandate.label} archive`,
  description: `Salaries, office expenses and overall public cost of the Northern Ireland Assembly since ${mandate.startLabel}.`,
}

export default function ArchiveSpendingPage() {
  return <SpendingPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
