export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import BillsPageBody from '@/app/assembly/bills/BillsPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Legislation - ${mandate.label} archive`,
  description: `Bills and acts in the Northern Ireland Assembly during the ${mandate.label} mandate.`,
}

export default function ArchiveBillsPage() {
  return <BillsPageBody mandate={mandate} basePath="/archive/2027-2032" />
}
