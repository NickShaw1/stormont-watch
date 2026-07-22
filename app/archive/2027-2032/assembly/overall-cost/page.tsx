export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import OverallCostPageBody from '@/app/assembly/overall-cost/OverallCostPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `MLA Overall Cost - ${mandate.label} archive`,
  description: `MLA overall public cost during the ${mandate.label} mandate.`,
}

export default function ArchiveOverallCostPage() {
  return <OverallCostPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
