export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import StructurePageBody from '@/app/assembly/structure/StructurePageBody'

const mandate = mandateById('2027-2032')!

export const metadata: Metadata = {
  title: `Assembly Structure - ${mandate.label} archive`,
  description: `The Executive, presiding officers, departments and committee chairs of the Northern Ireland Assembly during the ${mandate.label} mandate.`,
}

export default function ArchiveStructurePage() {
  return <StructurePageBody mandate={mandate} />
}
