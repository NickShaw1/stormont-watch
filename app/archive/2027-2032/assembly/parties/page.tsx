export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import PartiesPageBody from '@/app/assembly/parties/PartiesPageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Parties - ${mandate.label} archive`,
  description: `Every political party in the Northern Ireland Assembly during the ${mandate.label} mandate.`,
}

export default function ArchivePartiesPage() {
  return <PartiesPageBody mandate={mandate} />
}
